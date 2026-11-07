import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { AstroTime } from 'astronomy-engine';
import { normalizeDegrees, signedAngleDifference } from '@/core/angles';
import {
  LAHIRI_ANCHOR_TRUE_DEGREES,
  LAHIRI_ANCHOR_TT_DAYS,
  generalPrecessionArcsec,
  lahiriMeanAyanamsa,
  lahiriTrueAyanamsa,
  nutationInLongitudeDegrees,
  toSidereal,
} from '@/core/ayanamsa';

describe('normalizeDegrees (property)', () => {
  it('always returns a value in [0, 360)', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }), (x) => {
        const r = normalizeDegrees(x);
        return r >= 0 && r < 360;
      }),
    );
  });

  it('is congruent to the input modulo 360', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e5, max: 1e5, noNaN: true }), (x) => {
        const k = (x - normalizeDegrees(x)) / 360;
        return Math.abs(k - Math.round(k)) < 1e-9;
      }),
    );
  });

  it('folds tiny negative values that would round to 360 back to 0', () => {
    expect(normalizeDegrees(-1e-15)).toBe(0);
    expect(normalizeDegrees(360)).toBe(0);
  });

  it('signedAngleDifference stays in (-180, 180]', () => {
    fc.assert(
      fc.property(fc.double({ min: -720, max: 720, noNaN: true }), fc.double({ min: -720, max: 720, noNaN: true }), (a, b) => {
        const d = signedAngleDifference(a, b);
        return d > -180 && d <= 180;
      }),
    );
  });
});

describe('Lahiri ayanamsa (definitional and property checks; the value itself is UNVERIFIED)', () => {
  it('definitional: true ayanamsa at the 1956-03-21 anchor equals the published constant 23°15\'00.658"', () => {
    const anchor = AstroTime.FromTerrestrialTime(LAHIRI_ANCHOR_TT_DAYS);
    expect(Math.abs(lahiriTrueAyanamsa(anchor) - LAHIRI_ANCHOR_TRUE_DEGREES) * 3600).toBeLessThan(1e-6);
  });

  it('property: mean ayanamsa grows at the IAU 2006 precession rate (~50.29"/year near J2000)', () => {
    const t1 = AstroTime.FromTerrestrialTime(0);
    const t2 = AstroTime.FromTerrestrialTime(365.25);
    const rateArcsecPerYear = (lahiriMeanAyanamsa(t2) - lahiriMeanAyanamsa(t1)) * 3600;
    expect(rateArcsecPerYear).toBeGreaterThan(50.27);
    expect(rateArcsecPerYear).toBeLessThan(50.30);
  });

  it('property: mean ayanamsa is strictly increasing over 1900–2100', () => {
    fc.assert(
      fc.property(fc.double({ min: -36525, max: 36525, noNaN: true }), fc.double({ min: 1, max: 3650, noNaN: true }), (tt, dt) => {
        return lahiriMeanAyanamsa(AstroTime.FromTerrestrialTime(tt + dt)) > lahiriMeanAyanamsa(AstroTime.FromTerrestrialTime(tt));
      }),
    );
  });

  it('property: true − mean equals nutation in longitude, which is bounded by 20"', () => {
    fc.assert(
      fc.property(fc.double({ min: -36525, max: 36525, noNaN: true }), (tt) => {
        const t = AstroTime.FromTerrestrialTime(tt);
        const diff = lahiriTrueAyanamsa(t) - lahiriMeanAyanamsa(t);
        return Math.abs(diff - nutationInLongitudeDegrees(t)) < 1e-12 && Math.abs(diff) * 3600 < 20;
      }),
    );
  });

  it('math: general precession is zero at J2000 and ~5028.8" one century later', () => {
    expect(generalPrecessionArcsec(0)).toBe(0);
    expect(generalPrecessionArcsec(36525)).toBeCloseTo(5028.796195 + 1.1054348 + 0.00007964 - 0.000023857 - 0.0000000383, 9);
  });

  it('property: toSidereal returns [0, 360) and adding the ayanamsa back recovers the tropical longitude', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 359.999, noNaN: true }), fc.double({ min: 20, max: 26, noNaN: true }), (trop, ay) => {
        const sid = toSidereal(trop, ay);
        return sid >= 0 && sid < 360 && Math.abs(signedAngleDifference(sid + ay, trop)) < 1e-9;
      }),
    );
  });
});
