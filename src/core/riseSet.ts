/**
 * Sunrise/sunset and moonrise/moonset for a location and local calendar date.
 *
 * RISE/SET DEFINITION (documented convention, see also ARCHITECTURE.md):
 *   astronomy-engine `SearchRiseSet` reports the moment the UPPER LIMB (top
 *   edge) of the body's disc touches the observer's mathematical horizon,
 *   with a fixed standard atmospheric refraction of 34′ at the horizon
 *   (astronomy-engine's REFRACTION_NEAR_HORIZON). For the Sun this is the
 *   classical definition "centre 50′ below the geometric horizon" (34′
 *   refraction + ~16′ semi-diameter, the semi-diameter computed from the actual
 *   Earth–Sun distance). For the Moon, topocentric parallax is included. The observer is at `elevationMeters` above sea level,
 *   standing at ground level (metersAboveGround = 0), so no horizon dip is applied.
 *
 * This matches the spec's "upper limb of the Sun with standard refraction" and
 * is the convention most printed panchangas use for sunrise.
 */
import { Body, Equator, Horizon, Observer, SearchRiseSet } from 'astronomy-engine';
import { assertValidZone, localDayBounds, MS_PER_DAY } from './time';
import type { GeoLocation, LocalDate } from './types';

export type PolarCondition = 'MIDNIGHT_SUN' | 'POLAR_NIGHT';

/**
 * Typed error for dates/locations where the Sun does not rise or does not set.
 * Callers must handle this instead of receiving a wrong time.
 */
export class NoSunriseSunsetError extends Error {
  readonly code = 'NO_SUNRISE_SUNSET';
  constructor(
    readonly condition: PolarCondition,
    readonly date: LocalDate,
    readonly location: GeoLocation,
  ) {
    super(
      condition === 'MIDNIGHT_SUN'
        ? `The Sun does not set on ${date} at latitude ${location.latitude} (midnight sun); a panchang day cannot be defined.`
        : `The Sun does not rise on ${date} at latitude ${location.latitude} (polar night); a panchang day cannot be defined.`,
    );
    this.name = 'NoSunriseSunsetError';
  }
}

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
}

export function observerFor(location: GeoLocation): Observer {
  return new Observer(location.latitude, location.longitude, location.elevationMeters ?? 0);
}

const RISE = +1;
const SET = -1;

/** Refracted altitude of the Sun's centre at an instant (degrees). Used to classify polar days. */
export function sunAltitude(instant: Date, location: GeoLocation): number {
  const observer = observerFor(location);
  const eq = Equator(Body.Sun, instant, observer, true, true);
  return Horizon(instant, observer, eq.ra, eq.dec, 'normal').altitude;
}

/**
 * Sunrise = first sunrise during the local calendar date.
 * Sunset  = first sunset after that sunrise (normally the same evening).
 * Throws NoSunriseSunsetError when the Sun stays up or stays down.
 */
export function sunTimes(date: LocalDate, location: GeoLocation): SunTimes {
  assertValidZone(location.timezone);
  const observer = observerFor(location);
  const { start, end } = localDayBounds(date, location.timezone);
  const dayLengthDays = (end.getTime() - start.getTime()) / MS_PER_DAY;

  const rise = SearchRiseSet(Body.Sun, observer, RISE, start, dayLengthDays);
  if (rise === null || rise.date.getTime() >= end.getTime()) {
    throw polarError(date, location, start, end);
  }
  const set = SearchRiseSet(Body.Sun, observer, SET, rise.date, 1);
  if (set === null) {
    throw new NoSunriseSunsetError('MIDNIGHT_SUN', date, location);
  }
  return { sunrise: rise.date, sunset: set.date };
}

function polarError(date: LocalDate, location: GeoLocation, start: Date, end: Date): NoSunriseSunsetError {
  // Decide which polar condition applies by looking at the Sun's altitude at local midday.
  const midday = new Date((start.getTime() + end.getTime()) / 2);
  const condition: PolarCondition = sunAltitude(midday, location) > 0 ? 'MIDNIGHT_SUN' : 'POLAR_NIGHT';
  return new NoSunriseSunsetError(condition, date, location);
}
