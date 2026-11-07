import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { SearchMoonPhase } from 'astronomy-engine';
import {
  elementsAtInstant,
  karanaFromElongation,
  karanaKeyFromHalfTithi,
  nakshatraFromMoonSidereal,
  tithiFromElongation,
  yogaFromSidereal,
} from '@/core/elements';
import { REPEATING_KARANAS } from '@/core/names';

const angleArb = fc.double({ min: 0, max: 359.999999, noNaN: true });

describe('tithi and paksha (mathematical checks of the spec formula)', () => {
  it('tithi = floor(e/12) + 1 in 1..30; 1–15 Shukla, 16–30 Krishna', () => {
    fc.assert(
      fc.property(angleArb, (e) => {
        const t = tithiFromElongation(e);
        return (
          t.number === Math.floor(e / 12) + 1 &&
          t.number >= 1 &&
          t.number <= 30 &&
          t.paksha === (t.number <= 15 ? 'shukla' : 'krishna') &&
          t.numberInPaksha >= 1 &&
          t.numberInPaksha <= 15
        );
      }),
    );
  });

  it('boundary values: 0° → 1, 11.999° → 1, 12° → 2, 180° → 16, 359.99° → 30', () => {
    expect(tithiFromElongation(0).number).toBe(1);
    expect(tithiFromElongation(11.999).number).toBe(1);
    expect(tithiFromElongation(12).number).toBe(2);
    expect(tithiFromElongation(180).number).toBe(16);
    expect(tithiFromElongation(359.99).number).toBe(30);
    expect(tithiFromElongation(360).number).toBe(1);
  });
});

describe('nakshatra, pada and yoga (mathematical checks of the spec formula)', () => {
  it('nakshatra = floor(moon_sid / 13°20′) + 1, pada = quarter within it', () => {
    fc.assert(
      fc.property(angleArb, (m) => {
        const n = nakshatraFromMoonSidereal(m);
        const expectedN = Math.floor(m / (360 / 27)) + 1;
        const expectedPada = Math.floor((m - (expectedN - 1) * (360 / 27)) / (360 / 108)) + 1;
        return n.number === expectedN && n.pada === Math.min(expectedPada, 4) && n.pada >= 1 && n.pada <= 4;
      }),
    );
  });

  it('the 108 padas tile the zodiac: pada index = floor(moon_sid / 3°20′)', () => {
    fc.assert(
      fc.property(angleArb, (m) => {
        const n = nakshatraFromMoonSidereal(m);
        return (n.number - 1) * 4 + (n.pada - 1) === Math.min(Math.floor(m / (360 / 108)), 107);
      }),
    );
  });

  it('yoga = floor(((sun + moon) mod 360) / 13°20′) + 1', () => {
    fc.assert(
      fc.property(angleArb, angleArb, (s, m) => {
        const y = yogaFromSidereal(s, m);
        return y.number === Math.floor(((s + m) % 360) / (360 / 27)) + 1;
      }),
    );
  });
});

describe('karana mapping (structural checks)', () => {
  it('fixed karanas sit in their classical positions', () => {
    expect(karanaKeyFromHalfTithi(0)).toBe('Kimstughna'); // 1st half of Shukla Pratipada
    expect(karanaKeyFromHalfTithi(57)).toBe('Shakuni'); // 2nd half of Krishna Chaturdashi
    expect(karanaKeyFromHalfTithi(58)).toBe('Chatushpada'); // 1st half of Amavasya
    expect(karanaKeyFromHalfTithi(59)).toBe('Naga'); // 2nd half of Amavasya
  });

  it('second half of Shukla Pratipada is Bava, and the 7 movable karanas repeat in order', () => {
    expect(karanaKeyFromHalfTithi(1)).toBe('Bava');
    for (let k = 1; k <= 56; k++) expect(karanaKeyFromHalfTithi(k)).toBe(REPEATING_KARANAS[(k - 1) % 7]);
  });

  it('across a lunar month, each movable karana occurs 8 times and each fixed karana once', () => {
    const counts = new Map<string, number>();
    for (let k = 0; k < 60; k++) {
      const key = karanaKeyFromHalfTithi(k);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const r of REPEATING_KARANAS) expect(counts.get(r)).toBe(8);
    for (const f of ['Kimstughna', 'Shakuni', 'Chatushpada', 'Naga']) expect(counts.get(f)).toBe(1);
  });

  it('karana from elongation: two karanas per tithi', () => {
    fc.assert(
      fc.property(angleArb, (e) => {
        const k = karanaFromElongation(e);
        const t = tithiFromElongation(e);
        return Math.ceil(k.number / 2) === t.number;
      }),
    );
  });

  it('rejects half-tithi indices outside 0..59', () => {
    expect(() => karanaKeyFromHalfTithi(60)).toThrow(RangeError);
    expect(() => karanaKeyFromHalfTithi(-1)).toThrow(RangeError);
  });
});

describe('elementsAtInstant (cross-check against astronomy-engine moon phases)', () => {
  it('5 minutes after each new moon in 2026 the tithi is 1 (Shukla Pratipada); 5 minutes before, 30 (Amavasya)', () => {
    let t = SearchMoonPhase(0, new Date(Date.UTC(2026, 0, 1)), 40);
    for (let i = 0; i < 12 && t; i++) {
      const at = t.date.getTime();
      expect(elementsAtInstant(new Date(at + 5 * 60_000)).tithi.number).toBe(1);
      expect(elementsAtInstant(new Date(at - 5 * 60_000)).tithi.number).toBe(30);
      expect(elementsAtInstant(new Date(at - 5 * 60_000)).karana.key).toBe('Naga');
      expect(elementsAtInstant(new Date(at + 5 * 60_000)).karana.key).toBe('Kimstughna');
      t = SearchMoonPhase(0, new Date(at + 86_400_000), 40);
    }
  });

  it('5 minutes after each full moon in 2026 the tithi is 16 (Krishna Pratipada); 5 minutes before, 15 (Purnima)', () => {
    let t = SearchMoonPhase(180, new Date(Date.UTC(2026, 0, 1)), 40);
    for (let i = 0; i < 12 && t; i++) {
      const at = t.date.getTime();
      expect(elementsAtInstant(new Date(at + 5 * 60_000)).tithi.number).toBe(16);
      expect(elementsAtInstant(new Date(at - 5 * 60_000)).tithi.number).toBe(15);
      t = SearchMoonPhase(180, new Date(at + 86_400_000), 40);
    }
  });
});
