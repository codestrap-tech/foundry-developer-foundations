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

