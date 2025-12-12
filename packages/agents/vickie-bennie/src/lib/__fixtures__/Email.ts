import type { Context } from '@codestrap/developer-foundations-types';

const date = new Date();
// get tomorrow
date.setDate(date.getDate() + 1);

// Helper to generate ISO strings with specified hour and minute in UTC
function getISOTime(date: Date, hour: number, minute: number): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute)
  );
  return d.toISOString();
}

// Mock email response data
export const mockEmailResponse = {
  data: {
    id: '8675309',
    threadId: '2468',
    labelIds: ['labels', 'schmabels'],
  },
};

export const validEmailData = {
  message: 'Hello World',
  subject: 'Test Subject',
  recipients: ['test@example.com'],
  modelDialog: 'sample dialog',
  ts: 1234567890,
};

export const validContext = {
  stack: ['emailData', 'bullshit'],
  emailData: validEmailData,
} as any as Context;

export const missingRecipientContext = {
  stack: ['emailData', 'bullshit'],
  emailData: {
    // message is missing
    subject: 'Test',
    modelDialog: 'sample dialog',
    ts: 1234567890,
  },
} as any as Context;

const THREAD_ID = 'mock-thread-id-1';

/* ── messages.get ─────────────────────────────────────────────── */
export const mockMessageGetResponse = {
  data: {
    id: 'mock-email-id-1',
    threadId: THREAD_ID,
    payload: {
      headers: [
        {
          name: 'Subject',
          value:
            'Resolve Meeting Conflicts - ID f41b004c-c032-4f3a-b7b8-be831804cb03',
        },
      ],
    },
    snippet: 'Mock message snippet',
  },
};

/* ── messages.list (no‑resolution) ────────────────────────────── */
export const mockEmailHistoryNoResolution = {
  data: {
    messages: [
      {
        subject:
          'Resolve Meeting Conflicts - ID f41b004c-c032-4f3a-b7b8-be831804cb03',
        threadId: THREAD_ID,
        from: 'vici@codestrap.me',
        body: `Hey Dorian and Connor  nHappy Thursday! I'm Vickie, Code's AI EA. I'm having trouble scheduling a meeting for you both on July 18, 2025, between 2:00 PM and 3:00 PM. It looks like neither of you are available at that time. Could you please let me know if there's any chance you could move things around to make that time work? Knowing whether that slot is flexible would really help in finding a suitable time.  Thanks!  Best Vickie`,
        id: 'mock-email-id',
      },
    ],
  },
};

/* ── messages.list (with resolution) ──────────────────────────── */
export const mockEmailHistoryWithResolution = {
  data: {
    messages: [
      {
        subject:
          'Resolve Meeting Conflicts - ID f41b004c-c032-4f3a-b7b8-be831804cb03',
        threadId: THREAD_ID,
        from: 'vici@codestrap.me',
        body: `Hey Dorian and Connor  nHappy Thursday! I'm Vickie, Code's AI EA. I'm having trouble scheduling a meeting for you both on July 18, 2025, between 2:00 PM and 3:00 PM. It looks like neither of you are available at that time. Could you please let me know if there's any chance you could move things around to make that time work? Knowing whether that slot is flexible would really help in finding a suitable time.  Thanks!  Best Vickie`,
        id: 'mock-email-id-1',
      },
      {
        subject:
          'Resolve Meeting Conflicts - ID f41b004c-c032-4f3a-b7b8-be831804cb03',
        threadId: THREAD_ID,
        from: 'dsmiley@codestrap.me',
        body: `Hey Connor what about tomorrow at 4 PM?`,
        id: 'mock-email-id-2',
      },
      {
        subject:
          'Resolve Meeting Conflicts - ID f41b004c-c032-4f3a-b7b8-be831804cb03',
        threadId: THREAD_ID,
        from: 'connor.deeks@codestrap.me',
        body: `That works.`,
        id: 'mock-email-id-3',
      },
    ],
  },
};

/* ── threads.get ──────────────────────────────────────────────── */
export const mockMessageGetThreadsResponse = {
  data: {
    id: THREAD_ID,
    messages: [
      {
        id: mockEmailHistoryWithResolution.data.messages[0].id,
        threadId: THREAD_ID,
        payload: {
          headers: [
            {
              name: 'Subject',
              value:
                'Resolve Meeting Conflicts - ID f41b004c-c032-4f3a-b7b8-be831804cb03',
            },
            { name: 'From', value: 'vici@codestrap.me' },
          ],
          body: {
            data: Buffer.from(
              mockEmailHistoryWithResolution.data.messages[0].body,
              'utf8'
            ).toString('base64'),
          },
        },
        snippet: 'Mock thread snippet',
      },
      {
        id: mockEmailHistoryWithResolution.data.messages[1].id,
        threadId: THREAD_ID,
        payload: {
          headers: [
            {
              name: 'Subject',
              value:
                'Resolve Meeting Conflicts - ID f41b004c-c032-4f3a-b7b8-be831804cb03',
            },
            { name: 'From', value: 'dsmiley@codestrap.me' },
          ],
          body: {
            data: Buffer.from(
              mockEmailHistoryWithResolution.data.messages[1].body,
              'utf8'
            ).toString('base64'),
          },
        },
        snippet: 'Mock thread snippet',
      },
      {
        id: mockEmailHistoryWithResolution.data.messages[2].id,
        threadId: THREAD_ID,
        payload: {
          headers: [
            {
              name: 'Subject',
              value:
                'Resolve Meeting Conflicts - ID f41b004c-c032-4f3a-b7b8-be831804cb03',
            },
            { name: 'From', value: 'connor.deeks@codestrap.me' },
          ],
          body: {
            data: Buffer.from(
              mockEmailHistoryWithResolution.data.messages[2].body,
              'utf8'
            ).toString('base64'),
          },
        },
        snippet: 'Mock thread snippet',
      },
    ],
  },
};

export const mockMessageGetThreadsResponseNoResolution = {
  data: {
    id: THREAD_ID,
    messages: [
      {
        id: mockEmailHistoryNoResolution.data.messages[0].id,
        threadId: THREAD_ID,
        payload: {
          headers: [
            {
              name: 'Subject',
              value:
                'Resolve Meeting Conflicts - ID f41b004c-c032-4f3a-b7b8-be831804cb03',
            },
            { name: 'From', value: 'vici@codestrap.me' },
          ],
          body: {
            data: Buffer.from(
              mockEmailHistoryNoResolution.data.messages[0].body,
              'utf8'
            ).toString('base64'),
          },
        },
        snippet: 'Mock thread snippet',
      },
    ],
  },
};

export const mockCalendarList = {
  data: {
    items: [
      {
        id: 'mockEventId',
        summary: 'Meet with Komatsu',
        start: { dateTime: getISOTime(date, 20, 0) },
        end: { dateTime: getISOTime(date, 21, 0) },
      },
      {
        id: 'mockEventId2',
        summary: 'Stand Up',
        start: { dateTime: getISOTime(date, 21, 0) },
        end: { dateTime: getISOTime(date, 21, 30) },
      },
    ],
    nextPageToken: null,
    // other Schema$Events fields can be added if your code reads them
  },
};

export const mockCalendarInsert = {
  data: {
    id: 'mockEventId',
    hangoutLink: 'https://meet.google.com/mock-link', // direct Meet link
    conferenceData: {
      // redundant but harmless
      entryPoints: [
        {
          entryPointType: 'video',
          uri: 'https://meet.google.com/mock-link',
        },
      ],
    },
  },
};

export function getMockFreeBusyResponse(timeMin: any, timeMax: any) {
  return {
    data: {
      kind: 'calendar#freeBusy',
      timeMin,
      timeMax,
      calendars: {
        // each email requested in params.requestBody.items[*].id gets an entry:
        'dsmiley@codestrap.me': {
          busy: [
            {
              start: { dateTime: getISOTime(date, 20, 0) },
              end: { dateTime: getISOTime(date, 21, 0) },
            },
            {
              start: { dateTime: getISOTime(date, 21, 0) },
              end: { dateTime: getISOTime(date, 21, 30) },
            },
          ],
        },
      },
    },
  };
}
