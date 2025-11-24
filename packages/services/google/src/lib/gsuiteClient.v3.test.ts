import { makeGSuiteClientV3 } from './gsuiteClient.v3';
import { makeGSuiteClientV2 } from './gsuiteClient.v2';
import {
  identifyMeetingConflictsDelegate,
  proposeMeetingConflictResolutionsDelegate,
} from './delegates/resolveMeetingConflicts';
import {
  IdentifyMeetingConflictsInput,
  IdentifyMeetingConflictsOutput,
  ProposeMeetingConflictResolutionsInput,
  ProposeMeetingConflictResolutionsOutput,
} from '@codestrap/developer-foundations-types';

// Mock the v2 client
jest.mock('./gsuiteClient.v2');
const mockMakeGSuiteClientV2 = makeGSuiteClientV2 as jest.MockedFunction<
  typeof makeGSuiteClientV2
>;

// Mock the delegate functions
jest.mock('./delegates/resolveMeetingConflicts');
const mockIdentifyMeetingConflictsDelegate =
  identifyMeetingConflictsDelegate as jest.MockedFunction<
    typeof identifyMeetingConflictsDelegate
  >;
const mockProposeMeetingConflictResolutionsDelegate =
  proposeMeetingConflictResolutionsDelegate as jest.MockedFunction<
    typeof proposeMeetingConflictResolutionsDelegate
  >;

describe('makeGSuiteClientV3', () => {
  const mockUser = 'test@example.com';
  const mockCalendarClient = {} as any;
  const mockV2Client = {
    getCalendarClient: jest.fn().mockReturnValue(mockCalendarClient),
    getEmailClient: jest.fn().mockReturnValue({}),
    getDriveClient: jest.fn().mockReturnValue({}),
    searchDriveFiles: jest.fn(),
    summarizeCalendars: jest.fn(),
    getAvailableMeetingTimes: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMakeGSuiteClientV2.mockResolvedValue(mockV2Client);
  });

  describe('factory & inheritance', () => {
    it('should call makeGSuiteClientV2 with correct user', async () => {
      await makeGSuiteClientV3(mockUser);

      expect(mockMakeGSuiteClientV2).toHaveBeenCalledWith(mockUser);
    });

    it('should return all v2 client methods plus v3 methods', async () => {
      const client = await makeGSuiteClientV3(mockUser);

      // Check that v2 methods are available
      expect(client.searchDriveFiles).toBeDefined();
      expect(client.summarizeCalendars).toBeDefined();
      expect(client.getAvailableMeetingTimes).toBeDefined();

      // Check that v3 methods are available
      expect(client.identifyMeetingConflicts).toBeDefined();
      expect(client.proposeMeetingConflictResolutions).toBeDefined();
    });

    it('should preserve v1 client functionality', async () => {
      const client = await makeGSuiteClientV3(mockUser);

      expect(typeof client.getCalendarClient).toBe('function');
      expect(typeof client.getEmailClient).toBe('function');
      expect(typeof client.getDriveClient).toBe('function');
    });
  });

  describe('identifyMeetingConflicts method', () => {
    it('should return validation error when userEmails is empty', async () => {
      const client = await makeGSuiteClientV3(mockUser);
      const input: IdentifyMeetingConflictsInput = {
        userEmails: [],
      };

      const result = await client.identifyMeetingConflicts(input);

      expect(result).toEqual({
        identifiedConflicts: [],
        message: 'Invalid input: userEmails array cannot be empty.',
      });
      expect(mockIdentifyMeetingConflictsDelegate).not.toHaveBeenCalled();
    });

    it('should return validation error when userEmails is missing', async () => {
      const client = await makeGSuiteClientV3(mockUser);
      const input = {} as IdentifyMeetingConflictsInput;

      const result = await client.identifyMeetingConflicts(input);

      expect(result).toEqual({
        identifiedConflicts: [],
        message: 'Invalid input: userEmails array cannot be empty.',
      });
      expect(mockIdentifyMeetingConflictsDelegate).not.toHaveBeenCalled();
    });

    it('should call identifyMeetingConflictsDelegate with correct parameters', async () => {
      const mockOutput: IdentifyMeetingConflictsOutput = {
        identifiedConflicts: [],
        message: 'No meeting conflicts found',
      };

      mockIdentifyMeetingConflictsDelegate.mockResolvedValue(mockOutput);

      const client = await makeGSuiteClientV3(mockUser);
      const input: IdentifyMeetingConflictsInput = {
        userEmails: ['user1@example.com', 'user2@example.com'],
      };

      const result = await client.identifyMeetingConflicts(input);

      expect(mockIdentifyMeetingConflictsDelegate).toHaveBeenCalledWith({
        calendarClient: mockCalendarClient,
        userEmails: input.userEmails,
        timezone: 'UTC',
        windowStartLocal: expect.any(Date),
        windowEndLocal: expect.any(Date),
      });
      expect(result).toEqual(mockOutput);
    });

    describe('date window logic', () => {
      it('should use targetDayISO for single day window', async () => {
        const mockOutput: IdentifyMeetingConflictsOutput = {
          identifiedConflicts: [],
          message: 'No meeting conflicts found',
        };

        mockIdentifyMeetingConflictsDelegate.mockResolvedValue(mockOutput);

        const client = await makeGSuiteClientV3(mockUser);
        const targetDate = '2024-03-15T00:00:00Z';
        const input: IdentifyMeetingConflictsInput = {
          userEmails: ['user1@example.com'],
          targetDayISO: targetDate,
        };

        await client.identifyMeetingConflicts(input);

        const callArgs = mockIdentifyMeetingConflictsDelegate.mock.calls[0][0];
        const windowStart = callArgs.windowStartLocal;
        const windowEnd = callArgs.windowEndLocal;

        // Should be start and end of the same day (accounting for timezone)
        expect(windowStart.getHours()).toBe(0);
        expect(windowStart.getMinutes()).toBe(0);
        expect(windowStart.getSeconds()).toBe(0);
        expect(windowEnd.getHours()).toBe(23);
        expect(windowEnd.getMinutes()).toBe(59);
        expect(windowEnd.getSeconds()).toBe(59);
        // The dates should be on the same calendar day (allowing for timezone differences)
        const startDateStr = windowStart.toISOString().split('T')[0];
        const endDateStr = windowEnd.toISOString().split('T')[0];
        // They should be the same day or at most 1 day apart due to timezone
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        const diffDays = Math.abs(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        expect(diffDays).toBeLessThanOrEqual(1);
      });

      it('should use timeFrameStartISO and timeFrameEndISO when both provided', async () => {
        const mockOutput: IdentifyMeetingConflictsOutput = {
          identifiedConflicts: [],
          message: 'No meeting conflicts found',
        };

        mockIdentifyMeetingConflictsDelegate.mockResolvedValue(mockOutput);

        const client = await makeGSuiteClientV3(mockUser);
        const startDate = '2024-03-15T00:00:00Z';
        const endDate = '2024-03-20T00:00:00Z';
        const input: IdentifyMeetingConflictsInput = {
          userEmails: ['user1@example.com'],
          timeFrameStartISO: startDate,
          timeFrameEndISO: endDate,
        };

        await client.identifyMeetingConflicts(input);

        const callArgs = mockIdentifyMeetingConflictsDelegate.mock.calls[0][0];
        const windowStart = callArgs.windowStartLocal;
        const windowEnd = callArgs.windowEndLocal;

        expect(windowStart.getHours()).toBe(0);
        expect(windowStart.getMinutes()).toBe(0);
        expect(windowEnd.getHours()).toBe(23);
        expect(windowEnd.getMinutes()).toBe(59);
      });

      it('should default to one week when only timeFrameStartISO is provided', async () => {
        const mockOutput: IdentifyMeetingConflictsOutput = {
          identifiedConflicts: [],
          message: 'No meeting conflicts found',
        };

        mockIdentifyMeetingConflictsDelegate.mockResolvedValue(mockOutput);

        const client = await makeGSuiteClientV3(mockUser);
        const startDate = '2024-03-15T00:00:00Z';
        const input: IdentifyMeetingConflictsInput = {
          userEmails: ['user1@example.com'],
          timeFrameStartISO: startDate,
        };

        await client.identifyMeetingConflicts(input);

        const callArgs = mockIdentifyMeetingConflictsDelegate.mock.calls[0][0];
        const windowStart = callArgs.windowStartLocal;
        const windowEnd = callArgs.windowEndLocal;

        // Should be approximately 7 days apart (allowing for day boundary calculations)
        const diffDays = Math.round(
          (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24)
        );
        // The implementation adds 7 days, which can result in 7 or 8 days depending on time boundaries
        expect(diffDays).toBeGreaterThanOrEqual(7);
        expect(diffDays).toBeLessThanOrEqual(8);
      });

      it('should default to today through end of working week when no dates provided', async () => {
        const mockOutput: IdentifyMeetingConflictsOutput = {
          identifiedConflicts: [],
          message: 'No meeting conflicts found',
        };

        mockIdentifyMeetingConflictsDelegate.mockResolvedValue(mockOutput);

        const client = await makeGSuiteClientV3(mockUser);
        const input: IdentifyMeetingConflictsInput = {
          userEmails: ['user1@example.com'],
        };

        await client.identifyMeetingConflicts(input);

        const callArgs = mockIdentifyMeetingConflictsDelegate.mock.calls[0][0];
        const windowStart = callArgs.windowStartLocal;
        const windowEnd = callArgs.windowEndLocal;

        // windowStart should be start of today
        expect(windowStart.getHours()).toBe(0);
        expect(windowStart.getMinutes()).toBe(0);

        // windowEnd should be end of Friday (working week end)
        const dayOfWeek = windowEnd.getDay();
        expect(dayOfWeek).toBe(5); // Friday
        expect(windowEnd.getHours()).toBe(23);
        expect(windowEnd.getMinutes()).toBe(59);
      });
    });

    it('should propagate errors from identifyMeetingConflictsDelegate', async () => {
      const error = new Error('Delegate failed');
      mockIdentifyMeetingConflictsDelegate.mockRejectedValue(error);

      const client = await makeGSuiteClientV3(mockUser);
      const input: IdentifyMeetingConflictsInput = {
        userEmails: ['user1@example.com'],
      };

      await expect(client.identifyMeetingConflicts(input)).rejects.toThrow(
        'Delegate failed'
      );
    });
  });

  describe('proposeMeetingConflictResolutions method', () => {
    it('should return validation error when both identifiedConflicts and userEmails are missing', async () => {
      const client = await makeGSuiteClientV3(mockUser);
      const input: ProposeMeetingConflictResolutionsInput = {
        userEmails: [],
      };

      const result = await client.proposeMeetingConflictResolutions(input);

      expect(result).toEqual({
        identifiedConflicts: [],
        resolutionReports: [],
        summary: {
          totalConflicts: 0,
          proposalsGenerated: 0,
          invalidProposals: 0,
          validProposals: 0,
        },
        errors: ['Invalid input: userEmails array cannot be empty.'],
      });
      expect(
        mockProposeMeetingConflictResolutionsDelegate
      ).not.toHaveBeenCalled();
    });

    it('should return validation error when identifiedConflicts is empty and userEmails is empty', async () => {
      const client = await makeGSuiteClientV3(mockUser);
      const input: ProposeMeetingConflictResolutionsInput = {
        identifiedConflicts: [],
        userEmails: [],
      };

      const result = await client.proposeMeetingConflictResolutions(input);

      expect(result).toEqual({
        identifiedConflicts: [],
        resolutionReports: [],
        summary: {
          totalConflicts: 0,
          proposalsGenerated: 0,
          invalidProposals: 0,
          validProposals: 0,
        },
        errors: ['Invalid input: userEmails array cannot be empty.'],
      });
      expect(
        mockProposeMeetingConflictResolutionsDelegate
      ).not.toHaveBeenCalled();
    });

    it('should call proposeMeetingConflictResolutionsDelegate when identifiedConflicts are provided', async () => {
      const mockOutput: ProposeMeetingConflictResolutionsOutput = {
        identifiedConflicts: [],
        resolutionReports: [],
        summary: {
          totalConflicts: 0,
          proposalsGenerated: 0,
          invalidProposals: 0,
          validProposals: 0,
        },
      };

      mockProposeMeetingConflictResolutionsDelegate.mockResolvedValue(
        mockOutput
      );

      const client = await makeGSuiteClientV3(mockUser);
      const input: ProposeMeetingConflictResolutionsInput = {
        userEmails: [],
        identifiedConflicts: [
          {
            id: 'meeting1',
            title: 'Test Meeting',
            organizer: 'user1@example.com',
            attendees: [{ email: 'user1@example.com', role: 'required' }],
            startTime: '2024-03-15T10:00:00Z',
            endTime: '2024-03-15T11:00:00Z',
            durationMinutes: 60,
          },
        ],
      };

      const result = await client.proposeMeetingConflictResolutions(input);

      expect(
        mockProposeMeetingConflictResolutionsDelegate
      ).toHaveBeenCalledWith({
        calendarClient: mockCalendarClient,
        userEmails: [],
        timezone: 'UTC',
        windowStartLocal: expect.any(Date),
        windowEndLocal: expect.any(Date),
        identifiedConflicts: input.identifiedConflicts,
        fullDayCalendars: input.fullDayCalendars,
      });
      expect(result).toEqual(mockOutput);
    });

    it('should call proposeMeetingConflictResolutionsDelegate when userEmails are provided', async () => {
      const mockOutput: ProposeMeetingConflictResolutionsOutput = {
        identifiedConflicts: [],
        resolutionReports: [],
        summary: {
          totalConflicts: 0,
          proposalsGenerated: 0,
          invalidProposals: 0,
          validProposals: 0,
        },
      };

      mockProposeMeetingConflictResolutionsDelegate.mockResolvedValue(
        mockOutput
      );

      const client = await makeGSuiteClientV3(mockUser);
      const input: ProposeMeetingConflictResolutionsInput = {
        userEmails: ['user1@example.com', 'user2@example.com'],
      };

      const result = await client.proposeMeetingConflictResolutions(input);

      expect(
        mockProposeMeetingConflictResolutionsDelegate
      ).toHaveBeenCalledWith({
        calendarClient: mockCalendarClient,
        userEmails: input.userEmails,
        timezone: 'UTC',
        windowStartLocal: expect.any(Date),
        windowEndLocal: expect.any(Date),
        identifiedConflicts: input.identifiedConflicts,
        fullDayCalendars: input.fullDayCalendars,
      });
      expect(result).toEqual(mockOutput);
    });

    describe('date window logic', () => {
      it('should use targetDayISO for single day window', async () => {
        const mockOutput: ProposeMeetingConflictResolutionsOutput = {
          identifiedConflicts: [],
          resolutionReports: [],
          summary: {
            totalConflicts: 0,
            proposalsGenerated: 0,
            invalidProposals: 0,
            validProposals: 0,
          },
        };

        mockProposeMeetingConflictResolutionsDelegate.mockResolvedValue(
          mockOutput
        );

        const client = await makeGSuiteClientV3(mockUser);
        const targetDate = '2024-03-15T00:00:00Z';
        const input: ProposeMeetingConflictResolutionsInput = {
          userEmails: ['user1@example.com'],
          targetDayISO: targetDate,
        };

        await client.proposeMeetingConflictResolutions(input);

        const callArgs =
          mockProposeMeetingConflictResolutionsDelegate.mock.calls[0][0];
        const windowStart = callArgs.windowStartLocal;
        const windowEnd = callArgs.windowEndLocal;

        expect(windowStart.getHours()).toBe(0);
        expect(windowStart.getMinutes()).toBe(0);
        expect(windowEnd.getHours()).toBe(23);
        expect(windowEnd.getMinutes()).toBe(59);
        // The dates should be on the same calendar day (allowing for timezone differences)
        const startDateStr = windowStart.toISOString().split('T')[0];
        const endDateStr = windowEnd.toISOString().split('T')[0];
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        const diffDays = Math.abs(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        expect(diffDays).toBeLessThanOrEqual(1);
      });

      it('should use timeFrameStartISO and timeFrameEndISO when both provided', async () => {
        const mockOutput: ProposeMeetingConflictResolutionsOutput = {
          identifiedConflicts: [],
          resolutionReports: [],
          summary: {
            totalConflicts: 0,
            proposalsGenerated: 0,
            invalidProposals: 0,
            validProposals: 0,
          },
        };

        mockProposeMeetingConflictResolutionsDelegate.mockResolvedValue(
          mockOutput
        );

        const client = await makeGSuiteClientV3(mockUser);
        const startDate = '2024-03-15T00:00:00Z';
        const endDate = '2024-03-20T00:00:00Z';
        const input: ProposeMeetingConflictResolutionsInput = {
          userEmails: ['user1@example.com'],
          timeFrameStartISO: startDate,
          timeFrameEndISO: endDate,
        };

        await client.proposeMeetingConflictResolutions(input);

        const callArgs =
          mockProposeMeetingConflictResolutionsDelegate.mock.calls[0][0];
        const windowStart = callArgs.windowStartLocal;
        const windowEnd = callArgs.windowEndLocal;

        expect(windowStart.getHours()).toBe(0);
        expect(windowStart.getMinutes()).toBe(0);
        expect(windowEnd.getHours()).toBe(23);
        expect(windowEnd.getMinutes()).toBe(59);
      });

      it('should default to one week when only timeFrameStartISO is provided', async () => {
        const mockOutput: ProposeMeetingConflictResolutionsOutput = {
          identifiedConflicts: [],
          resolutionReports: [],
          summary: {
            totalConflicts: 0,
            proposalsGenerated: 0,
            invalidProposals: 0,
            validProposals: 0,
          },
        };

        mockProposeMeetingConflictResolutionsDelegate.mockResolvedValue(
          mockOutput
        );

        const client = await makeGSuiteClientV3(mockUser);
        const startDate = '2024-03-15T00:00:00Z';
        const input: ProposeMeetingConflictResolutionsInput = {
          userEmails: ['user1@example.com'],
          timeFrameStartISO: startDate,
        };

        await client.proposeMeetingConflictResolutions(input);

        const callArgs =
          mockProposeMeetingConflictResolutionsDelegate.mock.calls[0][0];
        const windowStart = callArgs.windowStartLocal;
        const windowEnd = callArgs.windowEndLocal;

        // Should be approximately 7 days apart (allowing for day boundary calculations)
        const diffDays = Math.round(
          (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24)
        );
        // The implementation adds 7 days, which can result in 7 or 8 days depending on time boundaries
        expect(diffDays).toBeGreaterThanOrEqual(7);
        expect(diffDays).toBeLessThanOrEqual(8);
      });

      it('should default to today through end of working week when no dates provided', async () => {
        const mockOutput: ProposeMeetingConflictResolutionsOutput = {
          identifiedConflicts: [],
          resolutionReports: [],
          summary: {
            totalConflicts: 0,
            proposalsGenerated: 0,
            invalidProposals: 0,
            validProposals: 0,
          },
        };

        mockProposeMeetingConflictResolutionsDelegate.mockResolvedValue(
          mockOutput
        );

        const client = await makeGSuiteClientV3(mockUser);
        const input: ProposeMeetingConflictResolutionsInput = {
          userEmails: ['user1@example.com'],
        };

        await client.proposeMeetingConflictResolutions(input);

        const callArgs =
          mockProposeMeetingConflictResolutionsDelegate.mock.calls[0][0];
        const windowStart = callArgs.windowStartLocal;
        const windowEnd = callArgs.windowEndLocal;

        expect(windowStart.getHours()).toBe(0);
        expect(windowStart.getMinutes()).toBe(0);

        const dayOfWeek = windowEnd.getDay();
        expect(dayOfWeek).toBe(5); // Friday
        expect(windowEnd.getHours()).toBe(23);
        expect(windowEnd.getMinutes()).toBe(59);
      });
    });

    it('should propagate errors from proposeMeetingConflictResolutionsDelegate', async () => {
      const error = new Error('Delegate failed');
      mockProposeMeetingConflictResolutionsDelegate.mockRejectedValue(error);

      const client = await makeGSuiteClientV3(mockUser);
      const input: ProposeMeetingConflictResolutionsInput = {
        userEmails: ['user1@example.com'],
      };

      await expect(
        client.proposeMeetingConflictResolutions(input)
      ).rejects.toThrow('Delegate failed');
    });
  });

  describe('error handling', () => {
    it('should propagate errors from makeGSuiteClientV2', async () => {
      const error = new Error('Failed to create v2 client');
      mockMakeGSuiteClientV2.mockRejectedValue(error);

      await expect(makeGSuiteClientV3(mockUser)).rejects.toThrow(
        'Failed to create v2 client'
      );
    });
  });
});
