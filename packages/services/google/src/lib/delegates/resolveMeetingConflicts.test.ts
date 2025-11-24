import { google } from 'googleapis';
import {
  identifyMeetingConflictsDelegate,
  proposeMeetingConflictResolutionsDelegate,
} from './resolveMeetingConflicts';
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

describe('identifyMeetingConflictsDelegate', () => {
  let calendarClient: ReturnType<typeof google.calendar>;
  let mockSummarizeCalendars: jest.MockedFunction<typeof summarizeCalendars>;

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

    // Default mock implementations
    mockSummarizeCalendars.mockResolvedValue({
      message: 'Fetched events',
      calendars: conflictingCalendars,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------- CONFLICT DETECTION TESTS ----------------

  it('detects conflicts when events overlap in time', async () => {
    // given - use test data where events have all required participants
    const testCalendars = [
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
            participants: ['alice@corp.com', 'bob@corp.com'],
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
          {
            id: 'event-2',
            subject: 'Client Call',
            description: 'Important client meeting',
            start: '2025-07-22T10:15:00-07:00',
            end: '2025-07-22T11:00:00-07:00',
            participants: ['alice@corp.com', 'bob@corp.com'],
            durationMinutes: 45,
          },
        ],
      },
    ];

    mockSummarizeCalendars.mockResolvedValue({
      message: 'Fetched events',
      calendars: testCalendars,
    });

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await identifyMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(result.identifiedConflicts.length).toBeGreaterThan(0);
    expect(result.message).toContain('conflicting meeting');
  });

  it('returns no conflicts when events do not overlap', async () => {
    // given
    mockSummarizeCalendars.mockResolvedValue({
      message: 'Fetched events',
      calendars: noConflictCalendars,
    });

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await identifyMeetingConflictsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(result.identifiedConflicts).toHaveLength(0);
    expect(result.message).toBe('No meeting conflicts found');
  });
});

describe('proposeMeetingConflictResolutionsDelegate', () => {
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

  it('fetches conflict resolution rules for all involved users', async () => {
    // given - use calendar data that will create conflicts for the specified users
    const testCalendars = [
      {
        email: 'alice@corp.com',
        events: [
          {
            id: 'event-1',
            subject: 'Team Meeting',
            description: 'Team meeting',
            start: '2025-07-22T10:00:00-07:00',
            end: '2025-07-22T10:30:00-07:00',
            participants: ['alice@corp.com', 'bob@corp.com', 'charlie@corp.com'],
            durationMinutes: 30,
          },
          {
            id: 'event-2',
            subject: 'Overlapping Meeting',
            description: 'Overlapping meeting',
            start: '2025-07-22T10:15:00-07:00',
            end: '2025-07-22T11:00:00-07:00',
            participants: ['alice@corp.com', 'bob@corp.com', 'charlie@corp.com'],
            durationMinutes: 45,
          },
        ],
      },
      {
        email: 'bob@corp.com',
        events: [
          {
            id: 'event-1',
            subject: 'Team Meeting',
            description: 'Team meeting',
            start: '2025-07-22T10:00:00-07:00',
            end: '2025-07-22T10:30:00-07:00',
            participants: ['alice@corp.com', 'bob@corp.com', 'charlie@corp.com'],
            durationMinutes: 30,
          },
          {
            id: 'event-2',
            subject: 'Overlapping Meeting',
            description: 'Overlapping meeting',
            start: '2025-07-22T10:15:00-07:00',
            end: '2025-07-22T11:00:00-07:00',
            participants: ['alice@corp.com', 'bob@corp.com', 'charlie@corp.com'],
            durationMinutes: 45,
          },
        ],
      },
      {
        email: 'charlie@corp.com',
        events: [
          {
            id: 'event-1',
            subject: 'Team Meeting',
            description: 'Team meeting',
            start: '2025-07-22T10:00:00-07:00',
            end: '2025-07-22T10:30:00-07:00',
            participants: ['alice@corp.com', 'bob@corp.com', 'charlie@corp.com'],
            durationMinutes: 30,
          },
          {
            id: 'event-2',
            subject: 'Overlapping Meeting',
            description: 'Overlapping meeting',
            start: '2025-07-22T10:15:00-07:00',
            end: '2025-07-22T11:00:00-07:00',
            participants: ['alice@corp.com', 'bob@corp.com', 'charlie@corp.com'],
            durationMinutes: 45,
          },
        ],
      },
    ];

    mockSummarizeCalendars.mockResolvedValue({
      message: 'Fetched events',
      calendars: testCalendars,
    });

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);
    const userEmails = ['alice@corp.com', 'bob@corp.com', 'charlie@corp.com'];

    // when
    await proposeMeetingConflictResolutionsDelegate({
      calendarClient,
      userEmails,
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(mockReadRules).toHaveBeenCalled();
    // Rules are fetched for all involved users (attendees + organizers)
  });

  it('calls LLM service with conflict set and rules', async () => {
    // given
    mockReadRules.mockResolvedValue(['rule1', 'rule2']);

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    await proposeMeetingConflictResolutionsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(mockGeminiService).toHaveBeenCalled();

    const [userPrompt, systemPrompt] = mockGeminiService.mock.lastCall ?? [];
    expect(userPrompt).toBeDefined();
    expect(systemPrompt).toBeDefined();

    // Verify the prompt contains conflict set and rules
    const userPromptStr = userPrompt as string;
    expect(userPromptStr).toContain('CONFLICT SET');
    expect(userPromptStr).toContain('USER RULES');
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
    const result = await proposeMeetingConflictResolutionsDelegate({
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
    const result = await proposeMeetingConflictResolutionsDelegate({
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

  it('rejects proposal when proposed time introduces conflicts for any attendee', async () => {
    // given - use calendar data that will create conflicts for alice and bob
    const testCalendars = [
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
            participants: ['alice@corp.com', 'bob@corp.com'],
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
          {
            id: 'event-2',
            subject: 'Client Call',
            description: 'Important client meeting',
            start: '2025-07-22T10:15:00-07:00',
            end: '2025-07-22T11:00:00-07:00',
            participants: ['alice@corp.com', 'bob@corp.com'],
            durationMinutes: 45,
          },
        ],
      },
    ];

    mockSummarizeCalendars.mockResolvedValue({
      message: 'Fetched events',
      calendars: testCalendars,
    });

    // Proposal that tries to reschedule event-1 to a time when alice is busy
    // Note: Both event-1 and event-2 overlap and share attendees, so they'll be in the same conflict set
    const proposalWithConflict: LLMRescheduleProposal = {
      meetingsToReschedule: [
        {
          meetingId: 'event-1',
          newStartTime: '2025-07-22T11:00:00-07:00', // 11:00 PT = 18:00 UTC
          newEndTime: '2025-07-22T11:30:00-07:00', // 11:30 PT = 18:30 UTC
        },
      ],
    };
    // Reset the mock to ensure our test-specific proposal is used
    mockGeminiService.mockReset();
    mockGeminiService.mockResolvedValue(JSON.stringify(proposalWithConflict));

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

    const result = await proposeMeetingConflictResolutionsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    // First verify that conflicts were detected
    expect(result.identifiedConflicts.length).toBeGreaterThan(0);
    
    // The proposal should be invalid because the proposed time conflicts with alice's busy time
    const invalidReports = result.resolutionReports.filter(
      (r) => r.status === 'invalid_proposal'
    );
    
    expect(invalidReports.length).toBeGreaterThan(0);
    // Check if any invalid report mentions conflicts (there may be multiple conflict sets,
    // and some may have "meeting id not found" while others correctly detect conflicts)
    const hasConflictReason = invalidReports.some(r => 
      r.reason?.includes('introduces conflicts')
    );
    expect(hasConflictReason).toBe(true);
  });

  // ---------------- PROPOSAL GENERATION TESTS ----------------
  it('generates valid proposals when proposed time is free for all attendees', async () => {
    // given
    mockSummarizeCalendars.mockResolvedValue({
      message: 'Fetched events',
      calendars: conflictingCalendars,
    });

    mockGeminiService.mockResolvedValue(JSON.stringify(validLLMProposal));

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await proposeMeetingConflictResolutionsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    const validProposals = result.resolutionReports.filter(
      (r) => r.status === 'no_action_taken'
    );

    expect(validProposals.length).toBeGreaterThan(0);
    expect(validProposals[0].proposedNewStartTime).toBeDefined();
    expect(validProposals[0].proposedNewEndTime).toBeDefined();
    expect(result.summary.validProposals).toBeGreaterThan(0);
  });

  // ---------------- ERROR HANDLING TESTS ----------------

  it('reports errors when LLM service fails', async () => {
    // given
    mockGeminiService.mockRejectedValue(new Error('LLM service unavailable'));

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await proposeMeetingConflictResolutionsDelegate({
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
    const result = await proposeMeetingConflictResolutionsDelegate({
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
    const result = await proposeMeetingConflictResolutionsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(result.resolutionReports.length).toBeGreaterThan(0);
  });

  it('throws error when freebusy query fails', async () => {
    // given
    (calendarClient.freebusy.query as jest.Mock).mockRejectedValue(
      new Error('Freebusy API error')
    );

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = proposeMeetingConflictResolutionsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    await expect(result).rejects.toThrow('GoogleCalendarAPIError');
  });

  it('should still generate proposals as if no rules when reading conflict resolution rules fails', async () => {
    // given
    mockReadRules.mockRejectedValue(new Error('Database error'));

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await proposeMeetingConflictResolutionsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(result.summary.validProposals).toBeGreaterThan(0);
    expect(result.resolutionReports.length).toBeGreaterThan(0);
  });

  // ---------------- EDGE CASES ----------------

  it('should not generate proposals when LLM returns empty reschedule list', async () => {
    // given
    mockGeminiService.mockResolvedValue(
      JSON.stringify({ meetingsToReschedule: [] })
    );

    const windowStartLocal = wallClockToUTC('2025-07-22T08:00:00', timezone);
    const windowEndLocal = wallClockToUTC('2025-07-22T17:00:00', timezone);

    // when
    const result = await proposeMeetingConflictResolutionsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com', 'bob@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(result.summary.validProposals).toBe(0);
    expect(calendarClient.freebusy.query).not.toHaveBeenCalled();
  });

  it('should generate proposals when multiple conflict sets are identified', async () => {
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
    const result = await proposeMeetingConflictResolutionsDelegate({
      calendarClient,
      userEmails: ['alice@corp.com'],
      timezone,
      windowStartLocal,
      windowEndLocal,
    });

    // then
    expect(result.identifiedConflicts.length).toBeGreaterThan(0);
    expect(result.summary.validProposals).toBeGreaterThan(0);
  });
});
