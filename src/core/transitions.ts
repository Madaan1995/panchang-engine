/**
 * Start and end times of panchanga elements.
 *
 * Every element is a fixed-width slice of an increasing angle (see
 * angleFunctions.ts), so an element's start is the instant the angle crosses
 * (index × span) and its end is when it crosses ((index + 1) × span).
 *
 * KSHAYA and VRIDDHI, the two irregular cases a panchang day must show:
 *  - kshaya ("lost"): an element that starts after this day's sunrise and ends
 *    before the next sunrise, so it is never "the element at sunrise".
 *  - vriddhi ("increased"): an element that is current at this day's sunrise
 *    AND still current at the next sunrise, so it prevails at two sunrises.
 */
import type { AyanamsaName } from './ayanamsa';
import { angleFunctionFor, ELEMENT_GEOMETRY, type ElementKind } from './angleFunctions';
import { normalizeDegrees } from './angles';
import {
  karanaFromElongation,
  nakshatraFromMoonSidereal,
  tithiFromElongation,
  yogaFromSidereal,
  type KaranaInfo,
  type NakshatraInfo,
  type TithiInfo,
  type YogaInfo,
} from './elements';
import { findAngleCrossing } from './rootFinder';
import { sunTimes } from './riseSet';
import { addDays } from './time';
import type { GeoLocation, LocalDate } from './types';

export interface Segment<Info> {
  /** 1-based element number (tithi 1..30, karana 1..60, nakshatra 1..27, yoga 1..27). */
  number: number;
  info: Info;
  start: Date;
  end: Date;
}

export interface DaySegment<Info> extends Segment<Info> {
  /** Starts after this sunrise and ends before the next one. */
  kshaya: boolean;
  /** Current at this sunrise and still current at the next sunrise. */
  vriddhi: boolean;
}

interface InfoByKind {
  tithi: TithiInfo;
  karana: KaranaInfo;
  nakshatra: NakshatraInfo;
  yoga: YogaInfo;
}

/** Element info for a 1-based number, computed at the middle of its angular slice. */
export function infoFor<K extends ElementKind>(kind: K, number: number): InfoByKind[K] {
  const { span } = ELEMENT_GEOMETRY[kind];
  const mid = (number - 0.5) * span;
  switch (kind) {
    case 'tithi':
      return tithiFromElongation(mid) as InfoByKind[K];
    case 'karana':
      return karanaFromElongation(mid) as InfoByKind[K];
    case 'nakshatra': {
      // Pada is a sub-division of the nakshatra; a whole-nakshatra segment reports pada 1.
      const n = nakshatraFromMoonSidereal(mid);
      return { ...n, pada: 1 } as InfoByKind[K];
    }
    case 'yoga':
      // yogaFromSidereal takes the two longitudes and sums them; pass (mid, 0).
      return yogaFromSidereal(mid, 0) as InfoByKind[K];
  }
}

/** Longest any element can last, with margin: a tithi is at most ~26.8 h. Used as a search limit. */
const MAX_ELEMENT_DAYS = 3;

/**
 * Every segment of `kind` that overlaps [from, to), in time order. The first
 * segment may start before `from` and the last may end after `to`.
 */
export function segmentsBetween<K extends ElementKind>(
  kind: K,
  from: Date,
  to: Date,
  ayanamsa: AyanamsaName = 'lahiri',
): Segment<InfoByKind[K]>[] {
  const f = angleFunctionFor(kind, ayanamsa);
  const { span, count } = ELEMENT_GEOMETRY[kind];

  const value = f(from);
  let index = Math.min(Math.floor(normalizeDegrees(value) / span), count - 1); // 0-based
  let start = findAngleCrossing(f, index * span, from, { direction: -1, maxDays: MAX_ELEMENT_DAYS });
  if (start === null) throw new Error(`No start found for ${kind} before ${from.toISOString()}`);

  const segments: Segment<InfoByKind[K]>[] = [];
  while (start.getTime() < to.getTime()) {
    const nextIndex = (index + 1) % count;
    // Search from 1 ms after `start` so we never re-find the crossing we are standing on.
    const searchFrom = new Date(start.getTime() + 1);
    const end = findAngleCrossing(f, nextIndex * span, searchFrom, { direction: 1, maxDays: MAX_ELEMENT_DAYS });
    if (end === null) throw new Error(`No end found for ${kind} ${index + 1} after ${start.toISOString()}`);
    segments.push({ number: index + 1, info: infoFor(kind, index + 1), start, end });
    start = end;
    index = nextIndex;
  }
  return segments;
}

export interface DayTransitions {
  date: LocalDate;
  sunrise: Date;
  sunset: Date;
  nextSunrise: Date;
  tithi: DaySegment<TithiInfo>[];
  karana: DaySegment<KaranaInfo>[];
  nakshatra: DaySegment<NakshatraInfo>[];
  yoga: DaySegment<YogaInfo>[];
}

function markDay<Info>(segments: Segment<Info>[], dayStart: Date, dayEnd: Date): DaySegment<Info>[] {
  return segments.map((s) => ({
    ...s,
    kshaya: s.start.getTime() > dayStart.getTime() && s.end.getTime() <= dayEnd.getTime(),
    vriddhi: s.start.getTime() <= dayStart.getTime() && s.end.getTime() > dayEnd.getTime(),
  }));
}

/**
 * All element transitions for the panchang day that begins at sunrise on
 * `date` and ends at the next sunrise. Throws NoSunriseSunsetError at polar
 * latitudes on days without a sunrise.
 */
export function dayTransitions(date: LocalDate, location: GeoLocation, ayanamsa: AyanamsaName = 'lahiri'): DayTransitions {
  const { sunrise, sunset } = sunTimes(date, location);
  const { sunrise: nextSunrise } = sunTimes(addDays(date, 1), location);
  return {
    date,
    sunrise,
    sunset,
    nextSunrise,
    tithi: markDay(segmentsBetween('tithi', sunrise, nextSunrise, ayanamsa), sunrise, nextSunrise),
    karana: markDay(segmentsBetween('karana', sunrise, nextSunrise, ayanamsa), sunrise, nextSunrise),
    nakshatra: markDay(segmentsBetween('nakshatra', sunrise, nextSunrise, ayanamsa), sunrise, nextSunrise),
    yoga: markDay(segmentsBetween('yoga', sunrise, nextSunrise, ayanamsa), sunrise, nextSunrise),
  };
}
