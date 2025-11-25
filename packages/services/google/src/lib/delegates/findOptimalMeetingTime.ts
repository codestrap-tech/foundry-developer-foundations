import {
  FindOptimalMeetingTimeOutput,
  BusyPeriod,
  OptimalTimeContext,
  TimeSlot,
} from '@codestrap/developer-foundations-types';
import { calendar_v3 } from 'googleapis';

const LOG_PREFIX = 'GSUITE - findOptimalMeetingTime - ';

/* ============================ TZ-ROBUST HELPERS ============================ */

/** Extract Y/M/D/h/m/s in a given TZ for a given instant (host-TZ agnostic) */
function partsInTZ(d: Date, tz: string): {
  year: number; month: number; day: number;
  hour: number; minute: number; second: number;
} {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const p = Object.fromEntries(dtf.formatToParts(d).map(x => [x.type, x.value]));
  return {
    year: +p['year'],
    month: +p['month'],
    day: +p['day'],
    hour: +p['hour'],
    minute: +p['minute'],
    second: +p['second'],
  };
}

/** Interpret a wall-clock Y-M-D h:m:s in tz as a UTC instant (DST-safe) */
function wallClockToUTC(
  year: number, month: number, day: number,
  hour: number, minute: number, second: number,
  tz: string
): Date {
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i++) {
    const got = partsInTZ(new Date(utcMs), tz);
    const gotMs = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute, got.second);
    const wantMs = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = wantMs - gotMs;
    if (delta === 0) break;
    utcMs += delta;
  }
  return new Date(utcMs);
}

/** Local wall-clock parts at the same instant in tz */
function utcToWallClock(d: Date, tz: string) {
  return partsInTZ(d, tz);
}

/** Offset minutes of tz at instant d (positive if tz AHEAD of UTC, negative if behind) */
function offsetAt(d: Date, tz: string): number {
  const p = partsInTZ(d, tz);
  const localAsUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((localAsUTC - d.getTime()) / 60000);
}

/** Midnight of the same day in tz (as a UTC instant) */
function startOfDayTZ(d: Date, tz: string): Date {
  const p = partsInTZ(d, tz);
  return wallClockToUTC(p.year, p.month, p.day, 0, 0, 0, tz);
}

/** Add whole days in tz (DST-safe). Returns midnight of resulting day in tz. */
function addDaysTZ(d: Date, days: number, tz: string): Date {
  const p = partsInTZ(d, tz);
  return wallClockToUTC(p.year, p.month, p.day + days, 0, 0, 0, tz);
}

/** Round up an instant to the next slot boundary in tz */
function roundUpToNextSlotTZ(d: Date, slotMinutes = 30, tz: string): Date {
  const p = partsInTZ(d, tz);
  const rem = p.minute % slotMinutes;
  const add = (rem === 0 && p.second === 0) ? 0 : (slotMinutes - rem);
  return wallClockToUTC(p.year, p.month, p.day, p.hour, p.minute + add, 0, tz);
}

/** RFC3339 string for the SAME instant, formatted in timezone's local clock with offset */
function toISOStringWithTimezone(date: Date, timezone: string): string {
  const off = offsetAt(date, timezone); // minutes
  const p = utcToWallClock(date, timezone);
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/* ============================ ORIGINAL APIS, FIXED ============================ */

/**
 * Returns the offset (in minutes) for the target time zone on the given date.
 * Positive if the zone is ahead of UTC, negative if behind.
 * Fallback used only if ICU fails (rare).
 */
function getTimeZoneOffset(
  timeZone: string,
  date: Date,
  fallbackOffset?: number
): number {
  try {
    return offsetAt(date, timeZone);
  } catch {
    return fallbackOffset ?? 0;
  }
}

/**
 * Computes meeting start and end times as UTC instants.
 * Interprets ISO-without-offset strings as wall-clock in `timezone`.
 * Relative contexts use working hours and tz-aware day math.
 */
function calculateMeetingTime(
  timeframeContext: string,
  workingHours = { start_hour: 8, end_hour: 17 },
  now = new Date(),
  timezone = 'America/Los_Angeles',
  _fallbackOffset?: number,
  skipFridayMeetings = false,
  meetingDuration = 30 // minutes
) {
  // Try exact timestamp
  const parsed = new Date(timeframeContext);
  const isoNoTZ = /^\s*\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2})?\s*$/;

  if (!isNaN(parsed.getTime())) {
    // eslint-disable-next-line regexp/no-unused-capturing-group
    const hasOffset = /(z|[+\-]\d{2}:?\d{2})\s*$/i.test(timeframeContext);
    if (hasOffset) {
      const startTime = new Date(parsed);
      const endTime = new Date(startTime.getTime() + meetingDuration * 60000);
      return { startTime, endTime };
    }
    if (isoNoTZ.test(timeframeContext)) {
      const m = timeframeContext.match(
        /^\s*(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?\s*$/
      )!;
      const [Y, M, D, h, mm, ss] = [+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] || '0')];
      const startTime = wallClockToUTC(Y, M, D, h, mm, ss, timezone);
      const endTime = new Date(startTime.getTime() + meetingDuration * 60000);
      return { startTime, endTime };
    }
    // Other string formats with no offset are ambiguous—treat as already an instant
    const startTime = new Date(parsed);
    const endTime = new Date(startTime.getTime() + meetingDuration * 60000);
    return { startTime, endTime };
  }

  // Relative contexts: build "now" in tz
  const nowParts = partsInTZ(now, timezone);
  let day0 = startOfDayTZ(now, timezone); // midnight today in tz (UTC instant)

  // If after hours, advance to next day
  if (nowParts.hour >= workingHours.end_hour) {
    day0 = addDaysTZ(day0, 1, timezone);
  }

  // Determine base day considering weekend/next week/friday skip
  const weekdayShort = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' });
  const dowIndex = (d: Date) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayShort.format(d));
  let baseDay = day0;

  const todayDow = dowIndex(baseDay);
  let step = 0;
  if (skipFridayMeetings && todayDow === 5) step = 3; // Fri -> Mon
  if (todayDow === 6) step = 2;                        // Sat -> Mon
  if (todayDow === 0) step = 1;                        // Sun -> Mon

  if (timeframeContext === 'next week') {
    const d = dowIndex(baseDay);
    const toNextMonday = ((1 - d + 7) % 7) || 7;
    step = toNextMonday;
  }

  if (step) baseDay = addDaysTZ(baseDay, step, timezone);

  // Choose start hour (if we didn't move days and we're before start_hour, use start_hour; otherwise use max(now, start))
  let startHour = workingHours.start_hour;
  if (step === 0 && nowParts.hour > workingHours.start_hour && nowParts.hour < workingHours.end_hour) {
    startHour = nowParts.hour;
  }

  let startTime = wallClockToUTC(
    partsInTZ(baseDay, timezone).year,
    partsInTZ(baseDay, timezone).month,
    partsInTZ(baseDay, timezone).day,
    startHour, 0, 0, timezone
  );

  // Round to slot boundary in tz
  startTime = roundUpToNextSlotTZ(startTime, 30, timezone);
  const endTime = new Date(startTime.getTime() + meetingDuration * 60000);

  return { startTime, endTime };
}

function calculateTimeSlotScore(
  slot: TimeSlot,
  allBusyTimes: BusyPeriod[]
): number {
  let score = 100;
  const hoursFromNow =
    (Date.parse(slot.start) - Date.now()) / (1000 * 60 * 60);
  score -= Math.min(hoursFromNow * 0.5, 20);

  for (const busy of allBusyTimes) {
    const busyStart = Date.parse(busy.start);
    const busyEnd = Date.parse(busy.end);
    const slotStart = Date.parse(slot.start);
    const slotEnd = Date.parse(slot.end);

    const bufferBefore = (slotStart - busyEnd) / 60000;
    const bufferAfter = (busyStart - slotEnd) / 60000;

    if (bufferBefore > 0 && bufferBefore < 30) score -= 10;
    if (bufferAfter > 0 && bufferAfter < 30) score -= 10;
  }

  return Math.max(0, score);
}

/**
 * Formats a date as an ISO string including the correct offset for the given timezone.
 * Shows the same instant with the zone's local wall clock and offset.
 */
function toISOStringWithTimezonePublic(
  date: Date,
  timezone: string
): string {
  return toISOStringWithTimezone(date, timezone);
}

// Helper: check if two time slots overlap (using millis)
function slotsOverlap(
  slot1: { start: string; end: string },
  slot2: { start: string; end: string }
): boolean {
  const a0 = Date.parse(slot1.start), a1 = Date.parse(slot1.end);
  const b0 = Date.parse(slot2.start), b1 = Date.parse(slot2.end);
  return a0 < b1 && b0 < a1;
}

function calculateEventDuration(start: string, end: string): number {
  return (Date.parse(end) - Date.parse(start)) / 60000;
}

/* ============================ MAIN ============================ */

export async function findOptimalMeetingTime(
  calendar: calendar_v3.Calendar,
  context: OptimalTimeContext
): Promise<FindOptimalMeetingTimeOutput> {
  console.log(
    `${LOG_PREFIX} Finding optimal meeting time for:\n : ${JSON.stringify(
      context,
      null,
      2
    )}`
  );

  try {
    const duration = context.duration_minutes || 30;
    const workingHours = context.working_hours || { start_hour: 8, end_hour: 17 };

    // Build initial window (UTC instants)
    const { startTime, endTime } = calculateMeetingTime(
      context.timeframe_context,
      workingHours,
      new Date(),
      context.timezone
    );

    // --- STEP 1: Fetch events (events.list) ---
    const eventTimeSlots: TimeSlot[] = [];
    const participants = [...context.participants];

    for (const participant of participants) {
      const params = {
        calendarId: participant,
        timeMin: toISOStringWithTimezonePublic(startTime, context.timezone!),
        timeMax: toISOStringWithTimezonePublic(endTime, context.timezone!),
        singleEvents: true,
      };
      const eventsResponse = await calendar.events.list(params);
      const events = eventsResponse.data.items || [];
      for (const event of events) {
        if (
          event.status !== 'cancelled' &&
          event.start?.dateTime &&
          event.end?.dateTime
        ) {
          const dur = calculateEventDuration(event.start.dateTime, event.end.dateTime);
          if (dur > 0) {
            eventTimeSlots.push({
              attendees: JSON.stringify(event.attendees),
              id: event.iCalUID || `${event.id}-${event.start.dateTime}`,
              start: event.start.dateTime,
              end: event.end.dateTime,
              startLocalDate: new Date(event.start.dateTime).toString(),
              endLocalDate: new Date(event.end.dateTime).toString(),
              duration: dur,
            });
          }
        }
      }
    }

    // --- STEP 2: freebusy for business hours today in tz ---
    // Compute today's working window in tz, then format with tz offset
    const dayStart = startOfDayTZ(startTime, context.timezone!); // base day from startTime
    const pDay = partsInTZ(dayStart, context.timezone!);
    const startFreeBusyTime = wallClockToUTC(pDay.year, pDay.month, pDay.day, workingHours.start_hour, 0, 0, context.timezone!);
    const lastTimeLocal = wallClockToUTC(pDay.year, pDay.month, pDay.day, workingHours.end_hour, 0, 0, context.timezone!);

    const freeBusyRequest = {
      timeMin: toISOStringWithTimezonePublic(startFreeBusyTime, context.timezone!),
      timeMax: toISOStringWithTimezonePublic(lastTimeLocal, context.timezone!),
      items: participants.map((email) => ({ id: email })),
      timeZone: 'UTC',
    };

    const freeBusyResponse = await calendar.freebusy.query({
      requestBody: freeBusyRequest,
    });

    const busySlots: BusyPeriod[] = [];
    const calendars = freeBusyResponse.data.calendars || {};
    for (const email in calendars) {
      const busyPeriods = calendars[email].busy || [];
      for (const period of busyPeriods) {
        if (period.start && period.end) {
          busySlots.push({ start: period.start, end: period.end });
        }
      }
    }

    // --- STEP 3: Filter freebusy that overlap with events.list ---
    const filteredFreeBusySlots = busySlots.filter((fbSlot) => {
      return !eventTimeSlots.some((eventSlot) =>
        slotsOverlap(
          { start: eventSlot.start, end: eventSlot.end },
          { start: fbSlot.start, end: fbSlot.end }
        )
      );
    });

    // Merge & dedupe by instant keys
    const seen = new Set<string>();
    const allBusyTimes: BusyPeriod[] = [
      ...eventTimeSlots,
      ...filteredFreeBusySlots,
    ].filter((slot) => {
      const key = `${Date.parse(slot.start)}-${Date.parse(slot.end)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort chronologically
    allBusyTimes.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

    // --- STEP 4: Walk through available slots within today's business window ---
    const availableSlots: TimeSlot[] = [];

    // currentTime starts at now (rounded) but not before startTime
    let currentTime = roundUpToNextSlotTZ(new Date(), 30, context.timezone!);
    if (currentTime < startTime) currentTime = new Date(startTime);

    // We'll iterate within today's business window; if we need to roll over, recompute window
    let windowStart = startFreeBusyTime;
    let windowEnd = lastTimeLocal;

    while (currentTime < windowEnd) {
      // Recompute local hour each iteration in tz
      const lp = partsInTZ(currentTime, context.timezone!);
      const localHour = lp.hour;

      if (localHour >= workingHours.start_hour && localHour < workingHours.end_hour) {
        const slotStart = new Date(currentTime);
        const slotEnd = new Date(currentTime.getTime() + duration * 60000);

        let isAvailable = true;
        for (const busy of allBusyTimes) {
          const busyStart = Date.parse(busy.start);
          const busyEnd = Date.parse(busy.end);
          if (slotStart.getTime() < busyEnd && slotEnd.getTime() > busyStart) {
            isAvailable = false;
            currentTime = roundUpToNextSlotTZ(new Date(busyEnd), 30, context.timezone!);
            break;
          }
        }

        if (isAvailable) {
          const slot: TimeSlot = {
            start: toISOStringWithTimezonePublic(slotStart, context.timezone!),
            end: toISOStringWithTimezonePublic(slotEnd, context.timezone!),
          };
          slot.score = calculateTimeSlotScore(slot, allBusyTimes);
          availableSlots.push(slot);
          currentTime = new Date(currentTime.getTime() + 30 * 60000);
        }
      } else {
        // Move to next day start in tz and recompute window
        const nextDay0 = addDaysTZ(currentTime, 1, context.timezone!);
        const p = partsInTZ(nextDay0, context.timezone!);
        windowStart = wallClockToUTC(p.year, p.month, p.day, workingHours.start_hour, 0, 0, context.timezone!);
        windowEnd = wallClockToUTC(p.year, p.month, p.day, workingHours.end_hour, 0, 0, context.timezone!);
        currentTime = new Date(windowStart);
      }
    }

    const suggestedTimes = availableSlots
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5)
      .map((slot) => ({ ...slot, score: slot.score || 0 }));

    const message =
      suggestedTimes.length > 0
        ? `Found ${suggestedTimes.length} optimal time slots.`
        : 'No available time slots found';

    console.log(
      `${LOG_PREFIX} Found times for:\n  participants: ${JSON.stringify(
        context.participants,
        null,
        2
      )}\n  timeframe: ${JSON.stringify(
        { suggested_times: suggestedTimes, message },
        null,
        2
      )}`
    );

    return { suggested_times: suggestedTimes, message };
  } catch (error) {
    console.error(
      `${LOG_PREFIX} Finding optimal meeting time failed:\n  message: ${error instanceof Error ? error.message : error
      }\n  stack: ${error instanceof Error ? error.stack : ''}`,
      { response: (error as any).response?.data }
    );
    throw error;
  }
}
