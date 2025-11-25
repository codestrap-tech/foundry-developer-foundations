import { mockProcessEmailEventExecution } from '../__fixtures__/MachineExecutions';
import {
  mockGithubGetFileResult,
  mockGithubCheckinFileResult,
} from '../__fixtures__/Github';
import {
  mockCalendarInsert,
  mockCalendarList,
  mockEmailHistoryNoResolution,
  mockEmailResponse,
  mockMessageGetResponse,
  mockMessageGetThreadsResponseNoResolution,
} from '../__fixtures__/Email';
import { Vickie } from '../Vickie';

let counter = 0;

jest.mock('@codestrap/github', () => ({
  // override makeGithubClient with a Jest mock
  makeGithubClient: jest.fn(async () => {
    // this matches the VersionControlService shape:
    // { getFile, checkinFile }
    return {
      getFile: jest.fn(async () => mockGithubGetFileResult),
      checkinFile: jest.fn(async () => mockGithubCheckinFileResult),
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
  makeMachineDao: jest.fn(() => ({
    upsert: jest.fn(
      (
        id: string,
        stateMachine: string,
        state: string,
        logs: string,
        lockOwner?: string,
        lockUntil?: number,
      ) => {
        return mockProcessEmailEventExecution;
      },
    ),
    delete: jest.fn(),
    read: jest.fn((machineExecutionId: string) => {
      return Promise.resolve(mockProcessEmailEventExecution);
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
              console.log(`Gmail mock messages.send called with: ${request}`);
              return Promise.resolve(mockEmailResponse);
            }),
            list: jest.fn((request: any) => {
              console.log(`Gmail mock messages.list called with: ${request}`);
              return Promise.resolve(mockEmailHistoryNoResolution);
            }),
            get: jest.fn((request: any) => {
              console.log(`Gmail mock messages.get called with: ${request}`);
              return Promise.resolve(mockMessageGetResponse);
            }),
          },
          threads: {
            get: jest.fn((request: any) => {
              console.log(`Gmail mock threads.get called with: ${request}`);
              return Promise.resolve(mockMessageGetThreadsResponseNoResolution);
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
            return Promise.resolve(mockCalendarInsert);
          }),
          list: jest.fn((params: any) => {
            console.log(
              `Calendar mock events.list called with: ${JSON.stringify(params)}`,
            );
            return Promise.resolve(mockCalendarList);
          }),
        },
        /* ---------- freebusy.query mock ---------- */
        freebusy: {
          query: jest.fn((params: any) => {
            console.log(
              `Calendar mock freebusy.query called with: ${JSON.stringify(
                params,
              )}`,
            );
            return Promise.resolve({
              data: {
                kind: 'calendar#freeBusy',
                timeMin: params.requestBody.timeMin,
                timeMax: params.requestBody.timeMax,
                calendars: {
                  // each email requested in params.requestBody.items[*].id gets an entry:
                  'dsmiley@codestrap.me': {
                    busy: [
                      {
                        start: '2025-07-22T18:00:00Z',
                        end: '2025-07-22T19:00:00Z',
                      },
                      {
                        start: '2025-07-23T15:00:00Z',
                        end: '2025-07-23T16:30:00Z',
                      },
                    ],
                  },
                },
              },
            });
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

describe('testing Vickie', () => {
  afterAll(() => {
    jest.clearAllMocks();
  });

  it('it handle a mock event using processEmailEvent when no resolution is found', async () => {
    const vickie = new Vickie();
    const result = await vickie.processEmailEvent(
      'eyJlbWFpbEFkZHJlc3MiOiJkc21pbGV5QGNvZGVzdHJhcC5tZSIsImhpc3RvcnlJZCI6MTc5MDUxMn0=',
      '2025-07-22T20:43:55.184Z',
    );
    expect(result).toBeDefined();
    expect(result.message).toBe(
      'Some threads failed to resolve:\n {"status":"fulfilled","value":{"status":400,"executionId":"1","message":"ERROR","error":"No resolution found","taskList":"ERROR"}}',
    );
    expect(result.status).toBe(400);
  }, 120000);
});
