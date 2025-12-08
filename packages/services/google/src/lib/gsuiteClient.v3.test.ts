import { makeGSuiteClientV3 } from './gsuiteClient.v3';
import { makeGSuiteClientV2 } from './gsuiteClient.v2';
import {
  CalendarSummary,
  CreateGoogleSlidesInput,
  OfficeServiceV2,
  Summaries,
} from '@codestrap/developer-foundations-types';
import { faker } from '@faker-js/faker';
import { calendar_v3 } from 'googleapis';
import { createGoogleSlidesDelegate } from './delegates/createGoogleSlides';

// Mock the v2 client
jest.mock('./gsuiteClient.v2');
const mockMakeGSuiteClientV2 = makeGSuiteClientV2 as jest.MockedFunction<
  typeof makeGSuiteClientV2
>;

// Mock the slides delegate
jest.mock('./delegates/createGoogleSlides');
const mockCreateGoogleSlidesDelegate =
  createGoogleSlidesDelegate as jest.MockedFunction<
    typeof createGoogleSlidesDelegate
  >;

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

describe('makeGSuiteClientV3', () => {
  const mockCalendarClient = {
    freebusy: { query: jest.fn().mockResolvedValue({ data: {} }) },
  } as unknown as calendar_v3.Calendar;

  const mockDriveClient = {} as any; // shape not important here because we mock the delegate

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
    getDriveClient: jest.fn().mockReturnValue(mockDriveClient),
  } as Partial<OfficeServiceV2>;

  beforeEach(() => {
    mockMakeGSuiteClientV2.mockResolvedValue(mockV2Client as OfficeServiceV2);

    // default mock for slides delegate so tests don't blow up
    mockCreateGoogleSlidesDelegate.mockResolvedValue({
      successes: [],
      failures: [],
    });
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

  it('should call createGoogleSlidesDelegate with drive and slides clients', async () => {
    // given
    const user = faker.internet.email();
    const client = await makeGSuiteClientV3(user);

    const input: CreateGoogleSlidesInput = [
      {
        templateId: 'https://docs.google.com/presentation/d/TEMPLATE_ID/edit',
        name: 'Test Deck',
        content: [
          {
            targetType: 'PLACEHOLDER',
            placeholder: '{{TITLE}}',
            text: 'Hello Slides',
          },
        ],
      },
    ];

    const expectedOutput = {
      successes: [],
      failures: [],
    };

    mockCreateGoogleSlidesDelegate.mockResolvedValueOnce(expectedOutput);

    // when
    const result = await client.createGoogleSlides(input);

    // then
    expect(mockCreateGoogleSlidesDelegate).toHaveBeenCalledTimes(1);

    const callArgs = mockCreateGoogleSlidesDelegate.mock.calls[0][0];

    // The v3 client should pass through the input, the v2 drive client, and a slides client
    expect(callArgs.input).toBe(input);
    expect(callArgs.drive).toBe(mockDriveClient);
    expect(callArgs.slides).toBeDefined();

    expect(result).toBe(expectedOutput);
  });
});
