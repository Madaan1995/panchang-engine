/**
 * Small angle helpers. All angles in this library are in DEGREES unless the
 * variable name says otherwise.
 */

/** Normalise any angle to the half-open range [0, 360). */
export function normalizeDegrees(angle: number): number {
  const r = ((angle % 360) + 360) % 360;
  // Floating point can produce exactly 360 for tiny negative inputs
  // (e.g. -1e-15 + 360 === 360). Fold that back to 0 so the range is half-open.
  return r >= 360 ? 0 : r;
}

/**
 * Signed smallest difference `a - b`, in (-180, 180].
 * Used when comparing two longitudes that may straddle the 0°/360° seam.
 */
export function signedAngleDifference(a: number, b: number): number {
  const d = normalizeDegrees(a - b);
  return d > 180 ? d - 360 : d;
}

export const ARCSEC_PER_DEGREE = 3600;
