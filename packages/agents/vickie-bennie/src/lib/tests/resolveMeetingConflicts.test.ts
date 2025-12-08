import { resolveMeetingConflicts } from '../resolveMeetingConflicts';
import { OfficeServiceV3, TYPES } from '@codestrap/developer-foundations-types';
import { faker } from '@faker-js/faker';
import { container } from '@codestrap/developer-foundations-di';

// Mock the container
jest.mock('@codestrap/developer-foundations-di', () => ({
  container: { get: jest.fn(), getAsync: jest.fn() },
}));

const mockContainer = container as jest.Mocked<typeof container>;
const mockOfficeServiceV3 = {
  proposeMeetingConflictResolutions: jest.fn(),
  scheduleMeeting: jest.fn(),
} satisfies Partial<OfficeServiceV3>;

describe('resolveMeetingConflicts', () => {
  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
  const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

  beforeEach(() => {
    mockContainer.getAsync.mockImplementation(async (type) => {
      if (type === TYPES.OfficeServiceV3) {
        return mockOfficeServiceV3;
      }
      throw new Error(`Unknown type: ${String(type)}`);
    });

    faker.seed(75206);
    faker.setDefaultRefDate(new Date('2025-04-11'));
    jest
      .useFakeTimers()
      .setSystemTime(new Date(faker.date.recent().toISOString()));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
    mockConsoleLog.mockRestore();
  });

  describe('error handling', () => {
    it('returns 400 when no CodeStrap users are found', async () => {
      // given
      const nonCodeStrapUsers = [
        faker.internet.email({ provider: 'example.com' }),
      ];

      // when
      const result = await resolveMeetingConflicts(nonCodeStrapUsers);

      // then
      expect(result).toMatchObject({
        status: 400,
        message: 'No CodeStrap users found in the request',
        error: 'No valid users',
        taskList: 'ERROR',
      });
      expect(
        mockOfficeServiceV3.proposeMeetingConflictResolutions
      ).not.toHaveBeenCalled();
    });

    it('returns 500 when dependency retrieval fails', async () => {
      // given
      const errorMessage = faker.lorem.sentence();
      mockContainer.getAsync.mockRejectedValueOnce(new Error(errorMessage));

      // when
      const result = await resolveMeetingConflicts([
        faker.internet.email({ provider: 'codestrap.me' }),
      ]);

      // then
      expect(result).toMatchObject({
        status: 500,
        message: expect.stringContaining('Error resolving meeting conflicts'),
        error: expect.stringContaining(errorMessage),
      });
      expect(mockConsoleError).toHaveBeenCalledWith(
        'resolveMeetingConflicts error:',
        expect.stringContaining(errorMessage)
      );
    });

    it('returns 500 when conflict resolution fails', async () => {
      // given
      const errorMessage = faker.lorem.sentence();
      mockOfficeServiceV3.proposeMeetingConflictResolutions.mockRejectedValueOnce(
        new Error(errorMessage)
      );

      // when
      const result = await resolveMeetingConflicts([
        faker.internet.email({ provider: 'codestrap.me' }),
      ]);

      // then
      expect(result).toMatchObject({
        status: 500,
        message: expect.stringContaining('Error resolving meeting conflicts'),
        error: expect.stringContaining(errorMessage),
      });
      expect(mockConsoleError).toHaveBeenCalledWith(
        'resolveMeetingConflicts error:',
        expect.stringContaining(errorMessage)
      );
    });
  });

  describe('conflict identification', () => {
    it('calls office service v3 to propose meeting conflict resolutions', async () => {
      // given
      const timeFrameFrom = faker.date.recent().toISOString();
      const timeFrameTo = faker.date.soon().toISOString();
      mockOfficeServiceV3.proposeMeetingConflictResolutions.mockResolvedValue(
        []
      );

      const users = [
        faker.internet.email({ provider: 'codestrap.me' }),
        faker.internet.email({ provider: 'codestrap.com' }),
      ];

      // when
      const result = await resolveMeetingConflicts(
        users,
        timeFrameFrom,
        timeFrameTo,
        'America/New_York'
      );

      // then
      expect(result.status).toBe(200);
      expect(
        mockOfficeServiceV3.proposeMeetingConflictResolutions
      ).toHaveBeenCalledWith({
        userEmails: users,
        timeFrameFrom: new Date(timeFrameFrom),
        timeFrameTo: new Date(timeFrameTo),
        timezone: 'America/New_York',
      });
    });
  });

  describe('meeting rescheduling', () => {
    it('reschedules a single meeting to highest-scored block', async () => {
      // given
      const userEmail = faker.internet.email({ provider: 'codestrap.me' });
      const meetingStart = new Date('2025-04-11T10:00:00-07:00');
      const meetingDurationMin = 30;
      const meetingEnd = new Date(
        meetingStart.getTime() + meetingDurationMin * 60 * 1000
      );

      // Create resolution blocks: closer block has higher score, farther block has lower score
      const higherScoredBlockStart = new Date(
        meetingStart.getTime() + 2 * 60 * 60 * 1000
      ); // 2 hours later (closer to original)
      const higherScoredBlockEnd = new Date(
        higherScoredBlockStart.getTime() + meetingDurationMin * 60 * 1000
      );
      const fartherBlockStart = new Date(
        meetingStart.getTime() + 24 * 60 * 60 * 1000
      ); // Next day (farther from original)
      const fartherBlockEnd = new Date(
        fartherBlockStart.getTime() + meetingDurationMin * 60 * 1000
      );

      const higherScoredBlock = {
        start: higherScoredBlockStart.toISOString(),
        end: higherScoredBlockEnd.toISOString(),
        score: 90,
      };
      const meetingId = faker.string.uuid();
      const mockMeetings = [
        {
          id: meetingId,
          email: userEmail,
          subject: faker.company.buzzNoun(),
          description: faker.lorem.sentence(),
          start: meetingStart.toISOString(),
          end: meetingEnd.toISOString(),
          durationMinutes: meetingDurationMin,
          participants: [userEmail],
          resolutionBlocks: [
            {
              start: fartherBlockStart.toISOString(),
              end: fartherBlockEnd.toISOString(),
              score: 70, // Lower score for farther block
            },
            higherScoredBlock,
          ],
        },
      ];

      mockOfficeServiceV3.proposeMeetingConflictResolutions.mockResolvedValue(
        mockMeetings
      );

      // when
      await resolveMeetingConflicts([userEmail]);

      // then
      expect(mockOfficeServiceV3.scheduleMeeting).toHaveBeenCalledTimes(1);
      mockMeetings.forEach((meeting) => {
        expect(mockOfficeServiceV3.scheduleMeeting).toHaveBeenCalledWith(
          expect.objectContaining({
            summary: meeting.subject,
            description: meeting.description,
            start: higherScoredBlock.start,
            end: higherScoredBlock.end,
            attendees: meeting.participants,
          })
        );
      });
    });

    it('reschedules sequentially scheduled meetings without conflicts', async () => {
      // given
      const userEmail = faker.internet.email({ provider: 'codestrap.me' });
      const baseTime = new Date('2025-04-11T09:00:00-07:00');
      const meeting1Duration = 45; // 45 minutes
      const meeting2Duration = 30; // 30 minutes

      // Meeting 1: Original time and resolution blocks
      const meeting1Start = baseTime;
      const meeting1End = new Date(
        meeting1Start.getTime() + meeting1Duration * 60 * 1000
      );
      // Meeting 1's block is closer to original (2 hours later)
      const meeting1Block1Start = new Date(
        meeting1Start.getTime() + 2 * 60 * 60 * 1000
      ); // 2 hours later
      const meeting1Block1End = new Date(
        meeting1Block1Start.getTime() + meeting1Duration * 60 * 1000
      );

      // Meeting 2: Starts after meeting 1 ends, with non-overlapping blocks
      const meeting2Start = new Date(meeting1End.getTime() + 30 * 60 * 1000); // 30 minutes after meeting 1
      const meeting2End = new Date(
        meeting2Start.getTime() + meeting2Duration * 60 * 1000
      );
      // Meeting 2's block is also closer to its original (2 hours later) and 1 hour after meeting 1's block (no overlap)
      const meeting2Block1Start = new Date(
        meeting2Start.getTime() + 2 * 60 * 60 * 1000
      ); // 2 hours after meeting 2's original time
      const meeting2Block1End = new Date(
        meeting2Block1Start.getTime() + meeting2Duration * 60 * 1000
      );

      const meeting1Block1 = {
        start: meeting1Block1Start.toISOString(),
        end: meeting1Block1End.toISOString(),
        score: 85, // Higher score for closer block (2 hours from original)
      };
      const meeting2Block1 = {
        start: meeting2Block1Start.toISOString(),
        end: meeting2Block1End.toISOString(),
        score: 80, // Higher score for closer block (2 hours from original)
      };
      const meeting1Id = faker.string.uuid();
      const meeting2Id = faker.string.uuid();
      const mockMeetings = [
        {
          id: meeting1Id,
          email: userEmail,
          subject: faker.company.buzzNoun(),
          description: faker.lorem.sentence(),
          start: meeting1Start.toISOString(),
          end: meeting1End.toISOString(),
          durationMinutes: meeting1Duration,
          participants: [userEmail],
          resolutionBlocks: [meeting1Block1],
        },
        {
          id: meeting2Id,
          email: userEmail,
          subject: faker.company.buzzNoun(),
          description: faker.lorem.sentence(),
          start: meeting2Start.toISOString(),
          end: meeting2End.toISOString(),
          durationMinutes: meeting2Duration,
          participants: [userEmail],
          resolutionBlocks: [meeting2Block1],
        },
      ];

      mockOfficeServiceV3.proposeMeetingConflictResolutions.mockResolvedValue(
        mockMeetings
      );

      // when
      await resolveMeetingConflicts([userEmail]);

      // then
      expect(mockOfficeServiceV3.scheduleMeeting).toHaveBeenCalledTimes(2);
      expect(mockOfficeServiceV3.scheduleMeeting.mock.calls).toEqual([
        expect.arrayContaining([
          expect.objectContaining({
            summary: mockMeetings[0].subject,
            description: mockMeetings[0].description,
            start: meeting1Block1.start,
            end: meeting1Block1.end,
            attendees: mockMeetings[0].participants,
          }),
        ]),
        expect.arrayContaining([
          expect.objectContaining({
            summary: mockMeetings[1].subject,
            description: mockMeetings[1].description,
            start: meeting2Block1.start,
            end: meeting2Block1.end,
            attendees: mockMeetings[1].participants,
          }),
        ]),
      ]);
    });

    it('reschedules meetings with priority-based conflict resolution', async () => {
      // given
      const userEmail = faker.internet.email({ provider: 'codestrap.me' });
      const baseTime = new Date('2025-04-11T14:00:00-07:00');
      const meetingDuration = 60; // 60 minutes

      // Meeting 1 (higher priority - index 0, first in the list)
      const meeting1Start = baseTime;
      const meeting1End = new Date(
        meeting1Start.getTime() + meetingDuration * 60 * 1000
      );
      // Meeting 1's closer block (higher score)
      const higherScoreAvailableTimeSlotStart = new Date(
        meeting1Start.getTime() + 2 * 60 * 60 * 1000
      ); // 2 hours later (closer to original)
      const higherScoreAvailableTimeSlotEnd = new Date(
        higherScoreAvailableTimeSlotStart.getTime() +
          meetingDuration * 60 * 1000
      );

      // Meeting 2 (lower priority - index 1, second in the list)
      const meeting2Start = new Date(meeting1Start.getTime() + 30 * 60 * 1000); // 30 min after meeting 1
      const meeting2End = new Date(
        meeting2Start.getTime() + meetingDuration * 60 * 1000
      );

      const higherScoreAvailableTimeSlot = {
        start: higherScoreAvailableTimeSlotStart.toISOString(),
        end: higherScoreAvailableTimeSlotEnd.toISOString(),
        score: 90, // Higher score for closer block (2 hours from original)
      };

      const lowerScoreAvailableTimeSlotStart = new Date(
        higherScoreAvailableTimeSlotEnd.getTime() + 30 * 60 * 1000
      ); // 30 minutes after meeting 1's block ends (farther from meeting2's original)
      const lowerScoreAvailableTimeSlotEnd = new Date(
        lowerScoreAvailableTimeSlotStart.getTime() + meetingDuration * 60 * 1000
      );
      const lowerScoreAvailableTimeSlot = {
        start: lowerScoreAvailableTimeSlotStart.toISOString(),
        end: lowerScoreAvailableTimeSlotEnd.toISOString(),
        score: 75, // Lower score for farther block, but no conflict
      };
      const meeting1Id = faker.string.uuid();
      const meeting2Id = faker.string.uuid();
      const mockMeetings = [
        {
          id: meeting1Id,
          email: userEmail,
          subject: faker.company.buzzNoun(),
          description: faker.lorem.sentence(),
          start: meeting1Start.toISOString(),
          end: meeting1End.toISOString(),
          durationMinutes: meetingDuration,
          participants: [userEmail],
          resolutionBlocks: [
            higherScoreAvailableTimeSlot,
            lowerScoreAvailableTimeSlot,
          ],
        },
        {
          id: meeting2Id,
          email: userEmail,
          subject: faker.company.buzzNoun(),
          description: faker.lorem.sentence(),
          start: meeting2Start.toISOString(),
          end: meeting2End.toISOString(),
          durationMinutes: meetingDuration,
          participants: [userEmail],
          resolutionBlocks: [
            higherScoreAvailableTimeSlot,
            lowerScoreAvailableTimeSlot,
          ],
        },
      ];

      mockOfficeServiceV3.proposeMeetingConflictResolutions.mockResolvedValue(
        mockMeetings
      );

      // when
      await resolveMeetingConflicts([userEmail]);

      // then
      expect(mockOfficeServiceV3.scheduleMeeting).toHaveBeenCalledTimes(2);
      expect(mockOfficeServiceV3.scheduleMeeting.mock.calls).toEqual([
        expect.arrayContaining([
          expect.objectContaining({
            summary: mockMeetings[0].subject,
            description: mockMeetings[0].description,
            start: higherScoreAvailableTimeSlot.start,
            end: higherScoreAvailableTimeSlot.end,
            attendees: mockMeetings[0].participants,
          }),
        ]),
        expect.arrayContaining([
          expect.objectContaining({
            summary: mockMeetings[1].subject,
            description: mockMeetings[1].description,
            start: lowerScoreAvailableTimeSlot.start,
            end: lowerScoreAvailableTimeSlot.end,
            attendees: mockMeetings[1].participants,
          }),
        ]),
      ]);
    });

    it('marks meeting with no resolution blocks as unresolved', async () => {
      // given
      const userEmail = faker.internet.email({ provider: 'codestrap.me' });
      const baseTime = new Date('2025-04-11T11:00:00-07:00');
      const meetingDuration = 30;

      const meetingStart = baseTime;
      const meetingEnd = new Date(
        meetingStart.getTime() + meetingDuration * 60 * 1000
      );

      const meetingId = faker.string.uuid();
      const mockMeetings = [
        {
          id: meetingId,
          email: userEmail,
          subject: faker.company.buzzNoun(),
          description: faker.lorem.sentence(),
          start: meetingStart.toISOString(),
          end: meetingEnd.toISOString(),
          durationMinutes: meetingDuration,
          participants: [userEmail],
          resolutionBlocks: [], // No resolution blocks
        },
      ];

      mockOfficeServiceV3.proposeMeetingConflictResolutions.mockResolvedValue(
        mockMeetings
      );

      // when
      await resolveMeetingConflicts([userEmail]);

      // then
      expect(mockOfficeServiceV3.scheduleMeeting).not.toHaveBeenCalled();
    });

    it('reschedules multiple meetings with complex overlapping scenarios', async () => {
      // given
      const userEmail = faker.internet.email({ provider: 'codestrap.me' });
      const baseTime = new Date('2025-04-11T08:00:00-07:00');
      const meeting1Duration = 45;
      const meeting2Duration = 30;
      const meeting3Duration = 60;

      // Meeting 1 (highest priority - index 0, first in the list)
      const meeting1Start = baseTime;
      const meeting1End = new Date(
        meeting1Start.getTime() + meeting1Duration * 60 * 1000
      );

      // Meeting 2 (medium priority - index 1, second in the list)
      // Original time overlaps with meeting 1
      const meeting2Start = new Date(
        meeting1Start.getTime() + (meeting1Duration / 2) * 60 * 1000
      ); // Starts halfway through meeting 1
      const meeting2End = new Date(
        meeting2Start.getTime() + meeting2Duration * 60 * 1000
      );

      // Meeting 3 (lowest priority - index 2, third in the list)
      const meeting3Start = new Date(meeting1End.getTime() + 15 * 60 * 1000); // 15 min after meeting 1
      const meeting3End = new Date(
        meeting3Start.getTime() + meeting3Duration * 60 * 1000
      );

      // Shared resolution blocks - all meetings have access to the same blocks
      // Highest score block (closer to original times)
      const highestScoreAvailableTimeSlotStart = new Date(
        meeting1Start.getTime() + 2 * 60 * 60 * 1000
      ); // 2 hours later (closer to original)
      const highestScoreAvailableTimeSlotEnd = new Date(
        highestScoreAvailableTimeSlotStart.getTime() +
          meeting1Duration * 60 * 1000
      );

      // Medium score block (farther from original times)
      const mediumScoreAvailableTimeSlotStart = new Date(
        highestScoreAvailableTimeSlotEnd.getTime() + 30 * 60 * 1000
      ); // 30 minutes after highest score block ends
      const mediumScoreAvailableTimeSlotEnd = new Date(
        mediumScoreAvailableTimeSlotStart.getTime() +
          meeting2Duration * 60 * 1000
      );

      // Lowest score block (farthest from original times)
      const lowestScoreAvailableTimeSlotStart = new Date(
        mediumScoreAvailableTimeSlotEnd.getTime() + 30 * 60 * 1000
      ); // 30 minutes after medium score block ends
      const lowestScoreAvailableTimeSlotEnd = new Date(
        lowestScoreAvailableTimeSlotStart.getTime() +
          meeting3Duration * 60 * 1000
      );

      const highestScoreAvailableTimeSlot = {
        start: highestScoreAvailableTimeSlotStart.toISOString(),
        end: highestScoreAvailableTimeSlotEnd.toISOString(),
        score: 90, // Highest score for closer block (2 hours from original)
      };

      const mediumScoreAvailableTimeSlot = {
        start: mediumScoreAvailableTimeSlotStart.toISOString(),
        end: mediumScoreAvailableTimeSlotEnd.toISOString(),
        score: 80, // Medium score for farther block
      };

      const lowestScoreAvailableTimeSlot = {
        start: lowestScoreAvailableTimeSlotStart.toISOString(),
        end: lowestScoreAvailableTimeSlotEnd.toISOString(),
        score: 75, // Lowest score for farthest block
      };

      const meeting1Id = faker.string.uuid();
      const meeting2Id = faker.string.uuid();
      const meeting3Id = faker.string.uuid();
      const mockMeetings = [
        {
          id: meeting1Id,
          email: userEmail,
          subject: faker.company.buzzNoun(),
          description: faker.lorem.sentence(),
          start: meeting1Start.toISOString(),
          end: meeting1End.toISOString(),
          durationMinutes: meeting1Duration,
          participants: [userEmail],
          resolutionBlocks: [
            highestScoreAvailableTimeSlot,
            mediumScoreAvailableTimeSlot,
            lowestScoreAvailableTimeSlot,
          ],
        },
        {
          id: meeting2Id,
          email: userEmail,
          subject: faker.company.buzzNoun(),
          description: faker.lorem.sentence(),
          start: meeting2Start.toISOString(),
          end: meeting2End.toISOString(),
          durationMinutes: meeting2Duration,
          participants: [userEmail],
          resolutionBlocks: [
            highestScoreAvailableTimeSlot,
            mediumScoreAvailableTimeSlot,
            lowestScoreAvailableTimeSlot,
          ],
        },
        {
          id: meeting3Id,
          email: userEmail,
          subject: faker.company.buzzNoun(),
          description: faker.lorem.sentence(),
          start: meeting3Start.toISOString(),
          end: meeting3End.toISOString(),
          durationMinutes: meeting3Duration,
          participants: [userEmail],
          resolutionBlocks: [
            highestScoreAvailableTimeSlot,
            mediumScoreAvailableTimeSlot,
            lowestScoreAvailableTimeSlot,
          ],
        },
      ];

      mockOfficeServiceV3.proposeMeetingConflictResolutions.mockResolvedValue(
        mockMeetings
      );

      // when
      await resolveMeetingConflicts([userEmail]);

      // then
      expect(mockOfficeServiceV3.scheduleMeeting).toHaveBeenCalledTimes(3);
      expect(mockOfficeServiceV3.scheduleMeeting.mock.calls).toEqual([
        expect.arrayContaining([
          expect.objectContaining({
            summary: mockMeetings[0].subject,
            description: mockMeetings[0].description,
            start: highestScoreAvailableTimeSlot.start,
            end: highestScoreAvailableTimeSlot.end,
            attendees: mockMeetings[0].participants,
          }),
        ]),
        expect.arrayContaining([
          expect.objectContaining({
            summary: mockMeetings[1].subject,
            description: mockMeetings[1].description,
            start: mediumScoreAvailableTimeSlot.start,
            end: mediumScoreAvailableTimeSlot.end,
            attendees: mockMeetings[1].participants,
          }),
        ]),
        expect.arrayContaining([
          expect.objectContaining({
            summary: mockMeetings[2].subject,
            description: mockMeetings[2].description,
            start: lowestScoreAvailableTimeSlot.start,
            end: lowestScoreAvailableTimeSlot.end,
            attendees: mockMeetings[2].participants,
          }),
        ]),
      ]);
    });
  });
});
