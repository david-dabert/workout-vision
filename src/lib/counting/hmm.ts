/**
 * A rep counter that reads the joint angle as a path through four states: at rest, going out, at the working
 * end, coming back. The most likely path (Viterbi) is found over the whole set; a rep is one pass out, through
 * the working end and back. A glitch is one unlikely sample the path does not follow, while the turn of a fast
 * rep is a smooth stretch the path does follow: the conflict the core's outlier filter cannot settle (TRIED.md,
 * 3 October: three filter changes, each failing a gate) does not arise. Linear in the number of samples.
 *
 * It reads the same raw angle and side as the core (countReps), so the two differ only in how a rep is found.
 * Status: experimental, research only; not used by the app. Every figure below is a starting value, UNSOURCED,
 * to be measured by test/real-phone/accuracy/hmm-eval.test.ts against David's sets, the public build half and
 * the synthetic sets; nothing ships unless it wins there (PLAN.md, the learned counter's rule).
 */
import { countReps, liftDefinition, COUNTABLE_RANGE_DEG, type WorldLandmarkFrame } from './core';

const REST = 0, OUT = 1, WORK = 2, BACK = 3;
// Mean time in each state (s): sets the chance of staying from one sample to the next. UNSOURCED.
const MEAN_SEC = [1.0, 0.5, 0.3, 0.6];
// Share of samples allowed to be anything (a glitch, a flipped pose): keeps one bad sample cheap. UNSOURCED.
const OUTLIER_SHARE = 0.05;
// Where each state sits on the set's own scale (0 rest, 1 working end) and how wide. UNSOURCED.
const POS = [{ m: 0, s: 0.15 }, { m: 0.5, s: 0.35 }, { m: 1, s: 0.2 }, { m: 0.5, s: 0.35 }];
// Speed (set ranges per second): resting states near still; going out moves up, coming back down. UNSOURCED.
const STILL_SD = 1.5, DIRECTION_SCALE = 0.3;
// The shortest rep, as the core's MIN_REP_SEC (Schoenfeld et al. 2015). Literature, as core.ts records it.
const MIN_REP_SEC = 0.5;
// How far back towards rest a rep must come before the next one counts (share of the range). UNSOURCED.
const RETURN_TO = 0.35;

const logN = (x: number, m: number, s: number) => -0.5 * ((x - m) / s) ** 2 - Math.log(s * Math.sqrt(2 * Math.PI));
const logSig = (z: number) => -Math.log1p(Math.exp(-z));
const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))];

export interface HmmRep { startTime: number; endTime: number }
export interface HmmResult { count: number; reps: HmmRep[]; states: number[] }

/** The most likely state of each sample, and the reps it makes. `angles` raw, null where no pose; rest 'low' or 'high'. */
/** Settings a research run may change (hmm-eval); the defaults are the starting values above. */
export interface HmmOptions { meanSec?: number[]; outlierShare?: number; stillSd?: number; directionScale?: number; posSd?: number[]; depth?: number; returnTo?: number }

export function hmmCount(angles: (number | null)[], timestamps: number[], rest: 'low' | 'high', o: HmmOptions = {}): HmmResult {
  const meanSec = o.meanSec ?? MEAN_SEC, outlierShare = o.outlierShare ?? OUTLIER_SHARE, stillSd = o.stillSd ?? STILL_SD;
  const directionScale = o.directionScale ?? DIRECTION_SCALE, depth = o.depth ?? 0.5, returnTo = o.returnTo ?? RETURN_TO;
  const pos = POS.map((p, k) => ({ m: p.m, s: o.posSd?.[k] ?? p.s }));
  const seen = angles.filter((a): a is number => a !== null).sort((a, b) => a - b);
  const none = { count: 0, reps: [], states: angles.map(() => REST) };
  if (seen.length < 3) return none;
  const lo = pct(seen, 10), hi = pct(seen, 90);
  if (hi - lo < COUNTABLE_RANGE_DEG) return none;
  // The set's own scale: 0 at the rest end, 1 at the working end.
  const x = angles.map(a => (a === null ? null : rest === 'high' ? (hi - a) / (hi - lo) : (a - lo) / (hi - lo)));
  const n = x.length;
  // Speed from the samples either side; null where either is missing.
  const v = x.map((_, i) => {
    const a = x[i - 1], b = x[i + 1];
    if (a == null || b == null) return null;
    const dt = timestamps[i + 1] - timestamps[i - 1];
    return dt > 0 ? (b - a) / dt : null;
  });
  const dtMean = n > 1 ? (timestamps[n - 1] - timestamps[0]) / (n - 1) : 1 / 15;
  const stay = meanSec.map(m => Math.min(0.98, Math.max(0.02, 1 - dtMean / m)));
  // Allowed moves: rest -> out -> work -> back -> rest, back straight into the next rep, and a rise abandoned.
  const logA: number[][] = Array.from({ length: 4 }, () => [-Infinity, -Infinity, -Infinity, -Infinity]);
  logA[REST][REST] = Math.log(stay[REST]); logA[REST][OUT] = Math.log(1 - stay[REST]);
  logA[OUT][OUT] = Math.log(stay[OUT]); logA[OUT][WORK] = Math.log((1 - stay[OUT]) * 0.9); logA[OUT][REST] = Math.log((1 - stay[OUT]) * 0.1);
  logA[WORK][WORK] = Math.log(stay[WORK]); logA[WORK][BACK] = Math.log(1 - stay[WORK]);
  logA[BACK][BACK] = Math.log(stay[BACK]); logA[BACK][REST] = Math.log((1 - stay[BACK]) * 0.6); logA[BACK][OUT] = Math.log((1 - stay[BACK]) * 0.4);
  const emit = (i: number, s: number) => {
    const xi = x[i];
    if (xi === null) return 0;
    let ll = logN(xi, pos[s].m, pos[s].s);
    const vi = v[i];
    if (vi !== null) ll += s === OUT ? logSig(vi / directionScale) : s === BACK ? logSig(-vi / directionScale) : logN(vi, 0, stillSd);
    // Any sample may be an outlier: a flat floor under every state.
    return Math.log((1 - outlierShare) * Math.exp(ll) + outlierShare * 0.1);
  };
  const start = [Math.log(0.7), Math.log(0.1), Math.log(0.1), Math.log(0.1)];
  const score: number[][] = [], from: number[][] = [];
  score.push([0, 1, 2, 3].map(s => start[s] + emit(0, s)));
  from.push([0, 0, 0, 0]);
  for (let i = 1; i < n; i++) {
    const prev = score[i - 1], row = [0, 0, 0, 0], back = [0, 0, 0, 0];
    for (let s = 0; s < 4; s++) {
      let best = -Infinity, arg = 0;
      for (let p = 0; p < 4; p++) { const c = prev[p] + logA[p][s]; if (c > best) { best = c; arg = p; } }
      row[s] = best + emit(i, s); back[s] = arg;
    }
    score.push(row); from.push(back);
  }
  const states = new Array<number>(n);
  let s = [0, 1, 2, 3].reduce((b, k) => (score[n - 1][k] > score[n - 1][b] ? k : b), 0);
  for (let i = n - 1; i >= 0; i--) { states[i] = s; s = from[i][s]; }
  // A rep: out, then work, then back, ended by rest or the next rise; a rep the video cuts is not counted.
  // Hysteresis: a rep starts from below returnTo and must come back below it before the next one counts, so
  // jitter at the working end is not a string of reps (overhead press, 22 counted for 10, 3 October).
  const reps: HmmRep[] = [];
  let i = 0, armed = true;
  while (i < n) {
    if (x[i] !== null && x[i]! <= returnTo) armed = true;
    if (states[i] !== OUT || !armed) { i++; continue; }
    const begin = i;
    while (i < n && states[i] === OUT) i++;
    if (i >= n || states[i] !== WORK) continue;
    while (i < n && states[i] === WORK) i++;
    if (i >= n || states[i] !== BACK) continue;
    while (i < n && states[i] === BACK) i++;
    if (i >= n) break;
    // As the core: a rep lasts at least MIN_REP_SEC (Schoenfeld et al. 2015, as core.ts cites it) and reaches past
    // halfway of the set's range; a glitch makes a path of two or three samples that reaches neither.
    const peak = Math.max(...x.slice(begin, i).map(e => e ?? 0));
    if (timestamps[i - 1] - timestamps[begin] >= MIN_REP_SEC && peak >= depth) { reps.push({ startTime: timestamps[begin], endTime: timestamps[i - 1] }); armed = false; }
  }
  return { count: reps.length, reps, states };
}

/** The core's raw angle and side for a lift, counted by the state model. */
export function hmmCountLift(worldLandmarks: WorldLandmarkFrame[], timestamps: number[], lift: string, o: HmmOptions = {}): HmmResult {
  const def = liftDefinition(lift);
  if (!def) return { count: 0, reps: [], states: [] };
  const core = countReps(worldLandmarks, timestamps, lift);
  return hmmCount(core.angles, timestamps, def.rest, o);
}
