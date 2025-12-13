// scheduler.ts
import type { calendar_v3 } from 'googleapis';
import {
  partsInTZ,
  wallClockToUTC,
} from '@codestrap/developer-foundations-utils';

type Busy = { start: string; end: string };
export type Slot = { start: string; end: string; score?: number };
type WorkingHoursUTC = { start_hour: number; end_hour: number };

export type FindArgs = {
  calendar: calendar_v3.Calendar;
  attendees: string[];
  timezone: string; // IANA, e.g. "America/Los_Angeles"
  windowStartUTC: Date; // UTC instant
  windowEndUTC: Date; // UTC instant
  durationMinutes: number;
  workingHours: WorkingHoursUTC; // PRECOMPUTED UTC hours for that day (from workingHoursUTCForDate)
  slotStepMinutes?: number; // default 30
  skipFriday?: boolean; // default false
};

export async function findOptimalMeetingTimeV2({
  calendar,
  attendees,
  timezone,
  windowStartUTC,
  windowEndUTC,
  durationMinutes,
  workingHours, // UTC hours (already localized for that date)
  slotStepMinutes = 30,
  skipFriday = false,
}: FindArgs): Promise<Slot[]> {
  // 1) FreeBusy in UTC
  const fb = await calendar.freebusy.query({
    requestBody: {
      timeMin: windowStartUTC.toISOString(),
      timeMax: windowEndUTC.toISOString(),
      timeZone: 'UTC',
      items: attendees.map((id) => ({ id })),
    },
  });

  const calendars = fb.data.calendars ?? {};
  const allBusy: Busy[] = [];
  for (const calId in calendars) {
    const periods = calendars[calId]?.busy ?? [];
    for (const p of periods) {
      if (
        p.start &&
        p.end &&
        !isNaN(Date.parse(p.start)) &&
        !isNaN(Date.parse(p.end))
      ) {
        allBusy.push({ start: p.start, end: p.end });
      }
    }
  }
  const mergedBusy = mergeBusyIntervals(allBusy);

  // 2) Build per-day working windows in UTC, iterating calendar days in `timezone`
  const dailyWorkWindowsUTC = buildWorkingWindowsUTCFromUTCBounds(
    windowStartUTC,
    windowEndUTC,
    timezone,
    workingHours,
    skipFriday,
  );

  // 3) Subtract busy from those windows (still UTC)
  const freeIntervals = subtractBusyFromWindows(
    dailyWorkWindowsUTC,
    mergedBusy,
  );

  // 4) Slice into candidate slots, score, and format as zoned ISO with ±HH:MM
  const slots = sliceIntoSlots(freeIntervals, durationMinutes, slotStepMinutes)
    .map((s) => ({
      start: toZonedISOString(s.start, timezone),
      end: toZonedISOString(s.end, timezone),
      score: simpleHeuristicScore(s.start),
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return slots;
}

/* ======================= UTC day-iteration using your utils ======================= */

type Interval = { start: Date; end: Date };

/**
 * Iterate calendar days in `tz` between [windowStartUTC, windowEndUTC], and for each day
 * construct the working window using **UTC hours** already localized for that date.
 * (If end_hour <= start_hour, we roll the end into the next UTC day.)
 */
function buildWorkingWindowsUTCFromUTCBounds(
  windowStartUTC: Date,
  windowEndUTC: Date,
  tz: string,
  hoursUTC: WorkingHoursUTC,
  skipFriday: boolean,
): Interval[] {
  const result: Interval[] = [];

  const pad = (n: number, len = 2) => String(n).padStart(len, '0');

  // tz-midnight for start and end (as UTC instants)
  const sp = partsInTZ(windowStartUTC, tz);
  const ep = partsInTZ(windowEndUTC, tz);
  let dayUTC = wallClockToUTC(
    `${sp.year}-${pad(sp.month)}-${pad(sp.day)}T00:00:00`,
    tz,
  );
  const lastDayUTC = wallClockToUTC(
    `${ep.year}-${pad(ep.month)}-${pad(ep.day)}T00:00:00`,
    tz,
  );

  const clipStart = new Date(windowStartUTC);
  const clipEnd = new Date(windowEndUTC);

  while (dayUTC.getTime() <= lastDayUTC.getTime()) {
    // weekday in target tz
    const w = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
    }).format(dayUTC);
    const isWeekend = w === 'Sat' || w === 'Sun';
    const isFriday = w === 'Fri';

    if (!isWeekend && !(skipFriday && isFriday)) {
      // Build day window using **UTC hours**
      const dayStart = new Date(dayUTC);
      dayStart.setUTCHours(hoursUTC.start_hour, 0, 0, 0);

      let dayEnd = new Date(dayUTC);
      dayEnd.setUTCHours(hoursUTC.end_hour, 0, 0, 0);
      if (dayEnd.getTime() <= dayStart.getTime()) {
        // end spills into next UTC day (common for US timezones)
        dayEnd = new Date(dayEnd.getTime() + 24 * 60 * 60 * 1000);
      }

      const start = new Date(Math.max(dayStart.getTime(), clipStart.getTime()));
      const end = new Date(Math.min(dayEnd.getTime(), clipEnd.getTime()));

      if (start < end) result.push({ start, end });
    }

    // advance to next tz-midnight
    const cur = partsInTZ(dayUTC, tz);
    dayUTC = wallClockToUTC(
      `${cur.year}-${pad(cur.month)}-${pad(cur.day + 1)}T00:00:00`,
      tz,
    );
  }

  return result;
}

/* =========================== Busy & slotting (UTC) =========================== */

function mergeBusyIntervals(busy: Busy[]): Busy[] {
  if (!busy.length) return [];
  const sorted = busy
    .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }))
    .filter((b) => !isNaN(b.start.getTime()) && !isNaN(b.end.getTime()))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: { start: Date; end: Date }[] = [];
  let cur = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.start <= cur.end) {
      if (next.end > cur.end) cur.end = next.end;
    } else {
      merged.push(cur);
      cur = next;
    }
  }
  merged.push(cur);
  return merged.map((m) => ({
    start: m.start.toISOString(),
    end: m.end.toISOString(),
  }));
}

function subtractBusyFromWindows(
  windows: Interval[],
  busy: Busy[],
): Interval[] {
  const sortedWindows = windows
    .slice()
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const busyUTC = busy
    .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }))
    .filter((b) => !isNaN(b.start.getTime()) && !isNaN(b.end.getTime()))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const result: Interval[] = [];
  let i = 0;

  for (const win of sortedWindows) {
    let cursor = new Date(win.start);
    while (i < busyUTC.length && busyUTC[i].end <= win.start) i++;

    for (let j = i; j < busyUTC.length; j++) {
      const b = busyUTC[j];
      if (b.start >= win.end) break;
      if (b.end <= cursor) continue;
      if (b.start > cursor)
        result.push({ start: cursor, end: new Date(b.start) });
      cursor = new Date(Math.max(cursor.getTime(), b.end.getTime()));
    }

    if (cursor < win.end)
      result.push({ start: cursor, end: new Date(win.end) });
  }

  return mergeAdjacent(result);
}

function mergeAdjacent(intervals: Interval[]): Interval[] {
  if (!intervals.length) return [];
  const sorted = intervals
    .slice()
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [];
  let cur = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.start <= cur.end) {
      if (next.end > cur.end) cur.end = next.end;
    } else {
      merged.push(cur);
      cur = next;
    }
  }
  merged.push(cur);
  return merged;
}

function sliceIntoSlots(
  free: Interval[],
  durationMinutes: number,
  stepMinutes: number,
): Interval[] {
  const slots: Interval[] = [];
  const durMs = durationMinutes * 60_000;
  const stepMs = stepMinutes * 60_000;

  for (const f of free) {
    let t = roundUpToStepUTC(f.start, stepMinutes); // round in UTC
    while (t.getTime() + durMs <= f.end.getTime()) {
      const end = new Date(t.getTime() + durMs);
      slots.push({ start: new Date(t), end });
      t = new Date(t.getTime() + stepMs);
    }
  }
  return slots;
}

function roundUpToStepUTC(d: Date, stepMinutes: number): Date {
  const t = new Date(d.getTime());
  const mins = t.getUTCMinutes();
  const rem = mins % stepMinutes;
  if (rem !== 0) {
    t.setUTCMinutes(mins - rem + stepMinutes, 0, 0);
  } else {
    t.setUTCSeconds(0, 0);
  }
  return t;
}

/* =============================== Scoring/formatting =============================== */

function simpleHeuristicScore(startUTC: Date): number {
  const hoursFromNow = (startUTC.getTime() - Date.now()) / 3_600_000;
  return Math.max(0, 100 - Math.min(hoursFromNow * 0.5, 20));
}

/** Render the SAME instant as local time in `tz` with ±HH:MM suffix (e.g. 2025-07-22T10:30:00-07:00) */
function toZonedISOString(utc: Date, tz: string): string {
  const p = partsInTZ(utc, tz); // local Y/M/D/H/M/S in tz
  const offMin = offsetMinutesForInstantInTZ(utc, tz);
  const sign = offMin >= 0 ? '+' : '-';
  const abs = Math.abs(offMin);
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function offsetMinutesForInstantInTZ(utc: Date, tz: string): number {
  const p = partsInTZ(utc, tz);
  const asIfUTC = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return Math.round((asIfUTC - utc.getTime()) / 60000);
}
