import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { SearchMoonPhase } from 'astronomy-engine';
import { sunSiderealFunction } from '@/core/angleFunctions';
import { amantaMonthContaining, lunarMonthAt, lunarMonthForDate } from '@/core/lunarCalendar';
import { cityArb, recentLocalDateArb } from './helpers/arbitraries';

const DAY = 86_400_000;
const instantArb = fc.integer({ min: Date.UTC(1990, 0, 1), max: Date.UTC(2060, 0, 1) }).map((ms) => new Date(ms));

describe('amanta month boundaries (cross-check vs astronomy-engine)', () => {
  it('month start/end are within 60 s of astronomy-engine new moons (aberration convention, see DECISIONS.md)', () => {
    fc.assert(
      fc.property(instantArb, (d) => {
        const m = amantaMonthContaining(d);
        const ae = SearchMoonPhase(0, new Date(m.start.getTime() - DAY), 3)!;
        const aeEnd = SearchMoonPhase(0, new Date(m.end.getTime() - DAY), 3)!;
        return (
          Math.abs(ae.date.getTime() - m.start.getTime()) < 60_000 &&
          Math.abs(aeEnd.date.getTime() - m.end.getTime()) < 60_000 &&
          m.start <= d &&
          d < m.end
        );
      }),
      { numRuns: 40 },
    );
  });
});

describe('month naming (property checks of the documented rule)', () => {
  it('amanta month index = (sidereal sign of the Sun at the starting new moon) + 1, mod 12', () => {
    fc.assert(
      fc.property(instantArb, (d) => {
        const m = amantaMonthContaining(d);
        const sign = Math.floor(sunSiderealFunction()(m.start) / 30);
        return m.index === (sign + 1) % 12;
      }),
      { numRuns: 40 },
    );
  });

  it('both systems agree on the month of every Shukla paksha date', () => {
    fc.assert(
      fc.property(recentLocalDateArb, cityArb, (date, city) => {
        const a = lunarMonthForDate(date, city, 'amanta');
        const p = lunarMonthForDate(date, city, 'purnimanta');
        if (a.paksha !== 'shukla') return true;
        return a.index === p.index && a.name.en === p.name.en;
      }),
      { numRuns: 60 },
    );
  });

  it('in Krishna paksha the purnimanta month is the amanta month + 1', () => {
    fc.assert(
      fc.property(instantArb, (d) => {
        const a = lunarMonthAt(d, 'amanta');
        const p = lunarMonthAt(d, 'purnimanta');
        if (a.paksha !== 'krishna' || a.amanta.isAdhik) return true;
        return p.index === (a.index + 1) % 12;
      }),
      { numRuns: 60 },
    );
  });

  it('consecutive amanta months advance by one name except around adhik/kshaya months', () => {
    let m = amantaMonthContaining(new Date(Date.UTC(2020, 0, 15)));
    let normalSteps = 0;
    for (let i = 0; i < 60; i++) {
      const next = amantaMonthContaining(new Date(m.end.getTime() + DAY));
      expect(next.start.getTime()).toBe(m.end.getTime());
      if (next.index === (m.index + 1) % 12) normalSteps++;
      m = next;
    }
    // In 5 years there are ~2 adhik months; every other step advances by exactly one.
    expect(normalSteps).toBeGreaterThanOrEqual(55);
  });
});

describe('adhik maas detection (property checks)', () => {
  /** All amanta months from `fromMs` for `count` lunations. */
  function months(fromMs: number, count: number) {
    const out = [amantaMonthContaining(new Date(fromMs))];
    for (let i = 1; i < count; i++) out.push(amantaMonthContaining(new Date(out[i - 1]!.end.getTime() + DAY)));
    return out;
  }
  const lunations = months(Date.UTC(2000, 0, 15), 19 * 12 + 7 + 12); // > 19 years

  it('a month is adhik exactly when no sankranti occurs in it (Sun in the same sign at both new moons)', () => {
    for (const m of lunations) {
      const f = sunSiderealFunction();
      // Independent check: sample the Sun's sign daily through the month; adhik ⇔ it never changes.
      const signs = new Set<number>();
      for (let t = m.start.getTime(); t < m.end.getTime(); t += DAY / 4) signs.add(Math.floor(f(new Date(t)) / 30));
      signs.add(Math.floor(f(m.end) / 30));
      expect(m.isAdhik).toBe(signs.size === 1);
    }
  });

  it('an adhik month has the same name as the following (nija) month, which is not adhik', () => {
    for (let i = 0; i < lunations.length - 1; i++) {
      const m = lunations[i]!;
      if (!m.isAdhik) continue;
      expect(lunations[i + 1]!.index).toBe(m.index);
      expect(lunations[i + 1]!.isAdhik).toBe(false);
    }
  });

  it('Metonic property: any 19-year span (235 lunations) contains 6–8 adhik months (7 on average)', () => {
    for (let start = 0; start + 235 <= lunations.length; start += 12) {
      const n = lunations.slice(start, start + 235).filter((m) => m.isAdhik).length;
      expect(n).toBeGreaterThanOrEqual(6);
      expect(n).toBeLessThanOrEqual(8);
    }
  });

  it('adhik flag is returned for dates in an adhik month in both systems (both pakshas)', () => {
    const adhik = lunations.find((m) => m.isAdhik)!;
    const shukla = new Date(adhik.start.getTime() + 5 * DAY);
    const krishna = new Date(adhik.start.getTime() + 20 * DAY);
    for (const system of ['amanta', 'purnimanta'] as const) {
      expect(lunarMonthAt(shukla, system).isAdhik).toBe(true);
      expect(lunarMonthAt(krishna, system).isAdhik).toBe(true);
      expect(lunarMonthAt(krishna, system).index).toBe(adhik.index);
    }
  });
});
