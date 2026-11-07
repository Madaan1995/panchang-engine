import { describe, it } from 'vitest';
import fc from 'fast-check';
import { Ecliptic, GeoMoon, MakeTime, MoonPhase } from 'astronomy-engine';
import { signedAngleDifference } from '@/core/angles';
import { elongationAt, longitudesAt } from '@/core/positions';

const instantArb = fc
  .integer({ min: Date.UTC(1950, 0, 1), max: Date.UTC(2100, 0, 1) })
  .map((ms) => new Date(ms));

describe('Sun/Moon longitudes', () => {
  it('cross-check (astronomy-engine): Moon longitude equals Ecliptic(GeoMoon) within 1 arcsecond', () => {
    fc.assert(
      fc.property(instantArb, (d) => {
        const ours = longitudesAt(d).moonTropical;
        const independent = Ecliptic(GeoMoon(MakeTime(d))).elon;
        return Math.abs(signedAngleDifference(ours, independent)) * 3600 < 1;
      }),
      { numRuns: 200 },
    );
  });

  it('cross-check (astronomy-engine): elongation matches MoonPhase within 25" (MoonPhase omits solar aberration, ~20.5")', () => {
    fc.assert(
      fc.property(instantArb, (d) => {
        const diffArcsec = Math.abs(signedAngleDifference(elongationAt(d), MoonPhase(d))) * 3600;
        return diffArcsec < 25;
      }),
      { numRuns: 200 },
    );
  });

  it('property: elongationAt equals moon − sun from longitudesAt', () => {
    // moon − sun from our two longitudes must equal our own elongationAt exactly.
    fc.assert(
      fc.property(instantArb, (d) => {
        const l = longitudesAt(d);
        return Math.abs(signedAngleDifference(l.moonTropical - l.sunTropical, elongationAt(d))) < 1e-9;
      }),
    );
  });

  it('property: sidereal = tropical − ayanamsa, normalised to [0, 360)', () => {
    fc.assert(
      fc.property(instantArb, (d) => {
        const l = longitudesAt(d);
        const inRange = (x: number) => x >= 0 && x < 360;
        return (
          inRange(l.sunSidereal) &&
          inRange(l.moonSidereal) &&
          Math.abs(signedAngleDifference(l.sunTropical - l.ayanamsa, l.sunSidereal)) < 1e-9 &&
          Math.abs(signedAngleDifference(l.moonTropical - l.ayanamsa, l.moonSidereal)) < 1e-9
        );
      }),
    );
  });

  it('property: the Sun moves ~0.95–1.02°/day and the Moon ~11.8–15.4°/day', () => {
    fc.assert(
      fc.property(instantArb, (d) => {
        const a = longitudesAt(d);
        const b = longitudesAt(new Date(d.getTime() + 86_400_000));
        const sunRate = signedAngleDifference(b.sunTropical, a.sunTropical);
        const moonRate = signedAngleDifference(b.moonTropical, a.moonTropical);
        return sunRate > 0.94 && sunRate < 1.03 && moonRate > 11.7 && moonRate < 15.5;
      }),
    );
  });
});
