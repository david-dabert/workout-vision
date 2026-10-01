/**
 * Left/right comparison of a set's range of motion, for sets filmed from the front only (David's order,
 * 1 October 2026). It changes no count: it reads the reps the core counted and measures both sides over
 * each rep's time.
 *
 * Why front only: filmed from the side, the far limb is hidden and the pose model estimates it while still
 * reporting it visible, so a visibility floor cannot exclude it (test/real-phone/symmetry/README.md,
 * iteration 3: curl filmed from the side read SI -87 %). The view is therefore decided from the body's
 * orientation, not from visibility: shoulders and hips must lie close to the image plane.
 *
 * Left and right are the filmed person's own (MediaPipe names landmarks by the body's side). A mirrored
 * video, as a front camera may save, swaps them; the app cannot tell.
 *
 * Status: experimental. Not validated against a measured asymmetry; its false-alarm rate on front-view
 * public clips is in test/real-phone/symmetry/front.txt.
 */
import { liftDefinition, sideAngles, type RepDetail, type WorldLandmarkFrame } from './core';

const L_SHOULDER = 11, R_SHOULDER = 12, L_HIP = 23, R_HIP = 24;

// Largest median angle, in degrees, between the shoulder line (and the hip line) and the image plane for the
// set to count as filmed from the front. Convention, UNSOURCED: chosen so a body turned a quarter (45°) is
// refused with margin; status experimental.
export const FRONT_SHOULDER_DEG = 20;
export const FRONT_HIP_DEG = 25;
// Share of a rep's samples in which each side's angle must be read for that rep to be compared
// (convention, UNSOURCED; the withdrawn iteration 3 used the same share).
export const SIDES_SEEN = 0.8;
// Fewest compared reps for a set's index: one or two reps give a single noisy reading (convention, UNSOURCED).
export const MIN_COMPARED_REPS = 3;
// The index beyond which a difference is reported. Literature: 10-15 % is the band most often used to call
// an inter-limb asymmetry meaningful (Bishop, Turner & Read 2018, J Sports Sci 36(10):1135-1144, who also
// note no threshold is universal). Status: literature, not measured by us.
export const ASYMMETRY_SI = 15;
// The index measurement alone reaches: on the Countix clips filmed from the front, lifters with no known
// asymmetry, 80 % of indices lie between -30 % and +29 % (rounded) (test/real-phone/symmetry/front.txt, 1 October 2026).
// The screen states it beside every index instead of a verdict. Status: measured on public clips, not on phone video.
export const NOISE_SI = 30;

const yawDeg = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  (Math.atan2(Math.abs(a.z - b.z), Math.abs(a.x - b.x)) * 180) / Math.PI;

function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** How square the body stands to the camera: the median angle of the shoulder and hip lines to the image plane. */
export function facing(worldLandmarks: WorldLandmarkFrame[]) {
  const sh: number[] = [], hp: number[] = [];
  for (const wl of worldLandmarks) {
    if (!wl) continue;
    sh.push(yawDeg(wl[L_SHOULDER], wl[R_SHOULDER]));
    hp.push(yawDeg(wl[L_HIP], wl[R_HIP]));
  }
  const shoulderDeg = median(sh), hipDeg = median(hp);
  return { shoulderDeg, hipDeg, front: shoulderDeg <= FRONT_SHOULDER_DEG && hipDeg <= FRONT_HIP_DEG };
}

export interface SideComparison {
  left: number;            // median range of the left joint over the compared reps, degrees
  right: number;           // the same, right
  si: number;              // symmetry index, median over reps of (R - L) / mean(R, L) x 100 (Robinson et al. 1987)
  reps: number;            // reps compared
}

export type SymmetryResult =
  | { status: 'measured'; comparison: SideComparison }
  | { status: 'not-front' | 'both-sides-lift' | 'too-few-reps' | 'no-lift' };

/** Both sides' range per counted rep and the set's symmetry index; a reason instead when it cannot be measured. */
export function compareSides(
  worldLandmarks: WorldLandmarkFrame[],
  timestamps: number[],
  lift: string,
  reps: Pick<RepDetail, 'startTime' | 'endTime'>[],
): SymmetryResult {
  const def = liftDefinition(lift);
  if (!def) return { status: 'no-lift' };
  // Alternating lifts work one side per rep: there is nothing to compare within a rep.
  if (def.bothSides) return { status: 'both-sides-lift' };
  if (!facing(worldLandmarks).front) return { status: 'not-front' };
  const l = sideAngles(worldLandmarks, timestamps, def, 'left').smoothed;
  const r = sideAngles(worldLandmarks, timestamps, def, 'right').smoothed;
  const range = (xs: (number | null)[], i0: number, i1: number) => {
    let lo = Infinity, hi = -Infinity, seen = 0;
    for (let i = i0; i <= i1; i++) { const a = xs[i]; if (a === null || a === undefined) continue; seen++; if (a < lo) lo = a; if (a > hi) hi = a; }
    return { rom: hi - lo, seen: seen / (i1 - i0 + 1) };
  };
  const L: number[] = [], R: number[] = [], SI: number[] = [];
  for (const rep of reps) {
    const i0 = timestamps.findIndex(t => t >= rep.startTime);
    let i1 = timestamps.findIndex(t => t >= rep.endTime);
    if (i1 < 0) i1 = timestamps.length - 1;
    if (i0 < 0 || i1 <= i0) continue;
    const a = range(l, i0, i1), b = range(r, i0, i1);
    if (a.seen < SIDES_SEEN || b.seen < SIDES_SEEN) continue;
    const mean = (a.rom + b.rom) / 2;
    if (!(mean > 0)) continue;
    L.push(a.rom); R.push(b.rom); SI.push(((b.rom - a.rom) / mean) * 100);
  }
  if (SI.length < MIN_COMPARED_REPS) return { status: 'too-few-reps' };
  const si = median(SI);
  return { status: 'measured', comparison: { left: median(L), right: median(R), si, reps: SI.length } };
}
