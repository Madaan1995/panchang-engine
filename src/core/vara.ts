/**
 * Vara (weekday) and the "panchang date" of an instant.
 *
 * Rule (SPEC §2): a panchang day runs from local sunrise to the next local
 * sunrise, and its vara is the weekday of the local calendar date on which
 * that sunrise happens. So 02:00 on a Tuesday (before Tuesday's sunrise)
 * still belongs to Monday's panchang day.
 */
import type { AyanamsaName } from './ayanamsa';
import { elementsAtInstant, type ElementsAtInstant } from './elements';
import { VARA_NAMES, WEEKDAY_ENGLISH, type Name } from './names';
import { sunTimes } from './riseSet';
import { addDays, localDateOf, weekdayOf } from './time';
import type { GeoLocation, LocalDate } from './types';

export interface VaraInfo {
  /** 0 = Sunday (Ravivara) … 6 = Saturday (Shanivara). */
  number: number;
  name: Name;
  english: (typeof WEEKDAY_ENGLISH)[number];
}

export function varaForDate(panchangDate: LocalDate): VaraInfo {
  const number = weekdayOf(panchangDate);
  return { number, name: VARA_NAMES[number] as Name, english: WEEKDAY_ENGLISH[number] as VaraInfo['english'] };
}

/** The local date whose sunrise begins the panchang day that contains `instant`. */
export function panchangDateOf(instant: Date, location: GeoLocation): LocalDate {
  const civilDate = localDateOf(instant, location.timezone);
  const { sunrise } = sunTimes(civilDate, location);
  return instant.getTime() < sunrise.getTime() ? addDays(civilDate, -1) : civilDate;
}

export function varaAt(instant: Date, location: GeoLocation): VaraInfo {
  return varaForDate(panchangDateOf(instant, location));
}

export interface ElementsAt extends ElementsAtInstant {
  panchangDate: LocalDate;
  vara: VaraInfo;
}

/** All six elements at an instant for a location (vara needs the location's sunrise). */
export function elementsAt(instant: Date, location: GeoLocation, ayanamsa: AyanamsaName = 'lahiri'): ElementsAt {
  const panchangDate = panchangDateOf(instant, location);
  return { ...elementsAtInstant(instant, ayanamsa), panchangDate, vara: varaForDate(panchangDate) };
}
