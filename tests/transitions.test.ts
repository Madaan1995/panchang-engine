import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { elementsAtInstant } from '@/core/elements';
import { addDays } from '@/core/time';
import { dayTransitions, segmentsBetween, type DaySegment } from '@/core/transitions';
import { cityArb, recentLocalDateArb } from './helpers/arbitraries';
import { MONTREAL } from './helpers/locations';

const KINDS = ['tithi', 'karana', 'nakshatra', 'yoga'] as const;

describe('dayTransitions (structural/property checks)', () => {
  it('segments are contiguous and cover sunrise → next sunrise for every element', () => {
    fc.assert(
      fc.property(recentLocalDateArb, cityArb, (date, city) => {
        const d = dayTransitions(date, city);
        for (const kind of KINDS) {
          const segs: DaySegment<unknown>[] = d[kind];
          if (segs.length === 0) return false;
          if (!(segs[0]!.start <= d.sunrise && segs.at(-1)!.end > d.nextSunrise)) return false;
          for (let i = 1; i < segs.length; i++) if (segs[i]!.start.getTime() !== segs[i - 1]!.end.getTime()) return false;
        }
        return true;
      }),
      { numRuns: 40 },
    );
  });

  it('the element evaluated just inside each segment matches the segment number', () => {
    fc.assert(
      fc.property(recentLocalDateArb, cityArb, (date, city) => {
        const d = dayTransitions(date, city);
        return d.tithi.every((s) => {
          const mid = new Date((s.start.getTime() + s.end.getTime()) / 2);
          const e = elementsAtInstant(mid);
          return e.tithi.number === s.number;
        }) &&
          d.nakshatra.every((s) => elementsAtInstant(new Date(s.start.getTime() + 1000)).nakshatra.number === s.number) &&
          d.yoga.every((s) => elementsAtInstant(new Date(s.start.getTime() + 1000)).yoga.number === s.number) &&
          d.karana.every((s) => elementsAtInstant(new Date(s.start.getTime() + 1000)).karana.number === s.number);
      }),
      { numRuns: 40 },
    );
  });

  it('tithi and karana boundaries coincide: every tithi boundary is also a karana boundary (to the millisecond)', () => {
    const d = dayTransitions('2026-11-07', MONTREAL);
    const karanaStarts = new Set(d.karana.map((s) => s.start.getTime()));
    for (const s of d.tithi) {
      // Within 2 ms: both are independent 1 ms-tolerance searches of the same function.
      expect([...karanaStarts].some((k) => Math.abs(k - s.start.getTime()) <= 2)).toBe(true);
    }
  });

  it('over a year in Montreal, kshaya tithis (3 tithis in one day) and vriddhi tithis (same tithi at two sunrises) both occur and are flagged', () => {
    let date = '2026-01-01';
    let kshayaDays = 0;
    let vriddhiDays = 0;
    for (let i = 0; i < 365; i++) {
      const d = dayTransitions(date, MONTREAL);
      const k = d.tithi.filter((s) => s.kshaya);
      const v = d.tithi.filter((s) => s.vriddhi);
      if (k.length > 0) {
        kshayaDays++;
        // A kshaya tithi starts after sunrise and ends before the next sunrise.
        for (const s of k) expect(s.start > d.sunrise && s.end <= d.nextSunrise).toBe(true);
        expect(d.tithi.length).toBeGreaterThanOrEqual(3);
      }
      if (v.length > 0) {
        vriddhiDays++;
        expect(d.tithi).toHaveLength(1);
        // Prevails at this sunrise and at the next one.
        const next = dayTransitions(addDays(date, 1), MONTREAL);
        expect(next.tithi[0]!.number).toBe(v[0]!.number);
      }
      date = addDays(date, 1);
    }
    expect(kshayaDays).toBeGreaterThan(0);
    expect(vriddhiDays).toBeGreaterThan(0);
  });

  it('segmentsBetween over 30 days returns a contiguous chain of tithis', () => {
    const from = new Date(Date.UTC(2026, 0, 1));
    const to = new Date(Date.UTC(2026, 0, 31));
    const segs = segmentsBetween('tithi', from, to);
    expect(segs.length).toBeGreaterThanOrEqual(29);
    for (let i = 1; i < segs.length; i++) expect(segs[i]!.start).toEqual(segs[i - 1]!.end);
  });
});
