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
        if (a.paksha !== 'krishna') return true;
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
