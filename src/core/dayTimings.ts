/**
 * Day timings derived from sunrise/sunset: Rahu Kaal, Yamaganda, Gulika Kaal,
 * Abhijit muhurat, Brahma muhurta and choghadiya.
 *
 * All of these are equal fractions of the daytime (sunrise→sunset) or the
 * night (sunset→next sunrise). Durations are computed on UTC instants, so a
 * DST change during the night cannot create negative or doubled segments; only
 * the formatting to local wall-clock time is zone-aware.
 */
import { CHOGHADIYA, DAY_TIMINGS, type ChoghadiyaKey } from './data';
import type { Name } from './names';
import { sunTimes } from './riseSet';
import { addDays } from './time';
import type { GeoLocation, Interval, LocalDate } from './types';
import { varaForDate } from './vara';

export type DayPeriodKey = keyof typeof DAY_TIMINGS.periods;

export interface NamedInterval extends Interval {
  key: string;
  name: Name;
}

/** Split [start, end) into `parts` equal intervals. */
export function splitEqually(start: Date, end: Date, parts: number): Interval[] {
  const len = (end.getTime() - start.getTime()) / parts;
  return Array.from({ length: parts }, (_, i) => ({
    start: new Date(start.getTime() + i * len),
    end: new Date(start.getTime() + (i + 1) * len),
  }));
}

/** Rahu Kaal / Yamaganda / Gulika for a day with the given sunrise, sunset and weekday. */
export function dayPeriod(key: DayPeriodKey, sunrise: Date, sunset: Date, weekday: number): NamedInterval {
  const period = DAY_TIMINGS.periods[key];
  const parts = splitEqually(sunrise, sunset, DAY_TIMINGS.segmentsPerDay);
  const segmentNumber = period.segmentByWeekday[weekday] as number;
  const part = parts[segmentNumber - 1] as Interval;
  return { key, name: period.name, ...part };
}

export interface InauspiciousPeriods {
  rahuKaal: NamedInterval;
  yamaganda: NamedInterval;
  gulika: NamedInterval;
}

export function inauspiciousPeriods(sunrise: Date, sunset: Date, weekday: number): InauspiciousPeriods {
  return {
    rahuKaal: dayPeriod('rahuKaal', sunrise, sunset, weekday),
    yamaganda: dayPeriod('yamaganda', sunrise, sunset, weekday),
    gulika: dayPeriod('gulika', sunrise, sunset, weekday),
  };
}

/**
 * Abhijit muhurat: the Nth (default 8th, i.e. the middle one) of 15 equal
 * day-muhurtas between sunrise and sunset. It is centred on local apparent noon.
 */
export function abhijitMuhurat(sunrise: Date, sunset: Date): NamedInterval {
  const { muhurtasPerDayOrNight, abhijit } = DAY_TIMINGS.muhurtas;
  const m = splitEqually(sunrise, sunset, muhurtasPerDayOrNight)[abhijit.dayMuhurta - 1] as Interval;
  return { key: 'abhijit', name: abhijit.name, ...m };
}

/**
 * Brahma muhurta, per SPEC §4: the last N (default 2) of the 15 night-muhurtas,
 * i.e. the 2 muhurtas ending at sunrise, where night = previous sunset → sunrise.
 */
export function brahmaMuhurta(previousSunset: Date, sunrise: Date): NamedInterval {
  const { muhurtasPerDayOrNight, brahmaMuhurta: b } = DAY_TIMINGS.muhurtas;
  const night = splitEqually(previousSunset, sunrise, muhurtasPerDayOrNight);
  const first = night[muhurtasPerDayOrNight - b.nightMuhurtasEndingAtSunrise] as Interval;
  return { key: 'brahmaMuhurta', name: b.name, start: first.start, end: sunrise };
}

export interface ChoghadiyaSegment extends Interval {
  key: ChoghadiyaKey;
  name: Name;
  nature: 'auspicious' | 'inauspicious' | 'neutral';
  period: 'day' | 'night';
  /** 1..8 within the day or the night. */
  index: number;
}

/**
 * Choghadiya: 8 equal day segments (sunrise→sunset) and 8 equal night
 * segments (sunset→next sunrise), named from the weekday tables in
 * data/choghadiya.json. The weekday is the vara of the panchang day, so the
 * night after Sunday's sunset uses Sunday's night table.
 */
export function choghadiya(
  sunrise: Date,
  sunset: Date,
  nextSunrise: Date,
  weekday: number,
): { day: ChoghadiyaSegment[]; night: ChoghadiyaSegment[] } {
  const build = (period: 'day' | 'night', start: Date, end: Date): ChoghadiyaSegment[] => {
    const keys = CHOGHADIYA[period][weekday] as ChoghadiyaKey[];
    return splitEqually(start, end, 8).map((interval, i) => {
      const key = keys[i] as ChoghadiyaKey;
      const meta = CHOGHADIYA.choghadiyas[key];
      return { ...interval, key, name: meta.name, nature: meta.nature, period, index: i + 1 };
    });
  };
  return { day: build('day', sunrise, sunset), night: build('night', sunset, nextSunrise) };
}

export interface DayTimings extends InauspiciousPeriods {
  date: LocalDate;
  weekday: number;
  /** Sunset of the previous civil date; starts the night that ends at this sunrise. */
  previousSunset: Date;
  sunrise: Date;
  sunset: Date;
  nextSunrise: Date;
  abhijit: NamedInterval;
  brahmaMuhurta: NamedInterval;
  choghadiya: { day: ChoghadiyaSegment[]; night: ChoghadiyaSegment[] };
}

/** Day timings for the panchang day starting at sunrise on `date`. */
export function dayTimings(date: LocalDate, location: GeoLocation): DayTimings {
  const { sunrise, sunset } = sunTimes(date, location);
  const { sunset: previousSunset } = sunTimes(addDays(date, -1), location);
  const { sunrise: nextSunrise } = sunTimes(addDays(date, 1), location);
  const weekday = varaForDate(date).number;
  return {
    date,
    weekday,
    previousSunset,
    sunrise,
    sunset,
    nextSunrise,
    ...inauspiciousPeriods(sunrise, sunset, weekday),
    abhijit: abhijitMuhurat(sunrise, sunset),
    brahmaMuhurta: brahmaMuhurta(previousSunset, sunrise),
    choghadiya: choghadiya(sunrise, sunset, nextSunrise, weekday),
  };
}
