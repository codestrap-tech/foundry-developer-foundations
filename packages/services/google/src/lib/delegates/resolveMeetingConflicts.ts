import {
  ResolveMeetingConflictsInput,
  ResolveMeetingConflictsOutput,
  ConflictingMeeting,
  LLMRescheduleProposal,
  ConflictResolutionReport,
} from '@codestrap/developer-foundations-types';
import { summarizeCalendars } from '../delegates/summerizeCalanders';
import {
  readConflictResolutionRulesForUser,
  geminiService,
} from '@codestrap/developer-foundations-services-palantir';
import { calendar_v3, google } from 'googleapis';
import { toUTCFromWallClockLocal } from '@codestrap/developer-foundations-utils';

/**
 * Minimal conflict detection (time overlap + attendee overlap) and orchestration:
 * - fetch calendars for day
 * - detect conflicts (group sets)
 * - fetch user rules
 * - call LLM (geminiService) to propose reschedules
 * - validate proposals with freebusy
 * - ask for confirmation via optional confirm callback
 * - perform updates via calendar.events.update
 *
 * Note: This is intentionally pure-ish and uses Promise.all for concurrency.
 */

type CalendarSummary = {
  email: string;
  events: {
    id: string;
    subject: string;
    description?: string;
    start: string;
    end: string;
    participants: string[];
    durationMinutes: number;
  }[];
};

function isoOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

function toConflictingMeeting(evt: any): ConflictingMeeting {
  return {
    id: evt.id,
    title: evt.subject,
    description: evt.description,
    organizer: evt.participants?.[0] ?? 'unknown',
    attendees: (evt.participants ?? []).map((e: string) => ({
      email: e,
      role: 'required',
    })),
    startTime: evt.start,
    endTime: evt.end,
    durationMinutes: evt.durationMinutes,
    location: undefined,
  };
}

export async function resolveMeetingConflictsDelegate(args: {
  calendarClient: calendar_v3.Calendar;
  userEmails: string[];
  timezone: string;
  windowStartLocal: Date;
  windowEndLocal: Date;
  confirm?: (summary: any) => Promise<boolean>;
}): Promise<ResolveMeetingConflictsOutput> {
  const {
    calendarClient,
    userEmails,
    timezone,
    windowStartLocal,
    windowEndLocal,
    confirm,
  } = args;

  const timeMin = toUTCFromWallClockLocal(
    windowStartLocal,
    timezone
  ).toISOString();
  const timeMax = toUTCFromWallClockLocal(
    windowEndLocal,
    timezone
  ).toISOString();

  // fetch calendars in parallel
  const summaries = await summarizeCalendars({
    calendar: calendarClient,
    emails: userEmails,
    timezone,
    windowStartLocal,
    windowEndLocal,
  });

  const calendars = summaries.calendars as CalendarSummary[];

  // flatten events with owner info
  const allEvents = calendars.flatMap((c) =>
    c.events.map((e) => ({ ...e, owner: c.email }))
  );

  // detect conflicts: pairwise compare and build sets
  const conflictSets: Map<string, ConflictingMeeting[]> = new Map();

  allEvents.forEach((evt, idx) => {
    const conflicts = allEvents
      .filter((other, jdx) => idx !== jdx)
      .filter(
        (other) =>
          isoOverlap(evt.start, evt.end, other.start, other.end) &&
          other.participants.some((p) => (evt.participants ?? []).includes(p))
      );

    if (conflicts.length > 0) {
      const key = [evt.id, ...conflicts.map((c) => c.id)].sort().join('|');
      const set = [evt, ...conflicts].map(toConflictingMeeting);
      conflictSets.set(key, set);
    }
  });

  // dedupe sets (they are keyed by sorted ids)
  const conflictArrays = Array.from(conflictSets.values());

  // fetch rules per involved user (unique emails)
  const involvedUsers = Array.from(
    new Set(
      allEvents
        .flatMap((e) => e.participants)
        .concat(allEvents.map((e) => e.owner))
    )
  );
  const rulesMap = new Map(
    await Promise.all(
      involvedUsers.map(async (u): Promise<[string, string[]]> => {
        try {
          const r = await readConflictResolutionRulesForUser(u);
          return [u, r] as const;
        } catch (err) {
          console.error(
            `Error reading conflict resolution rules for user ${u}: ${err}`
          );
          return [u, []] as const;
        }
      })
    )
  );

  // For each conflict set, call LLM to propose
  const llmPromises = conflictArrays.map(async (set) => {
    const payload = {
      conflictSet: set,
      rules: Array.from(
        new Set(set.flatMap((m) => m.attendees.map((a) => a.email)))
      ).map((email) => ({ email, rules: rulesMap.get(email) ?? [] })),
      fullDay: calendars,
    };

    // call LLM (geminiService) - expect JSON string back
    const llmRaw = await geminiService('system', JSON.stringify(payload), {
      extractJsonString: true,
    } as any).catch((e) => {
      throw new Error('LLMProcessingError: ' + (e?.message ?? String(e)));
    });

    // try parse as JSON
    let proposal: LLMRescheduleProposal | null = null;
    try {
      proposal = JSON.parse(llmRaw) as LLMRescheduleProposal;
    } catch {
      // fallback: attempt to find JSON inside string
      const m = llmRaw.match(/\{[\s\S]*\}/);
      if (m) {
        proposal = JSON.parse(m[0]) as LLMRescheduleProposal;
      }
    }
    if (!proposal) throw new Error('LLMProcessingError: invalid response');

    return { set, proposal };
  });

  const llmResults = await Promise.allSettled(llmPromises);

  const resolutionReports: ConflictResolutionReport[] = [];
  const errors: string[] = [];

  // Validate proposals using freebusy queries in parallel
  const toUpdate: Array<{
    originalEvent: ConflictingMeeting;
    proposed: { start: string; end: string };
    proposalRaw?: LLMRescheduleProposal;
  }> = [];

  llmResults.forEach((res) => {
    if (res.status === 'rejected') {
      errors.push(res.reason?.message ?? 'LLM failed');
      return;
    }
    const { set, proposal } = res.value!;
    // validate each meeting in proposal
    (proposal.meetingsToReschedule ?? []).forEach((m) => {
      const original = set.find((s) => s.id === m.meetingId);
      if (!original) {
        resolutionReports.push({
          meetingId: m.meetingId,
          originalStartTime: '',
          originalEndTime: '',
          status: 'invalid_proposal',
          reason: 'Meeting id not found in conflict set',
          llmProposal: proposal,
        });
        return;
      }
      // basic validation: preserve duration
      const origDur =
        (new Date(original.endTime).getTime() -
          new Date(original.startTime).getTime()) /
        60000;
      const newDur =
        (new Date(m.newEndTime).getTime() -
          new Date(m.newStartTime).getTime()) /
        60000;
      if (Math.abs(origDur - newDur) > 15) {
        resolutionReports.push({
          meetingId: original.id,
          originalStartTime: original.startTime,
          originalEndTime: original.endTime,
          status: 'invalid_proposal',
          reason: 'Duration change too large',
          llmProposal: proposal,
        });
        return;
      }
      // enqueue for freebusy validation
      toUpdate.push({
        originalEvent: original,
        proposed: { start: m.newStartTime, end: m.newEndTime },
        proposalRaw: proposal,
      });
    });
  });

  // Build freebusy request items
  const freeBusyReq = {
    timeMin: toUpdate.length
      ? toUpdate.map((t) => t.proposed.start).reduce((a, b) => (a < b ? a : b))
      : timeMin,
    timeMax: toUpdate.length
      ? toUpdate.map((t) => t.proposed.end).reduce((a, b) => (a > b ? a : b))
      : timeMax,
    items: Array.from(
      new Set(
        toUpdate.flatMap((t) => t.originalEvent.attendees.map((a) => a.email))
      )
    ).map((email) => ({ id: email })),
  };

  // If no updates to validate, return early
  if (toUpdate.length === 0) {
    return {
      identifiedConflicts: conflictArrays.flat(),
      resolutionReports,
      summary: {
        totalConflicts: conflictArrays.flat().length,
        successfullyRescheduled: 0,
        failedToReschedule: resolutionReports.filter(
          (r) => r.status === 'failed_reschedule'
        ).length,
        noActionTaken: resolutionReports.filter(
          (r) => r.status === 'no_action_taken'
        ).length,
      },
      errors: errors.length ? errors : undefined,
    };
  }

  // call freebusy
  const fbRes = await calendarClient.freebusy
    .query({
      requestBody: {
        timeMin: freeBusyReq.timeMin,
        timeMax: freeBusyReq.timeMax,
        items: freeBusyReq.items,
      },
    })
    .catch((e) => {
      throw new Error('GoogleCalendarAPIError: freebusy query failed');
    });

  const busyMap = new Map(
    (fbRes.data.calendars ? Object.entries(fbRes.data.calendars) : []).map(
      ([k, v]) => [
        k,
        (v.busy ?? []).map((b: any) => ({ start: b.start, end: b.end })),
      ]
    )
  );

  // validate no conflicts for proposed slots
  toUpdate.forEach((u) => {
    const attendees = u.originalEvent.attendees.map((a) => a.email);
    const conflictFound = attendees.some((email) => {
      const busy = busyMap.get(email) ?? [];
      return busy.some((b: any) =>
        isoOverlap(u.proposed.start, u.proposed.end, b.start, b.end)
      );
    });
    if (conflictFound) {
      resolutionReports.push({
        meetingId: u.originalEvent.id,
        originalStartTime: u.originalEvent.startTime,
        originalEndTime: u.originalEvent.endTime,
        status: 'invalid_proposal',
        reason: 'Proposed time introduces conflicts for attendees',
        llmProposal: u.proposalRaw,
      });
      return;
    }
    // otherwise mark as candidate
    resolutionReports.push({
      meetingId: u.originalEvent.id,
      originalStartTime: u.originalEvent.startTime,
      originalEndTime: u.originalEvent.endTime,
      proposedNewStartTime: u.proposed.start,
      proposedNewEndTime: u.proposed.end,
      status: 'no_action_taken', // will change if user confirms & update succeeds
      llmProposal: u.proposalRaw,
    });
  });

  // Ask user confirmation if provided
  const candidates = resolutionReports.filter(
    (r) => r.status === 'no_action_taken'
  );
  let userConfirmed = true;
  if (confirm && candidates.length) {
    userConfirmed = await confirm({
      summary: {
        totalProposals: candidates.length,
        proposals: candidates.map((c) => ({
          meetingId: c.meetingId,
          from: c.originalStartTime,
          to: c.proposedNewStartTime,
        })),
      },
    }).catch(() => false);
  }

  if (!userConfirmed) {
    // mark as no action taken
    resolutionReports.forEach((r) => {
      if (r.status === 'no_action_taken') {
        r.status = 'no_action_taken';
        r.reason = 'User declined proposed reschedule';
      }
    });

    return {
      identifiedConflicts: conflictArrays.flat(),
      resolutionReports,
      summary: {
        totalConflicts: conflictArrays.flat().length,
        successfullyRescheduled: 0,
        failedToReschedule: 0,
        noActionTaken: resolutionReports.filter(
          (r) => r.status === 'no_action_taken'
        ).length,
      },
      errors: errors.length ? errors : undefined,
    };
  }

  // perform calendar updates in parallel with retry/backoff (up to 3)
  const updatePromises = resolutionReports
    .filter((r) => r.status === 'no_action_taken' && r.proposedNewStartTime)
    .map(async (r) => {
      const original = toUpdate.find((t) => t.originalEvent.id === r.meetingId);
      if (!original) {
        r.status = 'failed_reschedule';
        r.reason = 'Original event not found in update queue';
      } else {
        const maxRetries = 3;
        let attempt = 0;
        let updateSucceeded = false;

        while (attempt < maxRetries && !updateSucceeded) {
          try {
            await calendarClient.events.update({
              calendarId:
                original.originalEvent?.organizer ??
                original.originalEvent.attendees[0]?.email ??
                'primary',
              eventId: original.originalEvent.id,
              sendUpdates: 'all',
              requestBody: {
                start: { dateTime: r.proposedNewStartTime },
                end: { dateTime: r.proposedNewEndTime },
              },
            } as any);
            r.status = 'rescheduled';
            r.reason = 'LLM proposed new time, validated and updated.';
            updateSucceeded = true;
          } catch (err) {
            attempt += 1;
            // simple exponential backoff
            await new Promise((res) =>
              setTimeout(res, 250 * Math.pow(2, attempt))
            );
            if (attempt >= maxRetries) {
              r.status = 'failed_reschedule';
              r.reason = `Calendar update failed after ${maxRetries} attempts`;
            }
          }
        }

        // Fallback: if we exited the loop without success and status wasn't set
        if (!updateSucceeded && r.status === 'no_action_taken') {
          r.status = 'failed_reschedule';
          r.reason = `Calendar update failed after ${maxRetries} attempts`;
        }
      }

      return r;
    });

  const finalResults = await Promise.allSettled(updatePromises);
  // ensure resolutionReports reflect any updates from promises (they mutate r)
  // compile final summary
  const successfullyRescheduled = resolutionReports.filter(
    (r) => r.status === 'rescheduled'
  ).length;
  const failedToReschedule = resolutionReports.filter(
    (r) => r.status === 'failed_reschedule'
  ).length;
  const noActionTaken = resolutionReports.filter(
    (r) => r.status === 'no_action_taken'
  ).length;

  return {
    identifiedConflicts: conflictArrays.flat(),
    resolutionReports,
    summary: {
      totalConflicts: conflictArrays.flat().length,
      successfullyRescheduled,
      failedToReschedule,
      noActionTaken,
    },
    errors: errors.length ? errors : undefined,
  };
}
