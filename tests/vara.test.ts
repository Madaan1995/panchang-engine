import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { DateTime } from 'luxon';
import { sunTimes } from '@/core/riseSet';
import { elementsAt, panchangDateOf, varaAt } from '@/core/vara';
import { cityArb, recentLocalDateArb } from './helpers/arbitraries';
import { MONTREAL } from './helpers/locations';

describe('vara at local sunrise', () => {
  it('spec example: 2 a.m. Tuesday local time in Montreal is still Monday\'s panchang', () => {
    // 2026-11-10 is a Tuesday (calendar fact, checkable with any calendar).
    const tuesday2am = DateTime.fromISO('2026-11-10T02:00', { zone: 'America/Toronto' });
    expect(tuesday2am.weekdayLong).toBe('Tuesday');
    const v = varaAt(tuesday2am.toJSDate(), MONTREAL);
    expect(v.english).toBe('Monday');
    expect(v.name.en).toBe('Somavara');
    expect(panchangDateOf(tuesday2am.toJSDate(), MONTREAL)).toBe('2026-11-09');
  });

  it('after sunrise on Tuesday the vara is Tuesday (Mangalavara)', () => {
    const { sunrise } = sunTimes('2026-11-10', MONTREAL);
    const v = varaAt(new Date(sunrise.getTime() + 60_000), MONTREAL);
    expect(v.english).toBe('Tuesday');
    expect(v.name.en).toBe('Mangalavara');
  });

  it('property: one second before sunrise belongs to the previous weekday, one second after to the civil weekday', () => {
    fc.assert(
      fc.property(recentLocalDateArb, cityArb, (date, city) => {
        const { sunrise } = sunTimes(date, city);
        const civilWeekday = DateTime.fromISO(date, { zone: 'UTC' }).weekday % 7;
        const before = varaAt(new Date(sunrise.getTime() - 1000), city).number;
        const after = varaAt(new Date(sunrise.getTime() + 1000), city).number;
        return after === civilWeekday && before === (civilWeekday + 6) % 7;
      }),
      { numRuns: 100 },
    );
  });

  it('elementsAt combines instant elements with the panchang date and vara', () => {
    const noon = DateTime.fromISO('2026-11-10T12:00', { zone: 'America/Toronto' }).toJSDate();
    const e = elementsAt(noon, MONTREAL);
    expect(e.panchangDate).toBe('2026-11-10');
    expect(e.vara.number).toBe(2);
    expect(e.tithi.number).toBeGreaterThanOrEqual(1);
  });
});
