/**
 * Lunar calendar: which lunar month (masa) an instant falls in.
 *
 * AMANTA months run from one new moon (end of Amavasya) to the next.
 * Month naming rule (the standard solar-sign rule, e.g. Reingold & Dershowitz,
 * "Calendrical Calculations", ch. "Modern Hindu Calendars"): an amanta month
 * is named after the sidereal sign (rashi) the Sun occupies at the new moon
 * that STARTS the month, plus one:
 *     Sun in Meena (330°–360°) at the starting new moon → Chaitra
 *     Sun in Mesha (0°–30°)                            → Vaishakha, … and so on.
 * Equivalently, in a normal month the Sun enters the next sign (a sankranti)
 * during the month, and Chaitra is the month containing Mesha sankranti.
 *
 * PURNIMANTA months run from full moon to full moon. Their Shukla (waxing)
 * half is identical to the amanta month's, so both systems give the same name
 * for Shukla paksha dates. Their Krishna (waning) half comes FIRST, and
 * carries the name of the NEXT amanta month (e.g. amanta Ashvin Krishna =
 * purnimanta Kartika Krishna).
 */
import type { AyanamsaName } from './ayanamsa';
import { angleFunctionFor, sunSiderealFunction } from './angleFunctions';
import { tithiFromElongation, type Paksha } from './elements';
import { LUNAR_MONTH_NAMES, RASHI_NAMES, nameAt, type Name } from './names';
import { findAngleCrossing } from './rootFinder';
import { sunTimes } from './riseSet';
import type { GeoLocation, LocalDate } from './types';

export type MonthSystem = 'amanta' | 'purnimanta';

/** Longest synodic month is ~29.8 days; search a little further. */
const MAX_LUNATION_DAYS = 31;

export interface AmantaMonth {
  /** New moon (end of Amavasya) that starts the month. */
  start: Date;
  /** New moon that ends it. */
  end: Date;
  /** 0 = Chaitra … 11 = Phalguna. */
  index: number;
  name: Name;
  /** Sidereal sign of the Sun at the start and end (0 = Mesha … 11 = Meena). */
  sunRashiAtStart: number;
  sunRashiAtEnd: number;
}

function rashiAt(instant: Date, ayanamsa: AyanamsaName): number {
  return Math.floor(sunSiderealFunction(ayanamsa)(instant) / 30) % 12;
}

/** The amanta month that contains `instant`. */
export function amantaMonthContaining(instant: Date, ayanamsa: AyanamsaName = 'lahiri'): AmantaMonth {
  const elongation = angleFunctionFor('tithi', ayanamsa);
  const start = findAngleCrossing(elongation, 0, instant, { direction: -1, maxDays: MAX_LUNATION_DAYS });
  if (start === null) throw new Error(`No new moon found before ${instant.toISOString()}`);
  const end = findAngleCrossing(elongation, 0, new Date(start.getTime() + 1), { direction: 1, maxDays: MAX_LUNATION_DAYS });
  if (end === null) throw new Error(`No new moon found after ${start.toISOString()}`);
  return amantaMonthBetween(start, end, ayanamsa);
}

/** Build the month record for the lunation between two consecutive new moons. */
export function amantaMonthBetween(start: Date, end: Date, ayanamsa: AyanamsaName = 'lahiri'): AmantaMonth {
  const sunRashiAtStart = rashiAt(start, ayanamsa);
  const sunRashiAtEnd = rashiAt(end, ayanamsa);
  const index = (sunRashiAtStart + 1) % 12;
  return { start, end, index, name: nameAt(LUNAR_MONTH_NAMES, index + 1), sunRashiAtStart, sunRashiAtEnd };
}

export interface LunarMonthInfo {
  system: MonthSystem;
  /** 0 = Chaitra … 11 = Phalguna. */
  index: number;
  name: Name;
  paksha: Paksha;
  /** The amanta month this instant falls in (always reported, whatever the system). */
  amanta: AmantaMonth;
  /** Sun's sidereal sign at the instant. */
  sunRashi: { index: number; name: Name };
}

/** Lunar month of an instant in the requested month system. */
export function lunarMonthAt(instant: Date, system: MonthSystem = 'purnimanta', ayanamsa: AyanamsaName = 'lahiri'): LunarMonthInfo {
  const amanta = amantaMonthContaining(instant, ayanamsa);
  const paksha = tithiFromElongation(angleFunctionFor('tithi', ayanamsa)(instant)).paksha;
  let index = amanta.index;
  if (system === 'purnimanta' && paksha === 'krishna') {
    index = (amanta.index + 1) % 12;
  }
  const r = rashiAt(instant, ayanamsa);
  return {
    system,
    index,
    name: nameAt(LUNAR_MONTH_NAMES, index + 1),
    paksha,
    amanta,
    sunRashi: { index: r, name: nameAt(RASHI_NAMES, r + 1) },
  };
}

/** Lunar month of a panchang day, evaluated at local sunrise. */
export function lunarMonthForDate(
  date: LocalDate,
  location: GeoLocation,
  system: MonthSystem = 'purnimanta',
  ayanamsa: AyanamsaName = 'lahiri',
): LunarMonthInfo {
  return lunarMonthAt(sunTimes(date, location).sunrise, system, ayanamsa);
}
