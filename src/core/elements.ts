/**
 * The five panchanga elements (minus vara, which needs a location — see
 * `vara.ts`) computed at a single instant from Sun and Moon longitudes.
 *
 * Formulas (from SPEC.md §2; standard Surya-Siddhanta-style definitions):
 *   elongation e = (moon − sun) mod 360          (tropical or sidereal: same value)
 *   tithi      = floor(e / 12°) + 1               1..30
 *   paksha     = Shukla for tithi 1–15, Krishna for 16–30
 *   nakshatra  = floor(moon_sidereal / (360°/27)) + 1   1..27
 *   pada       = floor((moon_sidereal mod 13°20′) / 3°20′) + 1   1..4
 *   yoga       = floor(((sun_sid + moon_sid) mod 360) / (360°/27)) + 1   1..27
 *   karana     = half-tithi index k = floor(e / 6°), 0..59, mapped below
 */
import { normalizeDegrees } from './angles';
import type { AyanamsaName } from './ayanamsa';
import {
  KARANA_NAMES,
  NAKSHATRA_NAMES,
  PAKSHA_NAMES,
  REPEATING_KARANAS,
  TITHI_NAMES,
  YOGA_NAMES,
  nameAt,
  type KaranaName,
  type Name,
} from './names';
import { longitudesAt, type Longitudes } from './positions';

export const TITHI_SPAN = 12; // degrees of elongation per tithi
export const KARANA_SPAN = 6; // half a tithi
export const NAKSHATRA_SPAN = 360 / 27; // 13°20′
export const PADA_SPAN = NAKSHATRA_SPAN / 4; // 3°20′
export const YOGA_SPAN = 360 / 27;

export type Paksha = 'shukla' | 'krishna';

export interface TithiInfo {
  number: number; // 1..30
  paksha: Paksha;
  /** Tithi number within the paksha, 1..15 (15 = Purnima in Shukla, Amavasya in Krishna). */
  numberInPaksha: number;
  name: Name;
  pakshaName: Name;
}

export interface NakshatraInfo {
  number: number; // 1..27
  pada: number; // 1..4
  name: Name;
}

export interface YogaInfo {
  number: number; // 1..27
  name: Name;
}

export interface KaranaInfo {
  /** Half-tithi position in the lunar month, 1..60. */
  number: number;
  key: KaranaName;
  name: Name;
}

/** Index of `value` in equal steps of `span`, 0-based. Guards the [0, 360) range. */
function stepIndex(value: number, span: number, count: number): number {
  return Math.min(Math.floor(normalizeDegrees(value) / span), count - 1);
}

export function tithiFromElongation(elongation: number): TithiInfo {
  const number = stepIndex(elongation, TITHI_SPAN, 30) + 1;
  const paksha: Paksha = number <= 15 ? 'shukla' : 'krishna';
  return {
    number,
    paksha,
    numberInPaksha: paksha === 'shukla' ? number : number - 15,
    name: nameAt(TITHI_NAMES, number),
    pakshaName: PAKSHA_NAMES[paksha],
  };
}

export function nakshatraFromMoonSidereal(moonSidereal: number): NakshatraInfo {
  const lon = normalizeDegrees(moonSidereal);
  const index = stepIndex(lon, NAKSHATRA_SPAN, 27);
  const within = lon - index * NAKSHATRA_SPAN;
  const pada = Math.min(Math.floor(within / PADA_SPAN), 3) + 1;
  return { number: index + 1, pada, name: nameAt(NAKSHATRA_NAMES, index + 1) };
}

export function yogaFromSidereal(sunSidereal: number, moonSidereal: number): YogaInfo {
  const number = stepIndex(sunSidereal + moonSidereal, YOGA_SPAN, 27) + 1;
  return { number, name: nameAt(YOGA_NAMES, number) };
}

/**
 * Map half-tithi position k (0..59, counted from new moon) to a karana.
 *
 * Classical scheme (e.g. Surya Siddhanta 2.69 commentary; Burgess translation):
 *   k = 0        Kimstughna  (first half of Shukla Pratipada)   — fixed
 *   k = 1..56    Bava, Balava, Kaulava, Taitila, Gara, Vanija, Vishti, repeating
 *                 8 times (7 × 8 = 56)
 *   k = 57       Shakuni     (second half of Krishna Chaturdashi) — fixed
 *   k = 58       Chatushpada (first half of Amavasya)             — fixed
 *   k = 59       Naga        (second half of Amavasya)            — fixed
 */
export function karanaKeyFromHalfTithi(k: number): KaranaName {
  if (!Number.isInteger(k) || k < 0 || k > 59) throw new RangeError(`half-tithi index ${k} not in 0..59`);
  if (k === 0) return 'Kimstughna';
  if (k === 57) return 'Shakuni';
  if (k === 58) return 'Chatushpada';
  if (k === 59) return 'Naga';
  return REPEATING_KARANAS[(k - 1) % 7] as KaranaName;
}

export function karanaFromElongation(elongation: number): KaranaInfo {
  const k = stepIndex(elongation, KARANA_SPAN, 60);
  const key = karanaKeyFromHalfTithi(k);
  return { number: k + 1, key, name: KARANA_NAMES[key] };
}

export interface ElementsAtInstant {
  instant: Date;
  longitudes: Longitudes;
  elongation: number;
  tithi: TithiInfo;
  nakshatra: NakshatraInfo;
  yoga: YogaInfo;
  karana: KaranaInfo;
}

/** Tithi, nakshatra, yoga and karana at an instant. Location-independent. */
export function elementsAtInstant(instant: Date, ayanamsa: AyanamsaName = 'lahiri'): ElementsAtInstant {
  const longitudes = longitudesAt(instant, ayanamsa);
  const elongation = normalizeDegrees(longitudes.moonTropical - longitudes.sunTropical);
  return {
    instant,
    longitudes,
    elongation,
    tithi: tithiFromElongation(elongation),
    nakshatra: nakshatraFromMoonSidereal(longitudes.moonSidereal),
    yoga: yogaFromSidereal(longitudes.sunSidereal, longitudes.moonSidereal),
    karana: karanaFromElongation(elongation),
  };
}
