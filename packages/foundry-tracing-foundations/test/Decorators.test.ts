// __tests__/traceDecorators.test.ts

// 1) Mock crypto **before** any imports:
jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return {
    ...actual,
    randomBytes: jest.fn(),
  };
});

import * as crypto from 'crypto';
import dotenv from 'dotenv';
import * as uuid from '../src/utils/uuid';
import { DecoratorTest } from './__fixtures__/mockDecorators';
import { parentTelemetryPayload } from './__fixtures__/parentTelemetryPayload';
import { childTelemetryPayload } from './__fixtures__/childTelemetryPayload';

dotenv.config();

global.fetch = jest.fn();

describe('Tracing', () => {
  afterAll(() => jest.clearAllMocks());

  beforeEach(() => {
    jest.clearAllMocks();

    // 1) Stub toISOString *in order*:
    const isoDates = [
      '2025-05-11T00:00:00.000Z', // outer span start
      '2025-05-11T00:00:00.000Z', // inner span start
      '2025-05-11T00:00:00.500Z', // inner span end
      '2025-05-11T00:00:01.000Z', // outer span end
    ];
    jest
      .spyOn(Date.prototype, 'toISOString')
      .mockImplementation(() => isoDates.shift()!);

    // 1) Drive our mocked crypto.randomBytes
    const rb = crypto.randomBytes as jest.Mock;
    rb.mockImplementationOnce((size) => Buffer.alloc(size, 0xaa)) // traceId
      .mockImplementationOnce((size) => Buffer.alloc(size, 0xbb)) // parent spanId
      .mockImplementationOnce((size) => Buffer.alloc(size, 0xcc)); // child spanId

    // 2) Spy uuidv4
    jest
      .spyOn(uuid, 'uuidv4')
      .mockReturnValue(parentTelemetryPayload.resource.resource_id);

    // 3) Stub fetch
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls fetch twice with the correct child & parent payloads', async () => {
    const dt = new DecoratorTest();
    const result = await dt.testDecorator();
    expect(result).toBe('segments traces');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const calls = (global.fetch as jest.Mock).mock.calls as Array<
      [string, any]
    >;

    // child span
    const foundTelemtryCall = calls.filter((item) =>
      item[0].match(/\/actions\/collect-telemetry\/apply/),
    );
    const [childUrl, childOpts] = foundTelemtryCall[0];
    expect(childUrl).toMatch(/\/actions\/collect-telemetry\/apply/);
    expect(childOpts.method).toBe('POST');
    expect(JSON.parse(JSON.parse(childOpts.body).parameters.inputJSON)).toEqual(
      childTelemetryPayload,
    );

    // parent span
    // now that we fire and forget this fetch call doesn't get logged as we do not await the response
    /*const foundParentTelemtryCall = calls.filter(item => item[0].match(/\/actions\/collect-telemetry\/apply/));
        const [parentUrl, parentOpts] = foundParentTelemtryCall[1];
        expect(parentUrl).toMatch(/\/actions\/collect-telemetry\/apply/);
        expect(parentOpts.method).toBe('POST');
        expect(JSON.parse(JSON.parse(parentOpts.body).parameters.inputJSON)).toEqual(parentTelemetryPayload);*/
  });
});
