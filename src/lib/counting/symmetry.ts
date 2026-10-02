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
import { COUNTABLE_RANGE_DEG, liftDefinition, sideAngles, type RepDetail, type WorldLandmarkFrame } from './core';

const L_SHOULDER = 11, R_SHOULDER = 12, L_HIP = 23, R_HIP = 24;

// Largest median angle, in degrees, between the shoulder line (and the hip line) and the image plane for the
// set to count as filmed from the front. Source: UNSOURCED, chosen so a body turned a quarter (45°) is
// refused with margin. Status: experimental.
export const FRONT_SHOULDER_DEG = 20;
export const FRONT_HIP_DEG = 25;
// Share of a rep's samples in which each side's angle must be read for that rep to be compared.
// Source: UNSOURCED (the withdrawn iteration 3 used the same share). Status: experimental.
export const SIDES_SEEN = 0.8;
// Fewest compared reps for a set's index: one or two reps give a single noisy reading. Source: UNSOURCED.
// Status: experimental.
export const MIN_COMPARED_REPS = 3;
// The gap the screen uses to say how noisy the measure is: 10-15 % is the band most often used to call an
// inter-limb asymmetry meaningful in performance tests (Bishop, Turner & Read 2018, J Sports Sci
// 36(10):1135-1144, who note no threshold is universal); here applied to joint range, a different quantity.
// Status: convention. The app draws no verdict from it.
export const GAP_SI = 15;
// Share of public clips filmed from the front (lifters with no known asymmetry) whose index exceeds GAP_SI:
// 15 of 44 (34 %) on the Countix clips in test/real-phone/symmetry/front.txt (1 October 2026, partly filmed
// reps not compared), which the screen states as "about a third". Descriptive of those clips only, not a
// threshold. Status: experimental.
export const NOISE_SHARE_OVER_GAP = 1 / 3;
// Exercises whose two sides move together through the same range, the only ones compared. A one-arm or
// one-leg exercise (one_arm_dumbbell_row, split_squat...), an alternating one, or a lunge would compare the
// working limb with the resting one. Source: the exercises' own execution (convention). Status: convention.
export const BILATERAL = new Set([
  'bicep_curl', 'lat_pulldown', 'seated_row', 'triceps_pushdown', 'bench_press', 'overhead_press',
  'lateral_raise', 'front_raise', 'squat', 'leg_press', 'leg_extension', 'leg_curl', 'romanian_deadlift',
  'hip_thrust', 'pull_up', 'push_up',
]);

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
  let toward = 0;
  for (const wl of worldLandmarks) {
    if (!wl) continue;
    sh.push(yawDeg(wl[L_SHOULDER], wl[R_SHOULDER]));
    hp.push(yawDeg(wl[L_HIP], wl[R_HIP]));
    // Facing the camera, the person's left shoulder lies on +x of the world frame: so on all of David's sets
    // filmed from the front (97-100 % of frames) and on none of his lat pulldown filmed from behind (0 %).
    if (wl[L_SHOULDER].x > wl[R_SHOULDER].x) toward++;
  }
  const shoulderDeg = median(sh), hipDeg = median(hp), facingShare = sh.length ? toward / sh.length : 0;
  // A body seen from behind is square to the camera too; it is refused (its left and right are less reliable).
  return { shoulderDeg, hipDeg, facingShare, front: shoulderDeg <= FRONT_SHOULDER_DEG && hipDeg <= FRONT_HIP_DEG && facingShare >= 0.8 };
}

export interface SideComparison {
  left: number;            // median range of the left joint over the compared reps, degrees
  right: number;           // the same, right
  si: number;              // symmetry index (R - L) / mean(R, L) x 100 of the two medians above (Robinson, Herzog & Nigg 1987), so the three numbers shown agree
  reps: number;            // reps compared
  perRep: { at: number; left: number; right: number }[]; // each compared rep's ranges; at = its position in the reps given
}

export type SymmetryResult =
  | { status: 'measured'; comparison: SideComparison }
  | { status: 'not-front' | 'one-side-lift' | 'one-side-still' | 'too-few-reps' | 'no-lift' };

/** Both sides' range per counted rep and the set's symmetry index; a reason instead when it cannot be measured. */
export function compareSides(
  worldLandmarks: WorldLandmarkFrame[],
  timestamps: number[],
  lift: string,
  reps: (Pick<RepDetail, 'startTime' | 'endTime'> & { clipped?: boolean })[],
): SymmetryResult {
  const def = liftDefinition(lift);
  if (!def) return { status: 'no-lift' };
  // Alternating, one-arm and one-leg lifts work one side at a time: there is nothing to compare within a rep.
  if (def.bothSides || !BILATERAL.has(lift)) return { status: 'one-side-lift' };
  if (!facing(worldLandmarks).front) return { status: 'not-front' };
  const l = sideAngles(worldLandmarks, timestamps, def, 'left').smoothed;
  const r = sideAngles(worldLandmarks, timestamps, def, 'right').smoothed;
  const range = (xs: (number | null)[], i0: number, i1: number) => {
    let lo = Infinity, hi = -Infinity, seen = 0;
    for (let i = i0; i <= i1; i++) { const a = xs[i]; if (a === null || a === undefined) continue; seen++; if (a < lo) lo = a; if (a > hi) hi = a; }
    return { rom: hi - lo, seen: seen / (i1 - i0 + 1) };
  };
  const L: number[] = [], R: number[] = [], perRep: SideComparison['perRep'] = [];
  for (const [at, rep] of reps.entries()) {
    // A rep the recording cuts is not whole on either side: not compared (its tempo is withheld too).
    if (rep.clipped) continue;
    const i0 = timestamps.findIndex(t => t >= rep.startTime);
    let i1 = timestamps.findIndex(t => t >= rep.endTime);
    if (i1 < 0) i1 = timestamps.length - 1;
    if (i0 < 0 || i1 <= i0) continue;
    const a = range(l, i0, i1), b = range(r, i0, i1);
    if (a.seen < SIDES_SEEN || b.seen < SIDES_SEEN) continue;
    const mean = (a.rom + b.rom) / 2;
    if (!(mean > 0)) continue;
    L.push(a.rom); R.push(b.rom); perRep.push({ at, left: a.rom, right: b.rom });
  }
  if (L.length < MIN_COMPARED_REPS) return { status: 'too-few-reps' };
  const left = median(L), right = median(R);
  // One side barely moving while the other works is a one-sided set, whatever the exercise was called.
  if (Math.min(left, right) < COUNTABLE_RANGE_DEG) return { status: 'one-side-still' };
  return { status: 'measured', comparison: { left, right, si: ((right - left) / ((left + right) / 2)) * 100, reps: L.length, perRep } };
}
