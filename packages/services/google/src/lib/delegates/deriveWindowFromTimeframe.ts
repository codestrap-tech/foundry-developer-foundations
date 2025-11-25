import type {
  MeetingRequest,
  DerivedWindow,
} from '@codestrap/developer-foundations-types';

/**
 * Derive a scheduling window from a MeetingRequest.
 *
 * Assumptions:
 * - All input instants and strings are UTC.
 * - All computations use UTC getters/setters (host-TZ agnostic).
 *
 * @param req Meeting request
 * @param now "Now" (defaults to system clock; must be a UTC instant)
 */
export function deriveWindowFromTimeframe(
  req: MeetingRequest,
  now?: Date,
): DerivedWindow {
  const {
    timeframe_context,
    working_hours,
    duration_minutes,
    localDateString,
  } = req;
  const stepDefault = 30;

  // If caller didn’t supply "now", just use the current UTC instant.
  // Date objects are always absolute instants; we’ll only use UTC accessors below.
  const localNow = new Date(now ?? new Date());

  switch (timeframe_context) {
    case 'user defined exact date/time': {
      const candidateStr = localDateString?.trim();

      if (!candidateStr) {
        throw new Error(
          'timeframe_context "user defined exact date/time" requires a non-empty localDateString (UTC).'
        );
      }

      // ISO without timezone (e.g., 2025-07-22T10:10 or 2025-07-22 10:10[:ss])
      const isoNoTZ = /^\s*\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2})?\s*$/;

      let candidate: Date;
      if (isoNoTZ.test(candidateStr)) {
        // Interpret as *UTC wall-clock*
        const m = candidateStr.match(
          /^\s*(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?\s*$/
        )!;
        const Y = +m[1], M = +m[2], D = +m[3], h = +m[4], mm = +m[5], s = +(m[6] || '0');
        candidate = new Date(Date.UTC(Y, M - 1, D, h, mm, s));
      } else {
        // Strings with explicit offset are real instants already
        const parsed = new Date(candidateStr);
        if (isNaN(parsed.getTime())) {
          throw new Error(
            `Invalid localDateString for exact meeting time: "${candidateStr}"`
          );
        }
        candidate = parsed;
      }

      // Snap seconds/millis
      candidate.setUTCSeconds(0, 0);

      const windowStartLocal = candidate; // UTC instant
      const windowEndLocal = new Date(
        candidate.getTime() + duration_minutes * 60_000
      );
      const slotStepMinutes = 1;

      const clampedStart = clampToWorkingInstant(
        windowStartLocal,
        working_hours
      );
      const clampedEnd = new Date(
        Math.max(
          clampedStart.getTime() + duration_minutes * 60_000,
          windowEndLocal.getTime()
        )
      );

      return {
        windowStartLocal: clampedStart,
        windowEndLocal: clampedEnd,
        slotStepMinutes,
      };
    }

    case 'as soon as possible': {
      const start = clampToWorkingInstant(localNow, working_hours);
      const endOfSpan = endOfCurrentOrNextWorkWeek(start, working_hours);
      return {
        windowStartLocal: start,
        windowEndLocal: endOfSpan,
        slotStepMinutes: stepDefault,
      };
    }

    case 'this week': {
      const start = clampToWorkingInstant(localNow, working_hours);
      const end = endOfWorkWeek(start, working_hours);
      if (start.getTime() >= end.getTime()) {
        const next = startOfNextWeek(start, working_hours);
        const endNext = endOfWorkWeek(next, working_hours);
        return {
          windowStartLocal: next,
          windowEndLocal: endNext,
          slotStepMinutes: stepDefault,
        };
      }
      return {
        windowStartLocal: start,
        windowEndLocal: end,
        slotStepMinutes: stepDefault,
      };
    }

    case 'next week': {
      const start = startOfNextWeek(localNow, working_hours);
      const end = endOfWorkWeek(start, working_hours);
      return {
        windowStartLocal: start,
        windowEndLocal: end,
        slotStepMinutes: stepDefault,
      };
    }

    default: {
      const start = clampToWorkingInstant(localNow, working_hours);
      const endOfSpan = endOfCurrentOrNextWorkWeek(start, working_hours);
      return {
        windowStartLocal: start,
        windowEndLocal: endOfSpan,
        slotStepMinutes: stepDefault,
      };
    }
  }
}

/* ---------- UTC helpers (no timezones) ---------- */

/**
 * Kept name for compatibility; in UTC mode it simply returns a copy of `ref`.
 */
function nowInTZ(ref: Date): Date {
  return new Date(ref);
}

/** Start of the day (00:00 UTC) */
function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** Add whole days in UTC */
function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

/** Weekend check in UTC (0 Sun .. 6 Sat) */
function isWeekend(d: Date): boolean {
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * Clamp an instant to working hours on that day in UTC.
 * If before start → bump to start; if after end → next business day's start.
 */
function clampToWorkingInstant(
  instant: Date,
  hours: { start_hour: number; end_hour: number }
): Date {
  let x = new Date(instant);

  while (isWeekend(x)) {
    x = startOfDayLocal(addDays(x, 1));
  }

  const start = new Date(x);
  start.setUTCHours(hours.start_hour, 0, 0, 0);

  const end = new Date(x);
  end.setUTCHours(hours.end_hour, 0, 0, 0);

  // 🔧 If the end hour is <= start hour in UTC, it means the local “end of day”
  // spills into the *next* UTC day (e.g., PT 17:00 → 00:00 UTC next day).
  if (end.getTime() <= start.getTime()) {
    end.setUTCDate(end.getUTCDate() + 1);
  }

  if (x >= end) {
    // move to next business day start (still all-UTC)
    let y = startOfDayLocal(addDays(x, 1));
    while (isWeekend(y)) {
      y = startOfDayLocal(addDays(y, 1));
    }
    y.setUTCHours(hours.start_hour, 0, 0, 0);
    return y;
  }

  if (x < start) return start;

  return x;
}


/** Monday 00:00 UTC of the week containing d (Sun=0..Sat=6) */
function startOfWeekMonday(d: Date): Date {
  const x = startOfDayLocal(d);
  const dow = x.getUTCDay(); // 0 Sun .. 6 Sat
  const delta = dow === 0 ? -6 : 1 - dow; // move to Monday
  return startOfDayLocal(addDays(x, delta));
}

/** Next week's Monday at start_hour UTC */
function startOfNextWeek(
  d: Date,
  hours: { start_hour: number }
): Date {
  const nextMon = addDays(startOfWeekMonday(d), 7);
  nextMon.setUTCHours(hours.start_hour, 0, 0, 0);
  return nextMon;
}

/** Friday end_hour UTC of the week containing d */
/** Friday at end_hour UTC of the week containing d (handles UTC wrap past midnight) */
function endOfWorkWeek(
  d: Date,
  hours: { start_hour: number; end_hour: number }
): Date {
  const mon = startOfWeekMonday(d);
  const fri = addDays(mon, 4); // Mon + 4 = Fri

  // End-of-day on Friday in UTC
  const end = new Date(fri);
  end.setUTCHours(hours.end_hour, 0, 0, 0);

  // If end_hour <= start_hour in UTC, local "end of day" spills into next UTC day
  // (e.g., local 17:00 PT -> 00:00 UTC next day). Push end forward one day.
  const friStart = new Date(fri);
  friStart.setUTCHours(hours.start_hour, 0, 0, 0);
  if (end.getTime() <= friStart.getTime()) {
    end.setUTCDate(end.getUTCDate() + 1);
  }

  return end;
}

function endOfCurrentOrNextWorkWeek(
  start: Date,
  hours: { start_hour: number; end_hour: number }
): Date {
  const end = endOfWorkWeek(start, hours);
  if (start.getTime() >= end.getTime()) {
    return endOfWorkWeek(addDays(start, 7), hours);
  }
  return end;
}
