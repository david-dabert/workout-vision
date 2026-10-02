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
 * Synthetic sets with an exact, built-in asymmetry (test/real-phone/synth/synth.txt, 2 October 2026: two rigged
 * bodies, four exercises, four camera angles) showed two limits, which the rules below enforce:
 * - only the lateral raise reads the gap within about 9 points when filmed square on; curls and presses
 *   move the limbs toward the camera, whose depth a single camera reads poorly, and were off by up to 55 and
 *   28 points even square on;
 * - the body's turn read from the landmarks depends on the body: one body turned 30° read 10° at the
 *   shoulders, so the old 20° gate measured sets filmed at 30° and 60°, with errors of 25 to 40 points.
 *
 * Status: experimental. Validated on synthetic bodies only, not against a person's measured asymmetry.
 */
import { COUNTABLE_RANGE_DEG, liftDefinition, sideAngles, type RepDetail, type WorldLandmarkFrame } from './core';

const L_SHOULDER = 11, R_SHOULDER = 12, L_HIP = 23, R_HIP = 24;

// Largest median angle, in degrees, between the shoulder line (and the hip line) and the image plane for the
// set to count as filmed square on. Source: synthetic sets (synth.txt): filmed square on, both bodies read at
// most 5° at the shoulders and 3° at the hips, and David's two front lateral raises 4-5°; the nearest bad case,
// one body filmed at 60°, read 11.7° at the shoulders and 11-13° at the hips, so the margin is 3-4°. Some
// real sets filmed from the front read above 8° (David's overhead press 10, 8.9°; a third of the Countix front
// raises) and are refused: the gate errs toward refusing. Angles between 0° and 30° were not rendered.
// Status: experimental.
export const FRONT_SHOULDER_DEG = 8;
export const FRONT_HIP_DEG = 8;
// Share of a rep's samples in which each side's angle must be read for that rep to be compared.
// Source: UNSOURCED (the withdrawn iteration 3 used the same share). Status: experimental.
export const SIDES_SEEN = 0.8;
// Fewest compared reps for a set's index: one or two reps give a single noisy reading. Source: UNSOURCED.
// Status: experimental.
export const MIN_COMPARED_REPS = 3;
// How far the app's gap lay from the true gap on the synthetic lateral raises filmed square on (synth.txt,
// 2 October 2026: 6 sets, two bodies, true gaps -12 % to +21 %), with the rest band of 5 % and 2° (core.ts):
// at most 9.7 points per set, and 11.5 points per rep (5 of 42 reps beyond 9). Equal sides read -4.5 to
// -6.7 %: a bias toward the left on these bodies. (With the earlier band: 8.9 and 13.7.)
// The screen states both bounds as observations, not as a guarantee. Status: experimental (synthetic bodies,
// six sets; not people).
export const GAP_SYNTH_SETS = 6;
export const GAP_ERROR_POINTS = 10;
export const REP_GAP_ERROR_POINTS = 12;
// The rule a stored comparison was measured under: sets saved before 2 October 2026 compared every bilateral
// lift with a 20°/25° gate and carry no version; version 2 used the 10 % rest band, whose rep windows read
// other ranges. Only the current version's comparison is shown again (sides-line.js).
export const SIDES_VERSION = 3;
// Exercises compared: those whose two sides move together in the plane the camera faces, and whose gap the
// synthetic sets read within GAP_ERROR_POINTS. Only the lateral raise qualifies so far. Square on, curls were
// off by up to 55 points and presses by 11 to 28 (synth.txt); squats filmed square on read the knee's range
// 50-63° short, and one set counted 0, so their sides are not compared either. An exercise joins only once a synthetic run shows it reads as well.
// Status: experimental.
export const SIDES_LIFTS = new Set(['lateral_raise']);

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
  | { status: 'not-front' | 'not-compared-lift' | 'one-side-still' | 'too-few-reps' | 'no-lift' };

/** Both sides' range per counted rep and the set's symmetry index; a reason instead when it cannot be measured. */
export function compareSides(
  worldLandmarks: WorldLandmarkFrame[],
  timestamps: number[],
  lift: string,
  reps: (Pick<RepDetail, 'startTime' | 'endTime'> & { clipped?: boolean })[],
): SymmetryResult {
  const def = liftDefinition(lift);
  if (!def) return { status: 'no-lift' };
  // Only exercises whose gap reads reliably (SIDES_LIFTS); alternating lifts work one side at a time.
  if (def.bothSides || !SIDES_LIFTS.has(lift)) return { status: 'not-compared-lift' };
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
