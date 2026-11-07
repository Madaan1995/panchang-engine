/**
 * DST test (SPEC §4): Montreal (America/Toronto) on the spring-forward and
 * fall-back dates of a given year. Times must be correct local wall-clock
 * times and no segment may have a negative or doubled duration.
 *
 * The transition dates are DERIVED from the IANA tz database via Luxon (not
 * hard-coded), and correctness is checked by internal consistency:
 *  - every ISO string round-trips to the same instant and carries the zone's
 *    offset at that instant (−05:00 EST before the change, −04:00 EDT after);
 *  - equal-fraction segments have equal real durations;
 *  - local wall-clock sunrise jumps by ≈ ±1 hour across the change, because the
 *    real sunrise moves only a minute or two per day.
 */
import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { dayTimings, type DayTimings } from '@/core/dayTimings';
import { toZonedIso } from '@/core/format';
import { addDays } from '@/core/time';
import type { Interval } from '@/core/types';
import { MONTREAL } from './helpers/locations';

const ZONE = MONTREAL.timezone;
const YEAR = 2026;

/** Local dates in YEAR on which the zone's UTC offset at local noon differs from the previous day's. */
function dstChangeDates(year: number, zone: string): string[] {
  const out: string[] = [];
  let d = DateTime.fromObject({ year, month: 1, day: 2, hour: 12 }, { zone });
  while (d.year === year) {
    if (d.offset !== d.minus({ days: 1 }).offset) out.push(d.toISODate() as string);
    d = d.plus({ days: 1 });
  }
  return out;
}

function allIntervals(t: DayTimings): Interval[] {
  return [t.rahuKaal, t.yamaganda, t.gulika, t.abhijit, t.brahmaMuhurta, ...t.choghadiya.day, ...t.choghadiya.night];
}

function assertWallClockCorrect(instant: Date) {
  const iso = toZonedIso(instant, ZONE);
  const parsed = DateTime.fromISO(iso, { setZone: true });
  // Round-trips to the same instant (to the second, as output is rounded).
  expect(Math.abs(parsed.toMillis() - instant.getTime())).toBeLessThanOrEqual(500);
  // Carries the zone's real offset at that instant.
  expect(parsed.offset).toBe(DateTime.fromJSDate(instant, { zone: ZONE }).offset);
  expect([-300, -240]).toContain(parsed.offset);
}

function durationsFromIso(intervals: Interval[]): number[] {
  return intervals.map(
    (i) => DateTime.fromISO(toZonedIso(i.end, ZONE)).toMillis() - DateTime.fromISO(toZonedIso(i.start, ZONE)).toMillis(),
  );
}

function wallClockMinutes(instant: Date): number {
  const dt = DateTime.fromJSDate(instant, { zone: ZONE });
  return dt.hour * 60 + dt.minute + dt.second / 60;
}

const [springForward, fallBack] = dstChangeDates(YEAR, ZONE);

describe(`DST in ${ZONE}, ${YEAR} (internal-consistency checks)`, () => {
  it('finds exactly two offset changes in the year: spring-forward (−5 → −4) then fall-back (−4 → −5)', () => {
    expect(springForward).toBeDefined();
    expect(fallBack).toBeDefined();
    expect(DateTime.fromISO(`${springForward}T12:00`, { zone: ZONE }).offset).toBe(-240);
    expect(DateTime.fromISO(`${fallBack}T12:00`, { zone: ZONE }).offset).toBe(-300);
  });

  for (const [label, date] of [
    ['spring-forward', springForward!],
    ['fall-back', fallBack!],
  ] as const) {
    describe(`${label} day ${date}`, () => {
      // The day itself, and the day before (its night spans the 02:00 change).
      const days = [addDays(date, -1), date].map((d) => dayTimings(d, MONTREAL));

      it('every time is a valid local wall-clock time with the correct offset', () => {
        for (const t of days) {
          for (const instant of [t.previousSunset, t.sunrise, t.sunset, t.nextSunrise]) assertWallClockCorrect(instant);
          for (const i of allIntervals(t)) {
            assertWallClockCorrect(i.start);
            assertWallClockCorrect(i.end);
          }
        }
      });

      it('no segment has a negative or doubled duration; equal-fraction segments have equal real durations', () => {
        for (const t of days) {
          const day = durationsFromIso(t.choghadiya.day);
          const night = durationsFromIso(t.choghadiya.night);
          for (const set of [day, night]) {
            for (const d of set) expect(d).toBeGreaterThan(0);
            // Rounding to whole seconds can move each end by ≤ 0.5 s.
            expect(Math.max(...set) - Math.min(...set)).toBeLessThanOrEqual(1000);
          }
          for (const d of durationsFromIso([t.rahuKaal, t.yamaganda, t.gulika])) {
            expect(Math.abs(d - day[0]!)).toBeLessThanOrEqual(1000);
          }
          const [brahma] = durationsFromIso([t.brahmaMuhurta]);
          const nightMs = t.sunrise.getTime() - t.previousSunset.getTime();
          expect(Math.abs(brahma! - (2 * nightMs) / 15)).toBeLessThanOrEqual(1000);
          // A night is between 8 and 16 real hours at Montreal's latitude: never "doubled" or negative.
          for (const n of [nightMs, t.nextSunrise.getTime() - t.sunset.getTime()]) {
            expect(n).toBeGreaterThan(8 * 3_600_000);
            expect(n).toBeLessThan(16 * 3_600_000);
          }
        }
      });

      it('local wall-clock sunrise jumps by about one hour across the change', () => {
        const [before, after] = days as [DayTimings, DayTimings];
        const jump = wallClockMinutes(after.sunrise) - wallClockMinutes(before.sunrise);
        if (label === 'spring-forward') {
          expect(jump).toBeGreaterThan(55);
          expect(jump).toBeLessThan(62);
        } else {
          expect(jump).toBeGreaterThan(-60);
          expect(jump).toBeLessThan(-55);
        }
      });
    });
  }
});
