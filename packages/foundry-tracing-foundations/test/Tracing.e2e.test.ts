import dotenv from 'dotenv';
import { collectTelemetryFetchWrapper } from '../src/Tracing';
import { mockPayload } from './__fixtures__/telemetryPayload';
// Load environment variables
dotenv.config();

describe('Tracing', () => {
  afterAll(() => jest.clearAllMocks());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should collect telemetry data', async () => {
    const result = await collectTelemetryFetchWrapper(
      JSON.stringify(mockPayload),
    );
    expect(result).toBeDefined();
    expect(JSON.parse(result).edits.addedObjectCount).toEqual(2);
  }, 10000);
});
