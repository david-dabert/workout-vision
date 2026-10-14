/**
 * EquiVision's gait engine: reads the vertical movement of a horse's head (poll), withers and pelvis (sacrum) over a
 * trot and returns, per trace, the two dips of every stride and the difference between them. Nothing more.
 *
 * What it does not do, on purpose (honesty audit of 14 October 2026, EQ-04 to EQ-09):
 * - It gives no verdict: no "sound", no "lame", no "clinical" anything. Asymmetry is not a diagnosis: 72.5 % of 222
 *   horses judged sound by their owners exceeded at least one of the usual asymmetry thresholds (Rhodin et al. 2017,
 *   PLoS ONE 12:e0176253; status literature, abstract read through a search summary, full text not checked here).
 * - It names no limb and no side. Which diagonal is in stance needs the hooves; without them the two dips of a stride
 *   are only "dip A" and "dip B", in the order the trace starts with, and the order flips with the clip's first frame.
 * - It computes no duty factor: that needs hoof contacts, which nothing here detects.
 * - A trace too short, flat or irregular to show strides is refused with a reason, never read as symmetric.
 *
 * The measures it keeps are those of the equine gait literature: per stride, MinDiff (the difference between the two
 * minima) and MaxDiff (between the two maxima), each from its own half-stride (Rhodin et al. 2017 and the studies it
 * builds on; status literature, as above). Here they are signed dip A minus dip B, in the trace's own unit.
 *
 * Today the engine only ever reads EquiVision's simulated horse (simulation.ts): the app has no model that finds a
 * horse's head, withers or pelvis in a video. Every constant below is experimental until a horse model exists and an
 * agreement study against a reference (inertial sensors or optical motion capture) has been run.
 */

export type EquineChannel = 'poll' | 'withers' | 'sacrum';

export interface EquinePoint { x: number; y: number; z?: number }

/** One frame's points. y is height (upward positive) in the trace's own unit; a missing point is left out. */
export interface EquineLandmarks {
  poll?: EquinePoint;
  withers?: EquinePoint;
  sacrum?: EquinePoint;
}

export interface EquineFrame {
  timestamp: number; // milliseconds
  landmarks: EquineLandmarks;
}

/** A dip (a local minimum) or a crest of a trace, placed between samples by a parabola through its three samples. */
export interface Extremum { index: number; time: number; value: number }

/** One stride of one trace: dip A, dip B, the next dip A; the differences are A minus B. */
export interface ChannelStride {
  startTime: number;
  endTime: number;
  durationMs: number;
  dipA: Extremum;
  dipB: Extremum;
  crestA: Extremum; // the highest point between dip A and dip B
  crestB: Extremum; // the highest point between dip B and the next dip A
  minDiff: number; // dipA.value - dipB.value
  maxDiff: number; // crestA.value - crestB.value
}

export type EquineRefusal = 'too_few_frames' | 'no_trace' | 'no_regular_stride';

export interface ChannelReport {
  channel: EquineChannel;
  refused: EquineRefusal | null;
  smoothed: number[]; // the trace after smoothing, one value per frame (NaN where the point is missing)
  dips: Extremum[];
  strides: ChannelStride[];
  meanMinDiff: number | null;
  meanMaxDiff: number | null;
  medianStrideMs: number | null;
}

export interface EquineGaitReport {
  /** Null when at least one trace shows regular strides; otherwise why nothing is read. */
  refused: EquineRefusal | null;
  strideDurationMs: number | null;
  strideFrequencyHz: number | null;
  totalStrides: number;
  channels: Partial<Record<EquineChannel, ChannelReport>>;
}

// The traces read, in the order a stride's duration is taken from when several qualify.
const CHANNELS: EquineChannel[] = ['sacrum', 'poll', 'withers'];

// Fewest frames worth reading: one smoothing window plus the edges it cannot smooth.
// Status: experimental (UNSOURCED; the strides gate below does the real work).
const MIN_FRAMES = 15;

// A dip counts when it sits at least this share of the trace's range below the crests around it (its prominence).
// Status: experimental (UNSOURCED; chosen on the simulations of __tests__/kinematics.test.ts, where it keeps every
// programmed dip and refuses white noise).
const MIN_PROMINENCE = 0.25;

// Successive dips must be evenly spaced: the spread of the intervals (standard deviation over mean) stays under this.
// Status: experimental (UNSOURCED; a trot has two dips per stride at an even rhythm, noise does not).
const MAX_INTERVAL_CV = 0.2;

// A stride (dip A to the next dip A) outside this band is not a trot stride and is skipped.
// Status: experimental (UNSOURCED; a wide band around the 0.6 to 0.9 s of trot strides, kept from the first engine).
const MIN_STRIDE_MS = 300;
const MAX_STRIDE_MS = 1500;

// Fewest strides a trace needs before any difference is computed from it.
// Status: experimental (UNSOURCED; published protocols average many more strides).
const MIN_STRIDES = 2;

// The trace must repeat itself one stride later: its autocorrelation at the stride's lag reaches at least this.
// Status: experimental (UNSOURCED; a periodic trace scores near 1, white noise near 0; the threshold is checked on 500
// noise traces in __tests__/kinematics.test.ts).
const MIN_PERIODICITY = 0.6;

// Savitzky-Golay quadratic smoothing over 7 samples: the standard coefficients [-2, 3, 6, 7, 6, 3, -2] / 21.
// Status: literature (Savitzky & Golay 1964, Analytical Chemistry 36:1627-1639; the coefficient table is textbook).
const SG7 = [-2, 3, 6, 7, 6, 3, -2];
const SG7_NORM = 21;
const SG7_HALF = 3;

/**
 * Savitzky-Golay quadratic smoothing over a window of 7 samples. The first and last 3 samples cannot be smoothed by
 * the window and are returned as they are; the engine never looks for a dip among them (an edge average invented a
 * stride at the start of every clip in the first engine, EQ-23). Only a window of 7 is implemented.
 */
export function savitzkyGolay(data: number[], windowSize = 7): number[] {
  if (windowSize !== 7) throw new RangeError('savitzkyGolay: only a window of 7 samples is implemented');
  const n = data.length;
  if (n < 7) return [...data];
  const out = [...data];
  for (let i = SG7_HALF; i < n - SG7_HALF; i++) {
    let sum = 0;
    for (let k = -SG7_HALF; k <= SG7_HALF; k++) sum += data[i + k] * SG7[k + SG7_HALF];
    out[i] = sum / SG7_NORM;
  }
  return out;
}

/** The extremum at sample i placed by a parabola through samples i-1, i, i+1 (its vertex), so a dip that falls between
 *  two frames is not read short by the sampling. Status: convention (standard peak interpolation). */
function refine(y: number[], t: number[], i: number): Extremum {
  const a = y[i - 1], b = y[i], c = y[i + 1];
  const den = a - 2 * b + c;
  if (!Number.isFinite(den) || den === 0) return { index: i, time: t[i], value: b };
  const d = Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den));
  const dt = d >= 0 ? t[i + 1] - t[i] : t[i] - t[i - 1];
  return { index: i, time: t[i] + d * dt, value: b - 0.25 * (a - c) * d };
}

/** The dips of a smoothed trace between lo and hi (exclusive), kept by prominence. */
function findDips(y: number[], lo: number, hi: number): number[] {
  let top = -Infinity, bottom = Infinity;
  for (let i = lo; i < hi; i++) { top = Math.max(top, y[i]); bottom = Math.min(bottom, y[i]); }
  const range = top - bottom;
  if (!(range > 0)) return [];
  const dips: number[] = [];
  for (let i = lo + 1; i < hi - 1; i++) {
    if (!(y[i] < y[i - 1] && y[i] <= y[i + 1])) continue;
    // Prominence: walk each way until a lower point or the edge; the lower of the two highest points met, minus the dip.
    let left = y[i], right = y[i];
    for (let j = i - 1; j >= lo && y[j] >= y[i]; j--) left = Math.max(left, y[j]);
    for (let j = i + 1; j < hi && y[j] >= y[i]; j++) right = Math.max(right, y[j]);
    if (Math.min(left, right) - y[i] >= MIN_PROMINENCE * range) dips.push(i);
  }
  return dips;
}

function mean(a: number[]): number { return a.reduce((s, v) => s + v, 0) / a.length; }
function median(a: number[]): number {
  const s = [...a].sort((p, q) => p - q), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Normalised autocorrelation of y[lo..hi) at a lag of `lag` samples (1 for a trace that repeats exactly). */
function periodicity(y: number[], lo: number, hi: number, lag: number): number {
  if (lag < 1 || hi - lo - lag < lag) return 0;
  const seg = y.slice(lo, hi);
  const mu = mean(seg);
  let num = 0, den = 0;
  for (let i = 0; i < seg.length; i++) {
    den += (seg[i] - mu) ** 2;
    if (i + lag < seg.length) num += (seg[i] - mu) * (seg[i + lag] - mu);
  }
  return den > 0 ? (num / den) * (seg.length / (seg.length - lag)) : 0;
}

function crest(y: number[], t: number[], from: number, to: number): Extremum {
  let best = from;
  for (let j = from; j <= to; j++) if (y[j] > y[best]) best = j;
  return best > from && best < to ? refine(y, t, best) : { index: best, time: t[best], value: y[best] };
}

function refusedChannel(channel: EquineChannel, refused: EquineRefusal, smoothed: number[]): ChannelReport {
  return { channel, refused, smoothed, dips: [], strides: [], meanMinDiff: null, meanMaxDiff: null, medianStrideMs: null };
}

/** One trace: its dips, its strides and their differences, or the reason it gives none. */
export function analyzeChannel(frames: EquineFrame[], channel: EquineChannel): ChannelReport {
  const raw = frames.map(f => f.landmarks[channel]?.y ?? NaN);
  if (raw.every(v => !Number.isFinite(v))) return refusedChannel(channel, 'no_trace', raw);
  // A trace with a gap is not read: no interpolation is invented between frames where the point was missing.
  if (raw.some(v => !Number.isFinite(v))) return refusedChannel(channel, 'no_trace', raw);
  if (frames.length < MIN_FRAMES) return refusedChannel(channel, 'too_few_frames', raw);

  const t = frames.map(f => f.timestamp);
  const y = savitzkyGolay(raw);
  const dipIdx = findDips(y, SG7_HALF, y.length - SG7_HALF);
  const dips = dipIdx.map(i => refine(y, t, i));
  if (dips.length < 2 * MIN_STRIDES + 1) return { ...refusedChannel(channel, 'no_regular_stride', y), dips };

  const gaps = dips.slice(1).map((d, k) => d.time - dips[k].time);
  const m = mean(gaps);
  const sd = Math.sqrt(mean(gaps.map(g => (g - m) ** 2)));
  if (!(m > 0) || sd / m > MAX_INTERVAL_CV) return { ...refusedChannel(channel, 'no_regular_stride', y), dips };

  const strides: ChannelStride[] = [];
  for (let k = 0; k + 2 < dips.length; k += 2) {
    const a = dips[k], b = dips[k + 1], next = dips[k + 2];
    const durationMs = next.time - a.time;
    if (durationMs < MIN_STRIDE_MS || durationMs > MAX_STRIDE_MS) continue;
    const crestA = crest(y, t, a.index, b.index);
    const crestB = crest(y, t, b.index, next.index);
    strides.push({
      startTime: a.time, endTime: next.time, durationMs, dipA: a, dipB: b, crestA, crestB,
      minDiff: a.value - b.value, maxDiff: crestA.value - crestB.value,
    });
  }
  if (strides.length < MIN_STRIDES) return { ...refusedChannel(channel, 'no_regular_stride', y), dips };

  const medianStrideMs = median(strides.map(s => s.durationMs));
  const frameMs = (t[t.length - 1] - t[0]) / (t.length - 1);
  const lag = Math.round(medianStrideMs / frameMs);
  if (periodicity(y, SG7_HALF, y.length - SG7_HALF, lag) < MIN_PERIODICITY) {
    return { ...refusedChannel(channel, 'no_regular_stride', y), dips };
  }

  return {
    channel, refused: null, smoothed: y, dips, strides,
    meanMinDiff: mean(strides.map(s => s.minDiff)),
    meanMaxDiff: mean(strides.map(s => s.maxDiff)),
    medianStrideMs,
  };
}

/**
 * Every trace present in the frames, read on its own. The stride's duration is the median of the first trace (pelvis,
 * then head, then withers) that shows regular strides. When none does, the report is refused, with the reason of the
 * trace that went furthest, and carries no number.
 */
export function analyzeEquineGait(frames: EquineFrame[]): EquineGaitReport {
  const channels: Partial<Record<EquineChannel, ChannelReport>> = {};
  if (!frames || frames.length === 0) {
    return { refused: 'too_few_frames', strideDurationMs: null, strideFrequencyHz: null, totalStrides: 0, channels };
  }
  for (const c of CHANNELS) {
    if (frames.some(f => f.landmarks[c])) channels[c] = analyzeChannel(frames, c);
  }
  const read = CHANNELS.map(c => channels[c]).filter((r): r is ChannelReport => !!r);
  const ok = read.find(r => r.refused === null);
  if (!ok) {
    const order: EquineRefusal[] = ['no_regular_stride', 'too_few_frames', 'no_trace'];
    const refused = order.find(o => read.some(r => r.refused === o)) ?? 'no_trace';
    return { refused, strideDurationMs: null, strideFrequencyHz: null, totalStrides: 0, channels };
  }
  const strideDurationMs = ok.medianStrideMs as number;
  return {
    refused: null,
    strideDurationMs,
    strideFrequencyHz: 1000 / strideDurationMs,
    totalStrides: ok.strides.length,
    channels,
  };
}

/**
 * The inward lean a body needs to trot on a circle of radius R at speed v, from gravity and the centripetal
 * acceleration: theta = arctan(v^2 / (g R)), in degrees. A calculation from the values typed in, not a measurement,
 * and nothing in the app corrects any trace with it.
 * Source: Pfau et al. 2012, Am J Vet Res 73:1890-1899 (measured lean of lunging horses close to this prediction).
 * Status: literature (abstract read through a search summary, full text not checked here).
 */
export function calculateCircleLean(radiusMeters: number, speedMps: number): number {
  if (!(radiusMeters > 0) || !(speedMps >= 0)) return 0;
  const g = 9.80665; // standard gravity, m/s^2 (status: convention, the SI standard value)
  return (Math.atan((speedMps * speedMps) / (g * radiusMeters)) * 180) / Math.PI;
}
