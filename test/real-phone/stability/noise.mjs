// Landmark-noise proxy for re-encoding (WorkoutVision, stability study, 10 October 2026).
// Test code: stability.test.ts imports it; the app never does. Parameters: README.md in this folder. The fitting
// scripts and their outputs (resid*.txt, calib.txt, ... named below) stayed in the study's scratch folder; their
// conclusions are in README.md and TRIED.md ("Counts that swing under re-encoding").
//
// What it imitates: the difference between two reads of the same video by the app (MediaPipe pose, IMAGE mode, world
// landmarks) after the video went through another encoder. Measured on David's 14 videos, committed read against the
// ctl, image9 and image reads (resid*.txt, calib.txt, scaling.txt, xcorr.txt, pullfit.txt, drops2.txt, gains.txt,
// gainpose.txt, visbias.txt in this folder):
//  - per joint and axis the difference is white in time at 15 Hz (autocorrelation at lags 1-5 within +-0.1);
//  - its size follows the set's own frame-to-frame jitter (log-log correlation 0.62), sub-linearly: robust sd 6 mm
//    where the local jitter is 2 mm, 14 mm at 17 mm, 48 mm at 69 mm, 81 mm at 264 mm; its tails are heavy;
//  - neighbouring joints move together (elbow-wrist 0.8, shoulder-elbow 0.7, knee-ankle 0.6-0.8, hip-knee 0.2-0.5),
//    and on the most unsteady frames the whole skeleton turns (front-back flips; joint angles ignore those);
//  - visibility (logit) moves the same way, and a second read is pulled back toward the first read's running median
//    (slope 0.43);
//  - a pose present in one read is missing in the other on 1.6-4.2 % of samples, mostly next to samples already
//    missing or where the skeleton jitters; a pose missing in one read is present in the other on about half of them.
//
// Model (mode 'empirical', the default): for each sample and joint, the difference is drawn from its measured
// distribution given the local jitter (noise-table.json, built by table.mjs), through a Gaussian copula chained along
// the skeleton (so limbs keep their measured joint-to-joint correlation); visibility is pulled toward its running
// median and given its own measured draw plus one level shift per set and side; poses are lost and found at the
// measured rates for their context. Mode 'parametric' replaces the table by k x jitter x Student t (kept for comparison).
// intensity scales the noise, the level shifts and the loss and find rates together: 1 reproduces the measured
// landmark statistics; 0.5 (the default) reproduces the spread of counts between real reads (validate-i0.5-K*.txt).
// Status: experimental (fitted on 14 videos of one person; validate-*.txt and valsig-final-*.txt say how far it matches).

const N_JOINTS = 33;
const BODY = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

// The chain the fresh draw follows: [joint, parent, link]. 'T' is a torso node shared by both shoulders and the head;
// the right hip mirrors the left (world landmarks are centred on the hips' midpoint: their residuals correlate -1.00).
const ORDER = [
  [23, null, null], [24, 23, 'mirror'],
  [11, 'T', 'torso'], [12, 'T', 'torso'], [0, 'T', 'head'],
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(j => [j, 0, 'face']),
  [13, 11, 'shoElb'], [14, 12, 'shoElb'], [15, 13, 'elbWri'], [16, 14, 'elbWri'],
  ...[17, 19, 21].map(j => [j, 15, 'hand']), ...[18, 20, 22].map(j => [j, 16, 'hand']),
  [25, 23, 'hipKnee'], [26, 24, 'hipKnee'], [27, 25, 'kneeAnk'], [28, 26, 'kneeAnk'],
  ...[29, 31].map(j => [j, 27, 'foot']), ...[30, 32].map(j => [j, 28, 'foot']),
];
// Measured correlation of the standardized residual between a joint and its parent (xcorr.txt, clipped at 3 robust sd,
// before removing the whole-skeleton rotation): shoulder-elbow 0.70-0.84, elbow-wrist 0.80-0.89, hip-knee 0.20-0.48,
// knee-ankle 0.56-0.78, shoulder-shoulder 0.04-0.77, nose-shoulder 0.94 (Pearson, resid.txt).
export const MEASURED_RHO = Object.freeze({ torso: 0.4, head: 0.9, face: 0.95, shoElb: 0.75, elbWri: 0.85, hand: 0.95, hipKnee: 0.4, kneeAnk: 0.7, foot: 0.95 });
// Tightened chain: rho' = 1 - (1 - rho) * rhoLoose. 1 keeps the measured values; below 1 makes limbs move more as one.
export const tightRho = (loose, base = MEASURED_RHO) => Object.fromEntries(Object.entries(base).map(([k, v]) => [k, 1 - (1 - v) * loose]));

export const DEFAULTS = Object.freeze({
  mode: 'empirical',                                   // 'empirical': measured conditional quantiles (noise-table.json); 'parametric': k * S * t
  rotate: false,                                       // empirical mode: also turn the whole skeleton per frame (positions only; joint angles ignore it)
  rawTable: false,                                     // empirical mode: draw the joints' noise from the raw differences (with rotation) instead of the aligned ones
  intensity: 0.5,                                      // scales noise, visibility shifts, drop and gain together: 1 = measured landmark statistics, 0.5 = count spread of real reads
  pull: 0, k: 0.6, nu: 5, rhoLoose: 0.3,               // positions (k, nu: parametric mode only)
  pullVis: 0.43, kVis: 0.77, nuVis: 2,                 // visibility, logit units
  visShift: 0.1,                                       // sd of one visibility offset per set and side (logit units)
  W: 2, phi: 0.05, zCap: 30, jitterFloorMm: 1, jitterCapMm: 400,
  drop: 1, dropExt: 0.22,                              // poses lost
  gain: 1, gainK: 1.6, gainVisSd: 2.0,                 // poses found
});

// P(pose missing in the other read | present in this one), six directed pairs of three encodings (drops2.txt): by
// distance (samples) to the nearest sample already missing here and by the skeleton's own jitter at that sample (mean
// |second difference| over 12 body joints, mm). Per sample, run extensions included.
export const DROP_TABLE = {
  near: 0.196,                                             // next to a missing sample (231 of 1180)
  jitter: [                                                // distance 2, 3-5, 6-15, >15
    { below: 40, rates: [0.04, 0.001, 0.0025, 0.0011] },   // d2: 5/63 measured (7.9 %, small n), held at 4 %; d3-5: 0/336, held at 0.1 %
    { below: 80, rates: [0.038, 0.027, 0.0084, 0.0042] },
    { below: 160, rates: [0.040, 0.043, 0.026, 0.0087] },
    { below: Infinity, rates: [0.142, 0.087, 0.057, 0.033] },
  ],
};
// P(pose present in the other read | missing in this one) by the missing run's length (gains.txt): a lone missing
// sample 296/413 = 72 %; runs of 2-4: 238/471 = 51 %; 5 and more: 83/212 = 39 %; runs touching the set's ends: 13/32.
export const GAIN_TABLE = { 1: 0.72, short: 0.51, long: 0.39, edge: 0.41 };

// Measured |difference| between two reads, conditional on the first read's local jitter (table.mjs -> noise-table.json):
// per bin of jitter, quantiles of |difference| at TABLE.levels; positions in mm per axis, visibility in logit units
// (after the pull toward the running median). Sampled through a Gaussian copula: the chained, AR(1) Gaussian draw z
// gives the sign and the level u = 2 Phi(|z|) - 1, so neighbouring joints keep their measured correlation.
import { readFileSync } from 'node:fs';
export const TABLE = JSON.parse(readFileSync(new URL('./noise-table.json', import.meta.url), 'utf8'));
const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
const absLevel = z => erf(Math.abs(z) / Math.SQRT2); // 2 Phi(|z|) - 1
function quantileAt(bin, u) {
  const L = TABLE.levels; let k = 0; while (k + 2 < L.length && u > L[k + 1]) k++;
  const t = Math.min(1, Math.max(0, (u - L[k]) / (L[k + 1] - L[k])));
  return bin.absQ[k] * (1 - t) + bin.absQ[k + 1] * t;
}
// |difference| at level u for a jitter S: interpolated in log S between the two nearest bins
export function empiricalAbs(bins, S, u) {
  const lg = v => Math.log(Math.max(v, 1e-3)); // a bin of zero jitter (saturated visibility) is anchored at 1e-3
  const ls = lg(S);
  if (ls <= lg(bins[0].S)) return quantileAt(bins[0], u);
  for (let k = 0; k + 1 < bins.length; k++) {
    const a = lg(bins[k].S), b = lg(bins[k + 1].S);
    if (b <= a) continue;
    if (ls <= b) { const t = (ls - a) / (b - a); return quantileAt(bins[k], u) * (1 - t) + quantileAt(bins[k + 1], u) * t; }
  }
  return quantileAt(bins[bins.length - 1], u);
}
function rotationMatrix(rv) { // rotation vector (rad) -> matrix (Rodrigues)
  const th = Math.hypot(rv[0], rv[1], rv[2]);
  if (th < 1e-12) return null;
  const [x, y, zz] = rv.map(v => v / th), c = Math.cos(th), s = Math.sin(th), C = 1 - c;
  return [[c + x * x * C, x * y * C - zz * s, x * zz * C + y * s], [y * x * C + zz * s, c + y * y * C, y * zz * C - x * s], [zz * x * C - y * s, zz * y * C + x * s, c + zz * zz * C]];
}

// ─── seeded random numbers ───
function mix32(a, b) { // two 32-bit words -> one well-mixed 32-bit word (murmur3 finalizer on a combination)
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
function fingerprint(set) { // FNV-1a over the set's length, first and last times, and a few coordinates
  let h = 0x811c9dc5;
  const eat = v => { const str = Number.isFinite(v) ? v.toFixed(6) : String(v); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } };
  const wl = set.worldLandmarks || [], ts = set.timestamps || [];
  eat(wl.length); eat(ts[0]); eat(ts[ts.length - 1]);
  let k = 0;
  for (let i = 0; i < wl.length && k < 5; i++) if (wl[i]) { eat(wl[i][0].x); eat(wl[i][25].y); eat(wl[i][16].z); k++; }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normal(rng) { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); }
function gamma(rng, shape) { // Marsaglia-Tsang
  if (shape < 1) return gamma(rng, shape + 1) * Math.pow(rng() || 1e-12, 1 / shape);
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x, v;
    do { x = normal(rng); v = 1 + c * x; } while (v <= 0);
    v = v * v * v; const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
// Student t scaled to a robust sd (1.4826 x median |t|) of 1; nu = Infinity gives a standard normal.
const MEDABS = new Map();
function medAbsT(nu) {
  if (!Number.isFinite(nu)) return 0.6745;
  if (MEDABS.has(nu)) return MEDABS.get(nu);
  let v;
  if (nu === 2) v = Math.SQRT1_2 / Math.sqrt(0.75);
  else if (nu === 1) v = 1;
  else { const r = mulberry32(12345), xs = []; for (let i = 0; i < 200001; i++) xs.push(Math.abs(normal(r) / Math.sqrt((2 * gamma(r, nu / 2)) / nu))); xs.sort((a, b) => a - b); v = xs[100000]; }
  MEDABS.set(nu, v); return v;
}
function tRobust(rng, nu, cap) {
  const t = Number.isFinite(nu) ? normal(rng) / Math.sqrt((2 * gamma(rng, nu / 2)) / nu) : normal(rng);
  return Math.max(-cap, Math.min(cap, t / (1.4826 * medAbsT(nu))));
}

// ─── local scale and running median ───
const logit = v => { const c = Math.min(1 - 1e-4, Math.max(1e-4, v)); return Math.log(c / (1 - c)); };
const sigmoid = x => 1 / (1 + Math.exp(-x));
/** Per-sample noise scale of one coordinate series (null = missing): RMS of second differences over +-W samples,
 *  / sqrt(1.5) (white noise of sd s has second differences of sd s * sqrt(1.5)). Gaps take the nearest scale within
 *  2W, else the series' median. */
export function localScale(series, W) {
  const n = series.length, d2 = new Array(n).fill(null);
  for (let i = 1; i + 1 < n; i++) if (series[i - 1] !== null && series[i] !== null && series[i + 1] !== null) d2[i] = series[i] - (series[i - 1] + series[i + 1]) / 2;
  const out = new Array(n).fill(null), have = [];
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let k = Math.max(0, i - W); k <= Math.min(n - 1, i + W); k++) if (d2[k] !== null) { s += d2[k] * d2[k]; c++; }
    if (c) { out[i] = Math.sqrt(s / c) / Math.sqrt(1.5); have.push(out[i]); }
  }
  have.sort((a, b) => a - b);
  const med = have.length ? have[Math.floor(have.length / 2)] : null;
  const filled = out.slice();
  for (let i = 0; i < n; i++) if (out[i] === null) {
    let best = null;
    for (let r = 1; r <= 2 * W && best === null; r++) { if (i - r >= 0 && out[i - r] !== null) best = out[i - r]; else if (i + r < n && out[i + r] !== null) best = out[i + r]; }
    filled[i] = best ?? med;
  }
  return filled;
}
/** Running median over the present samples within +-W. */
export function runningMedian(series, W) {
  const n = series.length, out = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (series[i] === null) continue;
    const w = [];
    for (let k = Math.max(0, i - W); k <= Math.min(n - 1, i + W); k++) if (series[k] !== null) w.push(series[k]);
    w.sort((a, b) => a - b);
    out[i] = w.length % 2 ? w[(w.length - 1) / 2] : (w[w.length / 2 - 1] + w[w.length / 2]) / 2;
  }
  return out;
}

/**
 * A perturbed copy of a set, as another encoding of the same video might be read by the app.
 * @param {{worldLandmarks: (Array<{x,y,z,visibility}>|null)[], timestamps: number[], imageLandmarks?: any[]}} set
 * @param {object} opts DEFAULTS overrides; opts.seed (integer) makes it reproducible; opts.rho overrides the chain
 * @returns {{worldLandmarks, timestamps, imageLandmarks, dropped, gained}} imageLandmarks: null where the pose is lost
 *   or gained, the source's where kept (image landmarks are not perturbed).
 */
export function perturbSet(set, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  for (const key of ['k', 'kVis', 'drop', 'gain', 'visShift']) o[key] *= o.intensity;
  const emp = o.mode === 'empirical';
  const wl = set.worldLandmarks, ts = set.timestamps, n = wl.length;
  // The stream depends on the seed and on the set itself, so two sets never reuse the same random numbers (with the
  // seed alone, every set's first decisions shared one stream and a seed's draws leaned the same way on every set).
  const rng = mulberry32(mix32((opts.seed ?? 1) >>> 0, fingerprint(set)));
  for (let i = 0; i < 8; i++) rng();
  const rho = { ...tightRho(o.rhoLoose), ...(o.rho || {}) };
  // 1. per joint and channel: local scale S, running median M (positions in mm, visibility in logit units)
  const S = [], M = [];
  for (let j = 0; j < N_JOINTS; j++) {
    const ch = ['x', 'y', 'z'].map(a => wl.map(f => (f ? 1000 * f[j][a] : null)));
    ch.push(wl.map(f => (f ? logit(f[j].visibility ?? 0) : null)));
    S.push(ch.map(s => localScale(s, o.W)));
    M.push(ch.map(s => runningMedian(s, o.W)));
  }
  // a level shift of visibility for the whole set, one per side (visbias.txt: per video and side, the mean logit change
  // of a read against the committed one reached -0.28 to +0.30; spread beyond white noise about 0.06-0.14)
  const shift = { L: o.visShift * normal(rng), R: o.visShift * normal(rng), C: o.visShift * normal(rng) };
  const sideOf = j => (j <= 10 ? 'C' : j % 2 ? 'L' : 'R');
  // 2. which missing samples come back (gains), decided on the source's runs; a set with no pose at all stays empty
  const gainAt = new Array(n).fill(false);
  if (o.gain > 0 && wl.some(Boolean)) for (let i = 0; i < n;) {
    if (wl[i]) { i++; continue; }
    let e = i; while (e < n && !wl[e]) e++;
    const L = e - i, edge = i === 0 || e === n;
    const p = Math.min(1, o.gain * (edge ? GAIN_TABLE.edge : L === 1 ? GAIN_TABLE[1] : L <= 4 ? GAIN_TABLE.short : GAIN_TABLE.long));
    for (let k = i; k < e; k++) if (rng() < p) gainAt[k] = true;
    i = e;
  }
  // 3. fresh draws: AR(1) per node and channel, chained along the skeleton
  const a = o.phi, b = Math.sqrt(1 - a * a);
  const nodes = ['T', ...ORDER.map(([j]) => j)];
  const state = {}; const reset = () => { for (const k of nodes) state[k] = [0, 0, 0, 0]; }; reset();
  const z = {};
  const draw = () => {
    for (const k of nodes) { const st = state[k]; for (let c = 0; c < 4; c++) st[c] = a * st[c] + b * (emp ? normal(rng) : tRobust(rng, c < 3 ? o.nu : o.nuVis, o.zCap)); }
    z.T = state.T;
    for (const [j, parent, link] of ORDER) {
      if (link === 'mirror') { z[j] = z[parent].map(v => -v); continue; }
      if (parent === null) { z[j] = state[j]; continue; }
      const r = rho[link], q = Math.sqrt(1 - r * r), pz = z[parent], own = state[j];
      z[j] = [r * pz[0] + q * own[0], r * pz[1] + q * own[1], r * pz[2] + q * own[2], r * pz[3] + q * own[3]];
    }
  };
  const clampS = s => Math.min(o.jitterCapMm, Math.max(o.jitterFloorMm, s ?? o.jitterFloorMm));
  const out = new Array(n);
  let gained = 0;
  for (let i = 0; i < n; i++) {
    const f = wl[i];
    if (!f && !gainAt[i]) { out[i] = null; reset(); continue; }
    draw();
    // empirical mode: the whole skeleton turns about the hips' midpoint by an angle drawn for this frame's mean body
    // jitter (measured: median 1-2 degrees on steady frames, front-back flips above 90 degrees on the most unsteady)
    let R = null;
    if (f && emp && o.rotate) {
      let sj = 0, cj = 0; for (const j of BODY) for (let ax = 0; ax < 3; ax++) if (S[j][ax][i] !== null) { sj += S[j][ax][i]; cj++; }
      const fs = cj ? sj / cj : 0;
      const th = empiricalAbs(TABLE.rot, fs, rng()) * o.intensity;
      const axis = [0, 1, 2].map(c => (rng() < 0.5 ? -1 : 1) * empiricalAbs(TABLE.rot.map(b => ({ S: b.S, absQ: b.compAbsQ[c] })), fs, rng()) + 1e-9);
      const an = Math.hypot(...axis);
      R = rotationMatrix(axis.map(v => (v / an) * (th * Math.PI) / 180));
    }
    if (f) { // a kept pose, read again
      const g = new Array(N_JOINTS);
      for (let j = 0; j < N_JOINTS; j++) {
        const zz = z[j], p = f[j], s = S[j], m = M[j];
        const c = [1000 * p.x, 1000 * p.y, 1000 * p.z].map((v, ax) => v - o.pull * (v - m[ax][i]) + (emp
          ? o.intensity * Math.sign(zz[ax]) * empiricalAbs(o.rawTable ? TABLE.pos : TABLE.posAligned, s[ax][i] ?? 0, absLevel(zz[ax]))
          : o.k * clampS(s[ax][i]) * zz[ax]));
        const lv = logit(p.visibility ?? 0);
        const v = lv - o.pullVis * (lv - m[3][i]) + shift[sideOf(j)] + (emp
          ? o.intensity * Math.sign(zz[3]) * empiricalAbs(TABLE.vis, s[3][i] ?? 0, absLevel(zz[3]))
          : o.kVis * Math.max(0.02, s[3][i] ?? 0.02) * zz[3]);
        g[j] = R
          ? { x: (R[0][0] * c[0] + R[0][1] * c[1] + R[0][2] * c[2]) / 1000, y: (R[1][0] * c[0] + R[1][1] * c[1] + R[1][2] * c[2]) / 1000, z: (R[2][0] * c[0] + R[2][1] * c[1] + R[2][2] * c[2]) / 1000, visibility: sigmoid(v) }
          : { x: c[0] / 1000, y: c[1] / 1000, z: c[2] / 1000, visibility: sigmoid(v) };
      }
      out[i] = g;
    } else { // a pose found where the source has none: the line between the source's nearest poses, plus a wide draw
      let i0 = i - 1; while (i0 >= 0 && !wl[i0]) i0--;
      let i1 = i + 1; while (i1 < n && !wl[i1]) i1++;
      const ia = i0 >= 0 ? i0 : i1, ib = i1 < n ? i1 : i0;
      const A = wl[ia], B = wl[ib];
      const t = ia === ib ? 0 : (ts[i] - ts[ia]) / (ts[ib] - ts[ia]);
      const g = new Array(N_JOINTS);
      // measured: a found pose sits 1.6 x the neighbours' jitter from the line (robust sd), with heavy tails (p99 24 x):
      // in empirical mode the Gaussian draw gets one Student-t scale (2 degrees of freedom) shared by the whole frame
      const heavy = emp ? 1 / (1.2105 * Math.sqrt(-Math.log(1 - rng() * 0.999999))) : 1;
      for (let j = 0; j < N_JOINTS; j++) {
        const zz = z[j].map(v => v * heavy);
        const c = ['x', 'y', 'z'].map((key, ax) => 1000 * (A[j][key] * (1 - t) + B[j][key] * t) + o.gainK * clampS(Math.max(S[j][ax][ia] ?? 0, S[j][ax][ib] ?? 0)) * zz[ax]);
        const lv = logit(A[j].visibility ?? 0) * (1 - t) + logit(B[j].visibility ?? 0) * t + o.gainVisSd * Math.max(-3, Math.min(3, zz[3]));
        g[j] = { x: c[0] / 1000, y: c[1] / 1000, z: c[2] / 1000, visibility: sigmoid(lv) };
      }
      out[i] = g; gained++;
    }
  }
  // 4. poses lost: start rate from DROP_TABLE (the source's context), runs extended with probability dropExt
  let dropped = 0;
  if (o.drop > 0) {
    const nullIdx = []; wl.forEach((f, i) => { if (!f) nullIdx.push(i); });
    const dist = new Array(n).fill(Infinity);
    for (let i = 0, p = 0; i < n; i++) { while (p + 1 < nullIdx.length && Math.abs(nullIdx[p + 1] - i) <= Math.abs(nullIdx[p] - i)) p++; if (nullIdx.length) dist[i] = Math.abs(nullIdx[p] - i); }
    const meanRun = 1 / (1 - o.dropExt);
    let extending = false;
    for (let i = 0; i < n; i++) {
      if (!wl[i] || !out[i]) { extending = false; continue; }
      let p;
      if (extending) p = o.dropExt;
      else {
        const d = dist[i];
        if (d <= 1) p = DROP_TABLE.near;
        else {
          const f1 = wl[i], f0 = i > 0 && wl[i - 1] ? wl[i - 1] : f1, f2 = i + 1 < n && wl[i + 1] ? wl[i + 1] : f1;
          let s = 0; for (const j of BODY) s += 1000 * Math.hypot(f1[j].x - (f0[j].x + f2[j].x) / 2, f1[j].y - (f0[j].y + f2[j].y) / 2, f1[j].z - (f0[j].z + f2[j].z) / 2);
          const jit = s / BODY.length;
          p = DROP_TABLE.jitter.find(r => jit < r.below).rates[d === 2 ? 0 : d <= 5 ? 1 : d <= 15 ? 2 : 3];
        }
        p = Math.min(1, (o.drop * p) / meanRun);
      }
      if (rng() < p) { out[i] = null; dropped++; extending = true; } else extending = false;
    }
  }
  const il = Array.isArray(set.imageLandmarks) ? set.imageLandmarks.map((x, i) => (out[i] && wl[i] ? x : null)) : set.imageLandmarks;
  return { worldLandmarks: out, timestamps: ts, imageLandmarks: il, dropped, gained };
}
