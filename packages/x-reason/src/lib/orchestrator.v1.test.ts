import { mockProgrammerResponse1 } from './__fixtures__/Gemini';
import { getState } from './orchestratorV1';
import { SupportTrainingDataTypes } from './factory';
import { SupportedEngines } from '@codestrap/developer-foundations-types';

import {
  machineId,
  machineId2,
  mockExecution,
  mockExecution2,
} from './__fixtures__/MachineExecutions';

jest.mock('@codestrap/developer-foundations-services-palantir', () => ({
  ...jest.requireActual('@codestrap/developer-foundations-services-palantir'),
  makeMemoryRecallDao: jest.fn(() => ({
    search: jest.fn(),
    read: jest.fn(),
  })),
  makeTrainingDataDao: jest.fn(() => ({
    upsert: jest.fn(),
    delete: jest.fn(),
    read: jest.fn((id: string) => {
      return {
        humanReview: 'this anser is good',
        isGood: true,
        machine: mockProgrammerResponse1,
        primaryKey_: '1234',
        solution: 'The task list',
        type: SupportTrainingDataTypes.PROGRAMMER,
        xReason: SupportedEngines.COMS,
      };
    }),
    search: jest.fn((xReason: string, type: string) => {
      return [
        {
          humanReview: 'this anser is good',
          isGood: true,
          machine: mockProgrammerResponse1,
          primaryKey_: '1234',
          solution: 'The task list',
          type: SupportTrainingDataTypes.PROGRAMMER,
          xReason: SupportedEngines.COMS,
        },
      ];
    }),
  })),
  makeMachineDao: jest.fn(() => ({
    upsert: jest.fn(),
    delete: jest.fn(),
    read: jest.fn((machineExecutionId: string) => {
      if (machineExecutionId === 'mock-execution-id') {
        return Promise.resolve(mockExecution);
      } else if (machineExecutionId === 'mock-execution-id2') {
        return Promise.resolve(mockExecution2);
      } else {
        return Promise.resolve(null); // or throw if you want stricter tests
      }
    }),
  })),
  makeContactsDao: jest.fn(() => ({
    search: jest.fn(),
    read: jest.fn(),
  })),
  makeUserDao: jest.fn(() => ({
    read: jest.fn(),
  })),
  makeCommsDao: jest.fn(() => ({
    search: jest.fn(),
    read: jest.fn(),
    upsert: jest.fn(),
  })),
  makeThreadsDao: jest.fn(() => ({
    search: jest.fn(),
    read: jest.fn(),
    upsert: jest.fn(),
  })),
  makeTicketsDao: jest.fn(() => ({
    search: jest.fn(),
    read: jest.fn(),
    upsert: jest.fn(),
  })),
  makeWorldDao: jest.fn(() => ({
    read: jest.fn(),
  })),
  geminiService: jest.fn(() => {
    return mockProgrammerResponse1;
  }),
}));

jest.mock('@codestrap/developer-foundations-services-rangr', () => ({
  createRangrClient: jest.fn(() => ({
    someMethod: jest.fn(),
  })),
  makeRfpRequestsDao: jest.fn(() => ({
    search: jest.fn(),
    read: jest.fn(),
    upsert: jest.fn(),
  })),
  makeRangrRfpRequestsDao: jest.fn(() => ({
    search: jest.fn(),
    read: jest.fn(),
    upsert: jest.fn(),
  })),
}));

let counter = 0;

jest.mock('@codestrap/developer-foundations-utils', () => ({
  ...jest.requireActual('@codestrap/developer-foundations-utils'),
  uuidv4: jest.fn(() => (++counter).toString()),
}));

jest.mock('./functions', () => ({
  ...jest.requireActual('./functions'),
  sendEmail: jest.fn().mockImplementation(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mockEmailResponse } = require('./__fixtures__/Email');
    return Promise.resolve(mockEmailResponse);
  }),
}));

// Mock fetch globally since it's used in SendSlackMessage
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        ok: true,
        channel: 'test-channel',
        ts: '1234567890.123456',
      }),
  }),
) as jest.Mock;

describe('testing orchestrator', () => {
  afterAll(() => {
    jest.clearAllMocks();
  });

  it('it should rehydrate an existing execution, move forward, and save', async () => {
    const solution = {
      input: '', //not relevant for this
      id: machineId || '',
      plan: '', //not relevant for retrieving an execution
    };

    //we don't need to test interpolation in this test case, but leaving here to help facilitate testing that
    const valuesToInterpolateOntoContext = {};

    const result = await getState(
      solution,
      true,
      valuesToInterpolateOntoContext,
      SupportedEngines.COMS,
    );
    const state = JSON.parse(result.jsonState);

    expect(state.value).toBe('success');
    expect(state.context.stack).toHaveLength(4);
    expect(state.context.stack[0]).toBe('sendEmail|2');
  });

  it('it should rehydrate an existing execution, move backward, and save', async () => {
    const solution = {
      input: '', //not relevant for this
      // note machineId2 starts on the second state: sendSlackMessage
      id: machineId2 || '',
      plan: '', //not relevant for retrieving an execution
    };

    //we don't need to test interpolation in this test case, but leaving here to help facilitate testing that
    const valuesToInterpolateOntoContext = {};

    const result = await getState(
      solution,
      false,
      valuesToInterpolateOntoContext,
      SupportedEngines.COMS,
    );
    const state = JSON.parse(result.jsonState);

    expect(state.value).toBe(
      'scheduleMeeting|7f8824d7-bb8e-4bb3-a820-5ab9e7dc6533',
    );
    expect(state.context.stack).toHaveLength(16);
    expect(state.context.stack[0]).toBe(
      'getAvailableMeetingTimes|ba26e192-9a5c-4c34-8a9c-c4a7a4567152',
    );
  });

  it('it should create a new machine, move forward, and save', async () => {
    const solution = {
      input: '', //not relevant for this
      id: '',
      plan: `1. **Send Email** - **To**: Mike Johnson <mike.johnson@example.com> - **Subject**: Follow-up on Marketing Plan - **Body**: "Hi Mike, following up on the recent discussion about the marketing plan. Please review the points raised by Sarah Lee <sarah.lee@example.com> and David Brown <david.brown@example.com>. Let me know if you need any further input. Best, Cody the AI Assistant"`, //not relevant for retrieving an execution
    };

    //we don't need to test interpolation in this test case, but leaving here to help facilitate testing that
    const valuesToInterpolateOntoContext = {};

    const result = await getState(
      solution,
      true,
      valuesToInterpolateOntoContext,
      SupportedEngines.COMS,
    );
    const state = JSON.parse(result.jsonState);
    expect(state.value).toBe('success');
    expect(state.context.stack).toHaveLength(2);
    expect(state.context.stack[0]).toBe('sendEmail|13');
    expect(state.context.stack[1]).toBe('success');
  });
});
