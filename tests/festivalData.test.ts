import { describe, expect, it } from 'vitest';
import { FESTIVALS, festivalsSchema, OBSERVANCE_RULES, OBSERVANCE_WINDOWS, observanceWindowsSchema } from '@/core/data';
import festivalsJson from '../data/festivals.json';
import windowsJson from '../data/observance-windows.json';

describe('festival rule data (structural checks; rules UNVERIFIED)', () => {
  it('festivals.json and observance-windows.json validate against their schemas', () => {
    expect(() => festivalsSchema.parse(festivalsJson)).not.toThrow();
    expect(() => observanceWindowsSchema.parse(windowsJson)).not.toThrow();
  });

  it('contains at least the 10 festivals the spec requires', () => {
    const ids = FESTIVALS.festivals.map((f) => f.id);
    for (const id of [
      'diwali-lakshmi-puja',
      'janmashtami',
      'ram-navami',
      'maha-shivaratri',
      'holika-dahan',
      'sharad-navratri-start',
      'dussehra',
      'karva-chauth',
      'raksha-bandhan',
      'ganesh-chaturthi',
    ]) {
      expect(ids).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every festival has a provenance block (empty until a human verifies it) and an UNVERIFIED file header', () => {
    expect(FESTIVALS.header.startsWith('UNVERIFIED')).toBe(true);
    for (const f of FESTIVALS.festivals) {
      expect(f.provenance).toHaveProperty('verifiedBy');
      expect(f.provenance).toHaveProperty('source');
      expect(f.provenance).toHaveProperty('dateVerified');
    }
  });

  it('every observance rule named by the spec has a window definition', () => {
    for (const rule of OBSERVANCE_RULES) expect(OBSERVANCE_WINDOWS.windows[rule]).toBeDefined();
  });
});
