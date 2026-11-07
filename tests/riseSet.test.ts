import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { Body, Equator, Horizon } from 'astronomy-engine';
import { DateTime } from 'luxon';
import { NoSunriseSunsetError, observerFor, sunTimes } from '@/core/riseSet';
import { InvalidInputError, localDayBounds } from '@/core/time';
import type { GeoLocation } from '@/core/types';
import { cityArb, localDateArb } from './helpers/arbitraries';
import { MONTREAL, TROMSO } from './helpers/locations';

const SUN_RADIUS_KM = 695_700;
const MOON_RADIUS_KM = 1_737.4;
const KM_PER_AU = 149_597_870.7;

/** Standard horizontal refraction used by the rise/set definition: 34 arcminutes. */
const STANDARD_REFRACTION_DEG = 34 / 60;

/**
 * Independent check of the rise/set definition using astronomy-engine's
 * Equator + Horizon functions (not SearchRiseSet): at a rise/set instant the
 * GEOMETRIC (unrefracted) altitude of the disc centre, plus the angular
 * semi-diameter, plus 34′ of standard refraction, is ~0.
 */
function upperLimbAltitude(body: Body, instant: Date, location: GeoLocation): number {
  const observer = observerFor(location);
  const eq = Equator(body, instant, observer, true, true);
  const hor = Horizon(instant, observer, eq.ra, eq.dec); // no refraction: geometric altitude
  const radiusKm = body === Body.Sun ? SUN_RADIUS_KM : MOON_RADIUS_KM;
  const semiDiameterDeg = (Math.asin(radiusKm / (eq.dist * KM_PER_AU)) * 180) / Math.PI;
  return hor.altitude + semiDiameterDeg + STANDARD_REFRACTION_DEG;
}

describe('sunTimes', () => {
  it('cross-check (astronomy-engine Horizon): upper limb + 34′ refraction is on the horizon at sunrise and sunset', () => {
    fc.assert(
      fc.property(localDateArb, cityArb, (date, city) => {
        const { sunrise, sunset } = sunTimes(date, city);
        return (
          Math.abs(upperLimbAltitude(Body.Sun, sunrise, city)) < 0.005 &&
          Math.abs(upperLimbAltitude(Body.Sun, sunset, city)) < 0.005
        );
      }),
      { numRuns: 150 },
    );
  });

  it('property: sunrise falls on the requested local date and precedes sunset', () => {
    fc.assert(
      fc.property(localDateArb, cityArb, (date, city) => {
        const { sunrise, sunset } = sunTimes(date, city);
        const { start, end } = localDayBounds(date, city.timezone);
        return sunrise >= start && sunrise < end && sunset > sunrise;
      }),
      { numRuns: 150 },
    );
  });

  it('property: sunrise is in the morning and sunset in the evening, local wall clock (mid-latitudes)', () => {
    fc.assert(
      fc.property(localDateArb, cityArb, (date, city) => {
        const { sunrise, sunset } = sunTimes(date, city);
        const riseHour = DateTime.fromJSDate(sunrise, { zone: city.timezone }).hour;
        const setHour = DateTime.fromJSDate(sunset, { zone: city.timezone }).hour;
        return riseHour >= 3 && riseHour <= 9 && setHour >= 15 && setHour <= 22;
      }),
      { numRuns: 100 },
    );
  });

  it('polar: midnight sun in Tromsø at the June solstice returns a typed error, not a time', () => {
    expect(() => sunTimes('2026-06-21', TROMSO)).toThrowError(NoSunriseSunsetError);
    try {
      sunTimes('2026-06-21', TROMSO);
    } catch (e) {
      expect((e as NoSunriseSunsetError).condition).toBe('MIDNIGHT_SUN');
      expect((e as NoSunriseSunsetError).code).toBe('NO_SUNRISE_SUNSET');
    }
  });

  it('polar: polar night in Tromsø at the December solstice returns a typed error', () => {
    try {
      sunTimes('2026-12-21', TROMSO);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(NoSunriseSunsetError);
      expect((e as NoSunriseSunsetError).condition).toBe('POLAR_NIGHT');
    }
  });

  it('rejects an invalid timezone or date with InvalidInputError', () => {
    expect(() => sunTimes('2026-01-01', { ...MONTREAL, timezone: 'Mars/Olympus' })).toThrowError(InvalidInputError);
    expect(() => sunTimes('2026-13-01', MONTREAL)).toThrowError(InvalidInputError);
  });
});
