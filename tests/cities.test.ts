import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { CITIES, DEFAULT_CITY_ID, findCity, searchCities } from '@/core/cities';

describe('bundled city list (structural checks; coordinates UNVERIFIED)', () => {
  it('has about 100 cities with unique ids', () => {
    expect(CITIES.length).toBeGreaterThanOrEqual(90);
    expect(new Set(CITIES.map((c) => c.id)).size).toBe(CITIES.length);
  });

  it('every timezone is a valid IANA zone', () => {
    for (const c of CITIES) expect(DateTime.fromMillis(0, { zone: c.timezone }).isValid, c.timezone).toBe(true);
  });

  it('emphasises Canada, the US, the UK and India', () => {
    const count = (cc: string) => CITIES.filter((c) => c.country === cc).length;
    expect(count('CA')).toBeGreaterThanOrEqual(15);
    expect(count('US')).toBeGreaterThanOrEqual(15);
    expect(count('GB')).toBeGreaterThanOrEqual(8);
    expect(count('IN')).toBeGreaterThanOrEqual(20);
  });

  it('the default city is Montreal in America/Toronto', () => {
    const m = findCity(DEFAULT_CITY_ID)!;
    expect(m.name).toBe('Montreal');
    expect(m.timezone).toBe('America/Toronto');
  });

  it('timezone is broadly consistent with longitude (standard offset within ±3 h of longitude/15)', () => {
    for (const c of CITIES) {
      const januaryOffsetH = DateTime.fromISO('2026-01-15T12:00', { zone: c.timezone }).offset / 60;
      const julyOffsetH = DateTime.fromISO('2026-07-15T12:00', { zone: c.timezone }).offset / 60;
      const standard = Math.min(januaryOffsetH, julyOffsetH);
      expect(Math.abs(standard - c.longitude / 15), c.id).toBeLessThan(3);
    }
  });
});

describe('searchCities', () => {
  it('is case- and accent-insensitive', () => {
    expect(searchCities('MONTRÉAL').map((c) => c.id)).toContain('montreal-ca');
  });

  it('returns both Londons, name prefix matches first', () => {
    const ids = searchCities('london').map((c) => c.id);
    expect(ids).toContain('london-gb');
    expect(ids).toContain('london-ca');
  });

  it('can search by country code and respects the limit', () => {
    expect(searchCities('in', 5)).toHaveLength(5);
  });

  it('returns an empty list for nonsense', () => {
    expect(searchCities('zzzzqqq')).toEqual([]);
  });
});
