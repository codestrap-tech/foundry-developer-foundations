import {
  text2ActionTestMachineExecution,
  machineId,
} from '../__fixtures__/MachineExecutions';
import { Text2Action } from '../Text2Action';
import { mockEmailResponse } from '../__fixtures__/Email';
import { mockGithubGetFileResult, mockGithubCheckinFileResult } from '../__fixtures__/Github';

let counter = 0;

jest.mock('@codestrap/github', () => ({
  // override makeGithubClient with a Jest mock
  makeGithubClient: jest.fn(async () => {
    // this matches the VersionControlService shape:
    // { getFile, checkinFile }
    return {
      getFile: jest.fn(async () => mockGithubGetFileResult),
      checkinFile: jest.fn( async () => mockGithubCheckinFileResult),
    };
  }),
}));

jest.mock('@codestrap/developer-foundations-utils', () => ({
  ...jest.requireActual('@codestrap/developer-foundations-utils'),
  uuidv4: jest.fn(() => (++counter).toString()),
}));

jest.mock('@codestrap/developer-foundations-services-palantir', () => ({
  // TODO mock the gemini service responses, this introduces an element on non-determinism.
  ...jest.requireActual('@codestrap/developer-foundations-services-palantir'),
  createFoundryClient: jest.fn(() => ({
    // Mock FoundryClient methods as needed
    someMethod: jest.fn(),
  })),
  geminiService: jest.fn(() => {
    return text2ActionTestMachineExecution.machine;
  }),
  makeMachineDao: jest.fn(() => ({
    upsert: jest.fn(
      (
        id: string,
        stateMachine: string,
        state: string,
        logs: string,
        lockOwner?: string,
        lockUntil?: number
      ) => {
        return text2ActionTestMachineExecution;
      }
    ),
    delete: jest.fn(),
    read: jest.fn((machineExecutionId: string) => {
      return Promise.resolve(text2ActionTestMachineExecution);
    }),
  })),
  makeMemoryRecallDao: jest.fn(() => ({
    search: jest.fn(),
    read: jest.fn(),
  })),
  makeTrainingDataDao: jest.fn(() => ({
    search: jest.fn(),
    read: jest.fn(),
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

jest.mock('googleapis', () => ({
  ...jest.requireActual('googleapis'), // Keep other actual exports

  google: {
    // mock slides
    slides: jest.fn((version: string, auth: any) => {
      return {
        presentations: {
          get: jest.fn(),
          batchUpdate: jest.fn(),
        },
      };
    }),
    // mock drive
    drive: jest.fn((version: string, auth: any) => {
      return {
        files: {
          list: jest.fn(),
        },
      };
    }),
    // Mock the 'gmail' function as before
    gmail: jest.fn((version: string, auth: any) => {
      return {
        users: {
          messages: {
            send: jest.fn((request: any) => {
              console.log(`Gmail mock called with: ${request}`);
              return Promise.resolve(mockEmailResponse);
            }),
          },
        },
      };
    }),

    // Mock the 'calendar' function as before
    calendar: jest.fn((version: string, auth: any) => {
      return {
        events: {
          insert: jest.fn((request: any) => {
            console.log(`Calendar mock called with: ${request}`);
            return Promise.resolve({ data: { id: 'mockEventId' } });
          }),
        },
      };
    }),

    // Mock the 'customsearch' function as before
    customsearch: jest.fn((version: string) => {
      return {
        cse: {
          list: jest.fn((params: any) => {
            console.log(`Custom Search mock called with: ${params}`);
            return Promise.resolve({
              data: {
                items: [
                  { title: 'Mock Result 1', link: 'http://mock.com/1' },
                  { title: 'Mock Result 2', link: 'http://mock.com/2' },
                ],
              },
            });
          }),
        },
      };
    }),

    // Add a mock for the 'auth' object and its 'GoogleAuth' constructor
    auth: {
      GoogleAuth: jest.fn().mockImplementation((config) => {
        console.log('Mocked GoogleAuth constructor called');

        // Return a mock object that mimics the behavior of a GoogleAuth instance
        return {
          // Mock methods that are called on the GoogleAuth instance
          getClient: jest.fn().mockResolvedValue({
            getRequestHeaders: jest.fn().mockResolvedValue({
              /* mock headers */
            }), // Mock getRequestHeaders if used
          }),
        };
      }),
    },
  },
}));

describe('testing Text2Action', () => {
  afterAll(() => {
    jest.clearAllMocks();
  });

  it('it should rehydrate an existing execution and return pause', async () => {
    const solution = {
      input: '', //not relevant for this
      id: machineId || '',
      plan: '', //not relevant for retrieving an execution
    };

    const t2a = new Text2Action();
    const result = await t2a.upsertState(undefined, true, machineId);
    const state = JSON.parse(result.state!);
    // TODO make this test better. Currently we are returning the mock value which
    // does not reflect the updates which should return the success state
    expect(state.value).toBe('sendEmail|1');
    expect(state.context.stack).toHaveLength(1);
    expect(state.context.stack[0]).toBe('sendEmail|1');
  }, 30000);
});
