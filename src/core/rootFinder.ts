/**
 * Finds the instant at which a steadily INCREASING angular function (one that
 * wraps from 360° back to 0°, like the Moon's longitude or the Moon−Sun
 * elongation) reaches a target angle.
 *
 * Method, deliberately plain:
 *  1. March from the start instant in fixed steps (default 6 hours),
 *     "unwrapping" the angle as we go (adding up small signed differences, so
 *     crossing 360°→0° does not confuse us), until the accumulated progress
 *     passes the angle we need. That brackets the crossing between two samples.
 *  2. Narrow the bracket with the Illinois variant of regula falsi (linear
 *     interpolation that cannot stall), falling back to bisection, until the
 *     bracket is shorter than `toleranceMs`.
 *
 * Requirements on f: it must increase monotonically and change by less than
 * 180° per step. True for every panchanga function (fastest is yoga, < 17°/day).
 */
import { normalizeDegrees, signedAngleDifference } from './angles';
import { MS_PER_DAY } from './time';

export type AngleFunction = (instant: Date) => number;

export interface CrossingOptions {
  /** Search forward (+1) or backward (−1) in time. */
  direction: 1 | -1;
  /** Give up after this many days. */
  maxDays: number;
  /** Marching step in days. Default 0.25 (6 hours). */
  stepDays?: number;
  /** Stop when the bracket is narrower than this. Default 100 ms. */
  toleranceMs?: number;
}

/**
 * The instant at which `f` equals `target` (mod 360), searching from `from` in
 * the given direction. Returns `from` if `f(from)` already equals the target,
 * and null if no crossing is found within `maxDays`.
 */
export function findAngleCrossing(f: AngleFunction, target: number, from: Date, options: CrossingOptions): Date | null {
  const { direction, maxDays } = options;
  const stepMs = (options.stepDays ?? 0.25) * MS_PER_DAY;
  const toleranceMs = options.toleranceMs ?? 100;

  const f0 = f(from);
  // How many degrees the function must move (forward in time it increases,
  // backward in time it decreases) to reach the target.
  const needed = direction === 1 ? normalizeDegrees(target - f0) : normalizeDegrees(f0 - target);
  if (needed === 0) return from;

  // progress(t) = how far the function has moved from f0, in the search direction.
  // We only ever evaluate it relative to a nearby known sample, so unwrapping is safe.
  let prevT = from.getTime();
  let prevValue = f0;
  let prevProgress = 0;
  const limit = from.getTime() + direction * maxDays * MS_PER_DAY;

  for (;;) {
    let t = prevT + direction * stepMs;
    if (direction === 1 ? t > limit : t < limit) t = limit;
    const value = f(new Date(t));
    const progress = prevProgress + direction * signedAngleDifference(value, prevValue);
    if (progress >= needed) {
      return refine(f, needed, direction, prevT, prevProgress - needed, t, progress - needed, prevValue, prevProgress, toleranceMs);
    }
    if (t === limit) return null;
    prevT = t;
    prevValue = value;
    prevProgress = progress;
  }
}

/**
 * Illinois regula falsi on g(t) = progress(t) − needed, bracketed by
 * [a, b] with g(a) < 0 ≤ g(b). Progress at any t is computed relative to the
 * sample at `anchorT`/`anchorValue`, which is within one step of the bracket.
 */
function refine(
  f: AngleFunction,
  needed: number,
  direction: 1 | -1,
  a: number,
  ga: number,
  b: number,
  gb: number,
  anchorValue: number,
  anchorProgress: number,
  toleranceMs: number,
): Date {
  const g = (t: number) => anchorProgress + direction * signedAngleDifference(f(new Date(t)), anchorValue) - needed;
  let side = 0;
  for (let i = 0; i < 100 && Math.abs(b - a) > toleranceMs; i++) {
    // Linear interpolation for the zero; fall back to the midpoint if it is degenerate.
    let c = b - (gb * (b - a)) / (gb - ga);
    if (!Number.isFinite(c) || c <= Math.min(a, b) || c >= Math.max(a, b)) c = (a + b) / 2;
    const gc = g(c);
    if (gc === 0) return new Date(c);
    if (gc < 0) {
      a = c;
      ga = gc;
      if (side === -1) gb /= 2; // Illinois step: stop the stale endpoint from stalling convergence
      side = -1;
    } else {
      b = c;
      gb = gc;
      if (side === 1) ga /= 2;
      side = 1;
    }
  }
  // Return the endpoint at which the target has been reached (g ≥ 0), so the
  // returned instant is never "just before" the boundary.
  return new Date(b);
}
