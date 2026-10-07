/**
 * A second count of a set, from image motion alone, with no skeleton: a rep is a periodic motion, so the shrunk
 * grayscale frames of a set repeat once per rep. Built 7 October as a cross-check of the skeleton's count, measured
 * on the bench only (test/real-phone/motion/, TRIED.md of 7 October). Nothing in the app imports this module: no
 * screen shows its number (R8), and no count of the app depends on it.
 *
 * Method (classical, in the spirit of RepNet's self-similarity, Dwibedi et al., CVPR 2020, without its network):
 *  1. Region: the box around the poses found in the set (5th to 95th percentile of their extents, widened by
 *     ROI_PAD of its size), or the whole frame when fewer than ROI_MIN_POSES of the samples hold a pose.
 *  2. Each frame's region is shrunk to GRID x GRID gray values; the frames are centred on their mean over the set.
 *  3. The first PCS principal components of that frame stack over time (power iteration on the T x T Gram matrix)
 *     give PCS 1-D signals. The period is where the frames repeat: the autocorrelation of all components together,
 *     weighted by their variance, between MIN_PERIOD_SEC and MAX_PERIOD_SEC (shortest lag within HARMONIC_SHARE of
 *     the highest peak). The component that carries the rep is the one with the highest autocorrelation at the period
 *     minus that at half of it (a component that bulges twice per rep scores near 0).
 *  4. That component, minus its centred mean over one period (slow drift: walking in, lighting), is smoothed over
 *     SMOOTH_SHARE of the period. The rest side is where the set spends most of its time (the median); one rep is one
 *     excursion away from it: a peak on the far side with a prominence of at least PROMINENCE_SHARE of the signal's
 *     5-95 % span, at least SPACING_SHARE of a period after the last one. The first and last samples are never peaks.
 *  5. Confidence: the joint autocorrelation at the period (0 to 1), lowered by the irregularity of the intervals
 *     between counted peaks (their coefficient of variation).
 *  Older modes kept for the record (opts.mode): 'pc' (the single most periodic component), 'rest' (distance from the
 *  first frames); both worse on David's videos (TRIED.md, 7 October).
 *
 * Thresholds. Source: UNSOURCED (chosen on 7 October from typical rep durations of about 1 to 6 s at the app's 15
 * samples per second). Status: experimental. Three rules (the period's component, the median rest side, no peak at the
 * end samples) were set while looking at David's five real videos, which are therefore not a held-out test; MM-Fit
 * w19 (8 sets) and five synthetic videos were run once after the rules were frozen (TRIED.md, 7 October).
 * Known limit (it.fails in __tests__/motionRhythm.test.js): reps that never pause at the rest can count one short.
 * Alternating lifts (one arm then the other) repeat once per pair: the motion count is half the label. Rule of
 * 7 October (opts.alternating, which the caller sets for a lift the catalogue counts on both sides, `bothSides` in
 * core.ts liftDefinition: the alternating curl, the walking lunge, the dead bug...): the region is cut into its left and
 * right halves, each half's rep component is counted over the same period (alternationPhase), and when the two halves
 * turn half a period apart (anti-phase: one side works while the other rests) each counted period holds two reps, so
 * the count doubles. When they turn together (both sides in each half, as from the side) the count is left as it is.
 */

export const GRID = 24;
export const PCS = 3;
export const ROI_PAD = 0.15;
export const ROI_MIN_POSES = 0.3;
export const MIN_PERIOD_SEC = 0.8;
export const MAX_PERIOD_SEC = 8;
export const SMOOTH_SHARE = 0.2;
export const PROMINENCE_SHARE = 0.35;
export const SPACING_SHARE = 0.5;
/** The rest is read on the first REST_EDGE_SEC of the set (restAt 'start'; 'end' or 'ends' on option). */
export const REST_EDGE_SEC = 0.5;
/** Lag-1 autocorrelation under which the signal is taken for frame noise, not motion. */
export const MIN_SMOOTHNESS = 0.5;
/** Within this share of the best autocorrelation peak, the shortest lag wins (a period, not two of them). */
export const HARMONIC_SHARE = 0.85;
/**
 * Alternating lifts: the left and right halves of the region are taken as anti-phase when their peaks lie, by median,
 * at least ALT_MIN_PHASE of a period from each other (0 = together, 0.5 = exactly alternating); each half is read on an
 * ALT_GRID x ALT_GRID grid. Source: UNSOURCED. Status: experimental (7 October; one real alternating set, MM-Fit w19's
 * curls, and synthetic alternating curls; test/real-phone/motion/motion.txt, test/real-phone/occlusion/).
 */
export const ALT_MIN_PHASE = 0.3;
export const ALT_GRID = 12;

const quantile = (xs, q) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};

/**
 * The region to read, in [0, 1] image coordinates [x0, y0, x1, y1], from the pose boxes of the set (null where a
 * sample has no pose). The whole frame when too few samples hold a pose.
 * @param {Array<number[] | null>} boxes
 */
export function roiFromBoxes(boxes, { pad = ROI_PAD, minShare = ROI_MIN_POSES } = {}) {
  const got = (boxes || []).filter(Boolean);
  if (!boxes?.length || got.length < minShare * boxes.length) return [0, 0, 1, 1];
  const x0 = quantile(got.map(b => b[0]), 0.05), y0 = quantile(got.map(b => b[1]), 0.05);
  const x1 = quantile(got.map(b => b[2]), 0.95), y1 = quantile(got.map(b => b[3]), 0.95);
  const pw = (x1 - x0) * pad, ph = (y1 - y0) * pad;
  const r = [Math.max(0, x0 - pw), Math.max(0, y0 - ph), Math.min(1, x1 + pw), Math.min(1, y1 + ph)];
  return r[2] - r[0] < 0.05 || r[3] - r[1] < 0.05 ? [0, 0, 1, 1] : r;
}

/**
 * The region of one gray frame (w x h, row-major bytes) shrunk to grid x grid by area averaging.
 * @param {ArrayLike<number>} frame
 */
export function shrinkRegion(frame, w, h, roi, grid = GRID) {
  const out = new Float64Array(grid * grid);
  const X0 = roi[0] * w, Y0 = roi[1] * h, cw = ((roi[2] - roi[0]) * w) / grid, ch = ((roi[3] - roi[1]) * h) / grid;
  for (let gy = 0; gy < grid; gy++) {
    const ya = Math.floor(Y0 + gy * ch), yb = Math.max(ya + 1, Math.min(h, Math.floor(Y0 + (gy + 1) * ch)));
    for (let gx = 0; gx < grid; gx++) {
      const xa = Math.floor(X0 + gx * cw), xb = Math.max(xa + 1, Math.min(w, Math.floor(X0 + (gx + 1) * cw)));
      let s = 0, n = 0;
      for (let y = Math.min(ya, h - 1); y < yb; y++) for (let x = Math.min(xa, w - 1); x < xb; x++) { s += frame[y * w + x]; n++; }
      out[gy * grid + gx] = n ? s / n : 0;
    }
  }
  return out;
}

/**
 * The first k principal components over time of a stack of vectors: k signals of length T, each scaled to unit
 * variance, strongest first, and the standard deviation of each (weights). Power iteration with deflation on the
 * centred T x T Gram matrix.
 * @param {Float64Array[]} vecs
 */
export function principalSignals(vecs, k = PCS) {
  const T = vecs.length;
  if (T < 3) return { signals: [], weights: [] };
  const d = vecs[0].length, mean = new Float64Array(d);
  for (const v of vecs) for (let j = 0; j < d; j++) mean[j] += v[j] / T;
  const c = vecs.map(v => v.map((x, j) => x - mean[j]));
  const G = Array.from({ length: T }, () => new Float64Array(T));
  for (let a = 0; a < T; a++) for (let b = a; b < T; b++) {
    let s = 0; const va = c[a], vb = c[b];
    for (let j = 0; j < d; j++) s += va[j] * vb[j];
    G[a][b] = s; G[b][a] = s;
  }
  const signals = [], weights = [];
  for (let comp = 0; comp < k; comp++) {
    let u = new Float64Array(T).map((_, i) => Math.sin(i * 0.37 + comp) + 1.1);
    let lambda = 0;
    for (let it = 0; it < 200; it++) {
      const nu = new Float64Array(T);
      for (let a = 0; a < T; a++) { let s = 0; const g = G[a]; for (let b = 0; b < T; b++) s += g[b] * u[b]; nu[a] = s; }
      const norm = Math.hypot(...nu);
      if (!(norm > 1e-12)) break;
      for (let a = 0; a < T; a++) nu[a] /= norm;
      const delta = nu.reduce((s, x, i) => s + Math.abs(x - u[i]), 0);
      u = nu; lambda = norm;
      if (delta < 1e-9) break;
    }
    if (!(lambda > 1e-9)) break;
    for (let a = 0; a < T; a++) for (let b = 0; b < T; b++) G[a][b] -= lambda * u[a] * u[b];
    const m = u.reduce((s, x) => s + x, 0) / T, sd = Math.sqrt(u.reduce((s, x) => s + (x - m) ** 2, 0) / T) || 1;
    signals.push(Array.from(u, x => (x - m) / sd));
    weights.push(Math.sqrt(lambda / T));
  }
  return { signals, weights };
}

/** Normalised autocorrelation of a signal at lags 0..maxLag (each lag over its own overlap). */
export function autocorrelation(signal, maxLag) {
  const n = signal.length, m = signal.reduce((s, x) => s + x, 0) / (n || 1);
  const z = signal.map(x => x - m), v = z.reduce((s, x) => s + x * x, 0) / (n || 1) || 1;
  const ac = [];
  for (let lag = 0; lag <= Math.min(maxLag, n - 2); lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += z[i] * z[i + lag];
    ac.push(s / (n - lag) / v);
  }
  return ac;
}

/**
 * The period of a signal in samples, and the autocorrelation there: among local maxima between minLag and maxLag,
 * the shortest lag within HARMONIC_SHARE of the highest. { lag: null, strength: 0 } when there is none.
 */
export function dominantPeriod(signal, minLag, maxLag) {
  const ac = autocorrelation(signal, maxLag);
  const peaks = [];
  for (let l = Math.max(1, minLag); l < ac.length - 1; l++) if (ac[l] > 0 && ac[l] >= ac[l - 1] && ac[l] >= ac[l + 1]) peaks.push(l);
  if (!peaks.length) return { lag: null, strength: 0 };
  const best = Math.max(...peaks.map(l => ac[l]));
  const lag = peaks.find(l => ac[l] >= HARMONIC_SHARE * best) ?? peaks[0];
  return { lag, strength: Math.max(0, Math.min(1, ac[lag])) };
}

/** Centred moving average over `win` samples (shrunk at the edges). */
export function smooth(signal, win) {
  const h = Math.max(0, Math.floor(win / 2));
  return signal.map((_, i) => {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - h); j <= Math.min(signal.length - 1, i + h); j++) { s += signal[j]; n++; }
    return s / n;
  });
}

/**
 * Indices of local maxima of `s` with a prominence of at least minProm, at least minGap samples apart (the more
 * prominent wins a conflict). Prominence: the height above the higher of the two lowest points between the peak and
 * the nearest higher sample on each side (or the signal's end). The end samples themselves are not peaks.
 */
export function prominentPeaks(s, minProm, minGap) {
  const n = s.length, cand = [];
  // The first and last samples are never peaks: the motion was not seen to turn there.
  for (let i = 1; i < n - 1; i++) {
    if (!(s[i] > s[i - 1] && s[i] >= s[i + 1])) continue;
    let lmin = s[i], rmin = s[i];
    for (let j = i - 1; j >= 0 && s[j] < s[i]; j--) lmin = Math.min(lmin, s[j]);
    for (let j = i + 1; j < n && s[j] <= s[i]; j++) rmin = Math.min(rmin, s[j]);
    const base = Math.max(lmin, rmin);
    const prom = s[i] - base;
    if (prom >= minProm) cand.push({ i, prom });
  }
  cand.sort((a, b) => b.prom - a.prom);
  const kept = [];
  for (const c of cand) if (kept.every(k => Math.abs(k.i - c.i) >= minGap)) kept.push(c);
  return kept.map(k => k.i).sort((a, b) => a - b);
}

/**
 * Count the reps of one 1-D signal of a set: excursions away from the rest side.
 * @param {number[]} signal
 * @param {number} lag period in samples
 */
export function countExcursions(signal, lag, { prominenceShare = PROMINENCE_SHARE, spacingShare = SPACING_SHARE, smoothShare = SMOOTH_SHARE, sign: fixed = undefined, orient = 'median' } = {}) {
  const s = smooth(signal, Math.max(1, Math.round(lag * smoothShare)));
  const n = s.length, edge = Math.max(1, Math.round(lag * 0.25));
  // The rest: where the set spends most of its time (the median), or (orient 'edges') the first and last quarter
  // period. The working extreme is the side farther from it.
  const restLevel = orient === 'edges' ? quantile([...s.slice(0, edge), ...s.slice(n - edge)], 0.5) : quantile(s, 0.5);
  const lo = quantile(s, 0.05), hi = quantile(s, 0.95);
  const sign = fixed ?? (hi - restLevel >= restLevel - lo ? 1 : -1);
  const oriented = s.map(x => sign * x);
  const peaks = prominentPeaks(oriented, prominenceShare * (hi - lo), Math.max(1, Math.round(spacingShare * lag)));
  return { peaks, sign, smoothed: s };
}

/**
 * Whether the left and right halves of the region move in turn over a period of `lag` samples (an alternating lift
 * seen from the front or the back). Each half: its first PCS principal components on an ALT_GRID grid, the one with
 * the highest autocorrelation at the period minus that at half of it, less its centred mean over one period, counted
 * as in motionCount (components with no memory from one sample to the next, MIN_SMOOTHNESS, are noise and left out).
 * phase: the median, over the left half's peaks, of the distance to the nearest right-half peak in
 * periods, folded into 0 to 0.5. null when either half has fewer than two peaks.
 * @returns {{ left: number, right: number, phase: number | null, antiPhase: boolean }}
 */
export function alternationPhase(frames, w, h, roi, lag, opts = {}) {
  const mid = (roi[0] + roi[2]) / 2;
  const halves = [[roi[0], roi[1], mid, roi[3]], [mid, roi[1], roi[2], roi[3]]].map(r => {
    const { signals } = principalSignals(frames.map(f => shrinkRegion(f, w, h, r, opts.altGrid ?? ALT_GRID)), opts.pcs ?? PCS);
    let best = null;
    for (const sig of signals) {
      const ac = autocorrelation(sig, lag + 1);
      if (ac.length <= lag || ac[1] < MIN_SMOOTHNESS) continue; // frame noise, not motion
      const score = ac[lag] - ac[Math.round(lag / 2)];
      if (!best || score > best.score) best = { score, sig };
    }
    if (!best) return [];
    const trend = smooth(best.sig, lag);
    return countExcursions(best.sig.map((x, i) => x - trend[i]), lag, opts).peaks;
  });
  const [L, R] = halves;
  if (L.length < 2 || R.length < 2) return { left: L.length, right: R.length, phase: null, antiPhase: false };
  const folded = L.map(p => {
    const d = Math.min(...R.map(q => Math.abs(q - p))) / lag, f = d - Math.floor(d);
    return Math.min(f, 1 - f);
  });
  const phase = Math.round(quantile(folded, 0.5) * 100) / 100;
  return { left: L.length, right: R.length, phase, antiPhase: phase >= (opts.altMinPhase ?? ALT_MIN_PHASE) };
}

/**
 * The motion count of a set.
 * @param {{ frames: ArrayLike<number>[], w: number, h: number, timestamps: number[], boxes?: Array<number[] | null> }} set
 *   frames: gray bytes, w x h, one per sample; timestamps in seconds; boxes: the pose box per sample in [0, 1], or null.
 * @param {{ alternating?: boolean } & Record<string, any>} [opts] alternating: the lift is done one side at a time
 *   (liftDefinition(lift).bothSides); the count doubles when the region's halves move in turn (alternationPhase).
 * @returns {{ count: number, period: number | null, confidence: number, roi: number[], component: number, peaksAt: number[], alternation?: { left: number, right: number, phase: number | null, antiPhase: boolean } }}
 */
export function motionCount({ frames, w, h, timestamps, boxes = [] }, opts = {}) {
  const T = frames.length;
  const none = { count: 0, period: null, confidence: 0, roi: [0, 0, 1, 1], component: -1, peaksAt: [] };
  if (T < 8 || timestamps.length !== T) return none;
  const dt = (timestamps[T - 1] - timestamps[0]) / (T - 1);
  if (!(dt > 0)) return none;
  const roi = opts.roi ?? roiFromBoxes(boxes);
  const vecs = frames.map(f => shrinkRegion(f, w, h, roi, opts.grid ?? GRID));
  const { signals, weights } = principalSignals(vecs, opts.pcs ?? PCS);
  const minLag = Math.max(2, Math.round((opts.minPeriodSec ?? MIN_PERIOD_SEC) / dt));
  const maxLag = Math.min(Math.floor(T / 2), Math.round((opts.maxPeriodSec ?? MAX_PERIOD_SEC) / dt));
  let best = null;
  const mode = opts.mode ?? 'fundamental';
  if (mode === 'fundamental') {
    // The period: where the frames themselves repeat, read on the autocorrelation of all components together,
    // each weighted by its variance (half a rep apart the frames differ, bottom against top, even where one component
    // bulges twice per rep). Noise components (no memory from one sample to the next) are left out. The shortest lag
    // within HARMONIC_SHARE of the highest peak wins, as in dominantPeriod.
    const live = signals.map((sig, k) => ({ k, sig, ac: autocorrelation(sig, maxLag + 1), w2: weights[k] ** 2 })).filter(c => (c.ac[1] ?? 0) >= MIN_SMOOTHNESS);
    const W = live.reduce((x, c) => x + c.w2, 0);
    if (W > 0) {
      const n = Math.min(...live.map(c => c.ac.length));
      const joint = Array.from({ length: n }, (_, l) => live.reduce((x, c) => x + c.w2 * c.ac[l], 0) / W);
      const peaks = [];
      for (let l = Math.max(1, minLag); l < n - 1; l++) if (joint[l] > 0 && joint[l] >= joint[l - 1] && joint[l] >= joint[l + 1]) peaks.push(l);
      if (peaks.length) {
        const hi = Math.max(...peaks.map(l => joint[l]));
        const lag = peaks.find(l => joint[l] >= HARMONIC_SHARE * hi) ?? peaks[0];
        // The component that carries the rep: high autocorrelation at the period, low at half of it.
        for (const c of live) {
          const score = c.ac[lag] - c.ac[Math.round(lag / 2)];
          if (!best || score > best.score) best = { k: c.k, lag, strength: Math.max(0, Math.min(1, joint[lag])), score, sig: c.sig };
        }
      }
    }
    // Slow drift (walking in, lighting, the camera settling) is removed with a centred mean over one period.
    if (best) { const trend = smooth(best.sig, best.lag); best.sig = best.sig.map((x, i) => x - trend[i]); }
  } else if (mode === 'rest') {
    // Distance from the rest, in the space of the first components: one bump per rep, whatever the shape of the
    // path the frames take through that space (a single component can bulge twice in one rep).
    const edge = Math.max(1, Math.round((opts.restEdgeSec ?? REST_EDGE_SEC) / dt));
    const at = opts.restAt ?? 'start';
    const idx = [...(at !== 'end' ? Array.from({ length: Math.min(edge, T) }, (_, i) => i) : []), ...(at !== 'start' ? Array.from({ length: Math.min(edge, T) }, (_, i) => T - 1 - i) : [])];
    const ref = signals.map(sig => idx.reduce((s, i) => s + sig[i], 0) / idx.length);
    const d = Array.from({ length: T }, (_, t) => Math.sqrt(signals.reduce((s, sig, k) => s + (weights[k] * (sig[t] - ref[k])) ** 2, 0)));
    const p = dominantPeriod(d, minLag, maxLag);
    // Frame noise alone gives a distance with no memory from one sample to the next: no motion to count.
    if (p.lag && autocorrelation(d, 1)[1] >= MIN_SMOOTHNESS) best = { k: -1, ...p, sig: d, fixedSign: 1 };
  } else {
    signals.forEach((sig, k) => {
      const p = dominantPeriod(sig, minLag, maxLag);
      if (p.lag && (!best || p.strength > best.strength)) best = { k, ...p, sig };
    });
  }
  if (!best) return { ...none, roi };
  const { peaks } = countExcursions(best.sig, best.lag, { ...opts, sign: best.fixedSign });
  const gaps = peaks.slice(1).map((p, i) => p - peaks[i]);
  const gm = gaps.reduce((s, x) => s + x, 0) / (gaps.length || 1);
  const cv = gaps.length > 1 ? Math.sqrt(gaps.reduce((s, x) => s + (x - gm) ** 2, 0) / gaps.length) / gm : 1;
  const confidence = Math.round(best.strength * Math.max(0, 1 - Math.min(1, cv)) * 100) / 100;
  const out = { count: peaks.length, period: Math.round(best.lag * dt * 100) / 100, confidence, roi, component: best.k, peaksAt: peaks.map(i => timestamps[i]) };
  // An alternating lift whose two halves move in turn: each period counted holds one rep per side.
  if (opts.alternating) {
    const alt = alternationPhase(frames, w, h, roi, best.lag, opts);
    out.alternation = alt;
    if (alt.antiPhase) out.count = 2 * peaks.length;
  }
  return out;
}

/**
 * The cross-check of a skeleton count with a motion count. agree: the two are equal. flag: the app would ask the user
 * to confirm (R8). fused: the motion count where the skeleton saw the body in fewer than coverageFloor of the samples
 * (or refused) and the motion count is confident, else the skeleton's.
 * Source: UNSOURCED (coverageFloor, minConfidence). Status: experimental, bench only (7 October).
 * @param {number | null} skeleton null when refused
 */
export function crossCheck(skeleton, motion, coverage, { coverageFloor = 0.9, minConfidence = 0.3 } = {}) {
  const agree = skeleton !== null && skeleton === motion.count;
  const useMotion = (skeleton === null || coverage < coverageFloor) && motion.confidence >= minConfidence && motion.count > 0;
  return { agree, flag: !agree, fused: useMotion ? motion.count : skeleton };
}
