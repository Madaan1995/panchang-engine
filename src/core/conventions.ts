/**
 * The `conventions` block included in every API response, so consumers know
 * exactly which definitions produced the numbers.
 */
import type { AyanamsaName } from './ayanamsa';
import { LAHIRI_STATUS } from './ayanamsa';
import type { MonthSystem } from './lunarCalendar';

export const ASTRONOMY_ENGINE_VERSION = '2.1.19';

export interface Conventions {
  ayanamsa: { id: AyanamsaName; name: string; status: string; definition: string };
  monthSystem: MonthSystem;
  dayBoundary: string;
  riseSetDefinition: string;
  positions: string;
  ephemeris: string;
  timeZone: string;
  times: string;
  rules: string;
}

export function conventions(options: { ayanamsa: AyanamsaName; monthSystem: MonthSystem; timeZone: string }): Conventions {
  return {
    ayanamsa: {
      id: options.ayanamsa,
      name: 'Lahiri (Chitrapaksha)',
      status: LAHIRI_STATUS,
      definition:
        'True ayanamsa 23°15\'00.658" at 1956-03-21 0h ET (Indian Calendar Reform Committee), advanced by IAU 2006 general precession in longitude; nutation (IAU 2000B) included. UNVERIFIED against reference panchangs.',
    },
    monthSystem: options.monthSystem,
    dayBoundary: 'A panchang day runs from local sunrise to the next local sunrise; vara is the weekday of that sunrise.',
    riseSetDefinition:
      'Upper limb of the disc on the geometric horizon with 34′ standard refraction (astronomy-engine SearchRiseSet); observer at ground level; Moon includes topocentric parallax.',
    positions:
      'Geocentric apparent Sun (VSOP87) and geocentric Moon, true ecliptic and equinox of date (astronomy-engine). Sidereal = tropical − ayanamsa.',
    ephemeris: `astronomy-engine ${ASTRONOMY_ENGINE_VERSION} (MIT)`,
    timeZone: options.timeZone,
    times: 'ISO 8601 with the UTC offset in effect at that instant in the location\'s IANA zone, rounded to the second.',
    rules:
      'Festival, muhurat and day-period rules are editable data. They are UNVERIFIED unless their provenance is filled in, and are not presented as authoritative.',
  };
}
