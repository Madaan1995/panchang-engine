import { describe, expect, it } from 'vitest';
import { FESTIVALS } from '@/core/data';
import { elementsAtInstant } from '@/core/elements';
import { festivals, observanceWindow } from '@/core/festivals';
import { lunarMonthAt } from '@/core/lunarCalendar';
import { sunTimes } from '@/core/riseSet';
import { addDays } from '@/core/time';
import { DELHI, LONDON, MONTREAL, VANCOUVER } from './helpers/locations';

const mid = (a: Date, b: Date) => new Date((a.getTime() + b.getTime()) / 2);

describe('festivals(year, location) (internal-consistency checks; NOT a correctness proof)', () => {
  const years = [2025, 2026, 2027, 2028];
  const cities = [MONTREAL, DELHI, VANCOUVER, LONDON];
  const results = cities.flatMap((city) => years.map((year) => ({ city, year, list: festivals(year, city) })));

  it('every festival rule is found exactly once per year (none of the 10 fall near New Year)', () => {
    for (const { list } of results) {
      expect(list.map((f) => f.id).sort()).toEqual(FESTIVALS.festivals.map((f) => f.id).sort());
    }
  });

  it('Diwali falls on Amavasya (tithi 30) of amanta Ashvin = purnimanta Kartika (see DECISIONS.md: SPEC.md states the reverse)', () => {
    for (const { city, year, list } of results) {
      const diwali = list.find((f) => f.id === 'diwali-lakshmi-puja')!;
      expect(diwali.date.startsWith(`${year}-`)).toBe(true);
      const at = mid(diwali.tithi.start, diwali.tithi.end);
      expect(elementsAtInstant(at).tithi.number).toBe(30);
      expect(lunarMonthAt(at, 'amanta').name.en).toBe('Ashvin');
      expect(lunarMonthAt(at, 'purnimanta').name.en).toBe('Kartika');
      // The day after Diwali is Kartika Shukla Pratipada in both systems.
      const nextSunrise = sunTimes(addDays(diwali.date, 1), city).sunrise;
      const after = lunarMonthAt(new Date(Math.max(nextSunrise.getTime(), diwali.tithi.end.getTime() + 60_000)), 'amanta');
      expect(after.name.en).toBe('Kartika');
    }
  });

  it('each festival tithi lies in the rule\'s amanta month and paksha', () => {
    for (const { list } of results) {
      for (const occ of list) {
        const rule = FESTIVALS.festivals.find((f) => f.id === occ.id)!;
        const at = mid(occ.tithi.start, occ.tithi.end);
        const m = lunarMonthAt(at, 'amanta');
        expect(m.name.en).toBe(rule.month);
        expect(m.isAdhik).toBe(false);
        expect(elementsAtInstant(at).tithi.paksha).toBe(rule.paksha);
      }
    }
  });

  it('unless the fallback was used, the deciding window on the chosen day overlaps the festival tithi', () => {
    for (const { list } of results) {
      for (const occ of list) {
        if (occ.fallbackUsed) continue;
        const w = occ.decidingWindow;
        if (w.start.getTime() === w.end.getTime()) {
          expect(w.start >= occ.tithi.start && w.start < occ.tithi.end).toBe(true);
        } else {
          expect(w.start < occ.tithi.end && w.end > occ.tithi.start).toBe(true);
        }
      }
    }
  });

  it('sunrise-rule festivals have their tithi at sunrise on the chosen date (unless fallback)', () => {
    for (const { city, list } of results) {
      for (const occ of list.filter((f) => f.observance === 'tithi_at_sunrise' && !f.fallbackUsed)) {
        const sunrise = sunTimes(occ.date, city).sunrise;
        expect(elementsAtInstant(sunrise).tithi.number).toBe(occ.tithi.number);
      }
    }
  });

  it('rejects years outside 1900..2100', () => {
    expect(() => festivals(1800, MONTREAL)).toThrow(RangeError);
  });
});

describe('observance windows (mathematical checks of the definitions in data/observance-windows.json)', () => {
  const day = {
    date: '2026-01-01',
    sunrise: new Date(Date.UTC(2026, 0, 1, 12)),
    sunset: new Date(Date.UTC(2026, 0, 1, 22)), // 10 h day
    nextSunrise: new Date(Date.UTC(2026, 0, 2, 12)), // 14 h night
  };
  const H = 3_600_000;

  it('sunrise rule is the sunrise instant', () => {
    const w = observanceWindow('tithi_at_sunrise', day);
    expect(w.start).toEqual(day.sunrise);
    expect(w.end).toEqual(day.sunrise);
  });

  it('Pradosh = first 3 of 15 night muhurtas after sunset (night/5)', () => {
    const w = observanceWindow('tithi_during_pradosh', day);
    expect(w.start).toEqual(day.sunset);
    expect(w.end.getTime() - w.start.getTime()).toBeCloseTo((14 * H) / 5, -1);
  });

  it('Nishita = 8th of 15 night muhurtas, centred on the middle of the night', () => {
    const w = observanceWindow('tithi_at_midnight', day);
    const nightMid = (day.sunset.getTime() + day.nextSunrise.getTime()) / 2;
    expect((w.start.getTime() + w.end.getTime()) / 2).toBeCloseTo(nightMid, -1);
    expect(w.end.getTime() - w.start.getTime()).toBeCloseTo((14 * H) / 15, -1);
  });

  it('Aparahna = 4th of 5 equal parts of the day', () => {
    const w = observanceWindow('tithi_during_aparahna', day);
    expect(w.start.getTime()).toBe(day.sunrise.getTime() + 6 * H);
    expect(w.end.getTime()).toBe(day.sunrise.getTime() + 8 * H);
  });
});
