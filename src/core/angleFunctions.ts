/**
 * The angular quantity behind each panchanga element, as a function of time.
 * Each one increases steadily and wraps at 360°, so element boundaries are
 * where it crosses a multiple of the element's span.
 */
import { MakeTime } from 'astronomy-engine';
import { normalizeDegrees } from './angles';
import { ayanamsaDegrees, type AyanamsaName } from './ayanamsa';
import { KARANA_SPAN, NAKSHATRA_SPAN, TITHI_SPAN, YOGA_SPAN } from './elements';
import { moonTropicalLongitude, sunTropicalLongitude } from './positions';
import type { AngleFunction } from './rootFinder';

export type ElementKind = 'tithi' | 'karana' | 'nakshatra' | 'yoga';

/** Degrees per element and number of elements in a full 360° cycle. */
export const ELEMENT_GEOMETRY: Record<ElementKind, { span: number; count: number }> = {
  tithi: { span: TITHI_SPAN, count: 30 },
  karana: { span: KARANA_SPAN, count: 60 },
  nakshatra: { span: NAKSHATRA_SPAN, count: 27 },
  yoga: { span: YOGA_SPAN, count: 27 },
};

export function angleFunctionFor(kind: ElementKind, ayanamsa: AyanamsaName = 'lahiri'): AngleFunction {
  switch (kind) {
    case 'tithi':
    case 'karana':
      // Moon − Sun elongation; ayanamsa cancels.
      return (instant) => {
        const t = MakeTime(instant);
        return normalizeDegrees(moonTropicalLongitude(t) - sunTropicalLongitude(t));
      };
    case 'nakshatra':
      // Sidereal Moon.
      return (instant) => {
        const t = MakeTime(instant);
        return normalizeDegrees(moonTropicalLongitude(t) - ayanamsaDegrees(t, ayanamsa));
      };
    case 'yoga':
      // Sidereal Sun + sidereal Moon.
      return (instant) => {
        const t = MakeTime(instant);
        const ay = ayanamsaDegrees(t, ayanamsa);
        return normalizeDegrees(sunTropicalLongitude(t) - ay + moonTropicalLongitude(t) - ay);
      };
  }
}

/** Sidereal longitude of the Sun; crossings of multiples of 30° are sankrantis. */
export function sunSiderealFunction(ayanamsa: AyanamsaName = 'lahiri'): AngleFunction {
  return (instant) => {
    const t = MakeTime(instant);
    return normalizeDegrees(sunTropicalLongitude(t) - ayanamsaDegrees(t, ayanamsa));
  };
}
