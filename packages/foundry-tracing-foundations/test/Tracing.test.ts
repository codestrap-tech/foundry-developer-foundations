import dotenv from 'dotenv';
import { collectTelemetryFetchWrapper } from '../src/Tracing';
import { mockPayload } from './__fixtures__/telemetryPayload';
// Load environment variables
dotenv.config();

global.fetch = jest.fn();

describe('Tracing', () => {
  afterAll(() => jest.clearAllMocks());

  beforeEach(() => {
    jest.clearAllMocks();

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (/\/actions\/collect-telemetry\/apply/.test(url)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ message: 'OK' }),
        });
      }
      // oauth token calls (adjust your matching as needed)
      if (url.match(/\/token$/) || url.match(/oauth2/)) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: 'fake-token',
              expires_in: 3600,
              token_type: 'Bearer',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.reject(new Error('URL not matched'));
    });
  });

  it('should collect telemetry data', async () => {
    const result = await collectTelemetryFetchWrapper(
      JSON.stringify(mockPayload),
    );
    expect(result).toBeDefined();
    expect(JSON.parse(result)).toEqual({ message: 'OK' });
  });
});
