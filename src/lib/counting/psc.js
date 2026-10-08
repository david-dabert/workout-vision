/**
 * PSC, a class-agnostic rep counter (Periodic Signal Consensus), built 7-8 October 2026 on the bench (TRIED.md). In the
 * app since 8 October only as a proposal on a set the core refused (pscProposal below, coreAnalysis.js withProposal): a
 * number to confirm on the low-confidence screen, never a silent count (R8). The bench imports it from here
 * (test/real-phone/psc/psc.test.ts, test/real-phone/learned-phase/). It counts a set from the pose alone, without knowing the exercise: no joint, rest side or
 * threshold is chosen per exercise. Stages (the design of the research report of 7 October):
 *  A. two poses per frame to keep the lifter: skipped, the stored landmarks hold one pose (numPoses 1).
 *  B. a bank of candidate signals (3D and, when stored, image-plane joint angles both sides, trunk to vertical, limb
 *     positions relative to the mid-hip in torso lengths, hip height above the ankles, limb distances); a landmark under
 *     VIS_MIN visibility is unseen; outliers against a 5-sample median removed; gaps up to BRIDGE_SEC bridged while
 *     resampling to FS; Savitzky-Golay smoothing; robust z; a signal seen under MIN_COVERAGE of the set is dropped.
 *  C. the period: the set's self-similarity S(i, j) = -mean over signals seen at both of (e_i - e_j)^2, its lag profile
 *     A(tau) = mean_i S(i, i + tau) for tau in [LAG_MIN_SEC, LAG_MAX_SEC] (read as a correlation: 1 - A over the pairs'
 *     energy about each signal's mean), the
 *     shortest peak within HARMONIC of the best (a period, not two); twice: equal weights, then each signal weighted by
 *     its stage D score; a local period over windows of 3 periods.
 *  D. the signal that carries the rep: score = P x log(1 + SNR) x coverage, P = ACF(tau) - max(0, ACF(tau / 2)),
 *     SNR = (p95 - p5) / std(high-pass residual); the best, with every signal correlated at |r| >= CONSENSUS_R, sign
 *     aligned and averaged; alternation when the best signal and its mirror move half a period apart.
 *  E. the active segment: the longest run of local lag score above ACTIVE_THETA, joined across gaps under 2 periods.
 *  F. the count: hysteresis inside the signal's own p10-p90 band; a cycle leaves the rest side and returns; amplitude at
 *     least AMP_SHARE of the median; spacing at least SPACING_SHARE of the local period; edge fragments by the core's
 *     HEAD_RETURN_SHARE and CUT_RETURN_SHARE, about one period from their neighbour; a count that differs from
 *     duration / period by 2 or more is marked to confirm.
 *  G. fusion with the motion rhythm (motionRhythm.js) where gray frames are stored (fusePsc).
 * Every constant below: Source UNSOURCED unless named; Status experimental (R9). None was tuned on the sets it is
 * measured on: the values are the research report's, set before the first run.
 */

/** Resampling rate, samples per second: the app's TARGET_FPS (src/lib/extractionConfig.js). Status: convention. */
export const FS = 15;
/** A landmark under this visibility is unseen: the threshold run-public.mjs and the core use. Status: convention. */
export const VIS_MIN = 0.5;
/** Gaps bridged up to this length, as the core bridges. Status: experimental. */
export const BRIDGE_SEC = 0.5;
/** Signals seen on fewer samples are dropped. UNSOURCED, experimental. */
export const MIN_COVERAGE = 0.7;
/** Period range: motionRhythm.js MIN_PERIOD_SEC / MAX_PERIOD_SEC. UNSOURCED, experimental. */
export const LAG_MIN_SEC = 0.8;
export const LAG_MAX_SEC = 8;
/** Harmonic guard: motionRhythm.js HARMONIC_SHARE. UNSOURCED, experimental. */
export const HARMONIC = 0.85;
/** Sub-harmonic guard: a peak near half the chosen lag holding this share of its score wins. UNSOURCED, experimental. */
export const SUBHARMONIC = 0.6;
/** Consensus with the best signal. UNSOURCED, experimental. */
export const CONSENSUS_R = 0.7;
/** Active segment: local lag score above this. UNSOURCED, experimental. */
export const ACTIVE_THETA = 0.3;
/** Hysteresis: a cycle starts above WORK_AT and ends below REST_AT of the p10-p90 band. UNSOURCED, experimental. */
export const REST_AT = 0.3;
export const WORK_AT = 0.7;
/** A cycle's amplitude at least this share of the median accepted. UNSOURCED, experimental. */
export const AMP_SHARE = 0.5;
/** Cycles at least this share of the local period apart. UNSOURCED, experimental. */
export const SPACING_SHARE = 0.5;
/** Edge fragments: the core's values (src/lib/counting/core.ts HEAD_RETURN_SHARE, CUT_RETURN_SHARE). Experimental. */
export const HEAD_RETURN_SHARE = 0.5;
export const CUT_RETURN_SHARE = 0.7;
/** Alternation: corr below, phase within 0.5 +- ALT_PHASE_TOL, both sides seen. UNSOURCED, experimental. */
export const ALT_CORR = -0.3;
export const ALT_PHASE_TOL = 0.15;
export const ALT_MIN_SEEN = 0.8;
/** Fusion (G): periods within this share are one period; under this pose coverage the rhythm is offered. UNSOURCED. */
export const G_PERIOD_TOL = 0.15;
export const G_COVERAGE = 0.8;

const L = { sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27, ft: 31 };
const R = { sh: 12, el: 14, wr: 16, hip: 24, kn: 26, an: 28, ft: 32 };
const NOSE = 0;

const quantile = (xs, q) => {
  if (!xs.length) return NaN;
  const s = Float64Array.from(xs).sort();
  const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};
const median = xs => quantile(xs, 0.5);
const finite = xs => xs.filter(Number.isFinite);

// ─── B. Signal bank ───

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = v => Math.hypot(v[0], v[1], v[2]);
const angle = (a, b, c) => {
  const u = sub(a, b), v = sub(c, b), n = norm(u) * norm(v);
  return n > 0 ? (Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / n))) * 180) / Math.PI : NaN;
};
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

/**
 * The signal definitions: name, the landmarks it needs seen, mirror name (for alternation), and fn(P) where P(i) is
 * the point [x, y, z] (z 0 in the image plane). `lateral` x positions of the right side are negated, so a mirror pair
 * moves the same way when the body moves symmetrically.
 */
function definitions() {
  const defs = [];
  for (const [side, S, other] of [['L', L, 'R'], ['R', R, 'L']]) {
    const sgn = side === 'L' ? 1 : -1;
    const ang = (name, a, b, c) => defs.push({ name: `${name}${side}`, mirror: `${name}${other}`, need: [a, b, c], fn: P => angle(P(a), P(b), P(c)) });
    ang('elbow', S.sh, S.el, S.wr);
    ang('shoulder', S.hip, S.sh, S.el);
    ang('hip', S.sh, S.hip, S.kn);
    ang('knee', S.hip, S.kn, S.an);
    ang('ankle', S.kn, S.an, S.ft);
    for (const [part, i] of [['wrist', S.wr], ['elbow', S.el], ['knee', S.kn], ['ankle', S.an]]) {
      const need = [i, 11, 12, 23, 24];
      defs.push({ name: `${part}X${side}`, mirror: `${part}X${other}`, need, rel: true, fn: (P, hipM, torso) => (sgn * (P(i)[0] - hipM[0])) / torso });
      defs.push({ name: `${part}Y${side}`, mirror: `${part}Y${other}`, need, rel: true, fn: (P, hipM, torso) => (P(i)[1] - hipM[1]) / torso });
    }
    defs.push({ name: `wristShoulder${side}`, mirror: `wristShoulder${other}`, need: [S.wr, S.sh, 11, 12, 23, 24], rel: true, fn: (P, _h, torso) => norm(sub(P(S.wr), P(S.sh))) / torso });
    defs.push({ name: `wristHip${side}`, mirror: `wristHip${other}`, need: [S.wr, S.hip, 11, 12, 23, 24], rel: true, fn: (P, _h, torso) => norm(sub(P(S.wr), P(S.hip))) / torso });
  }
  defs.push({ name: 'trunk', need: [11, 12, 23, 24], fn: P => { const v = sub(mid(P(11), P(12)), mid(P(23), P(24))), n = norm(v); return n > 0 ? (Math.acos(Math.max(-1, Math.min(1, -v[1] / n))) * 180) / Math.PI : NaN; } });
  defs.push({ name: 'noseX', need: [NOSE, 11, 12, 23, 24], rel: true, fn: (P, hipM, torso) => (P(NOSE)[0] - hipM[0]) / torso });
  defs.push({ name: 'noseY', need: [NOSE, 11, 12, 23, 24], rel: true, fn: (P, hipM, torso) => (P(NOSE)[1] - hipM[1]) / torso });
  defs.push({ name: 'wristWrist', need: [15, 16, 11, 12, 23, 24], rel: true, fn: (P, _h, torso) => norm(sub(P(15), P(16))) / torso });
  defs.push({ name: 'ankleAnkle', need: [27, 28, 11, 12, 23, 24], rel: true, fn: (P, _h, torso) => norm(sub(P(27), P(28))) / torso });
  defs.push({ name: 'hipHeight', need: [23, 24, 27, 28, 11, 12], rel: true, fn: (P, hipM, torso) => (mid(P(27), P(28))[1] - hipM[1]) / torso });
  return defs;
}
const DEFS = definitions();
// Image-only signals: the mid-hip and mid-shoulder height in the frame (whole-body rise and fall).
const IMAGE_ONLY = [
  { name: 'midHipY', need: [23, 24], fn: P => mid(P(23), P(24))[1] },
  { name: 'midShoulderY', need: [11, 12], fn: P => mid(P(11), P(12))[1] },
];

/**
 * Raw signals of a set, at its own sample times: { name, mirror, values (NaN where unseen) }.
 * @param {Array<Array<{x:number,y:number,z:number,visibility?:number}> | null>} wl world landmarks per sample
 * @param {Array<number[] | null> | null} image flat [x0, y0, x1, y1, ...] image landmarks per sample, or null
 */
export function rawSignals(wl, image, { useImage = true } = {}) {
  const out = [];
  const seen = (f, i) => f && f[i] && (f[i].visibility ?? 1) >= VIS_MIN;
  const build = (defs, prefix, point) => {
    for (const d of defs) {
      const values = new Float64Array(wl.length).fill(NaN);
      for (let t = 0; t < wl.length; t++) {
        const f = wl[t];
        if (!f || !d.need.every(i => seen(f, i))) continue;
        const P = i => point(t, i);
        if (!P(d.need[0])) continue;
        let hipM = null, torso = 1;
        if (d.rel) { hipM = mid(P(23), P(24)); torso = norm(sub(mid(P(11), P(12)), hipM)); if (!(torso > 1e-6)) continue; }
        values[t] = d.fn(P, hipM, torso);
      }
      out.push({ name: prefix + d.name, mirror: d.mirror ? prefix + d.mirror : null, values });
    }
  };
  build(DEFS, 'w.', (t, i) => { const p = wl[t][i]; return [p.x, p.y, p.z]; });
  if (useImage && image && image.some(Boolean)) {
    const pt = (t, i) => (image[t] ? [image[t][2 * i], image[t][2 * i + 1], 0] : null);
    build([...DEFS, ...IMAGE_ONLY], 'i.', pt);
  }
  return out;
}

/** Quadratic Savitzky-Golay, 5 points (Savitzky & Golay 1964, Anal Chem 36:1627, table): status literature. */
const SG5 = [-3, 12, 17, 12, -3].map(c => c / 35);

/**
 * One raw signal to the uniform grid: outliers out, bridged and resampled, smoothed, robust z; with its coverage and SNR.
 * @param {Float64Array} values @param {number[]} ts @param {number[]} grid
 */
export function conditionSignal(values, ts, grid) {
  const n = values.length;
  const v = Float64Array.from(values);
  // Outliers: a sample far from the median of its 5-sample neighbourhood (5 robust sigmas of those residuals, and
  // over a tenth of the signal's 5-95 % span). UNSOURCED, experimental.
  const res = new Float64Array(n).fill(NaN);
  for (let t = 0; t < n; t++) {
    if (!Number.isFinite(v[t])) continue;
    const nb = [];
    for (let k = Math.max(0, t - 2); k <= Math.min(n - 1, t + 2); k++) if (Number.isFinite(values[k])) nb.push(values[k]);
    if (nb.length >= 3) res[t] = v[t] - median(nb);
  }
  const rs = finite(Array.from(res));
  if (rs.length >= 10) {
    const sig = 1.4826 * median(rs.map(Math.abs)), span = quantile(finite(Array.from(values)), 0.95) - quantile(finite(Array.from(values)), 0.05);
    for (let t = 0; t < n; t++) if (Math.abs(res[t]) > 5 * sig && Math.abs(res[t]) > 0.1 * span) v[t] = NaN;
  }
  // Resample to the grid, interpolating between valid samples no more than BRIDGE_SEC (plus one sample) apart.
  const G = grid.length, g = new Float64Array(G).fill(NaN);
  const valid = [];
  for (let t = 0; t < n; t++) if (Number.isFinite(v[t])) valid.push(t);
  let j = 0;
  for (let k = 0; k < G; k++) {
    const tk = grid[k];
    while (j + 1 < valid.length && ts[valid[j + 1]] <= tk) j++;
    if (!valid.length) break;
    const a = valid[j];
    if (Math.abs(ts[a] - tk) < 1e-9) { g[k] = v[a]; continue; }
    const b = valid[j + 1];
    if (ts[a] <= tk && b !== undefined && ts[b] >= tk && ts[b] - ts[a] <= BRIDGE_SEC + 1.5 / FS) {
      const w = (tk - ts[a]) / (ts[b] - ts[a]);
      g[k] = v[a] + w * (v[b] - v[a]);
    }
  }
  const s = new Float64Array(G).fill(NaN);
  for (let k = 0; k < G; k++) {
    if (!Number.isFinite(g[k])) continue;
    let ok = k >= 2 && k + 2 < G, acc = 0;
    for (let d = -2; ok && d <= 2; d++) { if (!Number.isFinite(g[k + d])) ok = false; else acc += SG5[d + 2] * g[k + d]; }
    s[k] = ok ? acc : g[k];
  }
  const seen = finite(Array.from(s));
  const coverage = seen.length / Math.max(1, G);
  const m = median(seen);
  let scale = 1.4826 * median(seen.map(x => Math.abs(x - m)));
  if (!(scale > 1e-9)) { const mu = seen.reduce((a, x) => a + x, 0) / (seen.length || 1); scale = Math.sqrt(seen.reduce((a, x) => a + (x - mu) ** 2, 0) / (seen.length || 1)); }
  if (!(scale > 1e-9) || seen.length < 8) return null;
  const z = s.map(x => (x - m) / scale);
  const hp = [];
  for (let k = 0; k < G; k++) if (Number.isFinite(g[k]) && Number.isFinite(s[k])) hp.push((g[k] - s[k]) / scale);
  const zs = finite(Array.from(z));
  const muHp = hp.reduce((a, x) => a + x, 0) / (hp.length || 1);
  const noise = Math.sqrt(hp.reduce((a, x) => a + (x - muHp) ** 2, 0) / (hp.length || 1));
  const snr = (quantile(zs, 0.95) - quantile(zs, 0.05)) / Math.max(noise, 1e-3);
  return { z, coverage, snr };
}

/** The bank on the uniform grid: { names, mirror, z[], coverage[], snr[], grid }. */
export function signalBank(wl, ts, image, opts = {}) {
  const t0 = ts[0], t1 = ts[ts.length - 1];
  const G = Math.max(1, Math.floor((t1 - t0) * FS + 1e-6) + 1);
  const grid = Array.from({ length: G }, (_, k) => t0 + k / FS);
  const sigs = [];
  for (const r of rawSignals(wl, image, opts)) {
    const c = conditionSignal(r.values, ts, grid);
    if (c && c.coverage >= MIN_COVERAGE) sigs.push({ name: r.name, mirror: r.mirror, ...c });
  }
  return { grid, sigs };
}

// ─── C. Period from the self-similarity lag profile ───

/** r(tau) = 1 - sum w (z_i - z_{i+tau})^2 / sum w ((z_i - m)^2 + (z_{i+tau} - m)^2), over i and signals seen at both. */
export function lagProfile(sigs, weights, lo, hi, from = 0, to = Infinity) {
  // Normalised by the energy of the pairs about each signal's mean (a normalised squared-difference function), so the
  // profile reads as a correlation in [-1, 1] whatever the spread of the robust z.
  const prof = new Float64Array(hi + 1).fill(NaN);
  const G = sigs.length ? sigs[0].z.length : 0, end = Math.min(G, to);
  const means = sigs.map(s => { let a = 0, n = 0; for (const x of s.z) if (x === x) { a += x; n++; } return n ? a / n : 0; });
  for (let tau = lo; tau <= hi; tau++) {
    let num = 0, den = 0;
    for (let k = 0; k < sigs.length; k++) {
      const w = weights[k];
      if (!(w > 0)) continue;
      const z = sigs[k].z, m = means[k];
      for (let i = Math.max(0, from); i + tau < end; i++) {
        const a = z[i], b = z[i + tau];
        if (a === a && b === b) { const d = a - b; num += w * d * d; den += w * ((a - m) ** 2 + (b - m) ** 2); }
      }
    }
    if (den > 0) prof[tau] = 1 - num / den;
  }
  return prof;
}

/** The shortest peak within HARMONIC of the best, refined by a parabola. null when no positive peak. */
export function pickPeriod(prof, lo, hi) {
  // A peak is a lag above both neighbours; the profile is computed one lag beyond each end of the range, so a profile
  // still falling at the shortest lag (or rising at the longest) has no peak there.
  const peaks = [];
  for (let l = Math.max(lo, 1); l <= hi; l++) {
    const a = prof[l - 1], b = prof[l], c = prof[l + 1];
    if (b > 0 && Number.isFinite(a) && Number.isFinite(c) && b >= a && b > c) peaks.push(l);
  }
  if (!peaks.length) return null;
  const best = Math.max(...peaks.map(l => prof[l]));
  let lag = peaks.find(l => prof[l] >= HARMONIC * best);
  // Sub-harmonic check (added 7 October after the first synthetic run, where the set repeated slightly better every
  // second rep): a peak at 0.4 to 0.6 of the chosen lag holding SUBHARMONIC of its score is the period. Experimental.
  const half = peaks.find(l => l >= 0.4 * lag && l <= 0.6 * lag && prof[l] >= SUBHARMONIC * prof[lag] && prof[l] > 0.3);
  if (half !== undefined) lag = half;
  const a = prof[lag - 1], b = prof[lag], c = prof[lag + 1];
  let off = 0;
  if (Number.isFinite(a) && Number.isFinite(c) && a - 2 * b + c < 0) off = Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / (a - 2 * b + c)));
  return { lag: lag + off, score: b, best };
}

/** Pearson autocorrelation of one signal at an integer lag over the pairs seen at both. */
export function acfAt(z, lag) {
  lag = Math.round(lag);
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let i = 0; i + lag < z.length; i++) {
    const a = z[i], b = z[i + lag];
    if (a === a && b === b) { n++; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; }
  }
  if (n < 4) return 0;
  const va = saa - (sa * sa) / n, vb = sbb - (sb * sb) / n;
  return va > 0 && vb > 0 ? (sab - (sa * sb) / n) / Math.sqrt(va * vb) : 0;
}
/** Pearson correlation of two signals at a lag (b shifted later by lag). */
export function corrAt(x, y, lag = 0) {
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let i = 0; i + lag < x.length; i++) {
    const a = x[i], b = y[i + lag];
    if (a === a && b === b) { n++; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b; }
  }
  if (n < 4) return 0;
  const va = saa - (sa * sa) / n, vb = sbb - (sb * sb) / n;
  return va > 0 && vb > 0 ? (sab - (sa * sb) / n) / Math.sqrt(va * vb) : 0;
}

const scoreSignal = (s, lag) => {
  const P = acfAt(s.z, lag) - Math.max(0, acfAt(s.z, lag / 2));
  return { P, score: Math.max(0, P) * Math.log(1 + s.snr) * s.coverage };
};

/** Local period and lag score, every half period, over windows of 3 periods; per grid sample (nearest window). */
export function localPeriod(sigs, weights, lag) {
  const G = sigs[0].z.length, half = Math.round(1.5 * lag), step = Math.max(1, Math.round(lag / 2));
  const lo = Math.max(2, Math.floor(0.7 * lag)), hi = Math.max(lo + 1, Math.ceil(1.4 * lag));
  const centres = [];
  for (let c = 0; c < G; c += step) {
    const prof = lagProfile(sigs, weights, lo, hi, c - half, c + half + 1);
    let bl = null, bs = -Infinity;
    for (let l = lo; l <= hi; l++) if (prof[l] > bs) { bs = prof[l]; bl = l; }
    centres.push({ c, lag: bl ?? lag, score: Number.isFinite(bs) ? bs : -1 });
  }
  const tau = new Float64Array(G), score = new Float64Array(G);
  for (let k = 0; k < G; k++) {
    const w = centres[Math.min(centres.length - 1, Math.round(k / step))];
    tau[k] = w.lag; score[k] = w.score;
  }
  return { tau, score };
}

// ─── E. Active segment ───

export function activeSegment(score, lag, theta = ACTIVE_THETA) {
  const G = score.length, runs = [];
  let start = -1;
  for (let k = 0; k <= G; k++) {
    const on = k < G && score[k] > theta;
    if (on && start < 0) start = k;
    if (!on && start >= 0) { runs.push([start, k - 1]); start = -1; }
  }
  if (!runs.length) return null;
  const joined = [runs[0].slice()];
  for (const r of runs.slice(1)) {
    const last = joined[joined.length - 1];
    if (r[0] - last[1] < 2 * lag) last[1] = r[1]; else joined.push(r.slice());
  }
  return joined.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
}

// ─── F. Count ───

/**
 * Cycles of one signal between grid samples a and b (inclusive): { count, cycles: [{ start, peak, end, amp, edge? }] }.
 * @param {Float64Array} s @param {Float64Array} tau local period per sample
 */
export function countCycles(s, a, b, tau, { lag }) {
  const seg = [];
  for (let k = a; k <= b; k++) if (Number.isFinite(s[k])) seg.push(s[k]);
  if (seg.length < 8) return { count: 0, cycles: [], rest: null };
  const p10 = quantile(seg, 0.1), p90 = quantile(seg, 0.9), span = p90 - p10;
  if (!(span > 0)) return { count: 0, cycles: [], rest: null };
  // The rest side: where the segment starts and ends (half a period at each end, averaged), when that is clearly one
  // side of the band (a set starts and ends at rest); else where the signal spends most of its time (the median's
  // side). The median alone fails on reps with no pause at either end (a sinusoid). Experimental (7 October).
  const edgeN = Math.max(2, Math.round(lag / 2)), ends = [];
  for (let k = a; k < Math.min(b + 1, a + edgeN); k++) if (Number.isFinite(s[k])) ends.push((s[k] - p10) / span);
  for (let k = Math.max(a, b - edgeN + 1); k <= b; k++) if (Number.isFinite(s[k])) ends.push((s[k] - p10) / span);
  const endLevel = ends.length ? ends.reduce((x, y) => x + y, 0) / ends.length : 0.5;
  const restLow = endLevel < 0.4 ? true : endLevel > 0.6 ? false : median(seg) <= (p10 + p90) / 2;
  const u = k => (Number.isFinite(s[k]) ? (restLow ? (s[k] - p10) / span : (p90 - s[k]) / span) : NaN);
  const cand = [];
  let state = null, cur = null, head = null;
  for (let k = a; k <= b; k++) {
    const x = u(k);
    if (!Number.isFinite(x)) continue;
    if (state === null) { state = x >= WORK_AT ? 'work' : x <= REST_AT ? 'rest' : 'between'; if (state === 'work') { head = { start: k, peak: k, top: x }; cur = null; } continue; }
    if (state !== 'work') {
      if (x <= REST_AT) { if (state !== 'rest' || !cur || x < cur.low) cur = { start: k, low: x }; state = 'rest'; }
      if (x >= WORK_AT) { state = 'work'; if (!cur) cur = { start: k, low: x }; cur.peak = k; cur.top = x; }
      continue;
    }
    // In the work zone: track the top; a return below REST_AT closes the cycle.
    if (head && !cur) { if (x > head.top) { head.top = x; head.peak = k; } }
    else if (x > cur.top) { cur.top = x; cur.peak = k; }
    if (x <= REST_AT) {
      if (head && !cur) { head.end = k; head.low = x; head.done = true; }
      else cand.push({ start: cur.start, peak: cur.peak, end: k, amp: cur.top - Math.max(cur.low, x) });
      state = 'rest'; cur = { start: k, low: x };
    }
  }
  const medAmp = median(cand.map(c => c.amp));
  const accepted = [];
  for (const c of cand) {
    if (cand.length >= 2 && c.amp < AMP_SHARE * medAmp) continue;
    const prev = accepted[accepted.length - 1];
    if (prev && c.peak - prev.peak < SPACING_SHARE * tau[c.peak]) { if (c.amp > prev.amp) accepted[accepted.length - 1] = c; continue; }
    accepted.push(c);
  }
  const ref = accepted.length ? median(accepted.map(c => c.amp)) : NaN;
  const near = (k, other) => other !== undefined && Math.abs(k - other) >= 0.5 * tau[k] && Math.abs(k - other) <= 1.5 * tau[k];
  // Head: the set opens in the work zone and its first move is the return to rest.
  if (head && head.done && accepted.length >= 2 && head.top - head.low >= HEAD_RETURN_SHARE * ref && near(head.peak, accepted[0].peak)) accepted.unshift({ start: head.start, peak: head.peak, end: head.end, amp: head.top - head.low, edge: 'head' });
  // Tail: the last excursion reached the work zone and came back at least CUT_RETURN_SHARE of the way.
  if (state === 'work' && cur && cur.peak !== undefined && accepted.length >= 2) {
    let lastX = NaN;
    for (let k = b; k >= a && !Number.isFinite(lastX); k--) lastX = u(k);
    const amp = cur.top - cur.low;
    if (amp >= AMP_SHARE * ref && cur.top - lastX >= CUT_RETURN_SHARE * amp && near(cur.peak, accepted[accepted.length - 1].peak)) accepted.push({ start: cur.start, peak: cur.peak, end: b, amp, edge: 'tail' });
  }
  return { count: accepted.length, cycles: accepted, rest: restLow ? 'low' : 'high' };
}

// ─── The counter ───

/**
 * Count a set from its pose alone.
 * @param {{ wl: any[], ts: number[], image?: Array<number[] | null> | null }} set
 * @param {{ stages?: { E?: boolean, D?: boolean, twoPass?: boolean }, useImage?: boolean }} [opts] stages.D false: the best signal
 *   alone, no consensus; stages.E false: the whole set; twoPass false: the period from equal weights only.
 * @returns {{ count: number | null, reps: { startTime: number, endTime: number }[], period: number | null, confirm: boolean, reasons: string[], segment: number[] | null,
 *   signals: string[], alternating: boolean, periodCount: number | null, coverage: number, bank: number }}
 */
export function pscCount({ wl, ts, image = null }, opts = {}) {
  const stages = { E: true, D: true, twoPass: true, detrend: false, ...(opts.stages || {}) };
  const coverage = wl.length ? wl.filter(Boolean).length / wl.length : 0;
  const none = reason => ({ count: null, reps: [], period: null, confirm: true, reasons: [reason], segment: null, signals: [], alternating: false, periodCount: null, coverage, bank: 0 });
  if (!ts || ts.length < 10) return none('too short');
  const { grid, sigs } = signalBank(wl, ts, image, { useImage: opts.useImage !== false });
  if (!sigs.length) return none('no signal seen');
  const G = grid.length;
  const lo = Math.max(2, Math.round(LAG_MIN_SEC * FS)), hi = Math.min(Math.floor(0.6 * G), Math.round(LAG_MAX_SEC * FS));
  if (hi <= lo) return { ...none('shorter than two periods'), bank: sigs.length };
  // C, pass 1: equal weights.
  let weights = sigs.map(() => 1);
  let per = pickPeriod(lagProfile(sigs, weights, lo - 1, hi + 1), lo, hi);
  if (!per) return { ...none('no period'), bank: sigs.length };
  // D scores at that period; C, pass 2: each signal weighted by its score.
  let scored = sigs.map(s => scoreSignal(s, per.lag));
  if (stages.twoPass) {
    const w2 = scored.map(x => x.score);
    if (w2.some(w => w > 0)) {
      const p2 = pickPeriod(lagProfile(sigs, w2, lo - 1, hi + 1), lo, hi);
      if (p2) { per = p2; weights = w2; scored = sigs.map(s => scoreSignal(s, per.lag)); }
    }
  }
  const lag = per.lag;
  const local = localPeriod(sigs, weights, lag);
  // D: the best signal and its consensus.
  const order = sigs.map((s, k) => ({ k, ...scored[k] })).sort((x, y) => y.score - x.score);
  const best = order[0];
  if (!(best.score > 0)) return { ...none('no signal periodic at the period'), period: lag / FS, bank: sigs.length };
  const bs = sigs[best.k];
  const members = [{ k: best.k, sign: 1 }];
  if (stages.D) for (const o of order.slice(1)) {
    if (!(o.score > 0)) continue;
    const r = corrAt(bs.z, sigs[o.k].z);
    if (Math.abs(r) >= CONSENSUS_R) members.push({ k: o.k, sign: Math.sign(r) });
  }
  const s = new Float64Array(G).fill(NaN);
  for (let t = 0; t < G; t++) {
    let acc = 0, n = 0;
    for (const m of members) { const v = sigs[m.k].z[t]; if (v === v) { acc += m.sign * v; n++; } }
    if (n) s[t] = acc / n;
  }
  // Slow drift (walking in, the camera or the body settling) removed with a centred mean over one period, as
  // motionRhythm.js does (stage F reads the signal's own band, which a drift would stretch). Experimental (7 October).
  if (stages.detrend) {
    const w = Math.max(1, Math.round(lag / 2)), trend = new Float64Array(G).fill(NaN);
    for (let t = 0; t < G; t++) {
      let acc = 0, n = 0;
      for (let k = Math.max(0, t - w); k <= Math.min(G - 1, t + w); k++) if (s[k] === s[k]) { acc += s[k]; n++; }
      if (n) trend[t] = acc / n;
    }
    for (let t = 0; t < G; t++) s[t] -= trend[t];
  }
  // E: active segment, widened by one period each side.
  let a = 0, b = G - 1;
  const reasons = [];
  if (stages.E) {
    const seg = activeSegment(local.score, lag);
    if (seg) { a = Math.max(0, Math.floor(seg[0] - lag)); b = Math.min(G - 1, Math.ceil(seg[1] + lag)); }
    else reasons.push('no active segment');
  }
  // Alternation: a mirrored pair (the best signal's, else the best-scoring other pair among the angles, vertical
  // positions and distances), each periodic at the period, anticorrelated, half a period apart, both well seen.
  // Lateral (X) positions are left out: a mirrored lateral pair moving one way reads as anti-phase on any sinusoid.
  let alternating = false, count, sides = null, cycles = [];
  const byName = new Map(sigs.map((x, k) => [x.name, k]));
  const pairs = [];
  for (const o of order) {
    const x = sigs[o.k];
    if (!x.mirror || /X[LR]$/.test(x.name) || !(o.score > 0) || !byName.has(x.mirror)) continue;
    const m = byName.get(x.mirror);
    if (pairs.some(p => p[1] === o.k)) continue;
    pairs.push([o.k, m]);
  }
  // The pair that carries the rep best (the higher of its two sides' scores' minimum) decides: anti-phase, alternating;
  // in phase, not (a body that sways can make a weaker pair, the hips, read anti-phase).
  pairs.sort((p, q) => Math.min(scored[q[0]].score, scored[q[1]].score) - Math.min(scored[p[0]].score, scored[p[1]].score));
  for (const [k, m] of pairs) {
    const x = sigs[k], ms = sigs[m];
    // Both sides carry the rep: periodic at the period, each scoring at least half the best signal's score.
    if (!(scored[k].P > 0.3 && scored[m].P > 0.3 && scored[k].score >= 0.5 * best.score && scored[m].score >= 0.5 * best.score)) continue;
    let bl = 0, br = -Infinity;
    for (let l = 0; l < Math.round(lag); l++) { const r = corrAt(x.z, ms.z, l); if (r > br) { br = r; bl = l; } }
    if (corrAt(x.z, ms.z) < ALT_CORR && x.coverage >= ALT_MIN_SEEN && ms.coverage >= ALT_MIN_SEEN && Math.abs(bl / lag - 0.5) <= ALT_PHASE_TOL) {
      const c1 = countCycles(x.z, a, b, local.tau, { lag }), c2 = countCycles(ms.z, a, b, local.tau, { lag });
      alternating = true; sides = [c1.count, c2.count]; cycles = [...c1.cycles, ...c2.cycles];
      count = c1.count + c2.count;
      if (Math.abs(c1.count - c2.count) > 1) reasons.push('sides differ');
    }
    break;
  }
  if (!alternating) ({ count, cycles } = countCycles(s, a, b, local.tau, { lag }));
  const duration = (b - a) / FS, periodCount = Math.round(duration / (lag / FS)) * (alternating ? 2 : 1);
  if (Math.abs(count - periodCount) >= 2 * (alternating ? 2 : 1)) reasons.push('count and period disagree');
  // Each counted cycle's start and end, in the set's seconds (a window's count reads them: countInWindow).
  const reps = cycles.map(c => ({ startTime: grid[c.start], endTime: grid[c.end] })).sort((p, q) => p.startTime - q.startTime);
  return { count, reps, period: Math.round((lag / FS) * 100) / 100, confirm: reasons.length > 0, reasons, segment: [grid[a], grid[b]], signals: members.map(m => sigs[m.k].name), alternating, sides, periodCount, coverage, bank: sigs.length };
}

/**
 * G. PSC with the motion rhythm (motionRhythm.js motionCount) where gray frames are stored. Never a grade (R8).
 * @returns {{ count: number | null, source: 'psc' | 'rhythm' | 'none', confident: boolean, reason: string }}
 */
export function fusePsc(psc, rhythm) {
  const found = !!rhythm && rhythm.period != null && rhythm.count > 0;
  if (psc.count === null) return found ? { count: rhythm.count, source: 'rhythm', confident: false, reason: 'no pose period: rhythm to confirm' } : { count: null, source: 'none', confident: false, reason: 'nothing' };
  if (psc.coverage < G_COVERAGE && found) return { count: rhythm.count, source: 'rhythm', confident: false, reason: 'pose coverage low: rhythm to confirm' };
  if (found && rhythm.count === psc.count && Math.abs(rhythm.period - psc.period) <= G_PERIOD_TOL * psc.period && !psc.confirm) return { count: psc.count, source: 'psc', confident: true, reason: 'agree' };
  return { count: psc.count, source: 'psc', confident: false, reason: found ? (rhythm.count === psc.count ? 'periods differ or psc unsure' : 'disagree') : 'no rhythm' };
}

/**
 * The app's use of PSC (8 October 2026, delegated decision of David, R8): where the core refuses a set, PSC's count is
 * offered on the low-confidence screen as a number to confirm, never a silent count, never a grade, never a measure.
 * Reads only the set's stored landmarks: world landmarks, timestamps (seconds) and, when kept, the image landmarks
 * ({x, y} objects, flattened here to PSC's [x0, y0, x1, y1, ...]; or imageXY, already flat, as the public sets keep them). Returns null when PSC finds no rep (no proposal).
 * Shipped on the official variant evaluation (TRIED.md, 8 October): validated as a proposal on refused sets only.
 * @param {{ worldLandmarks?: any[], imageLandmarks?: any[] | null, imageXY?: Array<number[] | null> | null, timestamps?: number[] }} set
 * @returns {{ count: number, reps: { startTime: number, endTime: number }[], period: number | null, confirm: boolean } | null}
 */
export function pscProposal({ worldLandmarks = [], imageLandmarks = null, imageXY = null, timestamps = [] } = {}) {
  if (!worldLandmarks.length || worldLandmarks.length !== timestamps.length) return null;
  const fits = a => Array.isArray(a) && a.length === worldLandmarks.length && a.some(Boolean);
  const image = fits(imageXY) ? imageXY
    : fits(imageLandmarks) ? imageLandmarks.map(f => (f ? f.flatMap(p => [p.x, p.y]) : null))
      : null;
  let r;
  try { r = pscCount({ wl: worldLandmarks, ts: timestamps, image }); } catch { return null; }
  if (!Number.isInteger(r.count) || r.count < 1) return null;
  return { count: r.count, reps: r.reps, period: r.period, confirm: r.confirm };
}
