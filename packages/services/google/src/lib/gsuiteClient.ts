import { google } from 'googleapis';
import type {
  CalendarContext,
  EmailContext,
  FindOptimalMeetingTimeOutput,
  OfficeServiceV1,
  MeetingRequest,
  ReadEmailHistoryContext,
  ScheduleMeetingOutput,
  SendEmailOutput,
  WatchEmailsInput,
} from '@codestrap/developer-foundations-types';
import { findOptimalMeetingTime } from './delegates/findOptimalMeetingTime';
import { scheduleMeeting } from './delegates/scheduleMeeting';
import { sendEmail } from './delegates/sendEmail';
import { readEmailHistory } from './delegates/readEmailHistory';
import { watchEmails } from './delegates/watchEmails';
import {
  loadServiceAccountFromEnv,
  makeGoogleAuth,
} from './helpers/googleAuth';

export enum GSUITE_SCOPES {
  CALENDAR_READ = 'https://www.googleapis.com/auth/calendar.readonly',
  CALENDAR_WRITE = 'https://www.googleapis.com/auth/calendar.events',
  CALENDAR_FREEBUSY = 'https://www.googleapis.com/auth/calendar.freebusy',
  CALENDAR_ALL = 'https://www.googleapis.com/auth/calendar',
  GMAIL_SEND = 'https://www.googleapis.com/auth/gmail.send',
  GMAIL_READ = 'https://www.googleapis.com/auth/gmail.readonly',
  GMAIL_META = 'https://www.googleapis.com/auth/gmail.metadata',
  GMAIL_MODIFY = 'https://www.googleapis.com/auth/gmail.modify',
}

async function makeClient(user: string) {
  console.log(`Creating client for user: ${user}`);
  // load the service account one time
  const credentials = await loadServiceAccountFromEnv();

  const mailScopes: GSUITE_SCOPES[] = [
    GSUITE_SCOPES.GMAIL_SEND,
    GSUITE_SCOPES.CALENDAR_READ,
    GSUITE_SCOPES.GMAIL_READ,
  ];

  const calendarScopes: GSUITE_SCOPES[] = [
    GSUITE_SCOPES.CALENDAR_ALL,
    GSUITE_SCOPES.CALENDAR_FREEBUSY,
    GSUITE_SCOPES.CALENDAR_READ,
    GSUITE_SCOPES.CALENDAR_WRITE,
  ];

  const emailAuth = makeGoogleAuth(credentials, mailScopes, user);
  const calAuth = makeGoogleAuth(credentials, calendarScopes, user);

  const mailClient = await emailAuth.getClient();
  const calClient = await calAuth.getClient();

  if (!mailClient.getRequestHeaders || !calClient.getRequestHeaders) {
    throw new Error('Invalid auth client - missing methods');
  }

  const calendarClient = google.calendar({ version: 'v3', auth: calAuth });
  const emailClient = google.gmail({ version: 'v1', auth: emailAuth });

  return { emailClient, calendarClient };
}

export async function makeGSuiteClient(user: string): Promise<OfficeServiceV1> {
  const { emailClient, calendarClient } = await makeClient(user);

  return {
    getAvailableMeetingTimes: async (
      meetingRequest: MeetingRequest,
    ): Promise<FindOptimalMeetingTimeOutput> => {
      const result = await findOptimalMeetingTime(
        calendarClient,
        meetingRequest,
      );

      return result;
    },
    scheduleMeeting: async (
      meeting: CalendarContext,
    ): Promise<ScheduleMeetingOutput> => {
      const result = await scheduleMeeting(calendarClient, meeting);

      return result;
    },
    sendEmail: async (email: EmailContext): Promise<SendEmailOutput> => {
      const result = await sendEmail(emailClient, email);

      return result;
    },
    readEmailHistory: async (context: ReadEmailHistoryContext) => {
      const { emailClient } = await makeClient(context.email);
      const result = await readEmailHistory(emailClient, context);

      return {
        messages: result,
      };
    },
    watchEmails: async (context: WatchEmailsInput) => {
      // we pass makeClient because this operations requires scoped clients to the user's email!
      const result = await watchEmails(context, makeClient);

      return result;
    },
    getCalendarClient: () => calendarClient,
    getEmailClient: () => emailClient,
  };
}
