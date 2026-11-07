/**
 * Request validation with zod. Each endpoint's query string is parsed into a
 * typed object; failures become HTTP 400 with zod's issue list.
 */
import { DateTime } from 'luxon';
import { z } from 'zod';
import { cityToLocation, findCity } from '@/core/cities';
import { CEREMONIES } from '@/core/muhuratRules';
import type { CalcOptions } from '@/core/report';
import type { GeoLocation, LocalDate } from '@/core/types';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
  .refine((s) => DateTime.fromISO(s, { zone: 'UTC' }).isValid, 'is not a real calendar date');

const ianaZone = z.string().refine((tz) => DateTime.fromMillis(0, { zone: tz }).isValid, 'is not a known IANA timezone');

/** Either `city=<id>` or all of `lat`, `lon`, `tz`. */
const locationFields = {
  city: z.string().min(1).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  tz: ianaZone.optional(),
  elevation: z.coerce.number().min(-500).max(9000).optional(),
};

const optionFields = {
  monthSystem: z.enum(['amanta', 'purnimanta']).default('purnimanta'),
  ayanamsa: z.enum(['lahiri']).default('lahiri'),
};

function requireLocation<T extends { city?: string; lat?: number; lon?: number; tz?: string }>(schema: z.ZodType<T>) {
  return schema.superRefine((v, ctx) => {
    if (v.city !== undefined) return;
    for (const key of ['lat', 'lon', 'tz'] as const) {
      if (v[key] === undefined) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'is required when `city` is not given' });
      }
    }
  });
}

export const panchangQuery = requireLocation(z.object({ date: isoDate.optional(), ...locationFields, ...optionFields }));
export const festivalsQuery = requireLocation(
  z.object({ year: z.coerce.number().int().min(1900).max(2100), ...locationFields, ...optionFields }),
);
export const muhuratQuery = requireLocation(
  z.object({
    ceremony: z.string().refine((c) => CEREMONIES.includes(c), { message: `must be one of: ${CEREMONIES.join(', ')}` }),
    from: isoDate,
    to: isoDate,
    ...locationFields,
    ...optionFields,
  }),
);
export const citiesQuery = z.object({
  q: z.string().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';
}

/** Resolve `city` (→ 404 if unknown) or lat/lon/tz into a GeoLocation. */
export function resolveLocation(q: { city?: string; lat?: number; lon?: number; tz?: string; elevation?: number }): GeoLocation {
  if (q.city !== undefined) {
    const city = findCity(q.city);
    if (city === undefined) throw new NotFoundError(`Unknown city '${q.city}'. Use /api/v1/cities?q= to search.`);
    return cityToLocation(city);
  }
  return {
    latitude: q.lat as number,
    longitude: q.lon as number,
    timezone: q.tz as string,
    ...(q.elevation !== undefined ? { elevationMeters: q.elevation } : {}),
  };
}

export function calcOptions(q: { monthSystem: 'amanta' | 'purnimanta'; ayanamsa: 'lahiri' }): CalcOptions {
  return { monthSystem: q.monthSystem, ayanamsa: q.ayanamsa };
}

/** Today's local date in `zone`. The clock is injected so callers stay testable. */
export function todayIn(zone: string, now: Date): LocalDate {
  return DateTime.fromJSDate(now, { zone }).toISODate() as LocalDate;
}

/** URLSearchParams → plain object (last value wins). */
export function queryObject(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams.entries());
}
