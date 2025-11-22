// types/summarizeCalendars.ts
import { calendar_v3 } from 'googleapis';
import {
  toZonedISOString,
  toUTCFromWallClockLocal,
} from '@codestrap/developer-foundations-utils';
import {
  CalendarSummary,
  EventSummary,
  ListCalendarArgs,
  Summaries,
} from '@codestrap/developer-foundations-types';

/* ----------------------------------------------------------------------- */

function extractMeetingLink(evt: calendar_v3.Schema$Event): string | undefined {
  // Google Meet
  if (evt.hangoutLink) return evt.hangoutLink;
  // 3P links in description or location
  const text = `${evt.summary ?? ''} ${evt.description ?? ''} ${evt.location ?? ''}`;
  const regex =
    /(https?:\/\/\S*?(zoom\.us|teams\.microsoft\.com|meet\.google\.com|gotomeet\.|webex\.com)\S*)/i;
  const m = text.match(regex);
  return m ? m[1] : undefined;
}

async function fetchCalendar(
  cal: calendar_v3.Calendar,
  email: string,
  timeMin: string,
  timeMax: string,
  tz: string
): Promise<CalendarSummary> {
  const events: EventSummary[] = [];
  let pageTok: string | undefined;

  do {
    const res = await cal.events.list({
      calendarId: email,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      pageToken: pageTok,
    });

    (res.data.items ?? []).forEach((evt) => {
      if (!evt.start?.dateTime || !evt.end?.dateTime) return;

      const startUTC = new Date(evt.start.dateTime);
      const endUTC = new Date(evt.end.dateTime);
      if (isNaN(startUTC.getTime()) || isNaN(endUTC.getTime())) return;

      const dur = (endUTC.getTime() - startUTC.getTime()) / 60000;

      events.push({
        id: evt.id!,
        subject: evt.summary ?? '',
        description: evt.description ?? undefined,
        start: toZonedISOString(startUTC, tz),
        end: toZonedISOString(endUTC, tz),
        durationMinutes: Math.round(dur),
        participants: (evt.attendees ?? []).map((a) => a.email!).filter(Boolean),
        meetingLink: extractMeetingLink(evt),
      });
    });

    pageTok = res.data.nextPageToken ?? undefined;
  } while (pageTok);

  return { email, events };
}

export async function summarizeCalendars(
  args: ListCalendarArgs
): Promise<Summaries> {
  const { calendar, emails, timezone, windowStartLocal, windowEndLocal } = args;

  // Convert local wall-clock bounds to UTC instants using your utils.
  const timeMin = toUTCFromWallClockLocal(windowStartLocal, timezone).toISOString();
  const timeMax = toUTCFromWallClockLocal(windowEndLocal, timezone).toISOString();

  console.log(`summarizeCalendars fetchCalendar for timeMin ${timeMin} timeMax ${timeMax}`);

  // Kick off all fetches in parallel
  const settled = await Promise.allSettled(
    emails.map((email) => fetchCalendar(calendar, email, timeMin, timeMax, timezone))
  );

  // Split successes / failures
  const calendars: CalendarSummary[] = [];
  const failures: string[] = [];

  settled.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      calendars.push(result.value);
    } else {
      failures.push(`${emails[idx]}: ${result.reason?.message ?? 'unknown error'}`);
    }
  });

  const eventCount = calendars.reduce((n, c) => n + c.events.length, 0);
  const message =
    failures.length === 0
      ? `Fetched ${eventCount} events`
      : `Fetched ${eventCount} events; ${failures.length} calendar(s) failed`;

  return { message, calendars };
}
