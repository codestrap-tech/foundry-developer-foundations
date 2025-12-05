import { resolveMeetingConflicts } from '../resolveMeetingConflicts';
import {
  GeminiService,
  OfficeService,
  OfficeServiceV3,
  TYPES,
} from '@codestrap/developer-foundations-types';
import { faker } from '@faker-js/faker';
import { container } from '@codestrap/developer-foundations-di';

// Mock the container
jest.mock('@codestrap/developer-foundations-di', () => ({
  container: { get: jest.fn(), getAsync: jest.fn() },
}));

// Mock utils
jest.mock('@codestrap/developer-foundations-utils', () => ({
  ...jest.requireActual('@codestrap/developer-foundations-utils'),
  extractJsonFromBackticks: jest.fn((str: string) => str),
  uuidv4: jest.fn(() => faker.string.uuid()),
}));

const mockContainer = container as jest.Mocked<typeof container>;
const mockGeminiService = jest.fn() satisfies Partial<GeminiService>;
const mockOfficeService = {
  scheduleMeeting: jest.fn(),
} satisfies Partial<OfficeService>;
const mockOfficeServiceV3 = {
  proposeMeetingConflictResolutions: jest.fn(),
} satisfies Partial<OfficeServiceV3>;

describe('resolveMeetingConflicts', () => {
  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

  beforeEach(() => {
    mockContainer.get.mockReturnValue(mockGeminiService);
    mockContainer.getAsync.mockImplementation(async (type) => {
      if (type === TYPES.OfficeService) {
        return mockOfficeService;
      }
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
  });

  it('should return 400 when no CodeStrap users are found', async () => {
    // given
    const geminiResponse = JSON.stringify({
      users: [faker.internet.email({ provider: 'example.com' })],
      timeFrameFrom: faker.date.recent().toISOString(),
      timeFrameTo: faker.date.soon().toISOString(),
    });
    mockGeminiService.mockResolvedValueOnce(geminiResponse);

    // when
    const result = await resolveMeetingConflicts(faker.lorem.sentence());

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

  it('should handle errors and return 500 status', async () => {
    // given
    const errorMessage = faker.lorem.sentence();
    mockContainer.getAsync.mockRejectedValueOnce(new Error(errorMessage));

    // when
    const result = await resolveMeetingConflicts(faker.lorem.sentence());

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

  it('should handle errors during conflict resolution', async () => {
    // given
    const geminiResponse = JSON.stringify({
      users: [faker.internet.email({ provider: 'codestrap.me' })],
      timeFrameFrom: faker.date.recent().toISOString(),
      timeFrameTo: faker.date.soon().toISOString(),
    });
    mockGeminiService.mockResolvedValueOnce(geminiResponse);

    const errorMessage = faker.lorem.sentence();
    mockOfficeServiceV3.proposeMeetingConflictResolutions.mockRejectedValueOnce(
      new Error(errorMessage)
    );

    // when
    const result = await resolveMeetingConflicts(faker.lorem.sentence());

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

  it('should call gemini service to extract conflict details', async () => {
    // given
    const userRequest = faker.lorem.sentence();

    // when
    await resolveMeetingConflicts(userRequest);

    // then
    expect(mockGeminiService).toHaveBeenCalledWith(
      expect.stringContaining(userRequest),
      expect.stringContaining(
        new Date().toLocaleString('en-US', {
          timeZone: 'America/Los_Angeles',
        })
      )
    );

    expect(mockGeminiService.mock.lastCall).toMatchInlineSnapshot(`
      [
        "
      # Task
      Using the conflict resolution request from the end user extract the key details. You must extract:
      1. The users we are resolving conflicts for
      2. The time frame for the conflict resolution (default to today if not specified)
      3. The frame should start from current local date/time if not specified

      # The conflict resolution request from the end user is:
      Candidus bardus tristis arma totam eveniet sordeo vivo conservo.

      Let's take this step by step.
      1. First determine if any users mentioned in the input task most likely match the users below. If so return the matching user(s) in the user array
      Connor Deeks <connor.deeks@codestrap.me> - Connor Deeks in the CEO and board member in charge of platform leads, business strategy, and investor relations.
      Dorian Smiley <dsmiley@codestrap.me> - Dorian is the CTO who manages the software engineers and is responsible for technology strategy, execution, and the lead applied AI engineer.
      2. Insert any explicit email addresses into the user array
      3. Extract the time frame based on the conflict resolution request from the end user.
      If not time frame can be extracted for this conflict resolution request use "today" starting from now till the end of the day. Time zone is America/Los_Angeles
      Use ISO 8601 format for the time frame.
      Consider working day from 8 AM to 5 PM.

      You can only respond in JSON in the following format:
      {
          users: Array<string>;
          timeFrameFrom: string;
          timeFrameTo: string;
      }

      For example:
      {
          "users": ["connor.deeks@codestrap.me", "dsmiley@codestrap.me"],
          "timeFrameFrom": "2025-04-11T16:00:00Z",
          "timeFrameTo": "2025-12-05T01:00:00Z"
      }
      ",
        "You are a helpful virtual assistant tasked with identifying meeting conflicts for specified users and resolving them.
          You are professional in your tone, personable, and always start your messages with the phrase, "Hi, I'm Vickie, Code's AI EA" or similar. 
          You can get creative on your greeting, taking into account the day of the week. Today is Thursday. 
          You can also take into account the time of year such as American holidays like Halloween, Thanksgiving, Christmas, etc. 
          The current local date/time is 4/9/2025, 8:45:11 PM. 
          Time zone is America/Los_Angeles.
          Working day is from 8 AM to 5 PM.
          When resolving meeting conflicts you always extract the key details from the input task.",
      ]
    `);
  });

  it('should call office service v3 to propose meeting conflict resolutions', async () => {
    // given
    const task = faker.lorem.sentence();
    const mockLLMResponse = {
      users: [faker.internet.email({ provider: 'codestrap.me' })],
      timeFrameFrom: faker.date.recent().toISOString(),
      timeFrameTo: faker.date.soon().toISOString(),
    };
    mockGeminiService.mockResolvedValueOnce(JSON.stringify(mockLLMResponse));

    mockOfficeServiceV3.proposeMeetingConflictResolutions.mockResolvedValue([
      {
        meetingId: faker.string.uuid(),
        resolutionBlocks: [
          {
            start: faker.date.recent().toISOString(),
            end: faker.date.soon().toISOString(),
          },
        ],
      },
    ]);

    // when
    await resolveMeetingConflicts(task);

    // then
    expect(
      mockOfficeServiceV3.proposeMeetingConflictResolutions
    ).toHaveBeenCalledWith({
      userEmails: mockLLMResponse.users,
      timeFrameFrom: new Date(mockLLMResponse.timeFrameFrom),
      timeFrameTo: new Date(mockLLMResponse.timeFrameTo),
      timezone: 'America/Los_Angeles',
    });
  });
});

// const exampleProposeMeetingResponse: ProposeMeetingConflictResolutionsOutput = [
//   {
//     email: 'igor@codestrap.me',
//     id: '7h491kic47b10kd6k0bp0hj4de_20251208T120000Z',
//     subject: 'daily sync',
//     start: '2025-12-08T04:00:00-08:00',
//     end: '2025-12-08T04:30:00-08:00',
//     durationMinutes: 30,
//     participants: ['pnowak@codestrap.me', 'igor@codestrap.me'],
//     meetingLink: 'https://meet.google.com/aai-kcjj-jwy',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T08:30:00-08:00',
//         end: '2025-12-05T09:00:00-08:00',
//         score: 98.60490972222222,
//       },
//       {
//         start: '2025-12-05T11:30:00-08:00',
//         end: '2025-12-05T12:00:00-08:00',
//         score: 97.10490986111111,
//       },
//       {
//         start: '2025-12-05T12:00:00-08:00',
//         end: '2025-12-05T12:30:00-08:00',
//         score: 96.85490986111111,
//       },
//       {
//         start: '2025-12-05T12:30:00-08:00',
//         end: '2025-12-05T13:00:00-08:00',
//         score: 96.60490986111111,
//       },
//       {
//         start: '2025-12-05T13:00:00-08:00',
//         end: '2025-12-05T13:30:00-08:00',
//         score: 96.35491,
//       },
//       {
//         start: '2025-12-05T13:30:00-08:00',
//         end: '2025-12-05T14:00:00-08:00',
//         score: 96.10491,
//       },
//       {
//         start: '2025-12-05T14:00:00-08:00',
//         end: '2025-12-05T14:30:00-08:00',
//         score: 95.85491,
//       },
//       {
//         start: '2025-12-05T14:30:00-08:00',
//         end: '2025-12-05T15:00:00-08:00',
//         score: 95.60491,
//       },
//       {
//         start: '2025-12-05T15:00:00-08:00',
//         end: '2025-12-05T15:30:00-08:00',
//         score: 95.35491013888888,
//       },
//       {
//         start: '2025-12-05T15:30:00-08:00',
//         end: '2025-12-05T16:00:00-08:00',
//         score: 95.10491013888888,
//       },
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.85491013888888,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.60491013888888,
//       },
//       {
//         start: '2025-12-08T08:00:00-08:00',
//         end: '2025-12-08T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T08:30:00-08:00',
//         end: '2025-12-08T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T11:30:00-08:00',
//         end: '2025-12-08T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:00:00-08:00',
//         end: '2025-12-08T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:30:00-08:00',
//         end: '2025-12-08T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:00:00-08:00',
//         end: '2025-12-08T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:30:00-08:00',
//         end: '2025-12-08T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:00:00-08:00',
//         end: '2025-12-08T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:30:00-08:00',
//         end: '2025-12-08T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:00:00-08:00',
//         end: '2025-12-08T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:30:00-08:00',
//         end: '2025-12-08T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:00:00-08:00',
//         end: '2025-12-09T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:30:00-08:00',
//         end: '2025-12-09T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T11:30:00-08:00',
//         end: '2025-12-09T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:00:00-08:00',
//         end: '2025-12-09T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:30:00-08:00',
//         end: '2025-12-09T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:00:00-08:00',
//         end: '2025-12-09T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:30:00-08:00',
//         end: '2025-12-09T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:00:00-08:00',
//         end: '2025-12-09T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:30:00-08:00',
//         end: '2025-12-09T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:00:00-08:00',
//         end: '2025-12-09T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:30:00-08:00',
//         end: '2025-12-09T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T11:30:00-08:00',
//         end: '2025-12-10T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:30:00-08:00',
//         end: '2025-12-10T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:30:00-08:00',
//         end: '2025-12-10T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:30:00-08:00',
//         end: '2025-12-11T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T11:30:00-08:00',
//         end: '2025-12-11T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:00:00-08:00',
//         end: '2025-12-11T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:00:00-08:00',
//         end: '2025-12-11T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:30:00-08:00',
//         end: '2025-12-11T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:00:00-08:00',
//         end: '2025-12-11T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:30:00-08:00',
//         end: '2025-12-11T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '54jc9djmi0te83k96o62nd7m8l_20251208T170000Z',
//     subject: 'Standup',
//     start: '2025-12-08T09:00:00-08:00',
//     end: '2025-12-08T09:30:00-08:00',
//     durationMinutes: 30,
//     participants: [
//       'pnowak@codestrap.me',
//       'igor@codestrap.me',
//       'dsmiley@codestrap.me',
//     ],
//     meetingLink: 'https://meet.google.com/bgh-pprj-tun',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.85490819444445,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.60490819444445,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '7h491kic47b10kd6k0bp0hj4de_20251209T120000Z',
//     subject: 'daily sync',
//     start: '2025-12-09T04:00:00-08:00',
//     end: '2025-12-09T04:30:00-08:00',
//     durationMinutes: 30,
//     participants: ['pnowak@codestrap.me', 'igor@codestrap.me'],
//     meetingLink: 'https://meet.google.com/aai-kcjj-jwy',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T08:30:00-08:00',
//         end: '2025-12-05T09:00:00-08:00',
//         score: 98.60491666666667,
//       },
//       {
//         start: '2025-12-05T11:30:00-08:00',
//         end: '2025-12-05T12:00:00-08:00',
//         score: 97.10491680555556,
//       },
//       {
//         start: '2025-12-05T12:00:00-08:00',
//         end: '2025-12-05T12:30:00-08:00',
//         score: 96.85491680555556,
//       },
//       {
//         start: '2025-12-05T12:30:00-08:00',
//         end: '2025-12-05T13:00:00-08:00',
//         score: 96.60491680555556,
//       },
//       {
//         start: '2025-12-05T13:00:00-08:00',
//         end: '2025-12-05T13:30:00-08:00',
//         score: 96.35491680555556,
//       },
//       {
//         start: '2025-12-05T13:30:00-08:00',
//         end: '2025-12-05T14:00:00-08:00',
//         score: 96.10491680555556,
//       },
//       {
//         start: '2025-12-05T14:00:00-08:00',
//         end: '2025-12-05T14:30:00-08:00',
//         score: 95.85491680555556,
//       },
//       {
//         start: '2025-12-05T14:30:00-08:00',
//         end: '2025-12-05T15:00:00-08:00',
//         score: 95.60491694444444,
//       },
//       {
//         start: '2025-12-05T15:00:00-08:00',
//         end: '2025-12-05T15:30:00-08:00',
//         score: 95.35491694444444,
//       },
//       {
//         start: '2025-12-05T15:30:00-08:00',
//         end: '2025-12-05T16:00:00-08:00',
//         score: 95.10491694444444,
//       },
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.85491694444444,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.60491694444444,
//       },
//       {
//         start: '2025-12-08T08:00:00-08:00',
//         end: '2025-12-08T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T08:30:00-08:00',
//         end: '2025-12-08T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T11:30:00-08:00',
//         end: '2025-12-08T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:00:00-08:00',
//         end: '2025-12-08T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:30:00-08:00',
//         end: '2025-12-08T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:00:00-08:00',
//         end: '2025-12-08T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:30:00-08:00',
//         end: '2025-12-08T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:00:00-08:00',
//         end: '2025-12-08T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:30:00-08:00',
//         end: '2025-12-08T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:00:00-08:00',
//         end: '2025-12-08T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:30:00-08:00',
//         end: '2025-12-08T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:00:00-08:00',
//         end: '2025-12-09T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:30:00-08:00',
//         end: '2025-12-09T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T11:30:00-08:00',
//         end: '2025-12-09T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:00:00-08:00',
//         end: '2025-12-09T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:30:00-08:00',
//         end: '2025-12-09T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:00:00-08:00',
//         end: '2025-12-09T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:30:00-08:00',
//         end: '2025-12-09T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:00:00-08:00',
//         end: '2025-12-09T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:30:00-08:00',
//         end: '2025-12-09T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:00:00-08:00',
//         end: '2025-12-09T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:30:00-08:00',
//         end: '2025-12-09T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T11:30:00-08:00',
//         end: '2025-12-10T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:30:00-08:00',
//         end: '2025-12-10T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:30:00-08:00',
//         end: '2025-12-10T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:30:00-08:00',
//         end: '2025-12-11T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T11:30:00-08:00',
//         end: '2025-12-11T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:00:00-08:00',
//         end: '2025-12-11T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:00:00-08:00',
//         end: '2025-12-11T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:30:00-08:00',
//         end: '2025-12-11T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:00:00-08:00',
//         end: '2025-12-11T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:30:00-08:00',
//         end: '2025-12-11T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '54jc9djmi0te83k96o62nd7m8l_20251209T170000Z',
//     subject: 'Standup',
//     start: '2025-12-09T09:00:00-08:00',
//     end: '2025-12-09T09:30:00-08:00',
//     durationMinutes: 30,
//     participants: [
//       'pnowak@codestrap.me',
//       'igor@codestrap.me',
//       'dsmiley@codestrap.me',
//     ],
//     meetingLink: 'https://meet.google.com/bgh-pprj-tun',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.85493583333333,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.60493597222222,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '7h491kic47b10kd6k0bp0hj4de_20251210T120000Z',
//     subject: 'daily sync',
//     start: '2025-12-10T04:00:00-08:00',
//     end: '2025-12-10T04:30:00-08:00',
//     durationMinutes: 30,
//     participants: ['pnowak@codestrap.me', 'igor@codestrap.me'],
//     meetingLink: 'https://meet.google.com/aai-kcjj-jwy',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T08:30:00-08:00',
//         end: '2025-12-05T09:00:00-08:00',
//         score: 98.60491430555555,
//       },
//       {
//         start: '2025-12-05T11:30:00-08:00',
//         end: '2025-12-05T12:00:00-08:00',
//         score: 97.10491430555555,
//       },
//       {
//         start: '2025-12-05T12:00:00-08:00',
//         end: '2025-12-05T12:30:00-08:00',
//         score: 96.85491430555555,
//       },
//       {
//         start: '2025-12-05T12:30:00-08:00',
//         end: '2025-12-05T13:00:00-08:00',
//         score: 96.60491430555555,
//       },
//       {
//         start: '2025-12-05T13:00:00-08:00',
//         end: '2025-12-05T13:30:00-08:00',
//         score: 96.35491430555555,
//       },
//       {
//         start: '2025-12-05T13:30:00-08:00',
//         end: '2025-12-05T14:00:00-08:00',
//         score: 96.10491430555555,
//       },
//       {
//         start: '2025-12-05T14:00:00-08:00',
//         end: '2025-12-05T14:30:00-08:00',
//         score: 95.85491444444445,
//       },
//       {
//         start: '2025-12-05T14:30:00-08:00',
//         end: '2025-12-05T15:00:00-08:00',
//         score: 95.60491444444445,
//       },
//       {
//         start: '2025-12-05T15:00:00-08:00',
//         end: '2025-12-05T15:30:00-08:00',
//         score: 95.35491444444445,
//       },
//       {
//         start: '2025-12-05T15:30:00-08:00',
//         end: '2025-12-05T16:00:00-08:00',
//         score: 95.10491444444445,
//       },
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.85491444444445,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.60491458333334,
//       },
//       {
//         start: '2025-12-08T08:00:00-08:00',
//         end: '2025-12-08T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T08:30:00-08:00',
//         end: '2025-12-08T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T11:30:00-08:00',
//         end: '2025-12-08T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:00:00-08:00',
//         end: '2025-12-08T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:30:00-08:00',
//         end: '2025-12-08T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:00:00-08:00',
//         end: '2025-12-08T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:30:00-08:00',
//         end: '2025-12-08T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:00:00-08:00',
//         end: '2025-12-08T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:30:00-08:00',
//         end: '2025-12-08T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:00:00-08:00',
//         end: '2025-12-08T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:30:00-08:00',
//         end: '2025-12-08T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:00:00-08:00',
//         end: '2025-12-09T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:30:00-08:00',
//         end: '2025-12-09T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T11:30:00-08:00',
//         end: '2025-12-09T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:00:00-08:00',
//         end: '2025-12-09T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:30:00-08:00',
//         end: '2025-12-09T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:00:00-08:00',
//         end: '2025-12-09T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:30:00-08:00',
//         end: '2025-12-09T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:00:00-08:00',
//         end: '2025-12-09T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:30:00-08:00',
//         end: '2025-12-09T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:00:00-08:00',
//         end: '2025-12-09T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:30:00-08:00',
//         end: '2025-12-09T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T11:30:00-08:00',
//         end: '2025-12-10T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:30:00-08:00',
//         end: '2025-12-10T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:30:00-08:00',
//         end: '2025-12-10T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:30:00-08:00',
//         end: '2025-12-11T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T11:30:00-08:00',
//         end: '2025-12-11T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:00:00-08:00',
//         end: '2025-12-11T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:00:00-08:00',
//         end: '2025-12-11T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:30:00-08:00',
//         end: '2025-12-11T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:00:00-08:00',
//         end: '2025-12-11T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:30:00-08:00',
//         end: '2025-12-11T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '54jc9djmi0te83k96o62nd7m8l_20251210T170000Z',
//     subject: 'Standup',
//     start: '2025-12-10T09:00:00-08:00',
//     end: '2025-12-10T09:30:00-08:00',
//     durationMinutes: 30,
//     participants: [
//       'pnowak@codestrap.me',
//       'igor@codestrap.me',
//       'dsmiley@codestrap.me',
//     ],
//     meetingLink: 'https://meet.google.com/bgh-pprj-tun',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.85492097222222,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.60492097222222,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '7h491kic47b10kd6k0bp0hj4de_20251211T120000Z',
//     subject: 'daily sync',
//     start: '2025-12-11T04:00:00-08:00',
//     end: '2025-12-11T04:30:00-08:00',
//     durationMinutes: 30,
//     participants: ['pnowak@codestrap.me', 'igor@codestrap.me'],
//     meetingLink: 'https://meet.google.com/aai-kcjj-jwy',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T08:30:00-08:00',
//         end: '2025-12-05T09:00:00-08:00',
//         score: 98.60492388888889,
//       },
//       {
//         start: '2025-12-05T11:30:00-08:00',
//         end: '2025-12-05T12:00:00-08:00',
//         score: 97.10492388888889,
//       },
//       {
//         start: '2025-12-05T12:00:00-08:00',
//         end: '2025-12-05T12:30:00-08:00',
//         score: 96.85492388888889,
//       },
//       {
//         start: '2025-12-05T12:30:00-08:00',
//         end: '2025-12-05T13:00:00-08:00',
//         score: 96.60492388888889,
//       },
//       {
//         start: '2025-12-05T13:00:00-08:00',
//         end: '2025-12-05T13:30:00-08:00',
//         score: 96.35492388888889,
//       },
//       {
//         start: '2025-12-05T13:30:00-08:00',
//         end: '2025-12-05T14:00:00-08:00',
//         score: 96.10492388888889,
//       },
//       {
//         start: '2025-12-05T14:00:00-08:00',
//         end: '2025-12-05T14:30:00-08:00',
//         score: 95.85492402777778,
//       },
//       {
//         start: '2025-12-05T14:30:00-08:00',
//         end: '2025-12-05T15:00:00-08:00',
//         score: 95.60492402777778,
//       },
//       {
//         start: '2025-12-05T15:00:00-08:00',
//         end: '2025-12-05T15:30:00-08:00',
//         score: 95.35492402777778,
//       },
//       {
//         start: '2025-12-05T15:30:00-08:00',
//         end: '2025-12-05T16:00:00-08:00',
//         score: 95.10492402777778,
//       },
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.85492402777778,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.60492402777778,
//       },
//       {
//         start: '2025-12-08T08:00:00-08:00',
//         end: '2025-12-08T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T08:30:00-08:00',
//         end: '2025-12-08T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T11:30:00-08:00',
//         end: '2025-12-08T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:00:00-08:00',
//         end: '2025-12-08T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:30:00-08:00',
//         end: '2025-12-08T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:00:00-08:00',
//         end: '2025-12-08T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:30:00-08:00',
//         end: '2025-12-08T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:00:00-08:00',
//         end: '2025-12-08T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:30:00-08:00',
//         end: '2025-12-08T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:00:00-08:00',
//         end: '2025-12-08T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:30:00-08:00',
//         end: '2025-12-08T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:00:00-08:00',
//         end: '2025-12-09T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:30:00-08:00',
//         end: '2025-12-09T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T11:30:00-08:00',
//         end: '2025-12-09T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:00:00-08:00',
//         end: '2025-12-09T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:30:00-08:00',
//         end: '2025-12-09T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:00:00-08:00',
//         end: '2025-12-09T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:30:00-08:00',
//         end: '2025-12-09T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:00:00-08:00',
//         end: '2025-12-09T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:30:00-08:00',
//         end: '2025-12-09T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:00:00-08:00',
//         end: '2025-12-09T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:30:00-08:00',
//         end: '2025-12-09T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T11:30:00-08:00',
//         end: '2025-12-10T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:30:00-08:00',
//         end: '2025-12-10T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:30:00-08:00',
//         end: '2025-12-10T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:30:00-08:00',
//         end: '2025-12-11T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T11:30:00-08:00',
//         end: '2025-12-11T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:00:00-08:00',
//         end: '2025-12-11T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:00:00-08:00',
//         end: '2025-12-11T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:30:00-08:00',
//         end: '2025-12-11T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:00:00-08:00',
//         end: '2025-12-11T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:30:00-08:00',
//         end: '2025-12-11T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '54jc9djmi0te83k96o62nd7m8l_20251211T170000Z',
//     subject: 'Standup',
//     start: '2025-12-11T09:00:00-08:00',
//     end: '2025-12-11T09:30:00-08:00',
//     durationMinutes: 30,
//     participants: [
//       'pnowak@codestrap.me',
//       'igor@codestrap.me',
//       'dsmiley@codestrap.me',
//     ],
//     meetingLink: 'https://meet.google.com/bgh-pprj-tun',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.85491597222222,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.60491597222222,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '7h491kic47b10kd6k0bp0hj4de_20251212T120000Z',
//     subject: 'daily sync',
//     start: '2025-12-12T04:00:00-08:00',
//     end: '2025-12-12T04:30:00-08:00',
//     durationMinutes: 30,
//     participants: ['pnowak@codestrap.me', 'igor@codestrap.me'],
//     meetingLink: 'https://meet.google.com/aai-kcjj-jwy',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T08:30:00-08:00',
//         end: '2025-12-05T09:00:00-08:00',
//         score: 98.60491222222223,
//       },
//       {
//         start: '2025-12-05T11:30:00-08:00',
//         end: '2025-12-05T12:00:00-08:00',
//         score: 97.1049123611111,
//       },
//       {
//         start: '2025-12-05T12:00:00-08:00',
//         end: '2025-12-05T12:30:00-08:00',
//         score: 96.8549123611111,
//       },
//       {
//         start: '2025-12-05T12:30:00-08:00',
//         end: '2025-12-05T13:00:00-08:00',
//         score: 96.6049123611111,
//       },
//       {
//         start: '2025-12-05T13:00:00-08:00',
//         end: '2025-12-05T13:30:00-08:00',
//         score: 96.3549123611111,
//       },
//       {
//         start: '2025-12-05T13:30:00-08:00',
//         end: '2025-12-05T14:00:00-08:00',
//         score: 96.1049123611111,
//       },
//       {
//         start: '2025-12-05T14:00:00-08:00',
//         end: '2025-12-05T14:30:00-08:00',
//         score: 95.8549125,
//       },
//       {
//         start: '2025-12-05T14:30:00-08:00',
//         end: '2025-12-05T15:00:00-08:00',
//         score: 95.6049125,
//       },
//       {
//         start: '2025-12-05T15:00:00-08:00',
//         end: '2025-12-05T15:30:00-08:00',
//         score: 95.3549125,
//       },
//       {
//         start: '2025-12-05T15:30:00-08:00',
//         end: '2025-12-05T16:00:00-08:00',
//         score: 95.1049125,
//       },
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.8549125,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.6049125,
//       },
//       {
//         start: '2025-12-08T08:00:00-08:00',
//         end: '2025-12-08T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T08:30:00-08:00',
//         end: '2025-12-08T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T11:30:00-08:00',
//         end: '2025-12-08T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:00:00-08:00',
//         end: '2025-12-08T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T12:30:00-08:00',
//         end: '2025-12-08T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:00:00-08:00',
//         end: '2025-12-08T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T13:30:00-08:00',
//         end: '2025-12-08T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:00:00-08:00',
//         end: '2025-12-08T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T14:30:00-08:00',
//         end: '2025-12-08T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:00:00-08:00',
//         end: '2025-12-08T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T15:30:00-08:00',
//         end: '2025-12-08T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:00:00-08:00',
//         end: '2025-12-09T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T08:30:00-08:00',
//         end: '2025-12-09T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T11:30:00-08:00',
//         end: '2025-12-09T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:00:00-08:00',
//         end: '2025-12-09T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T12:30:00-08:00',
//         end: '2025-12-09T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:00:00-08:00',
//         end: '2025-12-09T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T13:30:00-08:00',
//         end: '2025-12-09T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:00:00-08:00',
//         end: '2025-12-09T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T14:30:00-08:00',
//         end: '2025-12-09T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:00:00-08:00',
//         end: '2025-12-09T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T15:30:00-08:00',
//         end: '2025-12-09T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T11:30:00-08:00',
//         end: '2025-12-10T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:30:00-08:00',
//         end: '2025-12-10T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:30:00-08:00',
//         end: '2025-12-10T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:30:00-08:00',
//         end: '2025-12-11T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T11:30:00-08:00',
//         end: '2025-12-11T12:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:00:00-08:00',
//         end: '2025-12-11T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:00:00-08:00',
//         end: '2025-12-11T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T13:30:00-08:00',
//         end: '2025-12-11T14:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:00:00-08:00',
//         end: '2025-12-11T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T15:30:00-08:00',
//         end: '2025-12-11T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
//   {
//     email: 'igor@codestrap.me',
//     id: '54jc9djmi0te83k96o62nd7m8l_20251212T170000Z',
//     subject: 'Standup',
//     start: '2025-12-12T09:00:00-08:00',
//     end: '2025-12-12T09:30:00-08:00',
//     durationMinutes: 30,
//     participants: [
//       'pnowak@codestrap.me',
//       'igor@codestrap.me',
//       'dsmiley@codestrap.me',
//     ],
//     meetingLink: 'https://meet.google.com/bgh-pprj-tun',
//     resolutionBlocks: [
//       {
//         start: '2025-12-05T16:00:00-08:00',
//         end: '2025-12-05T16:30:00-08:00',
//         score: 94.85493124999999,
//       },
//       {
//         start: '2025-12-05T16:30:00-08:00',
//         end: '2025-12-05T17:00:00-08:00',
//         score: 94.60493124999999,
//       },
//       {
//         start: '2025-12-08T16:00:00-08:00',
//         end: '2025-12-08T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-08T16:30:00-08:00',
//         end: '2025-12-08T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:00:00-08:00',
//         end: '2025-12-09T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-09T16:30:00-08:00',
//         end: '2025-12-09T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:00:00-08:00',
//         end: '2025-12-10T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T08:30:00-08:00',
//         end: '2025-12-10T09:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T12:00:00-08:00',
//         end: '2025-12-10T12:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T13:00:00-08:00',
//         end: '2025-12-10T13:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:00:00-08:00',
//         end: '2025-12-10T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T14:30:00-08:00',
//         end: '2025-12-10T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:00:00-08:00',
//         end: '2025-12-10T15:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T15:30:00-08:00',
//         end: '2025-12-10T16:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:00:00-08:00',
//         end: '2025-12-10T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-10T16:30:00-08:00',
//         end: '2025-12-10T17:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T08:00:00-08:00',
//         end: '2025-12-11T08:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T12:30:00-08:00',
//         end: '2025-12-11T13:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:00:00-08:00',
//         end: '2025-12-11T14:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T14:30:00-08:00',
//         end: '2025-12-11T15:00:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:00:00-08:00',
//         end: '2025-12-11T16:30:00-08:00',
//         score: 80,
//       },
//       {
//         start: '2025-12-11T16:30:00-08:00',
//         end: '2025-12-11T17:00:00-08:00',
//         score: 80,
//       },
//     ],
//   },
// ];
