/**
 * Sun and Moon ecliptic longitudes at an instant.
 *
 * Source of positions: astronomy-engine.
 *  - Sun: `SunPosition` — apparent geocentric longitude (corrected for light
 *    time / aberration) on the true ecliptic and equinox of date. Based on VSOP87.
 *  - Moon: `EclipticGeoMoon` — geocentric longitude on the true ecliptic and
 *    equinox of date. Based on the Improved Lunar Ephemeris / Brown's theory.
 *
 * Both are GEOCENTRIC, which is the standard for panchang elements (tithi,
 * nakshatra, yoga): they are properties of the moment, not of the observer.
 */
import { EclipticGeoMoon, MakeTime, SunPosition, type AstroTime } from 'astronomy-engine';
import { normalizeDegrees } from './angles';
import { ayanamsaDegrees, toSidereal, type AyanamsaName } from './ayanamsa';

export interface Longitudes {
  /** Tropical (true of date) longitudes, degrees [0, 360). */
  sunTropical: number;
  moonTropical: number;
  /** Ayanamsa subtracted to get sidereal values, degrees. */
  ayanamsa: number;
  /** Sidereal longitudes, degrees [0, 360). */
  sunSidereal: number;
  moonSidereal: number;
}

export function sunTropicalLongitude(time: AstroTime): number {
  return normalizeDegrees(SunPosition(time).elon);
}

export function moonTropicalLongitude(time: AstroTime): number {
  return normalizeDegrees(EclipticGeoMoon(time).lon);
}

export function longitudesAt(instant: Date, ayanamsaName: AyanamsaName = 'lahiri'): Longitudes {
  const time = MakeTime(instant);
  const sunTropical = sunTropicalLongitude(time);
  const moonTropical = moonTropicalLongitude(time);
  const ayanamsa = ayanamsaDegrees(time, ayanamsaName);
  return {
    sunTropical,
    moonTropical,
    ayanamsa,
    sunSidereal: toSidereal(sunTropical, ayanamsa),
    moonSidereal: toSidereal(moonTropical, ayanamsa),
  };
}

/**
 * Moon − Sun elongation in degrees [0, 360). This drives tithi and karana.
 * The ayanamsa cancels out, so tropical and sidereal elongations are identical.
 */
export function elongationAt(instant: Date): number {
  const time = MakeTime(instant);
  return normalizeDegrees(moonTropicalLongitude(time) - sunTropicalLongitude(time));
}
