/** Serialisation of instants to timezone-aware ISO 8601 strings in a location's IANA zone. */
import { DateTime } from 'luxon';

/** e.g. 2026-03-08T07:23:41-04:00 for America/Toronto after spring-forward. */
export function toZonedIso(instant: Date, zone: string): string {
  const s = DateTime.fromJSDate(instant, { zone }).toISO({ suppressMilliseconds: true });
  if (s === null) throw new Error(`Cannot format instant in zone ${zone}`);
  return s;
}

export function toZonedIsoOrNull(instant: Date | null, zone: string): string | null {
  return instant === null ? null : toZonedIso(instant, zone);
}
