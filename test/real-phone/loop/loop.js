// The loop counter (bench only; the app imports none of it; 24 October 2026). A repetition returns the body to where it
// started, so a set of N reps is a curve that turns N times around the centre of its movement. Counted here as the
// winding number of that curve in the movement's position-velocity plane (its phase portrait), which no threshold
// sets: the count changes only if the curve passes through the centre. Hence the certificate: by the dog-on-a-leash
// lemma (two closed curves γ, γ' with |γ(t) − γ'(t)| < |γ(t)| for all t wind equally around 0; Rouché's theorem in its
// topological form), any perturbation smaller than the curve's distance to the centre leaves the count unchanged. The
// set is "sure" when that distance stays above k times the measured pose noise along the whole set.
// Steps, every one label-free and exercise-agnostic:
// 1. The signal bank (psc.js signalBank: the joint angles and limb positions of the world landmarks, on a 15 Hz grid),
//    each signal put in units of its own measured jitter (its robust z times its SNR over its 5-95 % span), so a
//    still joint's noise does not pass for movement. Principal components of those noise-whitened signals: the
//    maximum-noise-fraction idea (Green, Berman, Switzer and Craig 1988), here with each signal's jitter as its noise.
// 2. Of the first COMPS components, the one with the clearest rhythm (psc.js lagProfile and pickPeriod: period T).
// 3. Its phase portrait: position x and velocity scaled by T/2π, centred on the middle of the local range and divided
//    by the local half-range (over one period each side), so a steady oscillation draws the unit circle.
// 4. The unwrapped angle around the centre, counted from the end of the range the body rests at: one complete turn
//    from rest back to rest, one rep; a fragment at either end of the video counts when it covers most of a turn.
// 5. The noise of x and of its velocity, from the median absolute second difference of x, carried through the
//    filters; the margin is the least ratio of the distance to the centre over that noise.
// Status of every constant below: UNSOURCED, experimental (chosen before any run, not tuned on any clip).
import { signalBank, lagProfile, pickPeriod, FS, LAG_MIN_SEC, LAG_MAX_SEC, SUBHARMONIC } from '../../../src/lib/counting/psc.js';

export const DEFAULTS = Object.freeze({
  comps: 3, // components searched for the rhythm
  minVarShare: 0.25, // a component searched holds at least this share of the first one's variance
  minRhythm: 0.2, // the lag profile's peak below this: no rhythm, refused
  smooth: 0.08, // Gaussian smoothing, sigma as a share of the period (at least one sample)
  // A stretch whose local half-range is under this share of the set's keeps the nearest full-range centre, so the centre
  // never slides into a stretch of partial movement (0.5 let it: the unit test of reps reaching 30 % of the range).
  active: 0.8,
  k: 3, // sure when the distance to the centre stays above k noise units
  // A fragment of a turn at either end of the video (the turn before the body first reaches its rest end, or after it
  // last leaves it) is a rep when it covers this share of a turn: the core's CUT_RETURN_SHARE (core.ts), the cut last rep
  // counted once most of its return is filmed. A setup or a release, from one end of the range to the other, is half a
  // turn and is not counted.
  fragment: 0.7,
  // A fragment between these shares cannot be told from a cut rep or a setup: the set is not sure.
  unsureFrom: 0.35, unsureTo: 0.85,
  ends: 'rest', // the end rule: 'rest' (rest to rest, fragments by share) or 'round' (whole turns rounded)
  dwellSpeed: 0.3, dwellReach: 0.5, // a sample dwells at an end of the range: |velocity| under 0.3, |position| over 0.5 (unit circle)
});

const finite = a => a.filter(Number.isFinite);
const quantile = (arr, q) => { const s = finite(Array.from(arr)).sort((a, b) => a - b); if (!s.length) return NaN; const i = (s.length - 1) * q, lo = Math.floor(i); return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo); };
const median = arr => quantile(arr, 0.5);

/** Linear interpolation over the gaps of a grid signal; the ends hold the nearest value. Null when nothing is seen. */
export function fillGaps(z) {
  const out = Float64Array.from(z), idx = [];
  for (let i = 0; i < out.length; i++) if (Number.isFinite(out[i])) idx.push(i);
  if (!idx.length) return null;
  for (let i = 0; i < idx[0]; i++) out[i] = out[idx[0]];
  for (let i = idx[idx.length - 1] + 1; i < out.length; i++) out[i] = out[idx[idx.length - 1]];
  for (let j = 0; j + 1 < idx.length; j++) {
    const a = idx[j], b = idx[j + 1];
    for (let i = a + 1; i < b; i++) out[i] = out[a] + ((i - a) / (b - a)) * (out[b] - out[a]);
  }
  return out;
}

/** The first n principal directions of the rows' covariance (power iteration with deflation); scores and variances. */
export function principal(rows, n) {
  const K = rows.length, G = rows[0].length;
  const C = Array.from({ length: K }, () => new Float64Array(K));
  const X = rows.map(r => { let m = 0; for (const v of r) m += v; m /= G; return r.map(v => v - m); });
  for (let a = 0; a < K; a++) for (let b = a; b < K; b++) { let s = 0; for (let t = 0; t < G; t++) s += X[a][t] * X[b][t]; C[a][b] = C[b][a] = s / G; }
  const comps = [];
  for (let c = 0; c < Math.min(n, K); c++) {
    let v = new Float64Array(K).map((_, i) => 1 + 0.01 * i), lambda = 0;
    for (let it = 0; it < 300; it++) {
      const w = new Float64Array(K);
      for (let a = 0; a < K; a++) { let s = 0; for (let b = 0; b < K; b++) s += C[a][b] * v[b]; w[a] = s; }
      const norm = Math.hypot(...w);
      if (!(norm > 1e-12)) break;
      const next = w.map(x => x / norm);
      const diff = Math.hypot(...next.map((x, i) => x - v[i]));
      v = next; lambda = norm;
      if (diff < 1e-10) break;
    }
    if (!(lambda > 1e-12)) break;
    const score = new Float64Array(G);
    for (let t = 0; t < G; t++) { let s = 0; for (let a = 0; a < K; a++) s += v[a] * X[a][t]; score[t] = s; }
    comps.push({ dir: v, variance: lambda, score });
    for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) C[a][b] -= lambda * v[a] * v[b];
  }
  return comps;
}

/** A normalised Gaussian kernel of standard deviation sigma samples, cut at 3 sigma. */
function gaussian(sigma) {
  const h = Math.max(1, Math.ceil(3 * sigma)), k = [];
  for (let d = -h; d <= h; d++) k.push(Math.exp(-(d * d) / (2 * sigma * sigma)));
  const s = k.reduce((a, x) => a + x, 0);
  return k.map(x => x / s);
}
/** Convolution with a centred kernel; the edges reflect. */
function convolve(x, k) {
  const h = (k.length - 1) / 2, n = x.length, out = new Float64Array(n);
  const at = i => x[i < 0 ? Math.min(n - 1, -i) : i >= n ? Math.max(0, 2 * n - 2 - i) : i];
  for (let t = 0; t < n; t++) { let s = 0; for (let d = -h; d <= h; d++) s += k[d + h] * at(t + d); out[t] = s; }
  return out;
}
/** The L2 norm of a chain of kernels applied to a unit impulse: the factor by which they scale white noise. */
function noiseGain(chain) {
  const n = 401, x = new Float64Array(n); x[200] = 1;
  let y = x;
  for (const f of chain) y = f(y);
  return Math.sqrt(y.reduce((a, v) => a + v * v, 0));
}
// The bank's own smoothing (psc.js conditionSignal, SG5), whose noise the second differences see.
const SG5 = [-3, 12, 17, 12, -3].map(c => c / 35);
const diff2 = x => { const out = new Float64Array(x.length); for (let t = 1; t + 1 < x.length; t++) out[t] = x[t + 1] - 2 * x[t] + x[t - 1]; return out; };
const deriv = x => { const out = new Float64Array(x.length); for (let t = 0; t < x.length; t++) out[t] = (x[Math.min(x.length - 1, t + 1)] - x[Math.max(0, t - 1)]) / 2; return out; };

/**
 * The winding count of one rhythm signal x on a grid of rate fs, with period T (samples). Returns the turns (signed),
 * the count, each rep's [start, end] in samples, the least distance-to-noise ratio and its sample, and per turn the
 * least ratio. Exported for the unit tests.
 */
export function windSignal(x, T, opts = {}) {
  const o = { ...DEFAULTS, ...opts }, G = x.length;
  // White noise of x (in its own units), from the median absolute second difference of the bank's smoothed signal:
  // the second difference of a rhythm of period T is (2π/T)² of its amplitude, small beside the jitter at 15 Hz.
  const k5 = y => convolve(y, SG5);
  const d2 = finite(Array.from(diff2(x)).slice(1, -1));
  const sigma = (1.4826 * median(d2.map(Math.abs))) / noiseGain([k5, diff2]);
  const kg = gaussian(Math.max(1, o.smooth * T)), kgf = y => convolve(y, kg);
  const xs = convolve(x, kg);
  const scale = T / (2 * Math.PI);
  const v = deriv(xs).map(d => d * scale);
  const sx = sigma * noiseGain([k5, kgf]), sv = sigma * noiseGain([k5, kgf, deriv]) * scale;
  // The local centre and half-range, over one period each side.
  const W = Math.max(2, Math.round(T)), c = new Float64Array(G), a = new Float64Array(G);
  for (let t = 0; t < G; t++) {
    let lo = Infinity, hi = -Infinity;
    for (let i = Math.max(0, t - W); i <= Math.min(G - 1, t + W); i++) { if (xs[i] < lo) lo = xs[i]; if (xs[i] > hi) hi = xs[i]; }
    c[t] = (lo + hi) / 2; a[t] = (hi - lo) / 2;
  }
  const A = quantile(a, 0.75), active = Array.from(a, v => v >= o.active * A);
  // At rest, the nearest active centre and the set's half-range: a fidget at the rest end stays far from the centre.
  let last = -1;
  const nearest = new Int32Array(G).fill(-1);
  for (let t = 0; t < G; t++) { if (active[t]) last = t; nearest[t] = last; }
  last = -1;
  for (let t = G - 1; t >= 0; t--) { if (active[t]) last = t; if (!active[t] && (nearest[t] < 0 || (last >= 0 && last - t < t - nearest[t]))) nearest[t] = last; }
  const u = new Float64Array(G), w = new Float64Array(G), ratio = new Float64Array(G);
  for (let t = 0; t < G; t++) {
    const src = active[t] ? t : nearest[t];
    const cc = src >= 0 ? c[src] : c[t], aa = active[t] ? a[t] : A;
    u[t] = (xs[t] - cc) / aa; w[t] = v[t] / aa;
    ratio[t] = Math.hypot(u[t], w[t]) / (Math.hypot(sx, sv) / aa);
  }
  // The unwrapped angle; one turn per rep.
  const theta = new Float64Array(G);
  theta[0] = Math.atan2(w[0], u[0]);
  for (let t = 1; t < G; t++) {
    let d = Math.atan2(w[t], u[t]) - Math.atan2(w[t - 1], u[t - 1]);
    if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
    theta[t] = theta[t - 1] + d;
  }
  const turns = (theta[G - 1] - theta[0]) / (2 * Math.PI), dir = Math.sign(turns) || 1;
  // The rest end: the end of the range the body dwells at (still, at one end), where reps begin and end. Its angle is 0
  // on the +1 side and π on the -1 side; rho counts turns from it, so the body is at rest at every whole rho.
  let dwellPlus = 0, dwellMinus = 0;
  for (let t = 0; t < G; t++) if (Math.abs(w[t]) < o.dwellSpeed && Math.abs(u[t]) > o.dwellReach) { if (u[t] > 0) dwellPlus++; else dwellMinus++; }
  const restAngle = dwellPlus >= dwellMinus ? 0 : Math.PI;
  const rho = Float64Array.from(theta, th => (dir * th - dir * restAngle) / (2 * Math.PI));
  // rho's offset by whole turns is free: bring the start's rest level to the first whole number at or above rho[0].
  const r0 = rho[0], r1 = rho[G - 1];
  const k0 = Math.ceil(r0 - 1e-9), k1 = Math.floor(r1 + 1e-9);
  const reps = [];
  const crossing = level => { for (let t = 0; t < G; t++) if (rho[t] >= level - 1e-9) return t; return G - 1; };
  let head = 0, tail = 0, complete = 0;
  if (k1 >= k0) {
    head = k0 - r0; tail = r1 - k1; complete = k1 - k0;
    const marks = Array.from({ length: complete + 1 }, (_, i) => crossing(k0 + i));
    if (head >= o.fragment) reps.push([0, marks[0]]);
    for (let i = 0; i < complete; i++) reps.push([marks[i], marks[i + 1]]);
    if (tail >= o.fragment) reps.push([marks[complete], G - 1]);
  } else {
    // The body never comes back to rest: one fragment, the whole video.
    head = r1 - r0;
    if (head >= o.fragment) reps.push([0, G - 1]);
  }
  const unsure = f => f >= o.unsureFrom && f <= o.unsureTo;
  const ambiguous = unsure(head) || unsure(tail);
  // The other end rule, fixed before the run beside this one: the whole turns from the video's first sample, rounded
  // (a set filmed from rest to rest makes whole turns). Rep i ends where i turns are first reached; unsure when the
  // turns lie within 0.15 of a half.
  const total = Math.abs(turns), countRound = Math.round(total), repsRound = [];
  { let start = 0, next = 1;
    for (let t = 1; t < G && next <= countRound; t++) if ((dir * (theta[t] - theta[0])) / (2 * Math.PI) >= next) { repsRound.push([start, t]); start = t; next++; }
    if (repsRound.length < countRound) repsRound.push([start, G - 1]); }
  const ambiguousRound = Math.abs(total - Math.floor(total) - 0.5) <= 0.15;
  const count = o.ends === 'round' ? countRound : reps.length;
  const perTurn = (o.ends === 'round' ? repsRound : reps).map(([s, e]) => { let m = Infinity; for (let t = s; t <= e; t++) m = Math.min(m, ratio[t]); return m; });
  let minRatio = Infinity, at = 0;
  for (let t = 0; t < G; t++) if (ratio[t] < minRatio) { minRatio = ratio[t]; at = t; }
  return { turns, count, reps: o.ends === 'round' ? repsRound : reps, sigma, minRatio, at, perTurn, head, tail,
    ambiguous: o.ends === 'round' ? ambiguousRound : ambiguous, restAngle,
    rules: { rest: { count: reps.length, reps, ambiguous }, round: { count: countRound, reps: repsRound, ambiguous: ambiguousRound } } };
}

/** The loop count of a set: { refused, why, count, sure, turns, minRatio, period, comp, reps [{startTime, endTime}] }. */
export function loopCount(wl, ts, image = null, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  if (!Array.isArray(wl) || wl.length < 10) return { refused: true, why: 'too short', count: 0, sure: false };
  const { grid, sigs } = signalBank(wl, ts, image, { useImage: !!image });
  if (!sigs.length || grid.length < 2 * LAG_MIN_SEC * FS) return { refused: true, why: 'nothing seen', count: 0, sure: false };
  // Each signal in units of its own jitter: z times SNR over its 5-95 % span (psc.js conditionSignal's noise).
  const rows = [];
  for (const s of sigs) {
    const span = quantile(s.z, 0.95) - quantile(s.z, 0.05), filled = fillGaps(s.z);
    if (!filled || !(span > 1e-9) || !(s.snr > 0)) continue;
    rows.push(filled.map(v => (v * s.snr) / span));
  }
  if (!rows.length) return { refused: true, why: 'nothing seen', count: 0, sure: false };
  const comps = principal(rows, o.comps);
  const lo = Math.round(LAG_MIN_SEC * FS), hi = Math.min(Math.round(LAG_MAX_SEC * FS), Math.floor(grid.length / 2));
  if (!(hi > lo)) return { refused: true, why: 'too short', count: 0, sure: false };
  const found = [];
  comps.forEach((c, i) => {
    if (c.variance < o.minVarShare * comps[0].variance) return;
    // One lag beyond each end, as pickPeriod reads its neighbours (psc.js pscCount).
    const prof = lagProfile([{ z: c.score }], [1], lo - 1, hi + 1);
    const p = pickPeriod(prof, lo, hi);
    if (p && Number.isFinite(p.score)) found.push({ i, T: p.lag, rhythm: p.score, score: c.score });
  });
  let best = found.reduce((b, f) => (!b || f.rhythm > b.rhythm ? f : b), null);
  // A rep is the smallest unit the body repeats: a component at half the period, with a rhythm of at least
  // SUBHARMONIC of the best (psc.js pickPeriod's own guard), is the rep's. Alternating limbs make the first component
  // their difference, which turns once per two reps, and the second their sum, which turns once per rep.
  if (best) {
    const half = found.filter(f => f !== best && f.T >= 0.4 * best.T && f.T <= 0.6 * best.T && f.rhythm >= SUBHARMONIC * best.rhythm)
      .sort((a, b) => b.rhythm - a.rhythm)[0];
    if (half) best = { ...half, halved: true };
  }
  // No rhythm in the lag profile (a set of two or three reps gives too few lags): the period from the crossings of the
  // first component's middle, with a hysteresis of a quarter of its 10-90 % span; the winding count reads the turns,
  // the period only sets the smoothing and the centre's window.
  if (!best || !(best.rhythm >= o.minRhythm)) {
    const x = comps[0].score, q10 = quantile(x, 0.1), q90 = quantile(x, 0.9), mid = (q10 + q90) / 2, hy = 0.25 * (q90 - q10);
    const ups = []; let low = x[0] < mid - hy;
    for (let t = 1; t < x.length; t++) { if (x[t] < mid - hy) low = true; else if (low && x[t] > mid + hy) { ups.push(t); low = false; } }
    if (ups.length < 2) return { refused: true, why: 'no rhythm', count: 0, sure: false, rhythm: best?.rhythm ?? null };
    const T = (ups[ups.length - 1] - ups[0]) / (ups.length - 1);
    if (!(T >= lo)) return { refused: true, why: 'no rhythm', count: 0, sure: false, rhythm: best?.rhythm ?? null };
    best = { i: 0, T, rhythm: best?.rhythm ?? 0, score: x, fromCrossings: true };
  }
  const r = windSignal(best.score, best.T, o);
  const sure = r.count >= 1 && r.minRatio >= o.k && !r.ambiguous;
  return {
    refused: r.count < 1, why: r.count < 1 ? 'no turn' : null, count: r.count, sure, turns: r.turns, minRatio: r.minRatio,
    head: r.head, tail: r.tail, ambiguous: r.ambiguous, period: best.T / FS, rhythm: best.rhythm, comp: best.i, halved: !!best.halved, fromCrossings: !!best.fromCrossings, perTurn: r.perTurn,
    reps: r.reps.map(([s, e]) => ({ startTime: grid[s], endTime: grid[e] })),
    rules: Object.fromEntries(Object.entries(r.rules).map(([k, v]) => [k, { count: v.count, ambiguous: v.ambiguous, reps: v.reps.map(([s, e]) => ({ startTime: grid[s], endTime: grid[e] })) }])),
  };
}
