import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { DAY_TIMINGS, dayTimingsSchema } from '@/core/data';
import { dayPeriod, dayTimings, splitEqually } from '@/core/dayTimings';
import { sunTimes } from '@/core/riseSet';
import { cityArb, recentLocalDateArb } from './helpers/arbitraries';
import dayTimingsJson from '../data/day-timings.json';

describe('day-timings data file (structural checks; values UNVERIFIED)', () => {
  it('validates against its schema and carries an UNVERIFIED header and provenance', () => {
    expect(() => dayTimingsSchema.parse(dayTimingsJson)).not.toThrow();
    expect(DAY_TIMINGS.header.startsWith('UNVERIFIED')).toBe(true);
    expect(DAY_TIMINGS.provenance).toBeDefined();
  });

  it('on any weekday, Rahu Kaal, Yamaganda and Gulika occupy three different eighths of the day', () => {
    for (let w = 0; w < 7; w++) {
      const p = DAY_TIMINGS.periods;
      const s = new Set([p.rahuKaal.segmentByWeekday[w], p.yamaganda.segmentByWeekday[w], p.gulika.segmentByWeekday[w]]);
      expect(s.size).toBe(3);
    }
  });
});

describe('Rahu Kaal / Yamaganda / Gulika (mathematical checks)', () => {
  it('splitEqually produces equal, contiguous parts', () => {
    const parts = splitEqually(new Date(0), new Date(8000), 8);
    expect(parts).toHaveLength(8);
    parts.forEach((p, i) => {
      expect(p.start.getTime()).toBe(i * 1000);
      expect(p.end.getTime()).toBe((i + 1) * 1000);
    });
  });

  it('each period is exactly the table-specified eighth of sunrise→sunset', () => {
    fc.assert(
      fc.property(recentLocalDateArb, cityArb, (date, city) => {
        const t = dayTimings(date, city);
        const { sunrise, sunset } = sunTimes(date, city);
        const eighth = (sunset.getTime() - sunrise.getTime()) / 8;
        return (['rahuKaal', 'yamaganda', 'gulika'] as const).every((key) => {
          const seg = DAY_TIMINGS.periods[key].segmentByWeekday[t.weekday]!;
          const p = t[key];
          return (
            Math.abs(p.start.getTime() - (sunrise.getTime() + (seg - 1) * eighth)) <= 1 &&
            Math.abs(p.end.getTime() - p.start.getTime() - eighth) <= 1
          );
        });
      }),
      { numRuns: 50 },
    );
  });

  it('uses the table entry for the vara of the panchang day', () => {
    // 2026-11-08 is a Sunday; Sunday's Rahu Kaal is the table's entry 0.
    const sunrise = new Date(Date.UTC(2026, 10, 8, 12));
    const sunset = new Date(Date.UTC(2026, 10, 8, 20));
    const p = dayPeriod('rahuKaal', sunrise, sunset, 0);
    const seg = DAY_TIMINGS.periods.rahuKaal.segmentByWeekday[0]!;
    expect(p.start.getTime()).toBe(sunrise.getTime() + (seg - 1) * 3_600_000);
  });
});
