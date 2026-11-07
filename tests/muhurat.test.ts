import { describe, expect, it } from 'vitest';
import { elementsAtInstant } from '@/core/elements';
import { dayTimings } from '@/core/dayTimings';
import { findMuhurats, MAX_RANGE_DAYS, muhuratsForDay, rangeLengthDays, UnknownCeremonyError, type MuhuratWindow } from '@/core/muhurat';
import { MUHURAT_RULES, type MuhuratRule } from '@/core/muhuratRules';
import { InvalidInputError } from '@/core/time';
import { dayTransitions } from '@/core/transitions';
import { varaAt } from '@/core/vara';
import type { GeoLocation } from '@/core/types';
import { DELHI, MONTREAL } from './helpers/locations';

/** Independent re-evaluation of a rule at one instant, from elementsAtInstant + dayTimings. */
function ruleHoldsAt(rule: MuhuratRule, instant: Date, date: string, location: GeoLocation): boolean {
  const e = elementsAtInstant(instant);
  const t = dayTimings(date, location);
  const vara = varaAt(instant, location);
  const span = rule.timeOfDay === 'day' ? t.sunset : t.nextSunrise;
  if (instant < t.sunrise || instant >= span) return false;
  const inPeriod = rule.excluded.periods.some((p) => t[p].start <= instant && instant < t[p].end);
  return (
    rule.allowedWeekdays.includes(vara.english) &&
    rule.allowedTithis[e.tithi.paksha].includes(e.tithi.numberInPaksha) &&
    rule.allowedNakshatras.includes(e.nakshatra.name.en) &&
    !rule.excluded.karanas.includes(e.karana.key) &&
    !inPeriod
  );
}

const SECOND = 1000;

describe('findMuhurats (rule-consistency and boundary-alignment checks; rules UNVERIFIED)', () => {
  const cases: [string, GeoLocation][] = [
    ['griha-pravesh', MONTREAL],
    ['vivah', DELHI],
    ['namkaran', MONTREAL],
    ['mundan', DELHI],
  ];
  const results = cases.map(([ceremony, loc]) => ({
    ceremony,
    loc,
    rule: MUHURAT_RULES[ceremony]!,
    windows: findMuhurats(ceremony, { from: '2026-01-01', to: '2026-06-30' }, loc),
  }));

  it('finds some windows for every ceremony over six months', () => {
    for (const r of results) expect(r.windows.length).toBeGreaterThan(0);
  });

  it('every inclusion rule holds and no exclusion applies inside each window (checked independently at start+1s, middle, end−1s)', () => {
    for (const { rule, loc, windows } of results) {
      for (const w of windows) {
        for (const t of [w.start.getTime() + SECOND, (w.start.getTime() + w.end.getTime()) / 2, w.end.getTime() - SECOND]) {
          expect(ruleHoldsAt(rule, new Date(t), w.date, loc)).toBe(true);
        }
      }
    }
  });

  it('window boundaries align to the transitions that create them: the rule flips exactly at each boundary', () => {
    for (const { rule, loc, windows } of results) {
      for (const w of windows) {
        const t = dayTimings(w.date, loc);
        const spanEnd = rule.timeOfDay === 'day' ? t.sunset : t.nextSunrise;
        // Start: either sunrise, or the rule did NOT hold one second earlier.
        if (w.start.getTime() !== t.sunrise.getTime()) {
          expect(ruleHoldsAt(rule, new Date(w.start.getTime() - SECOND), w.date, loc)).toBe(false);
        }
        // End: either the end of the search span, or the rule does NOT hold one second later.
        if (w.end.getTime() !== spanEnd.getTime()) {
          expect(ruleHoldsAt(rule, new Date(w.end.getTime() + SECOND), w.date, loc)).toBe(false);
        }
      }
    }
  });

  it('each boundary names its cause, and the named transition/period edge is at that exact instant (±10 ms)', () => {
    for (const { loc, windows } of results) {
      for (const w of windows) {
        const d = dayTransitions(w.date, loc);
        const t = dayTimings(w.date, loc);
        const known: number[] = [
          d.sunrise, d.sunset, d.nextSunrise,
          ...[...d.tithi, ...d.nakshatra, ...d.karana].flatMap((s) => [s.start, s.end]),
          ...[t.rahuKaal, t.yamaganda, t.gulika].flatMap((p) => [p.start, p.end]),
        ].map((x) => x.getTime());
        for (const b of [w.startBoundary, w.endBoundary]) {
          expect(b.causes.length).toBeGreaterThan(0);
          expect(known.some((k) => Math.abs(k - b.at.getTime()) <= 10)).toBe(true);
        }
        expect(w.startBoundary.at).toEqual(w.start);
        expect(w.endBoundary.at).toEqual(w.end);
      }
    }
  });

  it('windows are ordered, non-overlapping and at least minimumWindowMinutes long, with reasons', () => {
    for (const { rule, windows } of results) {
      windows.forEach((w: MuhuratWindow, i) => {
        expect(w.end.getTime() - w.start.getTime()).toBeGreaterThanOrEqual(rule.minimumWindowMinutes * 60_000);
        expect(w.reasons.length).toBeGreaterThanOrEqual(3);
        if (i > 0) expect(w.start.getTime()).toBeGreaterThanOrEqual(windows[i - 1]!.end.getTime());
      });
    }
  });

  it('days whose weekday is not allowed produce no windows', () => {
    const rule = MUHURAT_RULES['griha-pravesh']!;
    // 2026-03-03 is a Tuesday, which is not in the griha-pravesh weekday list.
    expect(rule.allowedWeekdays).not.toContain('Tuesday');
    expect(muhuratsForDay(rule, '2026-03-03', MONTREAL)).toEqual([]);
  });
});

describe('findMuhurats input limits', () => {
  it(`allows up to ${MAX_RANGE_DAYS} days and rejects longer ranges`, () => {
    expect(rangeLengthDays({ from: '2028-01-01', to: '2028-12-31' })).toBe(366);
    expect(() => findMuhurats('mundan', { from: '2026-01-01', to: '2027-01-02' }, MONTREAL)).toThrowError(InvalidInputError);
  });

  it('rejects reversed ranges and unknown ceremonies', () => {
    expect(() => findMuhurats('mundan', { from: '2026-02-01', to: '2026-01-01' }, MONTREAL)).toThrowError(InvalidInputError);
    expect(() => findMuhurats('bogus', { from: '2026-01-01', to: '2026-01-02' }, MONTREAL)).toThrowError(UnknownCeremonyError);
  });
});
