import { makeGSuiteClientV3 } from './gsuiteClient.v3';
import { makeGSuiteClientV2 } from './gsuiteClient.v2';
import {
  CalendarSummary,
  OfficeServiceV2,
  Summaries,
} from '@codestrap/developer-foundations-types';
import { faker } from '@faker-js/faker';
import { calendar_v3 } from 'googleapis';

// Mock the v2 client
jest.mock('./gsuiteClient.v2');
const mockMakeGSuiteClientV2 = makeGSuiteClientV2 as jest.MockedFunction<
  typeof makeGSuiteClientV2
>;

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

describe('makeGSuiteClientV3', () => {
  const mockCalendarClient = {
    freebusy: { query: jest.fn().mockResolvedValue({ data: {} }) },
  } as unknown as calendar_v3.Calendar;
  const mockV2Client = {
    getCalendarClient: jest.fn().mockReturnValue(mockCalendarClient),
    summarizeCalendars: jest.fn().mockResolvedValue({
      calendars: [
        {
          events: [
            {
              id: faker.string.uuid(),
              start: faker.date.past(),
              end: faker.date.future(),
              durationMinutes: faker.number.int({ min: 5, max: 120 }),
              participants: [faker.internet.email()],
            } as Partial<CalendarSummary>,
          ],
        },
      ],
    } as Partial<Summaries>),
  } as Partial<OfficeServiceV2>;

  beforeEach(() => {
    mockMakeGSuiteClientV2.mockResolvedValue(mockV2Client as OfficeServiceV2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  it('should get a list conflicted meetings for a given user', async () => {
    // given
    const client = await makeGSuiteClientV3(faker.internet.email());

    // when
    const result = await client.proposeMeetingConflictResolutions({
      userEmails: [faker.internet.email()],
      timeFrameFrom: faker.date.past(),
      timeFrameTo: faker.date.future(),
      timezone: 'America/Los_Angeles',
    });

    // then
    expect(result).toEqual(
      expect.arrayContaining([
        {
          meetingId: expect.any(String),
          resolutionBlocks: expect.arrayContaining([
            { start: expect.any(String), end: expect.any(String) },
          ]),
        },
      ])
    );
  });
});
