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
} satisfies Partial<OfficeServiceV3>;

describe('resolveMeetingConflicts', () => {
  const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

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
  });

  it('returns 400 when no CodeStrap users are found', async () => {
    // given
    const nonCodeStrapUsers = [faker.internet.email({ provider: 'example.com' })];

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

  it('calls office service v3 to propose meeting conflict resolutions', async () => {
    // given
    const timeFrameFrom = faker.date.recent().toISOString();
    const timeFrameTo = faker.date.soon().toISOString();
    mockOfficeServiceV3.proposeMeetingConflictResolutions.mockResolvedValue([]);

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