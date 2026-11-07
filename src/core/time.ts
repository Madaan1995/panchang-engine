/**
 * Local-date helpers built on Luxon. Luxon resolves IANA zones (including DST)
 * from the bundled ICU data, so we never compute UTC offsets by hand.
 */
import { DateTime } from 'luxon';
import type { LocalDate } from './types';

export class InvalidInputError extends Error {
  readonly code = 'INVALID_INPUT';
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

/** Throw if `zone` is not a valid IANA timezone. */
export function assertValidZone(zone: string): void {
  if (!DateTime.fromMillis(0, { zone }).isValid) {
    throw new InvalidInputError(`Unknown IANA timezone: ${zone}`);
  }
}

/** Local midnight that starts `date` in `zone`. Handles zones where midnight is skipped by DST. */
export function startOfLocalDay(date: LocalDate, zone: string): DateTime {
  const dt = DateTime.fromISO(date, { zone });
  if (!dt.isValid) {
    throw new InvalidInputError(`Invalid date '${date}' or timezone '${zone}' (expected YYYY-MM-DD and an IANA zone)`);
  }
  return dt.startOf('day');
}

/** The local day containing `date` as a UTC interval: [local 00:00, next local 00:00). */
export function localDayBounds(date: LocalDate, zone: string): { start: Date; end: Date } {
  const start = startOfLocalDay(date, zone);
  const end = start.plus({ days: 1 }).startOf('day');
  return { start: start.toJSDate(), end: end.toJSDate() };
}

/** Add `n` calendar days to a local date string. Pure date arithmetic, no zone involved. */
export function addDays(date: LocalDate, n: number): LocalDate {
  const dt = DateTime.fromISO(date, { zone: 'UTC' });
  if (!dt.isValid) throw new InvalidInputError(`Invalid date '${date}' (expected YYYY-MM-DD)`);
  return dt.plus({ days: n }).toISODate() as LocalDate;
}

/** The local calendar date of an instant in `zone`. */
export function localDateOf(instant: Date, zone: string): LocalDate {
  return DateTime.fromJSDate(instant, { zone }).toISODate() as LocalDate;
}

/** Weekday of a local date: 0 = Sunday … 6 = Saturday (the panchang vara convention). */
export function weekdayOf(date: LocalDate): number {
  const dt = DateTime.fromISO(date, { zone: 'UTC' });
  return dt.weekday % 7; // Luxon: 1 = Monday … 7 = Sunday
}

export const MS_PER_DAY = 86_400_000;

export function addMs(d: Date, ms: number): Date {
  return new Date(d.getTime() + ms);
}
