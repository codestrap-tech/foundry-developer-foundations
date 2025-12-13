import { proposeMeetingConflictResolutionsDelegate } from './resolveMeetingConflicts';
import type { EventSummary } from '@codestrap/developer-foundations-types';
import { faker } from '@faker-js/faker';
import type { calendar_v3 } from 'googleapis';
import type { Slot } from './findOptimalMeetingTime.v2';
import { findOptimalMeetingTimeV2 } from './findOptimalMeetingTime.v2';

jest.mock('./findOptimalMeetingTime.v2');
const mockFindOptimalMeetingTimeV2 =
  findOptimalMeetingTimeV2 as jest.MockedFunction<
    typeof findOptimalMeetingTimeV2
  >;

describe('proposeMeetingConflictResolutionsDelegate', () => {
  const mockConsoleLog = jest.spyOn(console, 'error').mockImplementation();

  const mockCalendar = {
    freebusy: { query: jest.fn().mockResolvedValue({ data: {} }) },
  } as unknown as calendar_v3.Calendar;

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  it('should get a list conflicted meetings for a given user', async () => {
    // given
    const optimalMeetingTimeStart = faker.date.recent().toISOString();
    const optimalMeetingTimeEnd = faker.date.soon().toISOString();
    mockFindOptimalMeetingTimeV2.mockResolvedValue([
      {
        start: optimalMeetingTimeStart,
        end: optimalMeetingTimeEnd,
      } as Slot,
    ]);

    const userEmail = faker.internet.email();

    const mockEvent = {
      start: faker.date.recent().toISOString(),
      end: faker.date.soon().toISOString(),
      durationMinutes: faker.number.int({ min: 5, max: 120 }),
      participants: [userEmail],
    } as EventSummary;

    // when
    const result = await proposeMeetingConflictResolutionsDelegate({
      userEmails: [userEmail],
      timeFrameFrom: faker.date.recent(),
      timeFrameTo: faker.date.soon(),
      timezone: 'America/Los_Angeles',
      calendar: mockCalendar,

      calendarSummaries: [
        {
          email: userEmail,
          events: [
            { ...mockEvent, id: faker.string.uuid() },
            { ...mockEvent, id: faker.string.uuid() },
          ],
        },
      ],
    });

    // then
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ...mockEvent,
          email: userEmail,
          resolutionBlocks: expect.arrayContaining([
            { start: optimalMeetingTimeStart, end: optimalMeetingTimeEnd },
          ]),
        }),
      ]),
    );
  });

  it('should return an empty array if resolution query fails', async () => {
    // given
    mockFindOptimalMeetingTimeV2.mockRejectedValue(new Error('Test error'));
    const userEmail = faker.internet.email();
    const meetingId = faker.string.uuid();

    const mockEvent = {
      start: faker.date.recent().toISOString(),
      end: faker.date.soon().toISOString(),
      durationMinutes: faker.number.int({ min: 5, max: 120 }),
      participants: [userEmail],
    } as EventSummary;

    // when
    const result = await proposeMeetingConflictResolutionsDelegate({
      userEmails: [userEmail],
      timeFrameFrom: faker.date.recent(),
      timeFrameTo: faker.date.soon(),
      timezone: 'America/Los_Angeles',
      calendar: mockCalendar,
      calendarSummaries: [
        {
          email: userEmail,
          events: [
            { ...mockEvent, id: meetingId },
            { ...mockEvent, id: faker.string.uuid() },
          ],
        },
      ],
    });

    // then
    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining(
        `Error fetching resolution blocks for event ${meetingId}: `,
      ),
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ...mockEvent,
          email: userEmail,
          resolutionBlocks: [],
        }),
      ]),
    );
  });
});
