import { describe, expect, it } from 'vitest';
import { citiesQuery, festivalsQuery, muhuratQuery, NotFoundError, panchangQuery, resolveLocation, todayIn } from '@/server/validation';

describe('request validation (zod)', () => {
  it('accepts city= or lat/lon/tz', () => {
    expect(panchangQuery.safeParse({ city: 'montreal-ca' }).success).toBe(true);
    expect(panchangQuery.safeParse({ lat: '45.5', lon: '-73.6', tz: 'America/Toronto', date: '2026-03-08' }).success).toBe(true);
  });

  it('rejects missing location, bad coordinates, bad zone and bad dates with field-level issues', () => {
    const missing = panchangQuery.safeParse({});
    expect(missing.success).toBe(false);
    expect(missing.error!.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(['lat', 'lon', 'tz']));
    expect(panchangQuery.safeParse({ lat: '95', lon: '0', tz: 'UTC' }).success).toBe(false);
    expect(panchangQuery.safeParse({ lat: '45', lon: '0', tz: 'Mars/Base' }).success).toBe(false);
    expect(panchangQuery.safeParse({ city: 'montreal-ca', date: '2026-02-30' }).success).toBe(false);
    expect(panchangQuery.safeParse({ city: 'montreal-ca', monthSystem: 'lunar' }).success).toBe(false);
  });

  it('defaults to purnimanta and lahiri', () => {
    const r = panchangQuery.parse({ city: 'montreal-ca' });
    expect(r.monthSystem).toBe('purnimanta');
    expect(r.ayanamsa).toBe('lahiri');
  });

  it('festivals need a year in 1900..2100; muhurat needs a known ceremony and dates', () => {
    expect(festivalsQuery.safeParse({ city: 'toronto-ca', year: '2026' }).success).toBe(true);
    expect(festivalsQuery.safeParse({ city: 'toronto-ca', year: '3000' }).success).toBe(false);
    expect(muhuratQuery.safeParse({ city: 'toronto-ca', ceremony: 'vivah', from: '2026-01-01', to: '2026-02-01' }).success).toBe(true);
    expect(muhuratQuery.safeParse({ city: 'toronto-ca', ceremony: 'bbq', from: '2026-01-01', to: '2026-02-01' }).success).toBe(false);
  });

  it('cities query has defaults', () => {
    expect(citiesQuery.parse({})).toEqual({ q: '', limit: 20 });
  });

  it('resolveLocation: unknown city → NotFoundError', () => {
    expect(() => resolveLocation({ city: 'atlantis-xx' })).toThrowError(NotFoundError);
    expect(resolveLocation({ city: 'vancouver-ca' }).timezone).toBe('America/Vancouver');
  });

  it('todayIn uses the location zone, not the system zone', () => {
    // 03:00 UTC on 1 Jan is still 31 Dec in Toronto.
    expect(todayIn('America/Toronto', new Date(Date.UTC(2026, 0, 1, 3)))).toBe('2025-12-31');
  });
});
