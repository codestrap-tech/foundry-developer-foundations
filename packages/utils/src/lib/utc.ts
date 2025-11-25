/** Extract Y/M/D/h/m/s as seen in `tz` for a given UTC instant. */
export function partsInTZ(d: Date, tz: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const p = Object.fromEntries(
    dtf.formatToParts(d).map((x) => [x.type, x.value]),
  );
  return {
    year: +p['year'],
    month: +p['month'],
    day: +p['day'],
    hour: +p['hour'],
    minute: +p['minute'],
    second: +p['second'],
  };
}

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

/** Render the SAME UTC instant as local time in `tz` with ±HH:MM suffix. */
export function toZonedISOString(utc: Date, tz: string): string {
  const p = partsInTZ(utc, tz); // local Y/M/D H:M:S in tz
  // Offset minutes = (local-as-UTC ms) - (true UTC ms)
  const asIfUTC = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  const offMin = Math.round((asIfUTC - utc.getTime()) / 60000);
  const sign = offMin >= 0 ? '+' : '-';
  const abs = Math.abs(offMin);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Build "YYYY-MM-DDTHH:mm:ss" from a wall-clock Date and convert to the UTC instant for `tz`. */
export function toUTCFromWallClockLocal(wallClock: Date, tz: string): Date {
  const s =
    `${pad(wallClock.getFullYear(), 4)}-${pad(wallClock.getMonth() + 1)}-${pad(wallClock.getDate())}` +
    `T${pad(wallClock.getHours())}:${pad(wallClock.getMinutes())}:${pad(wallClock.getSeconds())}`;
  return wallClockToUTC(s, tz);
}

/** Convert a wall-clock string in `tz` to a UTC instant.
 * Supports:
 *  - ISO no-offset:  "YYYY-MM-DDTHH:mm[:ss]"  → interpret as wall-clock in `tz`
 *  - Explicit offset/Z (e.g., "...Z", "...+02:00", "GMT-0700 (...)") → parsed as real instant
 */
export function wallClockToUTC(isoOrOffsetStr: string, tz: string): Date {
  const s = isoOrOffsetStr.trim();

  // Case A: ISO without offset (wall-clock in tz)
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (m) {
    const Y = +m[1],
      Mo = +m[2],
      D = +m[3],
      h = +m[4],
      mi = +m[5],
      ssec = +(m[6] || '0');

    // First guess as UTC, then adjust by the tz offset at that instant.
    let ms = Date.UTC(Y, Mo - 1, D, h, mi, ssec);
    for (let i = 0; i < 3; i++) {
      const got = partsInTZ(new Date(ms), tz); // your existing helper (Intl-based)
      const gotMs = Date.UTC(
        got.year,
        got.month - 1,
        got.day,
        got.hour,
        got.minute,
        got.second,
      );
      const wantMs = Date.UTC(Y, Mo - 1, D, h, mi, ssec);
      const delta = wantMs - gotMs;
      if (delta === 0) break;
      ms += delta;
    }
    return new Date(ms);
  }

  // Case B: Anything with an explicit offset or Z → real instant already
  // Examples: "2025-09-09T10:30:00Z", "2025-09-09T10:30:00-07:00",
  //           "Tue Sep 09 2025 10:30:00 GMT-0700 (Pacific Daylight Time)"
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed;

  throw new Error(`Bad wall-clock string: ${isoOrOffsetStr}`);
}

/** Return UTC-hour numbers for the intended local working hours on the given date. */
export function workingHoursUTCForDate(
  baseUTC: Date,
  tz: string,
  localStartHour: number,
  localEndHour: number,
): { start_hour: number; end_hour: number } {
  const p = partsInTZ(baseUTC, tz);
  const y = p.year,
    m = p.month,
    d = p.day;

  const startUTC = wallClockToUTC(
    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(localStartHour).padStart(2, '0')}:00:00`,
    tz,
  );
  const endUTC = wallClockToUTC(
    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(localEndHour).padStart(2, '0')}:00:00`,
    tz,
  );

  // Use the UTC hour fields for clamping on that UTC date.
  return {
    start_hour: startUTC.getUTCHours(),
    end_hour: endUTC.getUTCHours(),
  };
}

/** Day-of-week index (0=Sun..6=Sat) for a UTC instant as seen in `tz`. */
export function dowInTZ(dUTC: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  });
  const w = fmt.format(dUTC);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(w);
}

/** Monday at LOCAL start-hour for the week containing `dUTC` in `tz` → UTC instant. */
export function mondayOfWeek(dUTC: Date, tz: string): Date {
  // Intended LOCAL business hours in the target tz:
  const LOCAL_START = 8;
  const p = partsInTZ(dUTC, tz);
  const dow = dowInTZ(dUTC, tz);
  const delta = dow === 0 ? -6 : 1 - dow; // to Monday
  const Y = p.year,
    Mo = p.month,
    D = p.day + delta;
  return wallClockToUTC(
    `${Y}-${String(Mo).padStart(2, '0')}-${String(D).padStart(2, '0')}T${String(LOCAL_START).padStart(2, '0')}:00:00`,
    tz,
  );
}

/** Friday at LOCAL end-hour for the week containing `dUTC` in `tz` → UTC instant. */
export function fridayOfWeek(dUTC: Date, tz: string): Date {
  const LOCAL_END = 17;
  const monUTC = mondayOfWeek(dUTC, tz);
  const mp = partsInTZ(monUTC, tz);
  const Y = mp.year,
    Mo = mp.month,
    D = mp.day + 4;
  return wallClockToUTC(
    `${Y}-${String(Mo).padStart(2, '0')}-${String(D).padStart(2, '0')}T${String(LOCAL_END).padStart(2, '0')}:00:00`,
    tz,
  );
}

export function dayInTZ(isoWithOffset: string, tz: string): number {
  const d = new Date(isoWithOffset); // instant is correct
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  });
  const w = fmt.format(d); // weekday as seen in `tz`
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(w);
}

export function detectIanaTimeZone(): string {
  // Works in modern Node and browsers with ICU data:
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return tz;
}
