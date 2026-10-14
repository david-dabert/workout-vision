/**
 * The activity engine (docs/VISION.md, "The engine"): reads any activity specification (types.ts) on a pose read and
 * returns its events and measures, every value with its margin or the reason it is not shown (R8). Three layers:
 *
 * 1. Perception: the pose of every sample, as the app's pose model gives it (coreAnalysis.js, readPoses), and the body's
 *    own ruler: the ground line, the leg length, the camera view.
 * 2. The grammar: signals, then events (airborne phases, jumps as cycles of hip height that carry a flight, strides,
 *    landings), read by the kinds declared in the specification.
 * 3. Measures: each with its formula, unit, source, R9 status and margin, computed from the samples actually read.
 *
 * Nothing here changes a rep count: the counting core (src/lib/counting/core.ts) is only read from, for its
 * Savitzky–Golay kernel.
 */
import { sgKernel } from '../counting/core';
import type {
  ActivityResult, ActivitySpec, EventSpec, FoundEvent, LandmarkFrame, MeasureResult, MeasureSpec, MeasureValue,
  PoseRead, SignalSpec, Text,
} from './types';

/** Standard gravity, m/s² (3rd CGPM, 1901). Status: literature. */
export const G = 9.80665;

// Perception settings. Each: source, then R9 status.
// A landmark below this visibility is unseen: the counting core's floor (VIS_THRESHOLD, core.ts). Status: convention.
const VIS = 0.5;
// A contact's time is corrected for the ground band with the foot's speed over this long after takeoff or before
// touchdown (at least two samples). Source: UNSOURCED (short enough that the speed barely changes). Status: experimental.
const SPEED_WINDOW_SEC = 0.06;
// The band correction is itself uncertain: this share of it is added to the contact's margin. Source: UNSOURCED (the
// foot's speed at a contact read from two samples, off by up to a fifth on the synthetic jumps). Status: experimental.
const BAND_SHARE = 0.25;
// The camera faces the person when the shoulders are at least this wide for their torso's length, sees them from the
// side at most this. Source: UNSOURCED (front 0.8 and side under 0.1 on the synthetic body). Status: experimental.
const FRONT_MIN = 0.35;
const SIDE_MAX = 0.2;
// The hip is smoothed over this long before its cycles and lowest points are read; contacts are read unsmoothed.
// Source: UNSOURCED. Status: experimental.
const SMOOTH_SEC = 0.2;
// The foot's noise on the ground is read from samples within this many leg lengths of the ground. Source: UNSOURCED.
// Status: experimental.
const NEAR_GROUND = 0.1;
// A read that sees the feet in fewer than this share of its samples is refused. Source: UNSOURCED. Status: experimental.
const MIN_SEEN = 0.5;

/** h = g·t²/8 (flight-time method, Bosco et al. 1983), in centimetres. */
export const flightHeightCm = (flight: number) => (G * flight * flight) / 8 * 100;

/**
 * The margin on a height from a flight time known to ±`margin` seconds, in centimetres: the larger of the two sides.
 * For a contact at each end known to half a sample, `margin` is one sample: (g·t/4)·Δt to first order, about ±10 cm on a
 * 0.6 s flight read at 15 samples a second.
 */
export function heightMarginCm(flight: number, margin: number) {
  const h = flightHeightCm(flight);
  return Math.max(flightHeightCm(flight + margin) - h, h - flightHeightCm(Math.max(0, flight - margin)));
}

const median = (values: number[]) => {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const seen = (frame: LandmarkFrame, i: number) => {
  const p = frame?.[i];
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= VIS;
};

// ─── Perception: signals in pixels, the ground, the leg length, the view ───

function rawSignal(spec: SignalSpec, read: PoseRead): (number | null)[] {
  const { width: W, height: H } = read;
  return read.landmarks.map(frame => {
    if (spec.kind === 'width') {
      const [a, b] = spec.points;
      return seen(frame, a) && seen(frame, b) ? Math.abs(frame![a].x - frame![b].x) * W : null;
    }
    const ys = spec.points.filter(i => seen(frame, i)).map(i => frame![i].y * H);
    if (!ys.length) return null;
    return spec.kind === 'lowest' ? Math.max(...ys) : ys.reduce((s, v) => s + v, 0) / ys.length;
  });
}

const mid = (frame: LandmarkFrame, a: number, b: number, W: number, H: number) =>
  seen(frame, a) && seen(frame, b) ? { x: ((frame![a].x + frame![b].x) / 2) * W, y: ((frame![a].y + frame![b].y) / 2) * H } : null;

/** The leg's length in pixels (hips to ankles, both sides' midpoints), median over the samples that see it. */
function legLength(read: PoseRead): number | null {
  const lengths: number[] = [];
  for (const frame of read.landmarks) {
    const hip = mid(frame, 23, 24, read.width, read.height), ankle = mid(frame, 27, 28, read.width, read.height);
    if (hip && ankle) lengths.push(Math.hypot(hip.x - ankle.x, hip.y - ankle.y));
  }
  return lengths.length >= MIN_SEEN * read.landmarks.length ? median(lengths) : null;
}

/** Front when the shoulders are wide for the torso, side when they overlap, unknown between. */
function cameraView(read: PoseRead): ActivityResult['view'] {
  const ratios: number[] = [];
  for (const frame of read.landmarks) {
    const sh = mid(frame, 11, 12, read.width, read.height), hip = mid(frame, 23, 24, read.width, read.height);
    if (!sh || !hip) continue;
    const torso = Math.hypot(sh.x - hip.x, sh.y - hip.y);
    if (torso > 0) ratios.push((Math.abs(frame![11].x - frame![12].x) * read.width) / torso);
  }
  if (!ratios.length) return 'unknown';
  const r = median(ratios);
  return r >= FRONT_MIN ? 'front' : r <= SIDE_MAX ? 'side' : 'unknown';
}

function smooth(values: (number | null)[], rate: number): (number | null)[] {
  let n = Math.round(SMOOTH_SEC * rate);
  if (n % 2 === 0) n += 1;
  const kernel = sgKernel(Math.max(3, n)), half = kernel.length >> 1;
  return values.map((v, i) => {
    if (v === null || i < half || i >= values.length - half) return v;
    let sum = 0;
    for (let j = 0; j < kernel.length; j++) {
      const x = values[i - half + j];
      if (x === null) return v;
      sum += kernel[j] * x;
    }
    return sum;
  });
}

// ─── The grammar: events ───

interface Context {
  read: PoseRead;
  t: number[];
  dt: number;
  rate: number;
  heights: Record<string, (number | null)[]>;
  widths: Record<string, (number | null)[]>;
  band: number;
  events: Record<string, FoundEvent[]>;
  /** Per airborne event key, each sample's state: true in the air, false on the ground, null unseen. */
  states: Record<string, (boolean | null)[]>;
}

/** Least-squares slope of `values` over the samples `from`..`to` (inclusive), per second. */
function slope(values: (number | null)[], t: number[], from: number, to: number): number | null {
  const pts: [number, number][] = [];
  for (let i = from; i <= to; i++) if (values[i] !== null) pts.push([t[i], values[i] as number]);
  if (pts.length < 2) return null;
  const mt = pts.reduce((s, p) => s + p[0], 0) / pts.length, mv = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  let num = 0, den = 0;
  for (const [x, y] of pts) { num += (x - mt) * (y - mv); den += (x - mt) ** 2; }
  return den > 0 ? num / den : null;
}

/**
 * Airborne phases: runs of samples whose signal is above the band. A contact lies between the last sample on one side
 * and the first on the other: its time is their midpoint, moved by the time the foot takes to cross the band (the band
 * over the foot's speed), and its margin is half their spacing plus a share of that correction.
 */
function airborne(ctx: Context, key: string, spec: Extract<EventSpec, { kind: 'airborne' }>): FoundEvent[] {
  const h = ctx.heights[spec.signal], t = ctx.t, n = t.length;
  const state = h.map(v => (v === null ? null : v > ctx.band));
  ctx.states[key] = state;
  const out: FoundEvent[] = [];
  for (let i = 0; i < n; i++) {
    if (state[i] !== true || (i > 0 && state[i - 1] === true)) continue;
    let c = i;
    while (c + 1 < n && state[c + 1] === true) c += 1;
    const b = i, a = b - 1, d = c + 1;
    const ev: FoundEvent = { start: b, end: c };
    if (a >= 0 && state[a] === false) {
      let k = b + 1;
      while (k + 1 <= c && t[k + 1] - t[b] <= SPEED_WINDOW_SEC) k += 1;
      const v = (k <= c ? slope(h, t, b, k) : null) ?? slope(h, t, a, b);
      const delta = v && v > 0 ? Math.min(0.1, ctx.band / v) : 0;
      ev.takeoff = (t[a] + t[b]) / 2 - delta;
      ev.takeoffMargin = (t[b] - t[a]) / 2 + BAND_SHARE * delta;
    }
    if (d < n && state[d] === false) {
      let k = c - 1;
      while (k - 1 >= b && t[c] - t[k - 1] <= SPEED_WINDOW_SEC) k -= 1;
      const s = (k >= b ? slope(h, t, k, c) : null) ?? slope(h, t, c, d);
      const v = s === null ? null : -s;
      const delta = v && v > 0 ? Math.min(0.1, ctx.band / v) : 0;
      ev.landing = (t[c] + t[d]) / 2 + delta;
      ev.landingMargin = (t[d] - t[c]) / 2 + BAND_SHARE * delta;
    }
    if (ev.takeoff !== undefined && ev.landing !== undefined) {
      ev.flight = ev.landing - ev.takeoff;
      ev.flightMargin = (ev.takeoffMargin as number) + (ev.landingMargin as number);
    }
    out.push(ev);
    i = c;
  }
  return out;
}

/** The standing level of a height signal: its median over the samples on the ground. */
function standing(values: (number | null)[], state: (boolean | null)[]): number {
  const on = values.filter((v, i) => v !== null && state[i] === false) as number[];
  return on.length ? median(on) : median(values.filter(v => v !== null) as number[]);
}

/**
 * Jumps: cycles of the hip that carry a flight. A cycle starts when the smoothed hip rises above standing by minRise and
 * ends when it falls back under half of that (a band, so noise at one level never starts two). The flights inside one
 * cycle are one jump: its takeoff is the first one's, its landing the last one's.
 */
function jumps(ctx: Context, spec: Extract<EventSpec, { kind: 'jump' }>): FoundEvent[] {
  const flights = ctx.events[spec.flight] ?? [], state = ctx.states[spec.flight] ?? [];
  const hip = smooth(ctx.heights[spec.hip], ctx.rate);
  const rest = standing(hip, state), high = rest + spec.minRise.value, low = rest + spec.minRise.value / 2;
  const cycles: [number, number][] = [];
  let open = -1;
  hip.forEach((v, i) => {
    if (v === null) return;
    if (open < 0 && v > high) open = i;
    else if (open >= 0 && v < low) { cycles.push([open, i]); open = -1; }
  });
  if (open >= 0) cycles.push([open, hip.length - 1]);
  const out: FoundEvent[] = [];
  for (const [s, e] of cycles) {
    const inside = flights.filter(f => f.start <= e && f.end >= s);
    if (!inside.length) continue;
    const first = inside[0], last = inside[inside.length - 1];
    const ev: FoundEvent = { start: first.start, end: last.end };
    if (first.takeoff !== undefined) { ev.takeoff = first.takeoff; ev.takeoffMargin = first.takeoffMargin; }
    if (last.landing !== undefined) { ev.landing = last.landing; ev.landingMargin = last.landingMargin; }
    if (ev.takeoff !== undefined && ev.landing !== undefined) {
      ev.flight = ev.landing - ev.takeoff;
      ev.flightMargin = (ev.takeoffMargin as number) + (ev.landingMargin as number);
    }
    const lasted = ev.flight ?? ctx.t[last.end] - ctx.t[first.start] + ctx.dt;
    if (lasted >= spec.minFlightSec.value) out.push(ev);
  }
  return out;
}

/** Strides: flights that belong to no jump, of at least minSamples samples. */
function strides(ctx: Context, spec: Extract<EventSpec, { kind: 'stride' }>): FoundEvent[] {
  const taken = ctx.events[spec.jump] ?? [];
  return (ctx.events[spec.flight] ?? []).filter(f =>
    f.end - f.start + 1 >= spec.minSamples.value && !taken.some(j => f.start <= j.end && f.end >= j.start));
}

/** Landings: after each jump's touchdown, the sample where the smoothed hip is lowest within withinSec. */
function landings(ctx: Context, spec: Extract<EventSpec, { kind: 'landing' }>): FoundEvent[] {
  const hip = smooth(ctx.heights[spec.hip], ctx.rate), t = ctx.t;
  const out: FoundEvent[] = [];
  for (const j of ctx.events[spec.jump] ?? []) {
    const from = j.landing ?? t[j.end] + ctx.dt / 2;
    let at = -1;
    for (let i = j.end + 1; i < t.length && t[i] <= from + spec.withinSec.value; i++) {
      if (hip[i] !== null && (at < 0 || (hip[i] as number) < (hip[at] as number))) at = i;
    }
    if (at >= 0) out.push({ start: j.end + 1, end: at, at });
  }
  return out;
}

// ─── Measures ───

const fps = (rate: number) => Math.round(rate);

function measure(spec: MeasureSpec, ctx: Context, view: ActivityResult['view']): MeasureResult {
  const base = { key: spec.key, label: spec.label, unit: spec.unit, formulaText: spec.formulaText, source: spec.source, status: spec.status, error: spec.error };
  const refuse = (refused: Text): MeasureResult => ({ ...base, value: null, margin: null, values: [], refused });
  const events = ctx.events[spec.of] ?? [];
  const f = spec.formula;
  if (spec.view === 'front' && view !== 'front') {
    return refuse({ fr: 'Se lit de face seulement : filmez de face pour la lire.', en: 'Read from the front only: film from the front to read it.' });
  }
  if (f.kind === 'count') return { ...base, value: events.length, margin: null, values: [], refused: null };
  if (!events.length) return refuse({ fr: 'Aucun saut lu.', en: 'No jump read.' });
  let values: MeasureValue[] = [];
  if (f.kind === 'flightHeight') {
    events.forEach((e, i) => {
      if (e.flight !== undefined && e.flightMargin !== undefined) values.push({ value: flightHeightCm(e.flight), margin: heightMarginCm(e.flight, e.flightMargin), event: i });
    });
    if (!values.length) return refuse({ fr: 'Aucun envol entier dans la vidéo.', en: 'No whole flight in the video.' });
  } else if (f.kind === 'contactBefore') {
    const before = ctx.events[f.before] ?? [];
    let seenOne = false;
    events.forEach((e, i) => {
      if (e.takeoff === undefined) return;
      const last = [...before].reverse().find(b => b.landing !== undefined && (b.landing as number) < (e.takeoff as number));
      if (!last || (e.takeoff as number) - (last.landing as number) > f.withinSec.value) return;
      seenOne = true;
      const value = (e.takeoff as number) - (last.landing as number);
      const margin = (e.takeoffMargin as number) + (last.landingMargin as number);
      if (margin <= f.maxRelError.value * value) values.push({ value, margin, event: i });
    });
    if (!values.length) {
      return refuse(seenOne
        ? { fr: `Pas mesurable à ${fps(ctx.rate)} images par seconde : la marge dépasserait le quart de la valeur.`, en: `Not measurable at ${fps(ctx.rate)} frames a second: the margin would exceed a quarter of the value.` }
        : { fr: `Pas d’élan lu : un saut sans course, ou des foulées trop brèves pour ${fps(ctx.rate)} images par seconde.`, en: `No run-up read: a standing jump, or strides too brief for ${fps(ctx.rate)} frames a second.` });
    }
  } else if (f.kind === 'widthRatio') {
    const num = ctx.widths[f.num], den = ctx.widths[f.den];
    events.forEach((e, i) => {
      if (e.at === undefined) return;
      const around = (s: (number | null)[]) => median([e.at! - 1, e.at!, e.at! + 1].map(k => s[k]).filter((v): v is number => v !== null && v !== undefined));
      const n = around(num), d = around(den);
      if (Number.isFinite(n) && Number.isFinite(d) && d > 0) { const r = n / d; values.push({ value: r, margin: null, event: i, flag: r < f.below.value }); }
    });
    if (!values.length) return refuse({ fr: 'Genoux ou chevilles non vus à la réception.', en: 'Knees or ankles not seen on landing.' });
  }
  const pick = spec.summary === 'max' ? values.reduce((a, b) => (b.value > a.value ? b : a))
    : spec.summary === 'min' ? values.reduce((a, b) => (b.value < a.value ? b : a)) : null;
  const value = pick ? pick.value : values.reduce((s, v) => s + v.value, 0) / values.length;
  const margins = values.map(v => v.margin).filter((m): m is number => m !== null);
  const margin = pick ? pick.margin : margins.length === values.length ? margins.reduce((s, m) => s + m, 0) / margins.length : null;
  const flagged = values.some(v => v.flag) ? true : values.some(v => v.flag === false) ? false : undefined;
  values = values.slice();
  return { ...base, value, margin, values, refused: null, ...(flagged === undefined ? {} : { flagged }) };
}

/**
 * Reads `spec` on a pose read: its signals, events and measures. A read that does not see the body's ruler (the
 * feet and the legs in at least half the samples) is refused whole: every measure then carries the reason.
 */
export function runActivity(spec: ActivitySpec, read: PoseRead): ActivityResult {
  const t = read.timestamps;
  const steps = t.slice(1).map((v, i) => v - t[i]).filter(v => v > 0);
  const dt = steps.length ? median(steps) : NaN;
  const rate = Number.isFinite(dt) && dt > 0 ? 1 / dt : 0;
  const duration = t.length ? t[t.length - 1] - t[0] : 0;
  const raw: Record<string, (number | null)[]> = {};
  for (const [key, s] of Object.entries(spec.signals)) raw[key] = rawSignal(s, read);
  const view = cameraView(read);
  const groundRaw = raw[spec.ground] ?? [];
  const seenGround = groundRaw.filter(v => v !== null) as number[];
  const leg = legLength(read);
  const empty = (refused: Text): ActivityResult => ({
    rate, dt, duration, view, ground: null, legLength: leg, band: null, signals: raw, events: {}, refused,
    measures: spec.measures.map(m => ({ key: m.key, label: m.label, unit: m.unit, formulaText: m.formulaText, source: m.source, status: m.status, error: m.error, value: null, margin: null, values: [], refused })),
  });
  if (!rate || t.length < 10) return empty({ fr: 'Vidéo trop courte pour être lue.', en: 'Video too short to read.' });
  if (!leg || seenGround.length < MIN_SEEN * t.length) {
    return empty({ fr: 'Pieds ou jambes trop peu visibles : filmez le corps entier, pieds compris.', en: 'Feet or legs too rarely seen: film the whole body, feet included.' });
  }
  const ground = median(seenGround);
  const heights: Record<string, (number | null)[]> = {}, widths: Record<string, (number | null)[]> = {};
  for (const [key, s] of Object.entries(spec.signals)) {
    if (s.kind === 'width') widths[key] = raw[key];
    else heights[key] = raw[key].map(y => (y === null ? null : (ground - y) / leg));
  }
  // The ground band: the airborne event's floor, or its noise on the ground if that is larger.
  const air = Object.values(spec.events).find((e): e is Extract<EventSpec, { kind: 'airborne' }> => e.kind === 'airborne');
  let band = 0;
  if (air) {
    const near = (heights[air.signal] ?? []).filter((v): v is number => v !== null && Math.abs(v) < NEAR_GROUND);
    const m = median(near), mad = median(near.map(v => Math.abs(v - m)));
    band = Math.max(air.floor.value, air.noiseK.value * 1.4826 * (Number.isFinite(mad) ? mad : 0));
  }
  const ctx: Context = { read, t, dt, rate, heights, widths, band, events: {}, states: {} };
  // Events in the order declared: an event reads only those declared before it.
  for (const [key, e] of Object.entries(spec.events)) {
    ctx.events[key] = e.kind === 'airborne' ? airborne(ctx, key, e)
      : e.kind === 'jump' ? jumps(ctx, e)
        : e.kind === 'stride' ? strides(ctx, e)
          : landings(ctx, e);
  }
  return {
    rate, dt, duration, view, ground, legLength: leg, band,
    signals: { ...heights, ...widths }, events: ctx.events,
    measures: spec.measures.map(m => measure(m, ctx, view)), refused: null,
  };
}
