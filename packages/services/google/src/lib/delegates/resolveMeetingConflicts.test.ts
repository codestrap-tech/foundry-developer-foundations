import { proposeMeetingConflictResolutionsDelegate } from './resolveMeetingConflicts';
import { EventSummary } from '@codestrap/developer-foundations-types';
import { faker } from '@faker-js/faker';
import { calendar_v3 } from 'googleapis';
import { findOptimalMeetingTimeV2, Slot } from './findOptimalMeetingTime.v2';

jest.mock('./findOptimalMeetingTime.v2');
const mockFindOptimalMeetingTimeV2 =
  findOptimalMeetingTimeV2 as jest.MockedFunction<
    typeof findOptimalMeetingTimeV2
  >;

describe('proposeMeetingConflictResolutionsDelegate', () => {
  afterEach(() => {
    jest.clearAllMocks();
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
    const meetingId = faker.string.uuid();

    // when
    const mockCalendar = {
      freebusy: { query: jest.fn().mockResolvedValue({ data: {} }) },
    } as unknown as calendar_v3.Calendar;

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
            {
              id: meetingId,
              start: faker.date.recent().toISOString(),
              end: faker.date.soon().toISOString(),
              durationMinutes: faker.number.int({ min: 5, max: 120 }),
              participants: [userEmail],
            } as EventSummary,
          ],
        },
      ],
    });

    // then
    expect(result).toEqual(
      expect.arrayContaining([
        {
          meetingId,
          resolutionBlocks: expect.arrayContaining([
            { start: optimalMeetingTimeStart, end: optimalMeetingTimeEnd },
          ]),
        },
      ])
    );
  });
});
