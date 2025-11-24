import {
  ConflictingMeeting,
  LLMRescheduleProposal,
  ConflictResolutionReport,
  CalendarSummary,
  IdentifyMeetingConflictsOutput,
  ProposeMeetingConflictResolutionsOutput,
} from '@codestrap/developer-foundations-types';
import { summarizeCalendars } from '../delegates/summerizeCalanders';
import {
  readConflictResolutionRulesForUser,
  geminiService,
} from '@codestrap/developer-foundations-services-palantir';
import { calendar_v3 } from 'googleapis';

/**
 * Unified meeting conflict resolution delegates.
 * This file combines functionality from identifyMeetingConflicts and proposeMeetingConflictResolutions.
 */

type CalendarSummaryInternal = {
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

export interface IdentifyMeetingConflictsDelegateArgs {
  calendarClient: calendar_v3.Calendar;
  userEmails: string[];
  timezone: string;
  windowStartLocal: Date;
  windowEndLocal: Date;
}


export interface ProposeMeetingConflictResolutionsDelegateArgs {
  calendarClient: calendar_v3.Calendar;
  userEmails: string[];
  timezone: string;
  windowStartLocal: Date;
  windowEndLocal: Date;
  identifiedConflicts?: ConflictingMeeting[];
  fullDayCalendars?: CalendarSummary[];
}

function isoOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

function toConflictingMeeting(evt: {
  id: string;
  subject: string;
  description?: string;
  start: string;
  end: string;
  participants: string[];
  durationMinutes: number;
  owner?: string;
}): ConflictingMeeting {
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

/**
 * Detect participant-based meeting conflicts
 * Filters events to only those where ALL userEmails are participants,
 * then finds time overlaps between those filtered events.
 */
type ConflictEvent = {
  id: string;
  subject: string;
  description?: string;
  start: string;
  end: string;
  participants: string[];
  durationMinutes: number;
  owner?: string;
};

function findMeetingConflicts(
  calendars: CalendarSummaryInternal[],
  userEmails: string[]
): Array<{ events: ConflictEvent[]; overlapStart: Date; overlapEnd: Date }> {
  const events = calendars.flatMap((c) => {
    return c.events.map((e) => ({ ...e, owner: c.email }));
  });

  const filterEmails = userEmails;
  const required = new Set(filterEmails);

  // Step 1: Filter events: must include ALL filterEmails
  const filteredEvents = events.filter((event) => {
    const participants = new Set(event.participants.concat(event.owner || []));
    for (const email of required) {
      if (!participants.has(email)) return false;
    }
    return true;
  });

  // Step 2: Sort events by start time
  filteredEvents.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const conflicts = [];

  // Step 3: Compare each pair for overlap
  for (let i = 0; i < filteredEvents.length; i++) {
    const a = filteredEvents[i];
    const startA = new Date(a.start);
    const endA = new Date(a.end);

    for (let j = i + 1; j < filteredEvents.length; j++) {
      const b = filteredEvents[j];
      const startB = new Date(b.start);
      const endB = new Date(b.end);

      // Early exit (list is sorted)
      if (startB >= endA) break;

      // Compute overlap
      const overlapStart = new Date(
        Math.max(startA.getTime(), startB.getTime())
      );
      const overlapEnd = new Date(Math.min(endA.getTime(), endB.getTime()));

      if (overlapStart < overlapEnd) {
        conflicts.push({
          events: [a, b],
          overlapStart,
          overlapEnd,
        });
      }
    }
  }

  return conflicts;
}


/**
 * Shared logic to detect conflicts from calendars or provided conflicts
 */
async function detectConflicts(
  calendarClient: calendar_v3.Calendar,
  userEmails: string[],
  timezone: string,
  windowStartLocal: Date,
  windowEndLocal: Date,
  providedConflicts?: ConflictingMeeting[],
  providedCalendars?: CalendarSummary[]
): Promise<{
  calendars: CalendarSummaryInternal[];
  conflictArrays: ConflictingMeeting[][];
}> {
  let calendars: CalendarSummaryInternal[] = [];

  // Use provided calendars if available, otherwise fetch them
  if (providedCalendars && providedCalendars.length > 0) {
    calendars = providedCalendars as CalendarSummaryInternal[];
  } else if (!providedConflicts || providedConflicts.length === 0) {
    // Fetch calendars if conflicts not provided
    const summaries = await summarizeCalendars({
      calendar: calendarClient,
      emails: userEmails,
      timezone,
      windowStartLocal,
      windowEndLocal,
    });
    calendars = summaries.calendars as CalendarSummaryInternal[];
  }

  let conflictArrays: ConflictingMeeting[][] = [];

  // If conflicts are already provided, use them
  if (providedConflicts && providedConflicts.length > 0) {
    // Group conflicts into sets (conflicts that share attendees are in the same set)
    const conflictSets: Map<string, ConflictingMeeting[]> = new Map();
    const processedIds = new Set<string>();

    providedConflicts.forEach((conflict) => {
      if (processedIds.has(conflict.id)) return;

      // Find all conflicts that overlap in time and share attendees with this one
      const conflictSet: ConflictingMeeting[] = [conflict];
      processedIds.add(conflict.id);

      providedConflicts.forEach((other) => {
        if (processedIds.has(other.id)) return;

        const hasTimeOverlap =
          new Date(conflict.startTime) < new Date(other.endTime) &&
          new Date(other.startTime) < new Date(conflict.endTime);

        const hasAttendeeOverlap = conflict.attendees.some((a) =>
          other.attendees.some((b) => a.email === b.email)
        );

        if (hasTimeOverlap && hasAttendeeOverlap) {
          conflictSet.push(other);
          processedIds.add(other.id);
        }
      });

      const key = conflictSet
        .map((c) => c.id)
        .sort()
        .join('|');
      conflictSets.set(key, conflictSet);
    });

    conflictArrays = Array.from(conflictSets.values());
  } else {
    // Detect conflicts using findMeetingConflicts logic
    const conflicts = findMeetingConflicts(calendars, userEmails);
    // Convert each conflict pair directly to a ConflictingMeeting array
    conflictArrays = conflicts.map((conflict) =>
      conflict.events.map((evt) => toConflictingMeeting(evt))
    );
  }

  return { calendars, conflictArrays };
}

/**
 * Identifies meeting conflicts without proposing or executing resolutions.
 */
export async function identifyMeetingConflictsDelegate(
  args: IdentifyMeetingConflictsDelegateArgs
): Promise<IdentifyMeetingConflictsOutput> {
  const {
    calendarClient,
    userEmails,
    timezone,
    windowStartLocal,
    windowEndLocal,
  } = args;

  const { conflictArrays } = await detectConflicts(
    calendarClient,
    userEmails,
    timezone,
    windowStartLocal,
    windowEndLocal
  );

  const allConflicts = conflictArrays.flat();
  const message =
    allConflicts.length === 0
      ? 'No meeting conflicts found'
      : `Found ${allConflicts.length} conflicting meeting(s) across ${conflictArrays.length} conflict set(s)`;

  return {
    identifiedConflicts: allConflicts,
    message,
  };
}

/**
 * Shared logic to generate proposals and validate them
 */
async function generateAndValidateProposals(
  calendarClient: calendar_v3.Calendar,
  conflictArrays: ConflictingMeeting[][],
  calendars: CalendarSummaryInternal[],
  windowStartLocal: Date,
  windowEndLocal: Date
): Promise<{
  resolutionReports: ConflictResolutionReport[];
  errors: string[];
  toUpdate: Array<{
    originalEvent: ConflictingMeeting;
    proposed: { start: string; end: string };
    proposalRaw?: LLMRescheduleProposal;
  }>;
}> {
  // fetch rules per involved user (unique emails)
  const involvedUsers = Array.from(
    new Set(
      conflictArrays
        .flat()
        .flatMap((c) => [
          ...c.attendees.map((a) => a.email),
          c.organizer,
        ])
        .filter(Boolean)
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

  // For each conflict set, call LLM to propose resolutions
  const llmPromises = conflictArrays.map(async (set) => {
    // Prepare data for LLM
    const attendeeEmails = Array.from(
        new Set(set.flatMap((m) => m.attendees.map((a) => a.email)))
    );
    const rulesForAttendees = attendeeEmails.map((email) => ({
      email,
      rules: rulesMap.get(email) ?? [],
    }));

    // Build system prompt explaining the assistant's role
    const systemPrompt = `You are an intelligent meeting conflict resolution assistant. Your role is to analyze meeting conflicts and propose rescheduling solutions that:
- Respect user-defined conflict resolution rules and preferences
- Avoid creating new conflicts with existing meetings
- Preserve meeting durations within acceptable bounds (within 15 minutes of original)
- Consider the full calendar context to find optimal time slots
- Minimize disruption to all attendees

You must respond with valid JSON only, following the exact schema specified in the user prompt.`;

    // Build user prompt with data and instructions
    const calendarContext =
      calendars.length > 0
        ? calendars.map((cal) => ({
            email: cal.email,
            events: cal.events.map((evt) => ({
              id: evt.id,
              subject: evt.subject,
              start: evt.start,
              end: evt.end,
              durationMinutes: evt.durationMinutes,
              participants: evt.participants,
            })),
          }))
        : undefined;

    const userPrompt = `Analyze the following meeting conflict set and propose rescheduling solutions.

TIME FRAME CONTEXT:
Consider only rescheduling options within the following local time window:
- windowStartLocal: ${windowStartLocal.toISOString()}
- windowEndLocal: ${windowEndLocal.toISOString()}

CONFLICT SET (meetings that overlap in time and share attendees):
${JSON.stringify(set, null, 2)}

USER RULES (conflict resolution preferences per attendee):
${JSON.stringify(rulesForAttendees, null, 2)}

${calendarContext
  ? `FULL DAY CALENDAR CONTEXT (all meetings for the period - use this to avoid creating new conflicts):
${JSON.stringify(calendarContext, null, 2)}

IMPORTANT: When proposing new times, ensure they do not conflict with any meetings shown in the full day calendar context above.`
  : ''}

INSTRUCTIONS:
1. Analyze the conflict set to understand which meetings overlap and share attendees
2. Review the user rules to understand preferences for each attendee
${calendarContext ? '3. Review the full day calendar context to identify available time slots that do not conflict with existing meetings' : '3. Identify available time slots that do not conflict with existing meetings'}
4. Propose new start and end times for meetings that should be rescheduled, keeping them within the provided time frame window
5. Preserve meeting durations (within 15 minutes of original duration)
6. Consider all attendees' schedules and preferences, and when relevant, prioritize minimizing disruption for the primary user described above

RESPONSE FORMAT:
You must respond with ONLY valid JSON in this exact format:
{
  "meetingsToReschedule": [
    {
      "meetingId": "string (meeting ID from conflict set)",
      "newStartTime": "ISO 8601 datetime string (e.g., 2025-03-15T10:00:00-07:00)",
      "newEndTime": "ISO 8601 datetime string (e.g., 2025-03-15T11:00:00-07:00)"
    }
  ]
}

Include only meetings that should be rescheduled. If no rescheduling is needed or possible, return an empty array for meetingsToReschedule.`;

    // Call LLM with structured prompts
    const llmRaw = await geminiService(userPrompt, systemPrompt).catch((e) => {
      throw new Error('LLMProcessingError: ' + (e?.message ?? String(e)));
    });

    // Parse JSON response with fallback extraction
    let proposal: LLMRescheduleProposal | null = null;
    try {
      proposal = JSON.parse(llmRaw) as LLMRescheduleProposal;
    } catch {
      // fallback: attempt to find JSON inside string (in case LLM adds extra text)
      try {
        const start = llmRaw.indexOf('{');
        const end = llmRaw.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          const json = llmRaw.substring(start, end + 1);
          proposal = JSON.parse(json) as LLMRescheduleProposal;
        }
      } catch {
        console.error('Error parsing LLM response: ' + llmRaw);
      }
    }

    // Validate proposal structure
    if (!proposal || typeof proposal !== 'object') {
      throw new Error('LLMProcessingError: invalid response structure');
    }
    if (!Array.isArray(proposal.meetingsToReschedule)) {
      throw new Error(
        'LLMProcessingError: meetingsToReschedule must be an array'
      );
    }

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
    if (!res.value) return;
    const { set, proposal } = res.value;
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

      // if new duration is different by more than 15 minutes, reject proposal
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

      // otherwise, enqueue for freebusy validation
      toUpdate.push({
        originalEvent: original,
        proposed: { start: m.newStartTime, end: m.newEndTime },
        proposalRaw: proposal,
      });
    });
  });

  // If no updates to validate, return early
  if (toUpdate.length === 0) {
    return { resolutionReports, errors, toUpdate };
  }

  // Build freebusy request items
  const freeBusyReq = {
    timeMin: toUpdate.map((t) => t.proposed.start).reduce((a, b) => (a < b ? a : b)),
    timeMax: toUpdate.map((t) => t.proposed.end).reduce((a, b) => (a > b ? a : b)),
    items: Array.from(
      new Set(
        toUpdate.flatMap((t) => t.originalEvent.attendees.map((a) => a.email))
      )
    ).map((email) => ({ id: email })),
  };

  // call freebusy
  const fbRes = await calendarClient.freebusy
    .query({
      requestBody: {
        timeMin: freeBusyReq.timeMin,
        timeMax: freeBusyReq.timeMax,
        items: freeBusyReq.items,
      },
    })
    .catch(() => {
      throw new Error('GoogleCalendarAPIError: freebusy query failed');
    });

  const busyMap = new Map(
    (fbRes.data.calendars ? Object.entries(fbRes.data.calendars) : []).map(
      ([k, v]) => [
        k,
        (v.busy ?? []).map((b) => ({
          start: b.start ?? '',
          end: b.end ?? '',
        })),
      ]
    )
  );

  // validate no conflicts for proposed slots
  toUpdate.forEach((u) => {
    const attendees = u.originalEvent.attendees.map((a) => a.email);
    const conflictFound = attendees.some((email) => {
      const busy = busyMap.get(email) ?? [];
      return busy.some((b) =>
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
    // otherwise mark as candidate (no_action_taken means ready but not executed)
    resolutionReports.push({
      meetingId: u.originalEvent.id,
      originalStartTime: u.originalEvent.startTime,
      originalEndTime: u.originalEvent.endTime,
      proposedNewStartTime: u.proposed.start,
      proposedNewEndTime: u.proposed.end,
      status: 'no_action_taken',
      llmProposal: u.proposalRaw,
    });
  });

  return { resolutionReports, errors, toUpdate };
}

/**
 * Proposes meeting conflict resolutions without executing them.
 */
export async function proposeMeetingConflictResolutionsDelegate(
  args: ProposeMeetingConflictResolutionsDelegateArgs
): Promise<ProposeMeetingConflictResolutionsOutput> {
  const {
    calendarClient,
    userEmails,
    timezone,
    windowStartLocal,
    windowEndLocal,
    identifiedConflicts: providedConflicts,
    fullDayCalendars: providedCalendars,
  } = args;

  const { calendars, conflictArrays } = await detectConflicts(
    calendarClient,
    userEmails,
    timezone,
    windowStartLocal,
    windowEndLocal,
    providedConflicts,
    providedCalendars
  );

  const { resolutionReports, errors } =
    await generateAndValidateProposals(
      calendarClient,
      conflictArrays,
      calendars,
      windowStartLocal,
      windowEndLocal
    );

  const validProposals = resolutionReports.filter(
    (r) => r.status === 'no_action_taken'
  ).length;
  const invalidProposals = resolutionReports.filter(
    (r) => r.status === 'invalid_proposal'
  ).length;

  return {
    identifiedConflicts: conflictArrays.flat(),
    resolutionReports,
    summary: {
      totalConflicts: conflictArrays.flat().length,
      proposalsGenerated: resolutionReports.length,
      invalidProposals,
      validProposals,
    },
    errors: errors.length ? errors : undefined,
  };
}

