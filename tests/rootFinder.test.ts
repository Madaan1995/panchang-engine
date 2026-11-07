import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { signedAngleDifference } from '@/core/angles';
import { angleFunctionFor, sunSiderealFunction, type ElementKind } from '@/core/angleFunctions';
import { findAngleCrossing } from '@/core/rootFinder';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 1);

describe('findAngleCrossing on synthetic functions (mathematical checks)', () => {
  // A linear angle that wraps: 13°/day starting at `phase` degrees.
  const linear = (phase: number, rate = 13) => (d: Date) => (((phase + (rate * (d.getTime() - T0)) / DAY) % 360) + 360) % 360;

  it('finds the exact analytic crossing forward and backward (within 1 s)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 359.9, noNaN: true }), fc.double({ min: 0, max: 359.9, noNaN: true }), (phase, target) => {
        const f = linear(phase);
        const fwd = findAngleCrossing(f, target, new Date(T0), { direction: 1, maxDays: 30 });
        const bwd = findAngleCrossing(f, target, new Date(T0), { direction: -1, maxDays: 30 });
        const needFwd = (((target - phase) % 360) + 360) % 360;
        const needBwd = (((phase - target) % 360) + 360) % 360;
        return (
          fwd !== null &&
          bwd !== null &&
          Math.abs(fwd.getTime() - (T0 + (needFwd / 13) * DAY)) < 1000 &&
          Math.abs(bwd.getTime() - (T0 - (needBwd / 13) * DAY)) < 1000
        );
      }),
    );
  });

  it('handles the 360° → 0° wrap', () => {
    const f = linear(350);
    const t = findAngleCrossing(f, 0, new Date(T0), { direction: 1, maxDays: 5 });
    expect(t).not.toBeNull();
    expect(Math.abs(t!.getTime() - (T0 + (10 / 13) * DAY))).toBeLessThan(1000);
  });

  it('returns null when no crossing happens within maxDays', () => {
    const f = linear(0, 1);
    expect(findAngleCrossing(f, 100, new Date(T0), { direction: 1, maxDays: 5 })).toBeNull();
  });

  it('returns the start instant when the function already equals the target', () => {
    const f = linear(42);
    expect(findAngleCrossing(f, 42, new Date(T0), { direction: 1, maxDays: 5 })!.getTime()).toBe(T0);
  });
});

describe('findAngleCrossing on real panchanga functions (property: boundary value within 0.0001°)', () => {
  const kinds: ElementKind[] = ['tithi', 'karana', 'nakshatra', 'yoga'];
  for (const kind of kinds) {
    it(`${kind}: the function equals the target at the returned instant`, () => {
      const f = angleFunctionFor(kind);
      fc.assert(
        fc.property(
          fc.integer({ min: Date.UTC(1990, 0, 1), max: Date.UTC(2060, 0, 1) }),
          fc.double({ min: 0, max: 359.99, noNaN: true }),
          (ms, target) => {
            const t = findAngleCrossing(f, target, new Date(ms), { direction: 1, maxDays: 40 });
            return t !== null && Math.abs(signedAngleDifference(f(t), target)) < 1e-4;
          },
        ),
        { numRuns: 30 },
      );
    });
  }

  it('sidereal Sun (sankranti): crossing found within 0.0001° using daily steps', () => {
    const f = sunSiderealFunction();
    const t = findAngleCrossing(f, 0, new Date(T0), { direction: 1, maxDays: 400, stepDays: 1 });
    expect(t).not.toBeNull();
    expect(Math.abs(signedAngleDifference(f(t!), 0))).toBeLessThan(1e-4);
  });
});
