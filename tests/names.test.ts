import { describe, expect, it } from 'vitest';
import {
  KARANA_NAMES,
  LUNAR_MONTH_NAMES,
  NAKSHATRA_NAMES,
  RASHI_NAMES,
  REPEATING_KARANAS,
  TITHI_NAMES,
  VARA_NAMES,
  YOGA_NAMES,
  nameAt,
} from '@/core/names';

const DEVANAGARI = /^[ऀ-ॿ\s]+$/;

describe('name tables (structural checks)', () => {
  it('have the right sizes', () => {
    expect(TITHI_NAMES).toHaveLength(30);
    expect(NAKSHATRA_NAMES).toHaveLength(27);
    expect(YOGA_NAMES).toHaveLength(27);
    expect(Object.keys(KARANA_NAMES)).toHaveLength(11);
    expect(REPEATING_KARANAS).toHaveLength(7);
    expect(VARA_NAMES).toHaveLength(7);
    expect(LUNAR_MONTH_NAMES).toHaveLength(12);
    expect(RASHI_NAMES).toHaveLength(12);
  });

  it('every entry has an English name and a Devanagari-only Sanskrit name', () => {
    const all = [
      ...TITHI_NAMES,
      ...NAKSHATRA_NAMES,
      ...YOGA_NAMES,
      ...Object.values(KARANA_NAMES),
      ...VARA_NAMES,
      ...LUNAR_MONTH_NAMES,
      ...RASHI_NAMES,
    ];
    for (const name of all) {
      expect(name.en).toMatch(/^[A-Za-z ]+$/);
      expect(name.sa).toMatch(DEVANAGARI);
    }
  });

  it('tithi 15 is Purnima, tithi 30 is Amavasya, and Krishna names mirror Shukla names', () => {
    expect(nameAt(TITHI_NAMES, 15).en).toBe('Purnima');
    expect(nameAt(TITHI_NAMES, 30).en).toBe('Amavasya');
    for (let i = 1; i <= 14; i++) expect(nameAt(TITHI_NAMES, i + 15)).toEqual(nameAt(TITHI_NAMES, i));
  });

  it('nameAt throws on out-of-range indices', () => {
    expect(() => nameAt(NAKSHATRA_NAMES, 0)).toThrow(RangeError);
    expect(() => nameAt(NAKSHATRA_NAMES, 28)).toThrow(RangeError);
  });
});
