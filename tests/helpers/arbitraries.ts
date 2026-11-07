import fc from 'fast-check';
import { DateTime } from 'luxon';
import { MID_LATITUDE_CITIES } from './locations';

/** Random local date string between 1950 and 2099. */
export const localDateArb = fc
  .integer({ min: 0, max: 150 * 365 })
  .map((n) => DateTime.fromISO('1950-01-01', { zone: 'UTC' }).plus({ days: n }).toISODate() as string);

/** Random local date in 2000–2049 (narrower range keeps slow tests fast). */
export const recentLocalDateArb = fc
  .integer({ min: 0, max: 50 * 365 })
  .map((n) => DateTime.fromISO('2000-01-01', { zone: 'UTC' }).plus({ days: n }).toISODate() as string);

export const cityArb = fc.constantFrom(...MID_LATITUDE_CITIES);
