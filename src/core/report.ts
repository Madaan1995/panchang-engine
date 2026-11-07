/**
 * JSON-ready reports built from the core calculations. Both the HTTP API and
 * the web page render these, so there is exactly one code path from
 * astronomy to what users see. All times are zoned ISO 8601 strings.
 */
import type { AyanamsaName } from './ayanamsa';
import { conventions, type Conventions } from './conventions';
import { dayTimings, type NamedInterval } from './dayTimings';
import { elementsAtInstant } from './elements';
import { festivals } from './festivals';
import { toZonedIso, toZonedIsoOrNull } from './format';
import { lunarMonthAt, type MonthSystem } from './lunarCalendar';
import { findMuhurats, type DateRange } from './muhurat';
import { RASHI_NAMES, nameAt, type Name } from './names';
import { moonTimes } from './riseSet';
import { dayTransitions, type DaySegment } from './transitions';
import type { GeoLocation, LocalDate } from './types';
import { varaForDate } from './vara';

export interface CalcOptions {
  monthSystem: MonthSystem;
  ayanamsa: AyanamsaName;
}

export const DEFAULT_OPTIONS: CalcOptions = { monthSystem: 'purnimanta', ayanamsa: 'lahiri' };

export interface ZonedInterval {
  start: string;
  end: string;
}

export interface LocationOut {
  name?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

function locationOut(l: GeoLocation): LocationOut {
  return { ...(l.name !== undefined ? { name: l.name } : {}), latitude: l.latitude, longitude: l.longitude, timezone: l.timezone };
}

function interval(i: { start: Date; end: Date }, zone: string): ZonedInterval {
  return { start: toZonedIso(i.start, zone), end: toZonedIso(i.end, zone) };
}

function named(i: NamedInterval, zone: string) {
  return { name: i.name, ...interval(i, zone) };
}

function segmentOut<I, E extends object>(s: DaySegment<I>, zone: string, extra: (info: I) => E) {
  return { number: s.number, ...extra(s.info), ...interval(s, zone), kshaya: s.kshaya, vriddhi: s.vriddhi };
}

export function panchangReport(date: LocalDate, location: GeoLocation, options: CalcOptions = DEFAULT_OPTIONS) {
  const zone = location.timezone;
  const t = dayTransitions(date, location, options.ayanamsa);
  const timings = dayTimings(date, location);
  const moon = moonTimes(date, location);
  const atSunrise = elementsAtInstant(t.sunrise, options.ayanamsa);
  const amanta = lunarMonthAt(t.sunrise, 'amanta', options.ayanamsa);
  const purnimanta = lunarMonthAt(t.sunrise, 'purnimanta', options.ayanamsa);
  const chosen = options.monthSystem === 'amanta' ? amanta : purnimanta;
  const moonRashi = Math.floor(atSunrise.longitudes.moonSidereal / 30);

  return {
    date,
    location: locationOut(location),
    conventions: conventions({ ...options, timeZone: zone }) as Conventions,
    sun: {
      sunrise: toZonedIso(t.sunrise, zone),
      sunset: toZonedIso(t.sunset, zone),
      nextSunrise: toZonedIso(t.nextSunrise, zone),
    },
    moon: { moonrise: toZonedIsoOrNull(moon.moonrise, zone), moonset: toZonedIsoOrNull(moon.moonset, zone) },
    vara: varaForDate(date),
    atSunrise: {
      tithi: { number: atSunrise.tithi.number, name: atSunrise.tithi.name, paksha: atSunrise.tithi.pakshaName },
      nakshatra: { number: atSunrise.nakshatra.number, name: atSunrise.nakshatra.name, pada: atSunrise.nakshatra.pada },
      yoga: { number: atSunrise.yoga.number, name: atSunrise.yoga.name },
      karana: { number: atSunrise.karana.number, name: atSunrise.karana.name },
      sunRashi: amanta.sunRashi,
      moonRashi: { index: moonRashi, name: nameAt(RASHI_NAMES, moonRashi + 1) },
      ayanamsaDegrees: atSunrise.longitudes.ayanamsa,
    },
    lunarMonth: {
      system: options.monthSystem,
      name: chosen.name,
      isAdhik: chosen.isAdhik,
      paksha: chosen.paksha,
      amanta: { name: amanta.name, isAdhik: amanta.isAdhik },
      purnimanta: { name: purnimanta.name, isAdhik: purnimanta.isAdhik },
    },
    transitions: {
      tithi: t.tithi.map((s) => segmentOut(s, zone, (i) => ({ name: i.name, paksha: i.pakshaName }))),
      nakshatra: t.nakshatra.map((s) => segmentOut(s, zone, (i) => ({ name: i.name }))),
      yoga: t.yoga.map((s) => segmentOut(s, zone, (i) => ({ name: i.name }))),
      karana: t.karana.map((s) => segmentOut(s, zone, (i) => ({ name: i.name }))),
    },
    timings: {
      rahuKaal: named(timings.rahuKaal, zone),
      yamaganda: named(timings.yamaganda, zone),
      gulika: named(timings.gulika, zone),
      abhijit: named(timings.abhijit, zone),
      brahmaMuhurta: named(timings.brahmaMuhurta, zone),
    },
    choghadiya: {
      day: timings.choghadiya.day.map((c) => ({ name: c.name, nature: c.nature, ...interval(c, zone) })),
      night: timings.choghadiya.night.map((c) => ({ name: c.name, nature: c.nature, ...interval(c, zone) })),
    },
  };
}
export type PanchangReport = ReturnType<typeof panchangReport>;

export function festivalsReport(year: number, location: GeoLocation, options: CalcOptions = DEFAULT_OPTIONS) {
  const zone = location.timezone;
  return {
    year,
    location: locationOut(location),
    conventions: conventions({ ...options, timeZone: zone }),
    festivals: festivals(year, location, options.ayanamsa).map((f) => ({
      id: f.id,
      name: f.name,
      date: f.date,
      observance: f.observance,
      decidingWindow: { name: f.decidingWindow.name, ...interval(f.decidingWindow, zone) },
      tithi: { number: f.tithi.number, name: f.tithi.name, paksha: f.tithi.paksha, ...interval(f.tithi, zone) },
      lunarMonth: f.month,
      fallbackUsed: f.fallbackUsed,
      regionNotes: f.regionNotes,
      provenance: f.provenance,
      verified: false,
    })),
  };
}
export type FestivalsReport = ReturnType<typeof festivalsReport>;

export function muhuratReport(ceremony: string, range: DateRange, location: GeoLocation, options: CalcOptions = DEFAULT_OPTIONS) {
  const zone = location.timezone;
  const windows = findMuhurats(ceremony, range, location, options.ayanamsa);
  return {
    ceremony,
    from: range.from,
    to: range.to,
    location: locationOut(location),
    conventions: conventions({ ...options, timeZone: zone }),
    disclaimer: 'UNVERIFIED — rules must be reviewed by a priest',
    windows: windows.map((w) => ({
      date: w.date,
      ...interval(w, zone),
      weekday: w.weekday,
      tithis: w.tithis,
      nakshatras: w.nakshatras,
      karanas: w.karanas,
      reasons: w.reasons,
      startBoundary: { at: toZonedIso(w.startBoundary.at, zone), causes: w.startBoundary.causes },
      endBoundary: { at: toZonedIso(w.endBoundary.at, zone), causes: w.endBoundary.causes },
    })),
  };
}
export type MuhuratReport = ReturnType<typeof muhuratReport>;

export type { Name };
