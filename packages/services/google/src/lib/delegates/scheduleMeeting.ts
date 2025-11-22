import { randomUUID } from 'crypto';
import type {
  CalendarContext,
  ScheduleMeetingOutput,
} from '@codestrap/developer-foundations-types';
import type { calendar_v3 } from 'googleapis';

const LOG_PREFIX = 'GSUITE - scheduleMeeting - ';

function validateScheduleMeetingInput(context: CalendarContext): void {
  const { summary, start, end, attendees } = context;

  if (!summary || typeof summary !== 'string') {
    throw new Error('Summary is required and must be a string');
  }
  if (!start || !Date.parse(start)) {
    throw new Error('Valid start time is required');
  }
  if (!end || !Date.parse(end)) {
    throw new Error('Valid end time is required');
  }
  if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
    throw new Error('At least one attendee is required');
  }
}

export async function scheduleMeeting(
  calendar: calendar_v3.Calendar,
  context: CalendarContext,
): Promise<ScheduleMeetingOutput> {
  console.log(
    `${LOG_PREFIX} Processing meeting request:\n  summary: ${
      context.summary
    }\n  attendees: ${JSON.stringify(context.attendees, null, 2)}`,
  );

  validateScheduleMeetingInput(context);

  const event = {
    summary: context.summary,
    description: context.description,
    start: { dateTime: context.start },
    end: { dateTime: context.end },
    attendees: context.attendees.map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  const { data } = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
    sendUpdates: 'all',
    conferenceDataVersion: 1,
  });

  // Guarantee we got a Meet link
  const meetLink =
    data.hangoutLink ??
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')
      ?.uri;

  if (!data.id || !meetLink) {
    throw new Error('Google Calendar did not return a Meet link');
  }

  console.log(
    `${LOG_PREFIX} Meeting Created:\n  calendar returned: ${JSON.stringify(
      {
        id: data.id,
        htmlLink: data.htmlLink,
        status: data.status,
      },
      null,
      2,
    )}`,
  );

  return {
    id: data.id,
    htmlLink: data.htmlLink!,
    status: data.status!,
  };
}
