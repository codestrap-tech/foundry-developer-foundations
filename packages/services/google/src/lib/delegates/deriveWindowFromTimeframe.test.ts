// src/test/deriveWindowFromTimeframe.test.ts
import { deriveWindowFromTimeframe } from './deriveWindowFromTimeframe';
import type { MeetingRequest } from '@codestrap/developer-foundations-types';
import { wallClockToUTC, workingHoursUTCForDate, fridayOfWeek, mondayOfWeek } from '@codestrap/developer-foundations-utils';

describe('deriveWindowFromTimeframe (UTC core, TZ-aware asserts)', () => {
  // Target human timezone to assert against:
  const timezone = 'America/Los_Angeles';
  // const timezone = 'Europe/London';

  // Intended LOCAL business hours in the target tz:
  const LOCAL_START = 8;
  const LOCAL_END = 17;

  beforeAll(() => {
    // Make Node’s own environment predictable; all helpers are TZ-aware anyway.
    process.env.TZ = 'UTC';
  });

  /* -------------------- helpers -------------------- */

  function buildReq(
    overrides: Partial<MeetingRequest>,
    working_hours: { start_hour: number; end_hour: number }
  ): MeetingRequest {
    return {
      participants: ['a@corp.com'],
      subject: 'Test',
      timeframe_context: 'as soon as possible',
      duration_minutes: 30,
      working_hours,            // NOTE: these are UTC hours now
      ...overrides,
    };
  }

  /** Assert a UTC instant displays as Y/M/D HH:mm in the given tz. */
  function expectWallClock(
    dateUTC: Date,
    tz: string,
    y: number, m: number, d: number, hh: number, mm: number
  ) {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = Object.fromEntries(dtf.formatToParts(dateUTC).map(p => [p.type, p.value]));
    expect(+parts['year']).toBe(y);
    expect(+parts['month']).toBe(m);
    expect(+parts['day']).toBe(d);
    expect(+parts['hour']).toBe(hh);
    expect(+parts['minute']).toBe(mm);
  }

  /* -------------------- tests -------------------- */

  it('user defined exact date/time: uses the exact minute and step=1 (inside hours)', () => {
    // 10:10 local → UTC payload
    const candidateUTC = wallClockToUTC('2025-07-22T10:10:00', timezone);
    const nowUTC = wallClockToUTC('2025-07-22T09:00:00', timezone);
    const hoursUTC = workingHoursUTCForDate(nowUTC, timezone, LOCAL_START, LOCAL_END);

    const req = buildReq({
      timeframe_context: 'user defined exact date/time',
      localDateString: candidateUTC.toISOString(), // pass UTC instant
      duration_minutes: 30,
    }, hoursUTC);

    const { windowStartLocal, windowEndLocal, slotStepMinutes } =
      deriveWindowFromTimeframe(req, nowUTC);

    expect(slotStepMinutes).toBe(1);
    expectWallClock(windowStartLocal, timezone, 2025, 7, 22, 10, 10);
    expectWallClock(windowEndLocal, timezone, 2025, 7, 22, 10, 40);
  });

  it('user defined exact date/time: clamps start to start_hour if given before-hours time', () => {
    const candidateUTC = wallClockToUTC('2025-07-22T07:15:00', timezone);
    const nowUTC = wallClockToUTC('2025-07-22T06:00:00', timezone);
    const hoursUTC = workingHoursUTCForDate(nowUTC, timezone, LOCAL_START, LOCAL_END);

    const req = buildReq({
      timeframe_context: 'user defined exact date/time',
      localDateString: candidateUTC.toISOString(),
      duration_minutes: 30,
    }, hoursUTC);

    const { windowStartLocal, windowEndLocal, slotStepMinutes } =
      deriveWindowFromTimeframe(req, nowUTC);

    expect(slotStepMinutes).toBe(1);
    expectWallClock(windowStartLocal, timezone, 2025, 7, 22, 8, 0);
    expectWallClock(windowEndLocal, timezone, 2025, 7, 22, 8, 30);
  });

  it('as soon as possible: inside working hours → start = now (clamped), end = Friday 17:00 of same week', () => {
    const nowUTC = wallClockToUTC('2025-07-22T10:05:00', timezone); // Tue
    const hoursUTC = workingHoursUTCForDate(nowUTC, timezone, LOCAL_START, LOCAL_END);
    const req = buildReq({ timeframe_context: 'as soon as possible' }, hoursUTC);

    const { windowStartLocal, windowEndLocal, slotStepMinutes } =
      deriveWindowFromTimeframe(req, nowUTC);

    expect(slotStepMinutes).toBe(30);
    expectWallClock(windowStartLocal, timezone, 2025, 7, 22, 10, 5);

    const expectedFri = fridayOfWeek(nowUTC, timezone);
    expect(windowEndLocal.getTime()).toBe(expectedFri.getTime());
  });

  it('as soon as possible: after hours → next business day 08:00, end = Friday 17:00', () => {
    const nowUTC = wallClockToUTC('2025-07-22T18:10:00', timezone); // Tue after hours
    const hoursUTC = workingHoursUTCForDate(nowUTC, timezone, LOCAL_START, LOCAL_END);
    const req = buildReq({ timeframe_context: 'as soon as possible' }, hoursUTC);

    const { windowStartLocal, windowEndLocal } =
      deriveWindowFromTimeframe(req, nowUTC);

    // next day 08:00 (Wed) in target tz
    expectWallClock(windowStartLocal, timezone, 2025, 7, 23, 8, 0);

    const expectedFri = fridayOfWeek(nowUTC, timezone);
    expect(windowEndLocal.getTime()).toBe(expectedFri.getTime());
  });

  it('as soon as possible: on Saturday → start Monday 08:00, end Friday 17:00 (next week)', () => {
    const nowUTC = wallClockToUTC('2025-07-26T12:00:00', timezone); // Sat
    const hoursUTC = workingHoursUTCForDate(nowUTC, timezone, LOCAL_START, LOCAL_END);
    const req = buildReq({ timeframe_context: 'as soon as possible' }, hoursUTC);

    const { windowStartLocal, windowEndLocal } =
      deriveWindowFromTimeframe(req, nowUTC);

    // Monday 08:00 (2025-07-28)
    expectWallClock(windowStartLocal, timezone, 2025, 7, 28, 8, 0);

    const expectedFri = fridayOfWeek(
      wallClockToUTC('2025-07-28T09:00:00', timezone),
      timezone
    );
    expect(windowEndLocal.getTime()).toBe(expectedFri.getTime());
  });

  it('this week: mid-week → start = clamped now, end = Friday 17:00 this week', () => {
    const nowUTC = wallClockToUTC('2025-07-23T07:10:00', timezone); // Wed before hours
    const hoursUTC = workingHoursUTCForDate(nowUTC, timezone, LOCAL_START, LOCAL_END);
    const req = buildReq({ timeframe_context: 'this week' }, hoursUTC);

    const { windowStartLocal, windowEndLocal } =
      deriveWindowFromTimeframe(req, nowUTC);

    expectWallClock(windowStartLocal, timezone, 2025, 7, 23, 8, 0);
    const expectedFri = fridayOfWeek(nowUTC, timezone);
    expect(windowEndLocal.getTime()).toBe(expectedFri.getTime());
  });

  it('this week: past Friday close → rolls to next week Mon 08:00 → Fri 17:00', () => {
    const nowUTC = wallClockToUTC('2025-07-25T18:10:00', timezone); // Fri after hours
    const hoursUTC = workingHoursUTCForDate(nowUTC, timezone, LOCAL_START, LOCAL_END);
    const req = buildReq({ timeframe_context: 'this week' }, hoursUTC);

    const { windowStartLocal, windowEndLocal } =
      deriveWindowFromTimeframe(req, nowUTC);

    const expectedNextMon = mondayOfWeek(
      wallClockToUTC('2025-07-28T00:00:00', timezone),
      timezone
    ); // 2025-07-28 08:00
    expect(windowStartLocal.getTime()).toBe(expectedNextMon.getTime());

    const expectedNextFri = fridayOfWeek(expectedNextMon, timezone);
    expect(windowEndLocal.getTime()).toBe(expectedNextFri.getTime());
  });

  it('next week: Mon 08:00 next week → Fri 17:00 next week', () => {
    const nowUTC = wallClockToUTC('2025-07-23T10:00:00', timezone); // Wed
    const hoursUTC = workingHoursUTCForDate(nowUTC, timezone, LOCAL_START, LOCAL_END);
    const req = buildReq({ timeframe_context: 'next week' }, hoursUTC);

    const { windowStartLocal, windowEndLocal, slotStepMinutes } =
      deriveWindowFromTimeframe(req, nowUTC);

    expect(slotStepMinutes).toBe(30);

    const expectedMon = mondayOfWeek(
      wallClockToUTC('2025-07-28T00:00:00', timezone),
      timezone
    ); // next week’s Monday 08:00
    expect(windowStartLocal.getTime()).toBe(expectedMon.getTime());

    const expectedFri = fridayOfWeek(expectedMon, timezone);
    expect(windowEndLocal.getTime()).toBe(expectedFri.getTime());
  });
});
