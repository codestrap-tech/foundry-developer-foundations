import {
  mockEmailResponse,
  missingRecipientContext,
  validContext,
} from '../../__fixtures__/Email';
import { google } from 'googleapis';

import { sendEmail } from './SendEmail';
import type { Context } from '@codestrap/developer-foundations-types';

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

describe('sendEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  it('calls sendEmail and returns the expected response', async () => {
    const response = await sendEmail(validContext);
    expect(response).toEqual(mockEmailResponse.data);
  }, 30000);

  it('throws an error when no email data is found in context', async () => {
    const invalidContext = { stack: [] } as any as Context;
    await expect(sendEmail(invalidContext)).rejects.toThrow(
      'No email data found in context',
    );
  });

  it('throws an error when required email fields are missing', async () => {
    await expect(sendEmail(missingRecipientContext)).rejects.toThrow(
      'Invalid email data format in context',
    );
  });
});
