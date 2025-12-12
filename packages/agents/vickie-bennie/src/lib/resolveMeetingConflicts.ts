import {
  OfficeServiceV3,
  TYPES,
  GeminiService,
  MeetingConflictResolutionProposals,
  OfficeService,
  ResolvedMeeting,
} from '@codestrap/developer-foundations-types';
import {
  uuidv4,
  extractJsonFromBackticks,
} from '@codestrap/developer-foundations-utils';
import { container } from '@codestrap/developer-foundations-di';
import { rescheduleConflictingMeetings } from './calculateRescheduling';

export interface VickieResponse {
  status: number;
  message: string;
  executionId: string;
  taskList?: string;
  error?: string;
}

function buildUnresolvedMeetingEmailBody(
  meetings: Array<ResolvedMeeting & { reason: string }>
): string {
  const meetingList = meetings
    .map(
      (m) =>
        `- "${m.subject}" (${m.start} - ${m.end}) — ${m.reason}${
          m.rescheduledTo
            ? ` (proposed: ${m.rescheduledTo.start} - ${m.rescheduledTo.end})`
            : ''
        }`
    )
    .join('\n');

  return `The following meetings could not be rescheduled:\n\n${meetingList}\n\nPlease review and reschedule manually.`;
}

export interface ParsedConflictRequest {
  users: string[];
  timeFrameFrom: string;
  timeFrameTo: string;
}

/**
 * Filters users to only include CodeStrap users
 */
function filterCodeStrapUsers(users: string[]): string[] {
  return users.filter(
    (user) =>
      user.indexOf('codestrap.me') >= 0 || user.indexOf('codestrap.com') >= 0
  );
}

/**
 * Conflict resolution rules for prioritizing meetings
 */
// TODO: @kopach - read conflict resolution rules from Foundry
const CONFLICT_RESOLUTION_RULES = [
  'Prioritize external meetings over internal meetings',
  'Prioritize meetings with participants over personal meetings (personal meetings usually have 1 participant)',
  'Prefer meetings within working hours (e.g., 9am–5pm local time)',
  'Minimize meetings late on Fridays or before holidays',
  'Prioritize meetings with higher-level stakeholders',
  'Respect time zones of all participants',
  'Allow adequate breaks between meetings if possible (e.g., 5-15 minutes between meetings)',
  'Limit back-to-back meetings to two in a row if possible',
  'Prefer meetings involving fewer conflicts among invitees',
  'Prefer not to schedule on national or religious holidays',
];

/**
 * Prioritizes meetings using Gemini LLM based on conflict resolution rules
 * @param meetings - The meetings to prioritize
 * @param geminiService - The Gemini service instance
 * @returns The meetings array reordered by priority (highest first)
 */
async function prioritizeMeetingsWithGemini(
  meetings: MeetingConflictResolutionProposals,
  geminiService: GeminiService
): Promise<MeetingConflictResolutionProposals> {
  // If no meetings or only one, return as-is
  if (meetings.length <= 1) {
    return meetings;
  }

  try {
    // Prepare meeting data for prompt (only relevant fields to reduce token usage)
    const meetingsForPrompt = meetings.map((meeting) => ({
      id: meeting.id,
      subject: meeting.subject,
      ...(meeting.description ? { description: meeting.description } : {}),
      participants: meeting.participants,
      start: meeting.start,
      durationMinutes: meeting.durationMinutes,
    }));

    const system = `You are a scheduling assistant that prioritizes meetings based on business importance.
Your job is to analyze conflicting meetings and sort them by priority (highest first).
Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}.
The current month is ${new Date().toLocaleDateString('en-US', {
      month: 'long',
    })}.`;

    const user = `
# Task
Analyze the following conflicting meetings and return them ordered by priority (most important first).

# Conflict Resolution Rules
${CONFLICT_RESOLUTION_RULES.map((r, i) => `${i + 1}. ${r}`).join('\n')}

# Meetings to Prioritize
${JSON.stringify(meetingsForPrompt, null, 2)}

# Output Format
Return ONLY a JSON object with an array of meeting IDs in priority order (highest first):
{
  "prioritizedMeetingIds": ["meeting-id-1", "meeting-id-2", ...]
}

# Examples

## Example 1: External vs Internal Meeting (internal domains are @codestrap.me, @codestrap.com)
Input:
[
  { "id": "mtg-001", "subject": "Team Standup", "participants": ["alice@codestrap.me", "bob@codestrap.me"], "start": "2025-04-11T09:00:00-07:00", "durationMinutes": 30 },
  { "id": "mtg-002", "subject": "Client Demo", "participants": ["alice@codestrap.me", "john@acme.com"], "start": "2025-04-11T09:00:00-07:00", "durationMinutes": 60 }
]

Output:
{ "prioritizedMeetingIds": ["mtg-002", "mtg-001"] }

Reasoning: External client meeting (Client Demo) takes priority over internal team meeting.

## Example 2: Multi-participant vs Solo Meeting
Input:
[
  { "id": "mtg-003", "subject": "Focus Time", "participants": ["alice@codestrap.me"], "start": "2025-04-11T14:00:00-07:00", "durationMinutes": 60 },
  { "id": "mtg-004", "subject": "Project Planning", "participants": ["alice@codestrap.me", "bob@codestrap.me", "carol@codestrap.me"], "start": "2025-04-11T14:00:00-07:00", "durationMinutes": 45 }
]

Output:
{ "prioritizedMeetingIds": ["mtg-004", "mtg-003"] }

Reasoning: Group meeting with 3 participants takes priority over personal focus time.

## Example 3: Friday Late Afternoon
Input:
[
  { "id": "mtg-005", "subject": "Sprint Retro", "participants": ["team@codestrap.me"], "start": "2025-04-11T16:30:00-07:00", "durationMinutes": 60 },
  { "id": "mtg-006", "subject": "Sprint Retro", "participants": ["team@codestrap.me"], "start": "2025-04-11T10:00:00-07:00", "durationMinutes": 60 }
]

Output:
{ "prioritizedMeetingIds": ["mtg-006", "mtg-005"] }

Reasoning: Earlier Friday meeting preferred over late Friday afternoon.

## Example 4: Working Hours Preference
Input:
[
  { "id": "mtg-007", "subject": "Team Sync", "participants": ["alice@codestrap.me", "bob@codestrap.me"], "start": "2025-04-11T08:00:00-07:00", "durationMinutes": 30 },
  { "id": "mtg-008", "subject": "Team Sync", "participants": ["alice@codestrap.me", "bob@codestrap.me"], "start": "2025-04-11T10:00:00-07:00", "durationMinutes": 30 }
]

Output:
{ "prioritizedMeetingIds": ["mtg-008", "mtg-007"] }

Reasoning: Meeting within working hours (10am) preferred over early morning (8am).
`;

    const response = await geminiService(user, system);
    const clean = extractJsonFromBackticks(response);
    const parsed = JSON.parse(clean) as { prioritizedMeetingIds: string[] };

    // Create a map of meeting ID to index for quick lookup
    const idToMeeting = new Map(meetings.map((m) => [m.id, m]));
    const prioritizedIds = parsed.prioritizedMeetingIds || [];

    // Reorder meetings based on prioritized IDs
    const prioritizedMeetings: MeetingConflictResolutionProposals = [];
    const processedIds = new Set<string>();

    // Add meetings in priority order
    for (const id of prioritizedIds) {
      const meeting = idToMeeting.get(id);
      if (meeting) {
        prioritizedMeetings.push(meeting);
        processedIds.add(id);
      }
    }

    // Add any meetings that weren't in the response (fallback)
    for (const meeting of meetings) {
      if (!processedIds.has(meeting.id)) {
        prioritizedMeetings.push(meeting);
      }
    }

    return prioritizedMeetings;
  } catch (e) {
    console.error(
      'Error prioritizing meetings with Gemini, using original order:',
      (e as Error).message
    );
    // Fallback: return original order if Gemini fails
    return meetings;
  }
}

/**
 * Performs rescheduling for identified conflicts
 * @param users - The users to resolve conflicts for
 * @param timeFrameFrom - The start time of the time frame to resolve conflicts for in ISO 8601 format, defaults to now
 * @param timeFrameTo - The end time of the time frame to resolve conflicts for in ISO 8601 format, defaults to now + 24 hours
 * @param timezone - The timezone to resolve conflicts for, defaults to 'America/Los_Angeles'
 */
export async function resolveMeetingConflicts(
  users: string[],
  timeFrameFrom = new Date().toISOString(),
  timeFrameTo = new Date(
    new Date().getTime() + 24 * 60 * 60 * 1000
  ).toISOString(),
  timezone = 'America/Los_Angeles'
): Promise<VickieResponse> {
  try {
    const officeServiceV3 = await container.getAsync<OfficeServiceV3>(
      TYPES.OfficeServiceV3
    );

    const codeStrapUsers = filterCodeStrapUsers(users);

    if (codeStrapUsers.length === 0) {
      return {
        status: 400,
        executionId: uuidv4(),
        message: 'No CodeStrap users found in the request',
        error: 'No valid users',
        taskList: 'ERROR',
      };
    }

    // Identify conflicts and propose resolutions
    const identifyResult =
      await officeServiceV3.proposeMeetingConflictResolutions({
        userEmails: codeStrapUsers,
        timeFrameFrom: new Date(timeFrameFrom),
        timeFrameTo: new Date(timeFrameTo),
        timezone,
      });

    // 1. Prioritize the meetings with LLM based on the conflict resolution rules
    const geminiService = container.get<GeminiService>(TYPES.GeminiService);
    const prioritizedMeetings = await prioritizeMeetingsWithGemini(
      identifyResult,
      geminiService
    );

    // 2. Perform rescheduling calculations based on the prioritized meetings
    const resolvedMeetings = rescheduleConflictingMeetings(prioritizedMeetings);

    // 3. Apply the rescheduling to the calendar
    const failedMeetings: Array<ResolvedMeeting & { reason: string }> = [];

    for (const meeting of resolvedMeetings) {
      if (meeting.status === 'SCHEDULED' && meeting.rescheduledTo) {
        try {
          const attendees = new Set(meeting.participants);
          if (meeting.organizer) {
            attendees.add(meeting.organizer);
          }
          const attendeesArray = Array.from(attendees);
          // await officeServiceV3.scheduleMeeting({
          //   summary: meeting.subject,
          //   description: meeting.description,
          //   start: meeting.rescheduledTo.start,
          //   end: meeting.rescheduledTo.end,
          //   attendees: attendeesArray,
          // });
          console.log(
            `Rescheduled meeting: ${meeting.subject} to ${meeting.rescheduledTo.start} - ${meeting.rescheduledTo.end}`
          );
        } catch (error) {
          failedMeetings.push({
            ...meeting,
            reason: `Failed to schedule: ${(error as Error).message}`,
          });
          console.error(
            `Failed to schedule meeting ${meeting.subject}:`,
            (error as Error).message
          );
        }
      } else {
        failedMeetings.push({
          ...meeting,
          reason: 'No available time slot found',
        });
      }
    }

    // 4. Send emails to meeting owner for unresolved/failed meetings
    if (failedMeetings.length > 0) {
      const officeService = await container.getAsync<OfficeService>(
        TYPES.OfficeService
      );

      const ownerEmail = failedMeetings[0].email;

      await officeService.sendEmail({
        from: process.env.OFFICE_SERVICE_ACCOUNT,
        recipients: [ownerEmail],
        subject: 'Meeting Conflict Resolution - Action Required',
        message: buildUnresolvedMeetingEmailBody(failedMeetings),
      });

      console.log(
        `Sent unresolved meetings email to ${ownerEmail} for ${failedMeetings.length} meetings`
      );
    }

    return {
      status: 200,
      executionId: uuidv4(),
      message: 'Meeting conflicts resolved',
      taskList: 'SUCCESS',
    };
  } catch (e) {
    console.error('resolveMeetingConflicts error:', (e as Error).message);
    return {
      status: 500,
      executionId: uuidv4(),
      message: `Error resolving meeting conflicts: ${(e as Error).message}`,
      error: (e as Error).stack || (e as Error).message,
      taskList: '',
    };
  }
}
