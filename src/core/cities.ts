/** The bundled city list (data/cities.json) and lookup helpers. */
import { z } from 'zod';
import citiesJson from '../../data/cities.json';
import { provenanceSchema } from './data';
import type { GeoLocation } from './types';

export const citySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  region: z.string(),
  country: z.string().length(2),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().min(1),
});
export type City = z.infer<typeof citySchema>;

export const citiesFileSchema = z.object({
  provenance: provenanceSchema,
  description: z.string(),
  cities: z.array(citySchema).min(1),
});

export const CITIES: readonly City[] = citiesFileSchema.parse(citiesJson).cities;

const BY_ID = new Map(CITIES.map((c) => [c.id, c]));

export const DEFAULT_CITY_ID = 'montreal-ca';

export function findCity(id: string): City | undefined {
  return BY_ID.get(id.toLowerCase());
}

/** Lower-case and strip accents so "montréal" matches "Montreal". */
function fold(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Case- and accent-insensitive search on name, region, country code and id.
 * Cities whose name starts with the query come first.
 */
export function searchCities(query: string, limit = 20): City[] {
  const q = fold(query.trim());
  if (q === '') return CITIES.slice(0, limit);
  const matches = CITIES.filter((c) => [c.name, c.region, c.country, c.id].some((f) => fold(f).includes(q)));
  const starts = (c: City) => (fold(c.name).startsWith(q) ? 0 : 1);
  return [...matches].sort((a, b) => starts(a) - starts(b) || a.name.localeCompare(b.name)).slice(0, limit);
}

export function cityToLocation(city: City): GeoLocation {
  return { name: city.name, latitude: city.latitude, longitude: city.longitude, timezone: city.timezone };
}
