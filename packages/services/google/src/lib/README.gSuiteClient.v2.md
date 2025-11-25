# Meeting Time Finder v2 — README

This document explains how **`getAvailableMeetingTimes` (v2)** works, what it returns, and how to use it. It wraps the new algorithm `findOptimalMeetingTimeV2` behind the same public interface you already use in v1.

---

## What it does

Given a **meeting request** (participants, duration, timeframe context, and PT working hours), the service:

1. Builds a **search window** in **Pacific Time** from your `timeframe_context` (ASAP / this week / next week / exact).
2. Calls Google Calendar **Free/Busy** for all participants inside that window.
3. Computes when **everyone is free** during **working hours** (Mon–Thu + Fri; weekends are excluded).
4. Slices free time into fixed‑length **slots** (default step 30 min).
5. **Scores** slots (earlier is better) and returns them as **PT ISO strings** with the correct **DST offset** (`-07:00` or `-08:00`).

---

## Quick start

```ts
import { makeGSuiteClientV2 } from './gsuiteClientV2';
import type { MeetingRequest } from '@xreason/types';

const office = await makeGSuiteClientV2('user@yourdomain.com');

const req: MeetingRequest = {
  participants: ['a@corp.com', 'b@corp.com', 'c@corp.com'],
  subject: 'Roadmap sync',
  timeframe_context: 'as soon as possible', // or 'this week' | 'next week' | 'user defined exact date/time'
  duration_minutes: 30,
  working_hours: { start_hour: 8, end_hour: 17 }, // PT business hours
  // localDateString: '2025-07-22T10:15:00' // only used for 'user defined exact date/time'
};

const result = await office.getAvailableMeetingTimes(req);

console.log(result);
/*
{
  message: "Found 6 suggested times",
  suggested_times: [
    { start: "2025-07-22T10:30:00-07:00", end: "2025-07-22T11:00:00-07:00", score: 98.7 },
    { start: "2025-07-22T11:00:00-07:00", end: "2025-07-22T11:30:00-07:00", score: 98.5 },
    ...
  ]
}
*/
```

**Return type**

```ts
{
  message: string;
  suggested_times: {
    start: string;
    end: string;
    score: number;
  }
  [];
}
```

---

## Inputs

`MeetingRequest` (unchanged from v1):

```ts
type MeetingRequest = {
  participants: string[]; // attendee emails (Google Calendar principals)
  subject: string;
  timeframe_context:
    | 'user defined exact date/time'
    | 'as soon as possible'
    | 'this week'
    | 'next week';
  localDateString?: string; // required when timeframe_context is 'user defined exact date/time'
  duration_minutes: number; // e.g., 30
  working_hours: { start_hour: number; end_hour: number }; // PT hours, e.g. {8,17}
};
```

---

## How the timeframe is interpreted (PT)

We convert your `timeframe_context` into a **PT wall‑clock window**:

- **`'as soon as possible'`**
  From **now (clamped to business hours)** through **Friday 17:00** of the same work week.
  _Example:_ If it’s Tuesday 10:05 PT, search window is `[Tue 10:05, Fri 17:00]`.

- **`'this week'`**
  From **now (clamped)** through **this Friday 17:00**. If you’re **already past Friday 17:00**, it **rolls to next week** (Mon 08:00 → Fri 17:00).

- **`'next week'`**
  **Monday 08:00 → Friday 17:00** of the **next** week (PT).

- **`'user defined exact date/time'`**
  Build a **narrow window** `[localDateString, localDateString + duration]`, with **minute granularity** (no rounding), then **clamp** to working hours if needed.
  _Example:_ `{ localDateString: "2025-07-22T10:10:00", duration_minutes: 30 }` → `[10:10, 10:40]`.

> **Weekends are excluded**. **Fridays are included** (no “skip Friday” unless you change that flag internally).

---

## Under the hood (how slots are found)

You don’t have to call this directly, but here’s what `findOptimalMeetingTimeV2` does:

1. **Convert the PT window to UTC** (DST‑safe) using `Intl.DateTimeFormat(...).formatToParts` to compute the true offset at each instant.
2. **Fetch Free/Busy** union for all attendees via `calendar.freebusy.query` in the UTC window.
3. **Merge** all busy intervals (plane‑sweep).
4. Build **daily working windows** (PT hours), converted to **UTC**, and **skip weekends** (optionally Friday if enabled).
5. **Subtract** merged busy from working windows (two‑pointer sweep) to get global **free intervals**.
6. **Slice** free intervals into fixed‑length **slots** (`duration_minutes`), advancing by `slotStepMinutes` (default 30), rounding **slot starts** up to the next step boundary.
7. **Score** (earlier → higher score), then **sort** descending.
8. Convert slot instants back to **PT ISO strings** with the **correct local offset** (`-07:00` in PDT, `-08:00` in PST).

---

## Time zone & DST behavior (Pacific Time)

- All user‑facing strings are **PT ISO datetimes** such as `2025-07-22T16:30:00-07:00`.
- **No ambiguity** around DST changes:
  - **Spring forward**: there is no 02:00–02:59 local hour; we never propose slots in that missing hour.
  - **Fall back**: the hour repeats; offset changes from `-07:00` to `-08:00` automatically.

- If `Intl` were to fail, we fall back to a safe offset (`fallbackOffsetMinutes`, default `-420`).

---

## What counts as “working hours”

- Provided by you in the request (`working_hours: { start_hour, end_hour }`) and applied **per business day** in PT.
- **Weekends** are **excluded**.
- **Fridays are included** by default (we do not set `skipFriday` in v2 client).

---

## Scoring

- Each slot gets a **simple heuristic score** that prefers **earlier** times.
- You can still sort or filter on your side (e.g., take top N) — the response contains a `score` for each.

---

## Error cases & validation

- If `timeframe_context = 'user defined exact date/time'` but `localDateString` is **missing** or **invalid**, you will get an error.
- If working hours are inverted (e.g., end ≤ start) or duration is non‑positive, the search yields **no slots**.
- If participants have all‑day busy events (OOO), those are treated as **busy** by Free/Busy.

---

## Example scenarios

### 1) ASAP on a weekday, during business hours

- **Request:** Tuesday 10:05 PT, duration 30, 08:00–17:00 PT.
- **Search window:** Tue 10:05 → Fri 17:00.
- **Result:** First slot typically `10:30–11:00` (rounded to the next 30‑min boundary), plus additional suggestions.

### 2) “This week” after Friday close

- **Request:** Friday 18:10 PT.
- **Behavior:** Rolls forward to **next week** (Mon 08:00 → Fri 17:00).

### 3) Exact date/time

- **Request:** `"2025-07-22T10:10:00"` for 30 minutes.
- **Behavior:** Search just **10:10–10:40** (clamped to business hours if outside).

---

## Performance notes

- Free/Busy call is a single batched request for all participants in the window.
- Interval math uses **merge** + **two‑pointer subtraction** for near **O(N)** traversal.
- For very long windows, consider limiting to the **first K slots** on your side.

---

## Required Google scopes & auth (unchanged)

- Calendar Free/Busy and Events scopes are used internally; you configure service account credentials via environment variables (same as v1).
- The v2 client reuses the v1 client’s authenticated `calendar_v3.Calendar` under the hood.

---

## Testing

We ship unit tests that cover:

- **Rounding and step alignment**.
- **Multi‑day windows**, weekend skipping, and Friday handling.
- **DST boundaries** (fall‑back and spring‑forward).
- **Fallback offset** behavior if `Intl` fails.

---

## FAQ

**Q: Why are the first slots slightly later than “now”?**
A: We **round up** to the next `slotStepMinutes` boundary to keep predictable scheduling (e.g., `10:05` → `10:30` when step is 30 min).

**Q: Can we exclude Fridays?**
A: The algorithm supports it (`skipFriday`), but the v2 client leaves it **off** by default to preserve v1 semantics.

**Q: Do results include lunch breaks or holidays?**
A: Lunch/holidays aren’t special‑cased. You can subtract a holiday calendar or add a lunch busy block per attendee if needed.

---

## Summary

- **Same API**, better reliability: PT timezone correctness, DST‑safe, and robust slot generation across multiple days and attendees.
- You call `getAvailableMeetingTimes` **exactly like v1**, and receive:

  ```ts
  {
    message: string;
    suggested_times: {
      start: string;
      end: string;
      score: number;
    }
    [];
  }
  ```

- If you need policy tweaks (buffers, lead time, skip Friday), we can enable them without breaking the API.
