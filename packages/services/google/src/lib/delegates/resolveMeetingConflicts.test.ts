import { google } from 'googleapis';
import { resolveMeetingConflictsDelegate } from './resolveMeetingConflicts';
import { wallClockToUTC } from '@codestrap/developer-foundations-utils';
import type { LLMRescheduleProposal } from '@codestrap/developer-foundations-types';

// Mock dependencies
jest.mock('../delegates/summerizeCalanders', () => ({
  summarizeCalendars: jest.fn(),
}));

jest.mock('@codestrap/developer-foundations-services-palantir', () => ({
  readConflictResolutionRulesForUser: jest.fn(() =>
    Promise.resolve(['rule1', 'rule2'])
  ),
  geminiService: jest.fn(),
}));

import { summarizeCalendars } from '../delegates/summerizeCalanders';
import {
  readConflictResolutionRulesForUser,
  geminiService,
} from '@codestrap/developer-foundations-services-palantir';

// ------------------------------
// Test fixtures
// ------------------------------

const timezone = 'America/Los_Angeles';

// Calendar summaries with overlapping events (conflicts)
const conflictingCalendars = [
  {
    email: 'alice@corp.com',
    events: [
      {
        id: 'event-1',
        subject: 'Team Standup',
        description: 'Daily standup',
        start: '2025-07-22T10:00:00-07:00',
        end: '2025-07-22T10:30:00-07:00',
        participants: ['alice@corp.com', 'bob@corp.com'],
        durationMinutes: 30,
      },
      {
        id: 'event-2',
        subject: 'Client Call',
        description: 'Important client meeting',
        start: '2025-07-22T10:15:00-07:00',
        end: '2025-07-22T11:00:00-07:00',
        participants: ['alice@corp.com', 'charlie@corp.com'],
        durationMinutes: 45,
      },
    ],
  },
  {
    email: 'bob@corp.com',
    events: [
      {
        id: 'event-1',
        subject: 'Team Standup',
        description: 'Daily standup',
        start: '2025-07-22T10:00:00-07:00',
        end: '2025-07-22T10:30:00-07:00',
        participants: ['alice@corp.com', 'bob@corp.com'],
        durationMinutes: 30,
      },
    ],
  },
  {
    email: 'charlie@corp.com',
    events: [
      {
        id: 'event-2',
        subject: 'Client Call',
        description: 'Important client meeting',
        start: '2025-07-22T10:15:00-07:00',
        end: '2025-07-22T11:00:00-07:00',
        participants: ['alice@corp.com', 'charlie@corp.com'],
        durationMinutes: 45,
      },
    ],
  },
];

// Calendar summaries with no conflicts
const noConflictCalendars = [
  {
    email: 'alice@corp.com',
    events: [
      {
        id: 'event-1',
        subject: 'Team Standup No Conflict',
        description: 'Daily standup',
        start: '2025-07-22T10:00:00-07:00',
        end: '2025-07-22T10:30:00-07:00',
        participants: ['alice@corp.com', 'bob@corp.com'],
        durationMinutes: 30,
      },
    ],
  },
  {
    email: 'bob@corp.com',
    events: [
      {
        id: 'event-3',
        subject: 'Lunch No Conflict',
        description: 'Lunch break',
        start: '2025-07-22T12:00:00-07:00',
        end: '2025-07-22T13:00:00-07:00',
        participants: ['bob@corp.com'],
        durationMinutes: 60,
      },
    ],
  },
];

// Valid LLM proposal
const validLLMProposal: LLMRescheduleProposal = {
  meetingsToReschedule: [
    {
      meetingId: 'event-1',
      newStartTime: '2025-07-22T11:00:00-07:00',
      newEndTime: '2025-07-22T11:30:00-07:00',
    },
    {
      meetingId: 'event-2',
      newStartTime: '2025-07-22T14:00:00-07:00',
      newEndTime: '2025-07-22T14:45:00-07:00',
    },
  ],
};

// Invalid LLM proposal (duration mismatch)
const invalidDurationProposal: LLMRescheduleProposal = {
  meetingsToReschedule: [
    {
      meetingId: 'event-1',
      newStartTime: '2025-07-22T11:00:00-07:00',
      newEndTime: '2025-07-22T12:00:00-07:00', // 60 min instead of 30
    },
  ],
};

// Invalid LLM proposal (unknown meeting ID)
const invalidMeetingIdProposal: LLMRescheduleProposal = {
  meetingsToReschedule: [
    {
      meetingId: 'event-999',
      newStartTime: '2025-07-22T11:00:00-07:00',
      newEndTime: '2025-07-22T11:30:00-07:00',
    },
  ],
};

// ------------------------------
// Inline mocks (auth INCLUDED)
// ------------------------------

let currentFreeBusyCalendars: Record<
  string,
  { busy: Array<{ start: string; end: string }> }
> = {};

jest.mock('googleapis', () => ({
  ...jest.requireActual('googleapis'),
  google: {
    calendar: jest.fn(() => {
      return {
        events: {
          list: jest.fn(() => Promise.resolve({ data: { items: [] } })),
          update: jest.fn(() => Promise.resolve({ data: {} })),
        },
        freebusy: {
          query: jest.fn(
            (params: { requestBody: { timeMin: string; timeMax: string } }) => {
              const { timeMin, timeMax } = params.requestBody;
              return Promise.resolve({
                data: {
                  kind: 'calendar#freeBusy',
                  timeMin,
                  timeMax,
                  calendars: currentFreeBusyCalendars,
                },
              });
            }
          ),
        },
      };
    }),
    auth: {
      GoogleAuth: jest.fn().mockImplementation(() => {
        return {
          getClient: jest.fn().mockResolvedValue({
            getRequestHeaders: jest.fn().mockResolvedValue({}),
          }),
        };
      }),
    },
  },
}));

describe('resolveMeetingConflictsDelegate', () => {
  let calendarClient: ReturnType<typeof google.calendar>;
  let mockSummarizeCalendars: jest.MockedFunction<typeof summarizeCalendars>;
  let mockReadRules: jest.MockedFunction<
    typeof readConflictResolutionRulesForUser
  >;
  let mockGeminiService: jest.MockedFunction<typeof geminiService>;

  beforeAll(() => {
    process.env.TZ = 'America/Los_Angeles';
  });

  beforeEach(() => {
    // Create calendar client AFTER jest.mock
    calendarClient = google.calendar('v3') as ReturnType<
      typeof google.calendar
    >;

    // Setup mocks
    mockSummarizeCalendars = summarizeCalendars as jest.MockedFunction<
      typeof summarizeCalendars
    >;
    mockReadRules = readConflictResolutionRulesForUser as jest.MockedFunction<
      typeof readConflictResolutionRulesForUser
    >;
    mockGeminiService = geminiService as jest.MockedFunction<
      typeof geminiService
    >;

    // Default mock implementations
    mockSummarizeCalendars.mockResolvedValue({
      message: 'Fetched events',
      calendars: conflictingCalendars,
    });
    mockReadRules.mockResolvedValue([]);
    mockGeminiService.mockResolvedValue(JSON.stringify(validLLMProposal));
    currentFreeBusyCalendars = {}; // No busy times by default
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------- BASIC FUNCTIONALITY TESTS ----------------

  // confclit
  it('detects conflicts when events overlap in time', async () => {
    // given
    mockSummarizeCalendars.mockResolvedValue({
      message: 'Fetched events',
      calendars: conflictingCalendars,
    });

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com', 'charlie@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(result.identifiedConflicts.length).toBeGreaterThan(0);
    expect(result.summary.totalConflicts).toBeGreaterThan(0);
  });

  // no conflicts
  it('returns no conflicts when events do not overlap', async () => {
    // given
    mockSummarizeCalendars.mockResolvedValue({
      message: 'Fetched events',
      calendars: noConflictCalendars,
    });

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(result.identifiedConflicts).toHaveLength(0);
    expect(result.summary.totalConflicts).toBe(0);
  });

  it('fetches conflict resolution rules for all involved users', async () => {
    // given
    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);
    const userEmails = ['alice@corp.com', 'bob@corp.com', 'charlie@corp.com'];

    // when
    await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails,
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(mockReadRules).toHaveBeenCalledTimes(userEmails.length);
    userEmails.forEach((email) =>
      expect(mockReadRules).toHaveBeenCalledWith(email)
    );
  });

  it('calls LLM service with conflict set and rules', async () => {
    // given
    mockReadRules.mockResolvedValue(['rule1', 'rule2']);

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(mockGeminiService).toHaveBeenCalled();

    const [user, system, params] = mockGeminiService.mock.lastCall ?? [];
    expect(user).toBe('system');
    expect(system).toBeDefined();
    expect(params).toEqual({ extractJsonString: true });
    const payload = JSON.parse(system ?? '');
    expect(payload.conflictSet).toBeInstanceOf(Array);
    expect(payload.rules).toBeInstanceOf(Array);
    expect(payload.fullDay).toBeInstanceOf(Array);
  });

  // ---------------- LLM PROPOSAL VALIDATION TESTS ----------------
  it('rejects proposal when meeting ID not found in conflict set', async () => {
    // given
    mockGeminiService.mockResolvedValue(
      JSON.stringify(invalidMeetingIdProposal)
    );

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    const invalidReports = result.resolutionReports.filter(
      (r) => r.status === 'invalid_proposal'
    );
    expect(invalidReports.length).toBeGreaterThan(0);
    expect(invalidReports[0].reason).toContain('Meeting id not found');
  });

  it('rejects proposal when duration change proposed by LLM differs from original duration by more than 15 minutes', async () => {
    // given
    mockGeminiService.mockResolvedValue(
      JSON.stringify(invalidDurationProposal)
    );

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    const invalidReports = result.resolutionReports.filter(
      (r) => r.status === 'invalid_proposal'
    );
    expect(invalidReports.length).toBeGreaterThan(0);
    expect(invalidReports[0].reason).toContain('Duration change too large');
  });

  // conflict
  it('rejects proposal when proposed time introduces conflicts for any attendee', async () => {
    // given
    mockSummarizeCalendars.mockResolvedValue({
      message: 'Fetched events',
      calendars: conflictingCalendars,
    });

    currentFreeBusyCalendars = {
      'alice@corp.com': {
        busy: [
          {
            start: '2025-07-22T18:00:00Z', // 11:00 PT
            end: '2025-07-22T18:30:00Z', // 11:30 PT
          },
        ],
      },
    };

    // when
    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    const result = await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    const invalidReports = result.resolutionReports.filter(
      (r) => r.status === 'invalid_proposal'
    );
    expect(invalidReports.length).toBeGreaterThan(0);
    expect(invalidReports[0].reason).toContain('introduces conflicts');
  });

  // ---------------- USER CONFIRMATION TESTS ----------------
  // conflict
  it('reschedules proposals when proposed time is free for all attendees', async () => {
    // given
    mockSummarizeCalendars.mockResolvedValue({
      message: 'Fetched events',
      calendars: conflictingCalendars,
    });

    mockGeminiService.mockResolvedValue(JSON.stringify(validLLMProposal));

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    const candidates = result.resolutionReports.filter(
      (r) => r.status === 'rescheduled'
    );

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].proposedNewStartTime).toBeDefined();
    expect(candidates[0].proposedNewEndTime).toBeDefined();
  });

  it('does not reschedule proposals when user declines', async () => {
    // given
    const mockDecline = jest.fn().mockResolvedValue(false);

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
      confirm: mockDecline,
    });

    // then
    expect(mockDecline).toHaveBeenCalled();
    expect(result.summary.successfullyRescheduled).toBe(0);
    expect(result.summary.noActionTaken).toBeGreaterThan(0);
  });

  it('reschedules proposals when user confirms', async () => {
    // given
    const mockConfirm = jest.fn().mockResolvedValue(true);

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
      confirm: mockConfirm,
    });

    expect(mockConfirm).toHaveBeenCalled();
    expect(calendarClient.events.update).toHaveBeenCalled();
  });

  it('skips confirmation when confirm callback not provided', async () => {
    // given
    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
      // no confirm callback
    });

    // then
    expect(calendarClient.events.update).toHaveBeenCalled();
  });

  // ---------------- CALENDAR UPDATE TESTS ----------------

  it('successfully reschedules meetings when calendar update succeeds', async () => {
    // given
    (calendarClient.events.update as jest.Mock).mockResolvedValue({ data: {} });

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    const rescheduled = result.resolutionReports.filter(
      (r) => r.status === 'rescheduled'
    );
    expect(rescheduled.length).toBeGreaterThan(0);
    expect(result.summary.successfullyRescheduled).toBeGreaterThan(0);
  });

  it('reports errors as failed_reschedule when calendar update fails after retries', async () => {
    // given
    (calendarClient.events.update as jest.Mock).mockRejectedValue(
      new Error('Update failed')
    );

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    const failed = result.resolutionReports.filter(
      (r) => r.status === 'failed_reschedule'
    );
    expect(failed.length).toBeGreaterThan(0);
    expect(result.summary.failedToReschedule).toBeGreaterThan(0);
    expect(failed[0].reason).toContain('failed after 3 attempts');
  });

  it('retries calendar updates with exponential backoff', async () => {
    // given
    const retryAttempts = 3;
    let attemptCount = 0;
    (calendarClient.events.update as jest.Mock).mockImplementation(() => {
      attemptCount++;
      if (attemptCount < retryAttempts) {
        return Promise.reject(new Error('Temporary failure'));
      }
      return Promise.resolve({ data: {} });
    });

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(calendarClient.events.update).toHaveBeenCalledTimes(
      retryAttempts + 1
    );
    const rescheduled = result.resolutionReports.filter(
      (r) => r.status === 'rescheduled'
    );
    expect(rescheduled.length).toBeGreaterThan(0);
  });

  // ---------------- ERROR HANDLING TESTS ----------------

  it('reports errors as failed_reschedule when LLM service fails', async () => {
    // given
    mockGeminiService.mockRejectedValue(new Error('LLM service unavailable'));

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(result.errors?.[0]).toContain('LLMProcessingError');
  });

  it('handles invalid LLM JSON response', async () => {
    // given
    mockGeminiService.mockResolvedValue('This is not valid JSON');

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('handles LLM response with JSON embedded in text', async () => {
    // given
    const embeddedJson = `Here's the proposal: ${JSON.stringify(
      validLLMProposal
    )}. Let me know if you need changes.`;
    mockGeminiService.mockResolvedValue(embeddedJson);

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(result.resolutionReports.length).toBeGreaterThan(0);
  });

  it('reports errors as failed_reschedule when freebusy query fails', async () => {
    // given
    (calendarClient.freebusy.query as jest.Mock).mockRejectedValue(
      new Error('Freebusy API error')
    );

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    await expect(result).rejects.toThrow('GoogleCalendarAPIError');
  });

  it('should still try to reschedule meetings as if no rules when reading conflict resolution rules fails', async () => {
    // given
    mockReadRules.mockRejectedValue(new Error('Database error'));

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(result.summary.successfullyRescheduled).toBeGreaterThan(0);
    expect(result.summary.noActionTaken).toBe(0);
  });

  // ---------------- EDGE CASES ----------------

  it('should not reschedule meetings when no updates to validate from LLM', async () => {
    // given
    mockGeminiService.mockResolvedValue(
      JSON.stringify({ meetingsToReschedule: [] })
    );

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(result.summary.successfullyRescheduled).toBe(0);
    expect(calendarClient.freebusy.query).not.toHaveBeenCalled();
  });

  it('should reschedule meetings when multiple conflict sets are identified', async () => {
    // given
    const multiConflictCalendars = [
      {
        email: 'alice@corp.com',
        events: [
          {
            id: 'event-1',
            subject: 'Meeting 1',
            start: '2025-07-22T10:00:00-07:00',
            end: '2025-07-22T10:30:00-07:00',
            participants: ['alice@corp.com', 'bob@corp.com'],
            durationMinutes: 30,
          },
          {
            id: 'event-2',
            subject: 'Meeting 2',
            start: '2025-07-22T10:15:00-07:00',
            end: '2025-07-22T11:00:00-07:00',
            participants: ['alice@corp.com', 'charlie@corp.com'],
            durationMinutes: 45,
          },
          {
            id: 'event-4',
            subject: 'Meeting 4',
            start: '2025-07-22T14:00:00-07:00',
            end: '2025-07-22T14:30:00-07:00',
            participants: ['alice@corp.com', 'dave@corp.com'],
            durationMinutes: 30,
          },
          {
            id: 'event-5',
            subject: 'Meeting 5',
            start: '2025-07-22T14:15:00-07:00',
            end: '2025-07-22T15:00:00-07:00',
            participants: ['alice@corp.com', 'eve@corp.com'],
            durationMinutes: 45,
          },
        ],
      },
    ];

    mockSummarizeCalendars.mockResolvedValue({
      message: 'Fetched events',
      calendars: multiConflictCalendars,
    });

    const multiProposal: LLMRescheduleProposal = {
      meetingsToReschedule: [
        {
          meetingId: 'event-1',
          newStartTime: '2025-07-22T11:00:00-07:00',
          newEndTime: '2025-07-22T11:30:00-07:00',
        },
        {
          meetingId: 'event-2',
          newStartTime: '2025-07-22T15:00:00-07:00',
          newEndTime: '2025-07-22T15:45:00-07:00',
        },
      ],
    };
    mockGeminiService.mockResolvedValue(JSON.stringify(multiProposal));

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await resolveMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(result.identifiedConflicts.length).toBeGreaterThan(0);
    expect(result.summary.successfullyRescheduled).toBeGreaterThan(0);
  });
});
