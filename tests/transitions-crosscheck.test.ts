import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { MoonPhase, SearchMoonPhase } from 'astronomy-engine';
import { signedAngleDifference } from '@/core/angles';
import { angleFunctionFor, ELEMENT_GEOMETRY } from '@/core/angleFunctions';
import { findAngleCrossing } from '@/core/rootFinder';
import { dayTransitions, segmentsBetween } from '@/core/transitions';
import { cityArb, recentLocalDateArb } from './helpers/arbitraries';

const DAY = 86_400_000;

/** Up to 24 consecutive astronomy-engine moon phase instants (0 = new, 180 = full) from `start`. */
function phases(targetLon: number, start: Date, count: number): Date[] {
  const out: Date[] = [];
  let from = start;
  for (let i = 0; i < count; i++) {
    const t = SearchMoonPhase(targetLon, from, 40);
    if (t === null) throw new Error('SearchMoonPhase returned null');
    out.push(t.date);
    from = new Date(t.date.getTime() + DAY);
  }
  return out;
}

describe('cross-check (independent of the root finder): tithi ends vs astronomy-engine SearchMoonPhase', () => {
  // astronomy-engine's MoonPhase uses the geometric Sun; we use the apparent Sun
  // (aberration ≈ 20.5"), so a systematic offset of ~30–50 s is expected. The
  // spec's tolerance is 60 s. The maximum observed offset is printed for the record.
  const start = new Date(Date.UTC(2025, 0, 1));

  it('end of Amavasya (tithi 30) equals the new-moon time within 60 s for 24 consecutive lunations', () => {
    let maxOffsetS = 0;
    for (const newMoon of phases(0, start, 24)) {
      const segs = segmentsBetween('tithi', new Date(newMoon.getTime() - 2 * DAY), new Date(newMoon.getTime() + 2 * DAY));
      const amavasya = segs.find((s) => s.number === 30);
      expect(amavasya).toBeDefined();
      const offsetS = Math.abs(amavasya!.end.getTime() - newMoon.getTime()) / 1000;
      maxOffsetS = Math.max(maxOffsetS, offsetS);
      expect(offsetS).toBeLessThan(60);
    }
    console.info(`max |Amavasya end − new moon| over 24 lunations: ${maxOffsetS.toFixed(1)} s`);
  });

  it('end of Purnima (tithi 15) equals the full-moon time within 60 s for 24 consecutive lunations', () => {
    let maxOffsetS = 0;
    for (const fullMoon of phases(180, start, 24)) {
      const segs = segmentsBetween('tithi', new Date(fullMoon.getTime() - 2 * DAY), new Date(fullMoon.getTime() + 2 * DAY));
      const purnima = segs.find((s) => s.number === 15);
      expect(purnima).toBeDefined();
      const offsetS = Math.abs(purnima!.end.getTime() - fullMoon.getTime()) / 1000;
      maxOffsetS = Math.max(maxOffsetS, offsetS);
      expect(offsetS).toBeLessThan(60);
    }
    console.info(`max |Purnima end − full moon| over 24 lunations: ${maxOffsetS.toFixed(1)} s`);
  });
});

describe('cross-check: the residual ~45 s offset is the solar-aberration convention, not root-finder error', () => {
  it('running our root finder on astronomy-engine MoonPhase (geometric Sun) reproduces SearchMoonPhase within 1 s', () => {
    for (const newMoon of phases(0, new Date(Date.UTC(2025, 0, 1)), 24)) {
      const t = findAngleCrossing(MoonPhase, 0, new Date(newMoon.getTime() - DAY), { direction: 1, maxDays: 3 });
      expect(Math.abs(t!.getTime() - newMoon.getTime())).toBeLessThan(1000);
    }
  });
});

describe('property: at every computed transition the angular function equals the boundary value within 0.01°', () => {
  for (const kind of ['tithi', 'karana', 'nakshatra', 'yoga'] as const) {
    it(kind, () => {
      const f = angleFunctionFor(kind);
      const { span } = ELEMENT_GEOMETRY[kind];
      fc.assert(
        fc.property(recentLocalDateArb, cityArb, (date, city) => {
          const d = dayTransitions(date, city);
          return d[kind].every((s) => {
            const boundaryAtStart = (s.number - 1) * span;
            const boundaryAtEnd = s.number * span;
            return (
              Math.abs(signedAngleDifference(f(s.start), boundaryAtStart)) < 0.01 &&
              Math.abs(signedAngleDifference(f(s.end), boundaryAtEnd)) < 0.01
            );
          });
        }),
        { numRuns: 25 },
      );
    });
  }
});

describe('property: transitions are strictly increasing; tithi numbers advance by exactly 1 mod 30', () => {
  it('over random 10-day windows', () => {
    fc.assert(
      fc.property(fc.integer({ min: Date.UTC(1990, 0, 1), max: Date.UTC(2060, 0, 1) }), (ms) => {
        const segs = segmentsBetween('tithi', new Date(ms), new Date(ms + 10 * DAY));
        for (let i = 1; i < segs.length; i++) {
          const prev = segs[i - 1]!;
          const cur = segs[i]!;
          if (!(cur.start.getTime() > prev.start.getTime() && cur.end.getTime() > cur.start.getTime())) return false;
          if (cur.number !== (prev.number % 30) + 1) return false;
        }
        return true;
      }),
      { numRuns: 50 },
    );
  });

  it('nakshatra, yoga and karana numbers also advance by exactly 1 modulo their cycle', () => {
    fc.assert(
      fc.property(fc.integer({ min: Date.UTC(1990, 0, 1), max: Date.UTC(2060, 0, 1) }), (ms) => {
        for (const kind of ['nakshatra', 'yoga', 'karana'] as const) {
          const { count } = ELEMENT_GEOMETRY[kind];
          const segs = segmentsBetween(kind, new Date(ms), new Date(ms + 10 * DAY));
          for (let i = 1; i < segs.length; i++) {
            if (segs[i]!.start.getTime() <= segs[i - 1]!.start.getTime()) return false;
            if (segs[i]!.number !== (segs[i - 1]!.number % count) + 1) return false;
          }
        }
        return true;
      }),
      { numRuns: 30 },
    );
  });
});
