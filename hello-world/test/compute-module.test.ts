import dotenv from 'dotenv';

// Load environment variables
dotenv.config();
// Mock setup must be before imports
import { TestModule } from '../src/types';
import { computeModule } from '../src';
import { writeGreeting } from '../src/writeGreeting';

// Cast computeModule to TestModule since we're in test environment
const testModule = computeModule as TestModule;

// 1. Grab the real fetch
const realFetch = global.fetch;

// 2. Override it with a logger wrapper
global.fetch = (async (input: any, init?: any): Promise<Response> => {
  // log the request
  console.log('➡️ fetch:', input, init);

  // call the real fetch
  const res = await realFetch(input, init);

  // attempt to parse JSON (fallback to text)
  let body: unknown;
  try {
    body = await res.clone().json();
  } catch {
    body = await res.clone().text();
  }
  console.log('⬅️ status=', res.status, 'body=', body);

  return res;
}) as typeof fetch;

describe('Compute Module Registration', () => {
  beforeEach(() => {
    // Register operations with actual handlers
    testModule.register('WriteGreeting', writeGreeting);

    // Register responsive handler
    testModule.on('responsive', () => {
      console.log(`${process.env.LOG_PREFIX} Module is now responsive`);
    });
  });

  it('should send a greeting', async () => {
    const operations = ['WriteGreeting'];

    // Initial check
    operations.forEach((op) => {
      expect(testModule.listeners[op]).toBeDefined();
      expect(testModule.listeners[op].type).toBe('response');
    });

    // Simulate multiple responsive events
    for (let i = 0; i < 3; i++) {
      const responsiveHandler = testModule.listeners['responsive'];
      if (responsiveHandler) {
        responsiveHandler();
      }

      // Verify after each event
      operations.forEach((op) => {
        expect(testModule.listeners[op]).toBeDefined();
        expect(testModule.listeners[op].type).toBe('response');
      });
    }

    // Execute calendar operations
    const result =
      await testModule.listeners['WriteGreeting'].listener('Los Angeles');

    expect(result).toBeDefined();
  }, 30000);
});
