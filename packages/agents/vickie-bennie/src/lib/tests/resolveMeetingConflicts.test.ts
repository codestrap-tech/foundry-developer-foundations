import { resolveMeetingConflicts, performRescheduling } from '../resolveMeetingConflicts';
import {
  GeminiService,
  OfficeService,
  OfficeServiceV3,
  ProposeMeetingConflictResolutionsOutput,
  TYPES,
} from '@codestrap/developer-foundations-types';
import { faker } from '@faker-js/faker';
import { container } from '@codestrap/developer-foundations-di';

// Mock the container
jest.mock('@codestrap/developer-foundations-di', () => ({
  container: {
    get: jest.fn(),
    getAsync: jest.fn(),
  },
}));

// Mock utils
jest.mock('@codestrap/developer-foundations-utils', () => ({
  ...jest.requireActual('@codestrap/developer-foundations-utils'),
  extractJsonFromBackticks: jest.fn((str: string) => str),
  uuidv4: jest.fn(() => faker.string.uuid()),
}));

const mockContainer = container as jest.Mocked<typeof container>;
const mockGeminiService = jest.fn() as unknown as GeminiService;
const mockOfficeService = {
  scheduleMeeting: jest.fn(),
} as unknown as OfficeService;
const mockOfficeServiceV3 = {
  proposeMeetingConflictResolutions: jest.fn(),
} as unknown as OfficeServiceV3;

describe('resolveMeetingConflicts', () => {
  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default mocks
    mockContainer.get.mockReturnValue(mockGeminiService as GeminiService);
    mockContainer.getAsync.mockImplementation(async (type: unknown) => {
      if (type === TYPES.OfficeService) {
        return mockOfficeService;
      }
      if (type === TYPES.OfficeServiceV3) {
        return mockOfficeServiceV3;
      }
      throw new Error(`Unknown type: ${String(type)}`);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  it('should successfully resolve meeting conflicts for valid CodeStrap users', async () => {
    // given
    const userEmail = 'connor.deeks@codestrap.me';
    const task = 'Resolve meeting conflicts for Connor';
    const timeFrameFrom = faker.date.recent().toISOString();
    const timeFrameTo = faker.date.soon().toISOString();
    const meetingId = faker.string.uuid();
    const resolutionStart = faker.date.soon().toISOString();
    const resolutionEnd = faker.date.future().toISOString();
    const htmlLink = faker.internet.url();

    // Mock GeminiService response
    const geminiResponse = JSON.stringify({
      users: [userEmail],
      timeFrameFrom,
      timeFrameTo,
    });
    (mockGeminiService as jest.Mock).mockResolvedValue(geminiResponse);

    // Mock proposeMeetingConflictResolutions
    const mockConflictResult: ProposeMeetingConflictResolutionsOutput = [
      {
        meetingId,
        resolutionBlocks: [
          { start: resolutionStart, end: resolutionEnd },
        ],
      },
    ];
    (mockOfficeServiceV3.proposeMeetingConflictResolutions as jest.Mock) =
      jest.fn().mockResolvedValue(mockConflictResult);

    // Mock scheduleMeeting
    (mockOfficeService.scheduleMeeting as jest.Mock) = jest
      .fn()
      .mockResolvedValue({ htmlLink });

    // when
    const result = await resolveMeetingConflicts(task);

    // then
    expect(result.status).toBe(200);
    expect(result.message).toContain('conflicts have been identified');
    expect(result.message).toContain(userEmail);
    expect(result.executionId).toBeDefined();
    expect(mockOfficeServiceV3.proposeMeetingConflictResolutions).toHaveBeenCalled();
    expect(mockOfficeService.scheduleMeeting).toHaveBeenCalled();
  });

  it('should return 400 when no CodeStrap users are found', async () => {
    // given
    const task = 'Resolve meeting conflicts for user@example.com';
    const timeFrameFrom = faker.date.recent().toISOString();
    const timeFrameTo = faker.date.soon().toISOString();

    // Mock GeminiService response with non-CodeStrap user
    const geminiResponse = JSON.stringify({
      users: ['user@example.com'],
      timeFrameFrom,
      timeFrameTo,
    });
    (mockGeminiService as jest.Mock).mockResolvedValue(geminiResponse);

    // when
    const result = await resolveMeetingConflicts(task);

    // then
    expect(result.status).toBe(400);
    expect(result.message).toBe('No CodeStrap users found in the request');
    expect(result.error).toBe('No valid users');
    expect(result.taskList).toBe('ERROR');
    expect(mockOfficeServiceV3.proposeMeetingConflictResolutions).not.toHaveBeenCalled();
  });

  it('should handle errors and return 500 status', async () => {
    // given
    const task = 'Resolve meeting conflicts';
    const errorMessage = 'Test error';

    // Mock container.getAsync to throw an error
    mockContainer.getAsync.mockRejectedValue(new Error(errorMessage));

    // when
    const result = await resolveMeetingConflicts(task);

    // then
    expect(result.status).toBe(500);
    expect(result.message).toContain('Error resolving meeting conflicts');
    expect(result.message).toContain(errorMessage);
    expect(mockConsoleError).toHaveBeenCalledWith(
      'resolveMeetingConflicts error:',
      errorMessage
    );
  });

  it('should handle errors during conflict resolution', async () => {
    // given
    const userEmail = 'connor.deeks@codestrap.me';
    const task = 'Resolve meeting conflicts for Connor';
    const timeFrameFrom = faker.date.recent().toISOString();
    const timeFrameTo = faker.date.soon().toISOString();

    // Mock GeminiService response
    const geminiResponse = JSON.stringify({
      users: [userEmail],
      timeFrameFrom,
      timeFrameTo,
    });
    (mockGeminiService as jest.Mock).mockResolvedValue(geminiResponse);

    // Mock proposeMeetingConflictResolutions to throw error
    (mockOfficeServiceV3.proposeMeetingConflictResolutions as jest.Mock) =
      jest.fn().mockRejectedValue(new Error('Conflict resolution failed'));

    // when
    const result = await resolveMeetingConflicts(task);

    // then
    expect(result.status).toBe(500);
    expect(result.message).toContain('Error resolving meeting conflicts');
    expect(mockConsoleError).toHaveBeenCalled();
  });
});

describe('performRescheduling', () => {
  let mockConsoleError: jest.SpyInstance;
  const mockOfficeService = {
    scheduleMeeting: jest.fn(),
  } as unknown as OfficeService;

  beforeEach(() => {
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (mockConsoleError) {
      mockConsoleError.mockRestore();
    }
  });

  it('should schedule meetings for conflicts with resolution blocks', async () => {
    // given
    const meetingId1 = faker.string.uuid();
    const meetingId2 = faker.string.uuid();
    const resolutionStart1 = faker.date.soon().toISOString();
    const resolutionEnd1 = faker.date.future().toISOString();
    const resolutionStart2 = faker.date.soon().toISOString();
    const resolutionEnd2 = faker.date.future().toISOString();
    const htmlLink1 = faker.internet.url();
    const htmlLink2 = faker.internet.url();
    const codeStrapUsers = ['connor.deeks@codestrap.me'];

    const identifyResult: ProposeMeetingConflictResolutionsOutput = [
      {
        meetingId: meetingId1,
        resolutionBlocks: [
          { start: resolutionStart1, end: resolutionEnd1 },
        ],
      },
      {
        meetingId: meetingId2,
        resolutionBlocks: [
          { start: resolutionStart2, end: resolutionEnd2 },
        ],
      },
    ];

    (mockOfficeService.scheduleMeeting as jest.Mock)
      .mockResolvedValueOnce({ htmlLink: htmlLink1 })
      .mockResolvedValueOnce({ htmlLink: htmlLink2 });

    // when
    const result = await performRescheduling(
      identifyResult,
      codeStrapUsers,
      mockOfficeService
    );

    // then
    expect(result.scheduledCount).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(mockOfficeService.scheduleMeeting).toHaveBeenCalledTimes(2);
    expect(mockOfficeService.scheduleMeeting).toHaveBeenCalledWith({
      summary: `Resolved Meeting Conflict - ${meetingId1}`,
      description: `Meeting scheduled to resolve conflict for meeting ${meetingId1}`,
      start: resolutionStart1,
      end: resolutionEnd1,
      attendees: codeStrapUsers,
    });
  });

  it('should handle scheduling errors gracefully', async () => {
    // given
    const meetingId = faker.string.uuid();
    const resolutionStart = faker.date.soon().toISOString();
    const resolutionEnd = faker.date.future().toISOString();
    const codeStrapUsers = ['connor.deeks@codestrap.me'];
    const errorMessage = 'Scheduling failed';

    const identifyResult: ProposeMeetingConflictResolutionsOutput = [
      {
        meetingId,
        resolutionBlocks: [{ start: resolutionStart, end: resolutionEnd }],
      },
    ];

    (mockOfficeService.scheduleMeeting as jest.Mock) = jest
      .fn()
      .mockRejectedValue(new Error(errorMessage));

    // when
    const result = await performRescheduling(
      identifyResult,
      codeStrapUsers,
      mockOfficeService
    );

    // then
    expect(result.scheduledCount).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain(`Failed to schedule meeting for conflict ${meetingId}`);
    expect(result.errors[0]).toContain(errorMessage);
    expect(mockConsoleError).toHaveBeenCalled();
  });

  it('should skip conflicts without resolution blocks', async () => {
    // given
    const meetingId = faker.string.uuid();
    const codeStrapUsers = ['connor.deeks@codestrap.me'];

    const identifyResult: ProposeMeetingConflictResolutionsOutput = [
      {
        meetingId,
        resolutionBlocks: [],
      },
    ];

    // when
    const result = await performRescheduling(
      identifyResult,
      codeStrapUsers,
      mockOfficeService
    );

    // then
    expect(result.scheduledCount).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockOfficeService.scheduleMeeting).not.toHaveBeenCalled();
  });
});

