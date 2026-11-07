/**
 * Ayanamsa: the angle between the tropical zodiac (measured from the moving
 * vernal equinox) and the sidereal zodiac (fixed relative to the stars).
 * Indian panchangas use sidereal longitudes, so every nakshatra, yoga and
 * solar-month (sankranti) calculation subtracts the ayanamsa from the tropical
 * longitude given by astronomy-engine.
 *
 * ---------------------------------------------------------------------------
 * Lahiri (Chitrapaksha) ayanamsa — STATUS: UNVERIFIED
 * ---------------------------------------------------------------------------
 * Definition used here (two parts):
 *
 * 1. Anchor value. The Indian Calendar Reform Committee (Report of the Calendar
 *    Reform Committee, Govt. of India, 1955), adopted by the Indian Astronomical
 *    Ephemeris, fixed the ayanamsa at 23°15'00.658" on 1956 March 21, 0h ET
 *    (Julian Date 2435553.5). That published figure is a TRUE ayanamsa: it
 *    already contains the nutation in longitude of that date. We therefore
 *    subtract the nutation at the anchor (computed with astronomy-engine's
 *    IAU 2000B nutation model, `e_tilt`) to get the MEAN ayanamsa at the anchor.
 *
 * 2. Rate of change. After the anchor, the mean ayanamsa grows exactly as the
 *    general precession in longitude, p_A. We use the IAU 2006 precession
 *    polynomial (Capitaine, Wallace & Chapront 2003, A&A 412, 567; IERS
 *    Conventions 2010, Chapter 5, eq. 5.40):
 *      p_A = 5028.796195 T + 1.1054348 T² + 0.00007964 T³
 *            − 0.000023857 T⁴ − 0.0000000383 T⁵   (arcseconds)
 *    with T in Julian centuries of Terrestrial Time since J2000.0.
 *
 *    mean_ayanamsa(t) = mean_ayanamsa(anchor) + p_A(t) − p_A(anchor)
 *    true_ayanamsa(t) = mean_ayanamsa(t) + Δψ(t)      (Δψ = nutation in longitude)
 *
 * Why true ayanamsa: astronomy-engine returns longitudes on the TRUE ecliptic
 * and equinox of date (nutation included). Subtracting the TRUE ayanamsa
 * cancels nutation, so sidereal longitudes are measured from a point fixed
 * relative to the stars, which is what "sidereal" means.
 *
 * Known approximation: the Indian Astronomical Ephemeris historically used
 * Newcomb's precession constant rather than IAU 2006. Over a few decades the
 * two differ by well under an arcsecond per decade, but the HUMAN MUST CONFIRM
 * this function against reference panchang data before it is trusted
 * (see HANDOFF.md). Until then, every API response labels it UNVERIFIED.
 */
import { AstroTime, e_tilt } from 'astronomy-engine';
import { ARCSEC_PER_DEGREE, normalizeDegrees } from './angles';

export type AyanamsaName = 'lahiri';

export const LAHIRI_STATUS = 'UNVERIFIED' as const;

/** 1956 March 21, 0h ET expressed as days of Terrestrial Time since J2000.0 (JD 2451545.0). */
export const LAHIRI_ANCHOR_TT_DAYS = 2435553.5 - 2451545.0;

/** Published true ayanamsa at the anchor: 23°15'00.658". */
export const LAHIRI_ANCHOR_TRUE_DEGREES = 23 + 15 / 60 + 0.658 / 3600;

const DAYS_PER_JULIAN_CENTURY = 36525;

/** IAU 2006 general precession in longitude p_A, in arcseconds. */
export function generalPrecessionArcsec(ttDaysSinceJ2000: number): number {
  const T = ttDaysSinceJ2000 / DAYS_PER_JULIAN_CENTURY;
  return (
    5028.796195 * T +
    1.1054348 * T ** 2 +
    0.00007964 * T ** 3 -
    0.000023857 * T ** 4 -
    0.0000000383 * T ** 5
  );
}

/** Nutation in longitude Δψ in degrees (astronomy-engine IAU 2000B model). */
export function nutationInLongitudeDegrees(time: AstroTime): number {
  return e_tilt(time).dpsi / ARCSEC_PER_DEGREE;
}

const ANCHOR_TIME = AstroTime.FromTerrestrialTime(LAHIRI_ANCHOR_TT_DAYS);
const ANCHOR_MEAN_DEGREES = LAHIRI_ANCHOR_TRUE_DEGREES - nutationInLongitudeDegrees(ANCHOR_TIME);
const ANCHOR_PRECESSION_ARCSEC = generalPrecessionArcsec(LAHIRI_ANCHOR_TT_DAYS);

/** Lahiri mean ayanamsa (no nutation) in degrees. UNVERIFIED — see module comment. */
export function lahiriMeanAyanamsa(time: AstroTime): number {
  const precessionSinceAnchor = generalPrecessionArcsec(time.tt) - ANCHOR_PRECESSION_ARCSEC;
  return ANCHOR_MEAN_DEGREES + precessionSinceAnchor / ARCSEC_PER_DEGREE;
}

/** Lahiri true ayanamsa (mean + nutation in longitude) in degrees. UNVERIFIED. */
export function lahiriTrueAyanamsa(time: AstroTime): number {
  return lahiriMeanAyanamsa(time) + nutationInLongitudeDegrees(time);
}

/** The ayanamsa to subtract from a true-of-date tropical longitude. */
export function ayanamsaDegrees(time: AstroTime, name: AyanamsaName = 'lahiri'): number {
  switch (name) {
    case 'lahiri':
      return lahiriTrueAyanamsa(time);
  }
}

/** Sidereal longitude = tropical longitude − ayanamsa, normalised to [0°, 360°). */
export function toSidereal(tropicalDegrees: number, ayanamsa: number): number {
  return normalizeDegrees(tropicalDegrees - ayanamsa);
}
