// Learned phase counter, bench only (the app imports none of it): the pose input every set is read through, in
// training (export.test.ts writes it for train.py) and in inference (model.js). One function, so the trained model and
// its JS inference read the same numbers.
//
// resampleJoints: world landmarks (MediaPipe, metres, hip-centred) of 13 joints, put on a uniform 15 Hz grid by the
// nearest sample within half a step (UNSOURCED, experimental: 15 Hz is the rate of almost every labelled set on disk,
// TRIED.md 3 October). A joint whose visibility is under 0.5 is unseen (the threshold the core and PSC use; MediaPipe's
// own default for drawing, convention). Layout per frame: 13 x (x, y, z, seen 0/1); an unseen frame is all zero.

import { createHash } from 'node:crypto';
import { FS } from '../../../src/lib/counting/psc.js';
import { specProgress } from '../template/sgc.js';

export const HZ = 15;

// The two cross-validation folds of the build sets (export.test.ts, learned-phase.test.ts): by group, so no video,
// MM-Fit workout, CF-Rep participant or synthetic lift has sets in both folds.
export const foldOf = g => (parseInt(createHash('sha256').update(`lphase:${g}`).digest('hex')[0], 16) < 8 ? 0 : 1);
export function groupOf(ds, id) {
  if (ds === 'countix') return `countix:${id.slice(0, 11)}`;
  if (ds === 'mmfit') return `mmfit:${id.split('-')[0]}`;
  if (ds === 'cfrep') return `cfrep:${id.split('_')[2] ?? id}`;
  if (ds === 'synthetic' || ds === 'occlusion') return `synth:${id}`;
  return `${ds}:${id}`;
}
// nose, shoulders, elbows, wrists, hips, knees, ankles (MediaPipe pose indices)
export const JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
export const NJ = JOINTS.length;
export const VIS_MIN = 0.5;

/** @returns {{ T: number, t0: number, joints: Float32Array }} */
export function resampleJoints(wl, ts) {
  const n = Math.min(wl.length, ts.length);
  if (n === 0) return { T: 0, t0: 0, joints: new Float32Array(0) };
  const t0 = ts[0], t1 = ts[n - 1];
  const T = Math.max(1, Math.floor((t1 - t0) * HZ + 1e-6) + 1);
  const joints = new Float32Array(T * NJ * 4);
  let j = 0;
  for (let k = 0; k < T; k++) {
    const t = t0 + k / HZ;
    while (j + 1 < n && Math.abs(ts[j + 1] - t) <= Math.abs(ts[j] - t)) j++;
    if (Math.abs(ts[j] - t) > 0.5 / HZ + 0.02) continue;
    const f = wl[j];
    if (!f || f.length < 29) continue;
    for (let q = 0; q < NJ; q++) {
      const p = f[JOINTS[q]];
      if (!p || !((p.visibility ?? 1) >= VIS_MIN)) continue;
      const o = (k * NJ + q) * 4;
      joints[o] = p.x; joints[o + 1] = p.y; joints[o + 2] = p.z; joints[o + 3] = 1;
    }
  }
  return { T, t0, joints };
}

// Per-frame features of the resampled joints, computed identically in train.py (features()); the parity is checked by
// learned-phase-unit.test.ts against a file train.py writes. Layout per frame (F = 2 * 48 + 14 = 110):
//  [0, 39)  each of the 13 joints relative to the hip midpoint, in torso lengths (the set's median shoulder-mid to
//           hip-mid distance), minus the set's median of that value;
//  [39, 48) nine angles over pi (elbows, shoulders, hips, knees, trunk to vertical), minus the set's median;
//  [48, 96) the same 48 divided by their set spread (median absolute deviation x 1.4826, floored at 0.05);
//  [96, 109) joint seen (0/1); 109: frame missing (0/1).
// Unseen values are 0. Medians and spreads over the seen frames only.
export const F = 110;
const ANG = [[11, 13, 15], [12, 14, 16], [13, 11, 23], [14, 12, 24], [11, 23, 25], [12, 24, 26], [23, 25, 27], [24, 26, 28]];
const idx = Object.fromEntries(JOINTS.map((j, q) => [j, q]));

function angle(J, base, a, b, c) {
  const oa = base + idx[a] * 4, ob = base + idx[b] * 4, oc = base + idx[c] * 4;
  if (!J[oa + 3] || !J[ob + 3] || !J[oc + 3]) return NaN;
  const ux = J[oa] - J[ob], uy = J[oa + 1] - J[ob + 1], uz = J[oa + 2] - J[ob + 2];
  const vx = J[oc] - J[ob], vy = J[oc + 1] - J[ob + 1], vz = J[oc + 2] - J[ob + 2];
  const nu = Math.hypot(ux, uy, uz), nv = Math.hypot(vx, vy, vz);
  if (nu < 1e-6 || nv < 1e-6) return NaN;
  const c0 = Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / (nu * nv)));
  return Math.acos(c0) / Math.PI;
}

function median(a) {
  if (!a.length) return NaN;
  const s = Float64Array.from(a).sort();
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** @returns {Float32Array} T x F, or T x (F + 2) with progress (the progress input mode, progressFeatures). */
export function features(joints, T, progress = null) {
  const raw = new Float64Array(T * 48).fill(NaN);
  const torso = [];
  for (let k = 0; k < T; k++) {
    const b = k * NJ * 4;
    const lh = b + idx[23] * 4, rh = b + idx[24] * 4, ls = b + idx[11] * 4, rs = b + idx[12] * 4;
    if (joints[lh + 3] && joints[rh + 3] && joints[ls + 3] && joints[rs + 3]) {
      const dx = (joints[ls] + joints[rs] - joints[lh] - joints[rh]) / 2;
      const dy = (joints[ls + 1] + joints[rs + 1] - joints[lh + 1] - joints[rh + 1]) / 2;
      const dz = (joints[ls + 2] + joints[rs + 2] - joints[lh + 2] - joints[rh + 2]) / 2;
      torso.push(Math.hypot(dx, dy, dz));
    }
  }
  const S = Math.max(median(torso) || 0.5, 0.05);
  for (let k = 0; k < T; k++) {
    const b = k * NJ * 4;
    const lh = b + idx[23] * 4, rh = b + idx[24] * 4;
    if (!(joints[lh + 3] && joints[rh + 3])) continue;
    const hx = (joints[lh] + joints[rh]) / 2, hy = (joints[lh + 1] + joints[rh + 1]) / 2, hz = (joints[lh + 2] + joints[rh + 2]) / 2;
    for (let q = 0; q < NJ; q++) {
      const o = b + q * 4;
      if (!joints[o + 3]) continue;
      raw[k * 48 + q * 3] = (joints[o] - hx) / S;
      raw[k * 48 + q * 3 + 1] = (joints[o + 1] - hy) / S;
      raw[k * 48 + q * 3 + 2] = (joints[o + 2] - hz) / S;
    }
    for (let a = 0; a < ANG.length; a++) raw[k * 48 + 39 + a] = angle(joints, b, ...ANG[a]);
    const ls = b + idx[11] * 4, rs = b + idx[12] * 4;
    if (joints[ls + 3] && joints[rs + 3]) {
      const dx = (joints[ls] + joints[rs]) / 2 - hx, dy = (joints[ls + 1] + joints[rs + 1]) / 2 - hy, dz = (joints[ls + 2] + joints[rs + 2]) / 2 - hz;
      const n = Math.hypot(dx, dy, dz);
      if (n > 1e-6) raw[k * 48 + 47] = Math.acos(Math.max(-1, Math.min(1, -dy / n))) / Math.PI;
    }
  }
  const out = new Float32Array(T * F);
  for (let c = 0; c < 48; c++) {
    const col = [];
    for (let k = 0; k < T; k++) { const v = raw[k * 48 + c]; if (!Number.isNaN(v)) col.push(v); }
    if (!col.length) continue;
    const m = median(col);
    const sp = Math.max(1.4826 * median(col.map(v => Math.abs(v - m))), 0.05);
    for (let k = 0; k < T; k++) {
      const v = raw[k * 48 + c];
      if (Number.isNaN(v)) continue;
      out[k * F + c] = v - m;
      out[k * F + 48 + c] = (v - m) / sp;
    }
  }
  for (let k = 0; k < T; k++) {
    let any = 0;
    for (let q = 0; q < NJ; q++) { const s = joints[(k * NJ + q) * 4 + 3]; out[k * F + 96 + q] = s; any += s; }
    out[k * F + 109] = any ? 0 : 1;
  }
  if (!progress) return out;
  const pf = progressFeatures(progress, T), wide = new Float32Array(T * (F + 2));
  for (let k = 0; k < T; k++) {
    wide.set(out.subarray(k * F, (k + 1) * F), k * (F + 2));
    wide[k * (F + 2) + F] = pf[2 * k];
    wide[k * (F + 2) + F + 1] = pf[2 * k + 1];
  }
  return wide;
}

// The progress input mode (optional; a model trained with train.py --progress, "input": "progress" in its JSON): two
// more channels per frame from the progress p of the set's motion spec (sgc.js specProgress: the spec's rep signal in
// physical units, a full rep of the spec moves it by about 1): p minus its median over the set's frames where it is
// finite, clipped to [-2, 2] (UNSOURCED, experimental: two reps' worth either side), 0 where absent; and a mask, 1 where
// p is finite. A set with no spec (or none of its signals seen) has the mask 0 throughout. Mirrored in train.py
// progress_features().
export const PROGRESS_CLIP = 2;
/** @returns {Float32Array} T x 2 */
export function progressFeatures(progress, T) {
  const out = new Float32Array(T * 2), fin = [];
  for (let k = 0; k < T; k++) if (Number.isFinite(progress[k])) fin.push(progress[k]);
  const m = median(fin);
  for (let k = 0; k < T; k++) {
    if (!Number.isFinite(progress[k])) continue;
    out[2 * k] = Math.max(-PROGRESS_CLIP, Math.min(PROGRESS_CLIP, progress[k] - m));
    out[2 * k + 1] = 1;
  }
  return out;
}

/**
 * sgc.js specProgress's { t0, p } (PSC's grid: t0 + j / FS) on the resampleJoints grid (t0 + k / HZ, T frames): the
 * value at the same time, linear between two finite neighbours when the grids are offset, NaN where absent. Both grids
 * start at the set's first timestamp at 15 Hz, so this is a copy (of the first T values) unless that changes.
 * @returns {Float32Array} T
 */
export function alignProgress(prog, t0, T) {
  const out = new Float32Array(T).fill(NaN);
  if (!prog) return out;
  const { p } = prog;
  // The offset between the grids first, then the step: t0 + k / HZ - prog.t0 loses the step's precision to a large t0
  // (epoch seconds: a third of the frames read between two samples instead of on one).
  const off = (t0 - prog.t0) * FS, step = FS / HZ;
  for (let k = 0; k < T; k++) {
    const u = off + k * step, i = Math.round(u);
    if (Math.abs(u - i) < 1e-6) { if (i >= 0 && i < p.length) out[k] = p[i]; continue; }
    const a = Math.floor(u);
    if (a >= 0 && a + 1 < p.length && Number.isFinite(p[a]) && Number.isFinite(p[a + 1])) out[k] = p[a] + (u - a) * (p[a + 1] - p[a]);
  }
  return out;
}

/** The progress input of a set on its resampleJoints grid (t0, T): NaN throughout without a spec. One function for the
 *  export (export.test.ts writes it for train.py) and inference (model.js learnedCount). */
export function progressOnGrid({ wl, ts, image = null }, spec, t0, T) {
  return alignProgress(spec ? specProgress({ wl, ts, image }, spec) : null, t0, T);
}
