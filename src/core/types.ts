/**
 * Shared types for the core library.
 *
 * Time convention: every instant inside the core library is a JavaScript `Date`
 * (which is just a UTC millisecond count, with no timezone of its own).
 * Calendar dates are ISO strings 'YYYY-MM-DD' interpreted in the LOCATION's
 * IANA timezone. Conversion to timezone-aware ISO 8601 strings happens only in
 * `format.ts`, so the system timezone of the machine never matters.
 */
export interface GeoLocation {
  /** Degrees north (negative = south). */
  latitude: number;
  /** Degrees east (negative = west). */
  longitude: number;
  /** IANA timezone, e.g. 'America/Toronto'. Used for local dates and output formatting. */
  timezone: string;
  /** Height above sea level in metres. Defaults to 0. */
  elevationMeters?: number;
  /** Optional display name. */
  name?: string;
}

/** A calendar date in the location's timezone, formatted 'YYYY-MM-DD'. */
export type LocalDate = string;

/** A closed-open time interval [start, end). */
export interface Interval {
  start: Date;
  end: Date;
}
