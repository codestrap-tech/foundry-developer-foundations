import { findMeetingDetails } from './FindMeetingDetails';
import { Context, OfficeServiceV2, MeetingSearchResult, EventSummary } from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';
import { drive_v3 } from 'googleapis';

jest.mock('@codestrap/developer-foundations-di', () => ({
  container: {
    getAsync: jest.fn(),
    get: jest.fn(),
  },
}));

describe('FindMeetingDetails - Comprehensive Tests', () => {
  let mockOfficeService: jest.Mocked<OfficeServiceV2>;
  let mockGeminiService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOfficeService = {
      getAvailableMeetingTimes: jest.fn(),
      scheduleMeeting: jest.fn(),
      sendEmail: jest.fn(),
      readEmailHistory: jest.fn(),
      watchEmails: jest.fn(),
      getCalendarClient: jest.fn(),
      getEmailClient: jest.fn(),
      summarizeCalendars: jest.fn(),
      searchDriveFiles: jest.fn(),
      getDriveClient: jest.fn(),
    } as any;

    mockGeminiService = jest.fn();

    (container.getAsync as jest.Mock).mockResolvedValue(mockOfficeService);
    (container.get as jest.Mock).mockReturnValue(mockGeminiService);
  });

  describe('Meeting Search - Success Cases', () => {
    it('should find meeting with transcript and generate summary', async () => {
      const mockEventSummary: EventSummary = {
        id: 'meeting1',
        subject: 'Team Sync',
        description: 'Weekly team meeting',
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T11:00:00Z',
        durationMinutes: 60,
        participants: ['user@codestrap.me', 'john@codestrap.me'],
        meetingLink: 'https://meet.google.com/abc123',
      };

      mockGeminiService
        .mockResolvedValueOnce(`
          {
            "attendees": ["john@codestrap.me"],
            "operator": "or",
            "timeframe": "next"
          }
        `)
        .mockResolvedValueOnce('Generated meeting summary with transcript');

      mockOfficeService.summarizeCalendars.mockResolvedValue({
        message: 'Fetched 1 events',
        calendars: [{
          email: 'primary',
          events: [mockEventSummary]
        }]
      });

      mockOfficeService.searchDriveFiles.mockResolvedValue({
        files: [{ id: 'file1', name: 'transcript.txt', mimeType: 'text/plain' }],
        totalResults: 1,
        nextPageToken: undefined,
        incompleteSearch: undefined,
        message: 'Search completed'
      });
      
      const mockDriveClient = {
        files: {
          get: jest.fn().mockResolvedValue({
            data: 'Meeting transcript content here...'
          })
        }
      } as unknown as drive_v3.Drive;
      
      mockOfficeService.getDriveClient.mockReturnValue(mockDriveClient);

      const context: Context = {
        requestId: 'test-request-1',
        status: 1
      };
      const task = 'When is my next meeting with John <john@codestrap.me>?';

      const result = await findMeetingDetails(context, undefined, task);

      expect(result.found).toBe(true);
      expect(result.meeting?.subject).toBe('Team Sync');
      expect(result.meeting?.participants).toEqual(['user@codestrap.me', 'john@codestrap.me']);
      expect(result.transcript).toBe('Meeting transcript content here...');
      expect(result.summary).toBe('Generated meeting summary with transcript');
      expect(result.message).toContain('Found next meeting');
    });

    it('should find meeting without transcript and generate summary from details only', async () => {
      const mockEventSummary: EventSummary = {
        id: 'meeting1',
        subject: 'Future Planning',
        description: 'Planning session for Q2',
        start: '2024-02-15T14:00:00Z',
        end: '2024-02-15T15:00:00Z',
        durationMinutes: 60,
        participants: ['user@codestrap.me', 'jane@codestrap.me'],
      };

      mockGeminiService
        .mockResolvedValueOnce(`
          {
            "attendees": ["jane@codestrap.me"],
            "operator": "or",
            "timeframe": "next"
          }
        `)
        .mockResolvedValueOnce('Generated summary based on meeting details only');

      mockOfficeService.summarizeCalendars.mockResolvedValue({
        message: 'Fetched 1 events',
        calendars: [{
          email: 'primary',
          events: [mockEventSummary]
        }]
      });

      mockOfficeService.searchDriveFiles.mockResolvedValue({
        files: [],
        totalResults: 0,
        nextPageToken: undefined,
        incompleteSearch: undefined,
        message: 'No files found'
      });

      const context: Context = {
        requestId: 'test-request-2',
        status: 1
      };
      const task = 'When is my next meeting with Jane <jane@codestrap.me>?';

      const result = await findMeetingDetails(context, undefined, task);

      expect(result.found).toBe(true);
      expect(result.meeting?.subject).toBe('Future Planning');
      expect(result.transcript).toBeUndefined();
      expect(result.summary).toBe('Generated summary based on meeting details only');
    });

    it('should find previous meeting with multiple attendees using AND operator', async () => {
      const mockEventSummary: EventSummary = {
        id: 'meeting2',
        subject: 'Project Review',
        description: 'Review project status and next steps',
        start: '2024-01-10T09:00:00Z',
        end: '2024-01-10T10:00:00Z',
        durationMinutes: 60,
        participants: ['user@codestrap.me', 'john@codestrap.me', 'jane@codestrap.me'],
      };

      mockGeminiService
        .mockResolvedValueOnce(`
          {
            "attendees": ["john@codestrap.me", "jane@codestrap.me"],
            "operator": "and",
            "timeframe": "previous"
          }
        `)
        .mockResolvedValueOnce('Generated summary for previous meeting with multiple attendees');

      mockOfficeService.summarizeCalendars.mockResolvedValue({
        message: 'Fetched 1 events',
        calendars: [{
          email: 'primary',
          events: [mockEventSummary]
        }]
      });

      mockOfficeService.searchDriveFiles.mockResolvedValue({
        files: [],
        totalResults: 0,
        nextPageToken: undefined,
        incompleteSearch: undefined,
        message: 'No files found'
      });

      const context: Context = {
        requestId: 'test-request-3',
        status: 1
      };
      const task = 'When was my last meeting with John <john@codestrap.me> and Jane <jane@codestrap.me>?';

      const result = await findMeetingDetails(context, undefined, task);

      expect(result.found).toBe(true);
      expect(result.meeting?.subject).toBe('Project Review');
      expect(result.meeting?.participants).toContain('john@codestrap.me');
      expect(result.meeting?.participants).toContain('jane@codestrap.me');
      expect(result.summary).toBe('Generated summary for previous meeting with multiple attendees');
    });

    it('should find meeting with custom time range', async () => {
      const mockEventSummary: EventSummary = {
        id: 'meeting3',
        subject: 'Sprint Planning',
        description: 'Sprint planning session',
        start: '2024-01-20T10:00:00Z',
        end: '2024-01-20T11:30:00Z',
        durationMinutes: 90,
        participants: ['user@codestrap.me', 'mike@codestrap.me'],
      };

      mockGeminiService
        .mockResolvedValueOnce(`
          {
            "attendees": ["mike@codestrap.me"],
            "operator": "or",
            "timeframe": "next",
            "timeRangeDays": 14
          }
        `)
        .mockResolvedValueOnce('Generated summary for meeting within custom time range');

      mockOfficeService.summarizeCalendars.mockResolvedValue({
        message: 'Fetched 1 events',
        calendars: [{
          email: 'primary',
          events: [mockEventSummary]
        }]
      });

      mockOfficeService.searchDriveFiles.mockResolvedValue({
        files: [],
        totalResults: 0,
        nextPageToken: undefined,
        incompleteSearch: undefined,
        message: 'No files found'
      });

      const context: Context = {
        requestId: 'test-request-4',
        status: 1
      };
      const task = 'When is my next meeting with Mike <mike@codestrap.me> in the next 2 weeks?';

      const result = await findMeetingDetails(context, undefined, task);

      expect(result.found).toBe(true);
      expect(result.meeting?.subject).toBe('Sprint Planning');
      expect(result.summary).toBe('Generated summary for meeting within custom time range');
    });
  });

  describe('Meeting Search - No Results Cases', () => {
    it('should return not found when no meetings match attendees', async () => {
      mockGeminiService.mockResolvedValue(`
        {
          "attendees": ["nonexistent@codestrap.me"],
          "operator": "or",
          "timeframe": "next"
        }
      `);

      mockOfficeService.summarizeCalendars.mockResolvedValue({
        message: 'Fetched 0 events',
        calendars: [{
          email: 'primary',
          events: []
        }]
      });

      const context: Context = {
        requestId: 'test-request-5',
        status: 1
      };
      const task = 'When is my next meeting with Nonexistent <nonexistent@codestrap.me>?';

      const result = await findMeetingDetails(context, undefined, task);

      expect(result.found).toBe(false);
      expect(result.meeting).toBeNull();
      expect(result.message).toContain('No next meetings found');
      expect(result.summary).toBeUndefined();
    });

    it('should return not found when meetings exist but no attendees match', async () => {
      const mockEventSummary: EventSummary = {
        id: 'meeting4',
        subject: 'Other Meeting',
        description: 'Meeting with different people',
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T11:00:00Z',
        durationMinutes: 60,
        participants: ['user@codestrap.me', 'other@codestrap.me'],
      };

      mockGeminiService.mockResolvedValue(`
        {
          "attendees": ["target@codestrap.me"],
          "operator": "or",
          "timeframe": "next"
        }
      `);

      mockOfficeService.summarizeCalendars.mockResolvedValue({
        message: 'Fetched 1 events',
        calendars: [{
          email: 'primary',
          events: [mockEventSummary]
        }]
      });

      const context: Context = {
        requestId: 'test-request-6',
        status: 1
      };
      const task = 'When is my next meeting with Target <target@codestrap.me>?';

      const result = await findMeetingDetails(context, undefined, task);

      expect(result.found).toBe(false);
      expect(result.meeting).toBeNull();
      expect(result.message).toContain('No next meetings found');
    });
  });

  describe('AI Context Extraction', () => {
    it('should extract single attendee with OR operator', async () => {
      mockGeminiService.mockResolvedValue(`
        {
          "attendees": ["single@codestrap.me"],
          "operator": "or",
          "timeframe": "next"
        }
      `);

      mockOfficeService.summarizeCalendars.mockResolvedValue({
        message: 'Fetched 0 events',
        calendars: [{ email: 'primary', events: [] }]
      });

      const context: Context = {
        requestId: 'test-request-7',
        status: 1
      };
      const task = 'When is my next meeting with Single <single@codestrap.me>?';

      await findMeetingDetails(context, undefined, task);

      expect(mockOfficeService.summarizeCalendars).toHaveBeenCalledWith({
        emails: ['primary'],
        timezone: 'UTC',
        windowStartLocal: expect.any(Date),
        windowEndLocal: expect.any(Date)
      });
    });

    it('should extract multiple attendees with AND operator', async () => {
      mockGeminiService.mockResolvedValue(`
        {
          "attendees": ["first@codestrap.me", "second@codestrap.me"],
          "operator": "and",
          "timeframe": "previous"
        }
      `);

      mockOfficeService.summarizeCalendars.mockResolvedValue({
        message: 'Fetched 0 events',
        calendars: [{ email: 'primary', events: [] }]
      });

      const context: Context = {
        requestId: 'test-request-8',
        status: 1
      };
      const task = 'When was my last meeting with First <first@codestrap.me> and Second <second@codestrap.me>?';

      await findMeetingDetails(context, undefined, task);

      expect(mockOfficeService.summarizeCalendars).toHaveBeenCalledWith({
        emails: ['primary'],
        timezone: 'UTC',
        windowStartLocal: expect.any(Date),
        windowEndLocal: expect.any(Date)
      });
    });

    it('should extract custom time range when specified', async () => {
      mockGeminiService.mockResolvedValue(`
        {
          "attendees": ["custom@codestrap.me"],
          "operator": "or",
          "timeframe": "next",
          "timeRangeDays": 7
        }
      `);

      mockOfficeService.summarizeCalendars.mockResolvedValue({
        message: 'Fetched 0 events',
        calendars: [{ email: 'primary', events: [] }]
      });

      const context: Context = {
        requestId: 'test-request-9',
        status: 1
      };
      const task = 'When is my next meeting with Custom <custom@codestrap.me> in the next week?';

      await findMeetingDetails(context, undefined, task);

      expect(mockOfficeService.summarizeCalendars).toHaveBeenCalledWith({
        emails: ['primary'],
        timezone: 'UTC',
        windowStartLocal: expect.any(Date),
        windowEndLocal: expect.any(Date)
      });
    });
  });

  describe('Transcript Search', () => {
    it('should find and retrieve transcript from Drive', async () => {
      const mockEventSummary: EventSummary = {
        id: 'meeting5',
        subject: 'Important Meeting',
        description: 'Critical discussion',
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T11:00:00Z',
        durationMinutes: 60,
        participants: ['user@codestrap.me', 'important@codestrap.me'],
      };

      mockGeminiService
        .mockResolvedValueOnce(`
          {
            "attendees": ["important@codestrap.me"],
            "operator": "or",
            "timeframe": "next"
          }
        `)
        .mockResolvedValueOnce('Generated summary with detailed transcript');

      mockOfficeService.summarizeCalendars.mockResolvedValue({
        message: 'Fetched 1 events',
        calendars: [{
          email: 'primary',
          events: [mockEventSummary]
        }]
      });

      mockOfficeService.searchDriveFiles.mockResolvedValue({
        files: [
          { id: 'file1', name: 'Important Meeting - Transcript.txt', mimeType: 'text/plain' },
          { id: 'file2', name: 'other-file.txt', mimeType: 'text/plain' }
        ],
        totalResults: 2,
        nextPageToken: undefined,
        incompleteSearch: undefined,
        message: 'Search completed'
      });
      
      const mockDriveClient = {
        files: {
          get: jest.fn().mockResolvedValue({
            data: 'Detailed meeting transcript with key decisions and action items...'
          })
        }
      } as unknown as drive_v3.Drive;
      
      mockOfficeService.getDriveClient.mockReturnValue(mockDriveClient);

      const context: Context = {
        requestId: 'test-request-10',
        status: 1
      };
      const task = 'When is my next meeting with Important <important@codestrap.me>?';

      const result = await findMeetingDetails(context, undefined, task);

      expect(result.found).toBe(true);
      expect(result.transcript).toBe('Detailed meeting transcript with key decisions and action items...');
      expect(result.summary).toBe('Generated summary with detailed transcript');
    });

    it('should handle Drive search returning no files gracefully', async () => {
      const mockEventSummary: EventSummary = {
        id: 'meeting6',
        subject: 'Future Meeting',
        description: 'Upcoming meeting without transcript',
        start: '2024-02-15T14:00:00Z',
        end: '2024-02-15T15:00:00Z',
        durationMinutes: 60,
        participants: ['user@codestrap.me', 'future@codestrap.me'],
      };

      mockGeminiService
        .mockResolvedValueOnce(`
          {
            "attendees": ["future@codestrap.me"],
            "operator": "or",
            "timeframe": "next"
          }
        `)
        .mockResolvedValueOnce('Generated summary for future meeting without transcript');

      mockOfficeService.summarizeCalendars.mockResolvedValue({
        message: 'Fetched 1 events',
        calendars: [{
          email: 'primary',
          events: [mockEventSummary]
        }]
      });

      mockOfficeService.searchDriveFiles.mockResolvedValue({
        files: [],
        totalResults: 0,
        nextPageToken: undefined,
        incompleteSearch: undefined,
        message: 'No files found'
      });

      const context: Context = {
        requestId: 'test-request-11',
        status: 1
      };
      const task = 'When is my next meeting with Future <future@codestrap.me>?';

      const result = await findMeetingDetails(context, undefined, task);

      expect(result.found).toBe(true);
      expect(result.transcript).toBeUndefined();
      expect(result.summary).toBe('Generated summary for future meeting without transcript');
    });
  });

  describe('Error Handling', () => {
    it('should let errors bubble up from calendar service', async () => {
      mockGeminiService.mockResolvedValue(`
        {
          "attendees": ["error@codestrap.me"],
          "operator": "or",
          "timeframe": "next"
        }
      `);

      const error = new Error('Calendar API error');
      mockOfficeService.summarizeCalendars.mockRejectedValue(error);

      const context: Context = {
        requestId: 'test-request-12',
        status: 1
      };
      const task = 'When is my next meeting with Error <error@codestrap.me>?';

      await expect(findMeetingDetails(context, undefined, task)).rejects.toThrow('Calendar API error');
    });

    it('should let errors bubble up from Drive service', async () => {
      const mockEventSummary: EventSummary = {
        id: 'meeting7',
        subject: 'Drive Error Meeting',
        description: 'Meeting that causes Drive error',
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T11:00:00Z',
        durationMinutes: 60,
        participants: ['user@codestrap.me', 'drive-error@codestrap.me'],
      };

      mockGeminiService
        .mockResolvedValueOnce(`
          {
            "attendees": ["drive-error@codestrap.me"],
            "operator": "or",
            "timeframe": "next"
          }
        `)
        .mockResolvedValueOnce('Generated summary despite Drive error');

      mockOfficeService.summarizeCalendars.mockResolvedValue({
        message: 'Fetched 1 events',
        calendars: [{
          email: 'primary',
          events: [mockEventSummary]
        }]
      });

      const driveError = new Error('Drive API error');
      mockOfficeService.searchDriveFiles.mockRejectedValue(driveError);

      const context: Context = {
        requestId: 'test-request-13',
        status: 1
      };
      const task = 'When is my next meeting with Drive Error <drive-error@codestrap.me>?';

      await expect(findMeetingDetails(context, undefined, task)).rejects.toThrow('Drive API error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty task string', async () => {
      mockGeminiService.mockResolvedValue(`
        {
          "attendees": ["empty@codestrap.me"],
          "operator": "or",
          "timeframe": "next"
        }
      `);

      mockOfficeService.summarizeCalendars.mockResolvedValue({
        message: 'Fetched 0 events',
        calendars: [{ email: 'primary', events: [] }]
      });

      const context: Context = {
        requestId: 'test-request-14',
        status: 1
      };

      const result = await findMeetingDetails(context, undefined, '');

      expect(result.found).toBe(false);
      expect(result.meeting).toBeNull();
    });

    it('should handle malformed AI response gracefully', async () => {
      mockGeminiService.mockResolvedValue('invalid json response');

      const context: Context = {
        requestId: 'test-request-15',
        status: 1
      };
      const task = 'When is my next meeting with Malformed <malformed@codestrap.me>?';

      await expect(findMeetingDetails(context, undefined, task)).rejects.toThrow();
    });

    it('should handle very large meeting participant lists', async () => {
      const largeParticipantList = Array.from({ length: 50 }, (_, i) => `user${i}@codestrap.me`);
      const mockEventSummary: EventSummary = {
        id: 'meeting8',
        subject: 'Large Team Meeting',
        description: 'Meeting with many participants',
        start: '2024-01-15T10:00:00Z',
        end: '2024-01-15T11:00:00Z',
        durationMinutes: 60,
        participants: ['user@codestrap.me', ...largeParticipantList],
      };

      mockGeminiService
        .mockResolvedValueOnce(`
          {
            "attendees": ["user0@codestrap.me", "user1@codestrap.me"],
            "operator": "or",
            "timeframe": "next"
          }
        `)
        .mockResolvedValueOnce('Generated summary for large meeting');

      mockOfficeService.summarizeCalendars.mockResolvedValue({
        message: 'Fetched 1 events',
        calendars: [{
          email: 'primary',
          events: [mockEventSummary]
        }]
      });

      mockOfficeService.searchDriveFiles.mockResolvedValue({
        files: [],
        totalResults: 0,
        nextPageToken: undefined,
        incompleteSearch: undefined,
        message: 'No files found'
      });

      const context: Context = {
        requestId: 'test-request-16',
        status: 1
      };
      const task = 'When is my next meeting with User0 <user0@codestrap.me> or User1 <user1@codestrap.me>?';

      const result = await findMeetingDetails(context, undefined, task);

      expect(result.found).toBe(true);
      expect(result.meeting?.participants).toHaveLength(51); // user@codestrap.me + 50 others
      expect(result.summary).toBe('Generated summary for large meeting');
    });
  });
});