// src/__fixtures__/scheduler.ts

export type FreeBusyCalendars = Record<
  string,
  {
    busy: Array<{ start: string; end: string }>;
  }
>;

/**
 * Single‑day, 3 attendees, with overlaps that force a narrow intersection.
 * Window (local PT): 2025-07-22 08:00–17:00 (PDT, UTC-7)
 *
 * Busy (all in UTC):
 *  a@corp.com:
 *    17:00–18:00Z  (10:00–11:00 PT)
 *    21:30–22:00Z  (14:30–15:00 PT)
 *  b@corp.com:
 *    19:00–20:30Z  (12:00–13:30 PT)
 *  c@corp.com:
 *    16:30–17:00Z  (09:30–10:00 PT)
 *    22:00–23:00Z  (15:00–16:00 PT)
 */
export const fbSingleDayCalendars: FreeBusyCalendars = {
  'a@corp.com': {
    busy: [
      { start: '2025-07-22T17:00:00Z', end: '2025-07-22T18:00:00Z' },
      { start: '2025-07-22T21:30:00Z', end: '2025-07-22T22:00:00Z' },
    ],
  },
  'b@corp.com': {
    busy: [{ start: '2025-07-22T19:00:00Z', end: '2025-07-22T20:30:00Z' }],
  },
  'c@corp.com': {
    busy: [
      { start: '2025-07-22T16:30:00Z', end: '2025-07-22T17:00:00Z' },
      { start: '2025-07-22T22:00:00Z', end: '2025-07-22T23:00:00Z' },
    ],
  },
};

/**
 * Multi‑day (2 days) intersection case. Window PT: 2025‑07‑22 08:00 → 2025‑07‑23 17:00
 */
export const fbMultiDayCalendars: FreeBusyCalendars = {
  'a@corp.com': {
    busy: [
      // Day 1
      { start: '2025-07-22T17:00:00Z', end: '2025-07-22T18:00:00Z' }, // 10–11 PT
      // Day 2
      { start: '2025-07-23T16:00:00Z', end: '2025-07-23T17:30:00Z' }, // 09–10:30 PT
    ],
  },
  'b@corp.com': {
    busy: [
      // Day 1
      { start: '2025-07-22T19:30:00Z', end: '2025-07-22T20:00:00Z' }, // 12:30–13:00 PT
      // Day 2
      { start: '2025-07-23T20:00:00Z', end: '2025-07-23T21:00:00Z' }, // 13–14 PT
    ],
  },
  'c@corp.com': {
    busy: [
      // Day 1
      { start: '2025-07-22T21:00:00Z', end: '2025-07-22T22:00:00Z' }, // 14–15 PT
      // Day 2 (none)
    ],
  },
};

/**
 * Friday window: expect 0 slots when skipFriday=true.
 */
export const fbFridayCalendars: FreeBusyCalendars = {
  'a@corp.com': { busy: [] },
  'b@corp.com': { busy: [] },
};

/**
 * DST boundary (US falls back on Sun Nov 2, 2025 at 02:00 local).
 * Window spans Nov 1–3, no busy blocks to ensure we only test offsets/slot counts.
 * (We'll just assert we get slots and offsets are either -07:00 or -08:00).
 */
export const fbDSTCalendars: FreeBusyCalendars = {
  'a@corp.com': { busy: [] },
  'b@corp.com': { busy: [] },
};
