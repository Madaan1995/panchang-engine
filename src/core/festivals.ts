/**
 * Festival dates from the rule data in data/festivals.json.
 *
 * For each festival rule (amanta month, paksha, tithi, observance rule):
 *  1. Walk the lunations that overlap the requested Gregorian year.
 *  2. In each NIJA (non-adhik) lunation whose name matches, find when the
 *     festival's tithi starts and ends (root finding on the elongation).
 *  3. For each panchang day (sunrise → next sunrise) touched by that tithi,
 *     build the rule's deciding window (sunrise, Nishita, Pradosh, Aparahna —
 *     definitions in data/observance-windows.json) and measure how much of the
 *     window the tithi covers.
 *  4. The festival is on the day with the largest coverage; ties go to the
 *     EARLIER day. If no day's window touches the tithi at all (e.g. a kshaya
 *     tithi that misses sunrise), fall back to the day in which most of the
 *     tithi falls, and flag `fallbackUsed`.
 *
 * Step 4 is a simplification of the classical decision rules
 * (Dharmasindhu/Nirnayasindhu have many special cases). UNVERIFIED.
 */
import type { AyanamsaName } from './ayanamsa';
import { angleFunctionFor } from './angleFunctions';
import { FESTIVALS, OBSERVANCE_WINDOWS, type FestivalRule, type ObservanceRule, type Provenance } from './data';
import { splitEqually } from './dayTimings';
import { LUNAR_MONTH_NAMES, TITHI_NAMES, nameAt, type Name } from './names';
import { amantaMonthContaining, type AmantaMonth } from './lunarCalendar';
import { findAngleCrossing } from './rootFinder';
import { sunTimes } from './riseSet';
import { addDays, localDateOf } from './time';
import type { GeoLocation, Interval, LocalDate } from './types';

const DAY_MS = 86_400_000;

export interface FestivalOccurrence {
  id: string;
  name: Name;
  /** Local date of the panchang day on which the festival is observed. */
  date: LocalDate;
  observance: ObservanceRule;
  /** The window that decided the date, on the chosen day. */
  decidingWindow: Interval & { name: Name };
  tithi: { number: number; name: Name; paksha: 'shukla' | 'krishna'; start: Date; end: Date };
  /** Month names in both systems for the festival's tithi. */
  month: { amanta: Name; purnimanta: Name };
  regionNotes: string;
  provenance: Provenance;
  /** True when no day's window overlapped the tithi and the fallback rule was used. */
  fallbackUsed: boolean;
}

/** Absolute tithi number 1..30 from paksha + number within paksha. */
export function absoluteTithi(paksha: 'shukla' | 'krishna', tithiInPaksha: number): number {
  return paksha === 'shukla' ? tithiInPaksha : tithiInPaksha + 15;
}

/** When tithi `n` (1..30) begins and ends inside the given lunation. */
export function tithiInterval(month: AmantaMonth, n: number, ayanamsa: AyanamsaName = 'lahiri'): Interval {
  const f = angleFunctionFor('tithi', ayanamsa);
  const start =
    n === 1 ? month.start : findAngleCrossing(f, (n - 1) * 12, month.start, { direction: 1, maxDays: 31 });
  const end = n === 30 ? month.end : findAngleCrossing(f, (n * 12) % 360, new Date(month.start.getTime() + 1), { direction: 1, maxDays: 31 });
  if (start === null || end === null) throw new Error(`Tithi ${n} not found in lunation starting ${month.start.toISOString()}`);
  return { start, end };
}

interface PanchangDay {
  date: LocalDate;
  sunrise: Date;
  sunset: Date;
  nextSunrise: Date;
}

function panchangDay(date: LocalDate, location: GeoLocation): PanchangDay {
  const { sunrise, sunset } = sunTimes(date, location);
  return { date, sunrise, sunset, nextSunrise: sunTimes(addDays(date, 1), location).sunrise };
}

/** The deciding window of an observance rule on a given panchang day. */
export function observanceWindow(rule: ObservanceRule, day: PanchangDay): Interval & { name: Name } {
  const def = OBSERVANCE_WINDOWS.windows[rule];
  switch (def.kind) {
    case 'instant':
      return { name: def.name, start: day.sunrise, end: day.sunrise };
    case 'dayParts': {
      const part = splitEqually(day.sunrise, day.sunset, def.parts)[def.part - 1] as Interval;
      return { name: def.name, ...part };
    }
    case 'nightMuhurtas': {
      const muhurtas = splitEqually(day.sunset, day.nextSunrise, 15);
      return { name: def.name, start: (muhurtas[def.from - 1] as Interval).start, end: (muhurtas[def.to - 1] as Interval).end };
    }
  }
}

/** How much of `window` the tithi covers. Instant windows score 1 if covered, else 0. */
function coverage(window: Interval, tithi: Interval): number {
  if (window.start.getTime() === window.end.getTime()) {
    return window.start >= tithi.start && window.start < tithi.end ? 1 : 0;
  }
  const s = Math.max(window.start.getTime(), tithi.start.getTime());
  const e = Math.min(window.end.getTime(), tithi.end.getTime());
  return Math.max(0, e - s);
}

/** Choose the observance day for a tithi occurrence (see module comment, step 4). */
export function chooseObservanceDay(
  rule: ObservanceRule,
  tithi: Interval,
  location: GeoLocation,
): { day: PanchangDay; window: Interval & { name: Name }; fallbackUsed: boolean } {
  // Candidate panchang days: those whose [sunrise, next sunrise) overlaps the tithi.
  const candidates: PanchangDay[] = [];
  for (let d = addDays(localDateOf(tithi.start, location.timezone), -1); ; d = addDays(d, 1)) {
    const day = panchangDay(d, location);
    if (day.sunrise.getTime() >= tithi.end.getTime()) break;
    if (day.nextSunrise.getTime() > tithi.start.getTime()) candidates.push(day);
  }
  let best: { day: PanchangDay; window: Interval & { name: Name }; score: number } | null = null;
  for (const day of candidates) {
    const window = observanceWindow(rule, day);
    const score = coverage(window, tithi);
    if (score > 0 && (best === null || score > best.score)) best = { day, window, score };
  }
  if (best !== null) return { day: best.day, window: best.window, fallbackUsed: false };

  // Fallback: the panchang day containing most of the tithi.
  let fallback = candidates[0] as PanchangDay;
  let most = -1;
  for (const day of candidates) {
    const c = coverage({ start: day.sunrise, end: day.nextSunrise }, tithi);
    if (c > most) {
      most = c;
      fallback = day;
    }
  }
  return { day: fallback, window: observanceWindow(rule, fallback), fallbackUsed: true };
}

/** All lunations whose span overlaps [from, to). */
export function lunationsBetween(from: Date, to: Date, ayanamsa: AyanamsaName = 'lahiri'): AmantaMonth[] {
  const out: AmantaMonth[] = [amantaMonthContaining(from, ayanamsa)];
  while ((out.at(-1) as AmantaMonth).end.getTime() < to.getTime()) {
    out.push(amantaMonthContaining(new Date((out.at(-1) as AmantaMonth).end.getTime() + DAY_MS), ayanamsa));
  }
  return out;
}

function occurrence(rule: FestivalRule, month: AmantaMonth, location: GeoLocation, ayanamsa: AyanamsaName): FestivalOccurrence {
  const n = absoluteTithi(rule.paksha, rule.tithi);
  const tithi = tithiInterval(month, n, ayanamsa);
  const { day, window, fallbackUsed } = chooseObservanceDay(rule.observance, tithi, location);
  const purnimantaIndex = rule.paksha === 'krishna' ? (month.index + 1) % 12 : month.index;
  return {
    id: rule.id,
    name: rule.name,
    date: day.date,
    observance: rule.observance,
    decidingWindow: window,
    tithi: { number: n, name: nameAt(TITHI_NAMES, n), paksha: rule.paksha, start: tithi.start, end: tithi.end },
    month: { amanta: month.name, purnimanta: nameAt(LUNAR_MONTH_NAMES, purnimantaIndex + 1) },
    regionNotes: rule.regionNotes,
    provenance: rule.provenance,
    fallbackUsed,
  };
}

/**
 * Every festival in data/festivals.json observed in Gregorian `year` at
 * `location`, sorted by date. Dates are local panchang dates.
 */
export function festivals(year: number, location: GeoLocation, ayanamsa: AyanamsaName = 'lahiri'): FestivalOccurrence[] {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new RangeError(`year must be an integer in 1900..2100, got ${year}`);
  // Pad by ~45 days so festivals near New Year are found whichever lunation they fall in.
  const from = new Date(Date.UTC(year - 1, 10, 15));
  const to = new Date(Date.UTC(year + 1, 1, 15));
  const results: FestivalOccurrence[] = [];
  for (const month of lunationsBetween(from, to, ayanamsa)) {
    if (month.isAdhik) continue; // festivals are observed in the nija month
    for (const rule of FESTIVALS.festivals) {
      if (LUNAR_MONTH_NAMES[month.index]?.en !== rule.month) continue;
      const occ = occurrence(rule, month, location, ayanamsa);
      if (occ.date.startsWith(`${year}-`)) results.push(occ);
    }
  }
  return results.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
