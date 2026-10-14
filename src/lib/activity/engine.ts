/**
 * The activity engine (docs/VISION.md, "The engine"): reads any activity specification (types.ts) on a pose read and
 * returns its events and measures, every value with its margin or the reason it is not shown (R8). Three layers:
 *
 * 1. Perception: the pose of every sample, in the shape the app's pose model gives it (coreAnalysis.js,
 *    analyzeCoreVideo: its imageLandmarks and timestamps; not yet wired to this engine), and the body's own ruler: the
 *    ground line, the leg length, the camera view.
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

// A no-break space, between a number and its noun and before a colon (the app's French typography).
const NB = '\u00A0';

// Perception settings. Each: source, then R9 status.
// A landmark below this visibility is unseen: the counting core's floor (VIS_THRESHOLD, core.ts). Status: convention.
const VIS = 0.5;
// A flight starts when the foot rises above the ground band and ends when it comes back under this share of it (two
// levels, so noise around one level never splits a flight in two or starts a false one: without it, 73 of 1000 run-ups
// at 240 a second and 1 px were refused for a step that was the last stride split in two). A touchdown is timed where
// the foot crosses this lower level. Source: UNSOURCED (a two-level threshold, the usual guard for a noisy signal).
// Status: experimental.
const EXIT_SHARE = 0.5;
// A contact's time is corrected for the crossing level with the foot's speed, read from the samples off the ground
// within this long of the crossing, on the contact's side of the flight's top (at least two samples). Source: UNSOURCED
// (set on the synthetic jumps: a run-up stride's 0.1 s flight decelerates within 0.06 s, which the first version of this
// window read across the top, giving no speed at all). Status: experimental.
const SPEED_WINDOW_SEC = 1 / 30;
// A sample reads on the ground when the foot is under this many of its own noise standard deviations above the ground
// line (or a tenth of the band, whichever is larger). Source: UNSOURCED (three standard deviations, a convention for
// noise). Status: experimental.
const LIFT_K = 3;
const LIFT_BAND = 0.1;
// The correction: the time the foot takes between the ground and the crossing level ℓ, read with its speed v there.
// - A touchdown: the foot arrives at speed, so ℓ/v.
// - A takeoff: the contact point (the toes) leaves the ground at zero vertical speed and accelerates. If its speed rises
//   no slower than uniformly, from 0 to the body's v within TOE_LAG_MAX, it covers ℓ in √(2ℓ·TOE_LAG_MAX/v) at most
//   (or ℓ/v + TOE_LAG_MAX/2 when ℓ lies beyond the v·TOE_LAG_MAX/2 it covers meanwhile) and ℓ/v at least (the limit of
//   a toe that leaves at full speed): the correction is the middle of that range, and half its width goes into the
//   margin. The synthetic toe-offs rise faster than uniformly at first, so they lie inside this range.
// - At a touchdown the foot's speed is not constant over the samples it is read from: ARRIVE_SHARE of ℓ/v goes into
//   the margin for it.
// - At a takeoff the speed is read, on average, `lead` seconds after the crossing (the middle of the samples the slope
//   is read from), and the toe has slowed by then: in the air the body falls at g, and a toe leaving the ground does
//   not fall faster than the body, so the toe's speed is at most g·lead lower, g in leg lengths of at least LEG_MIN_M.
//   The correction ℓ/v may be too long by that share, and it goes into the margin. Without it, a toe that left at full
//   speed sat at the edge of its margin, the range's half-width being then exactly its offset: at 0 px and 240 a
//   second, 10 of 400 takeoffs fell just outside (worst 1.02 times the margin). Source: kinematics, with the
//   assumption that the toe does not fall faster than the body (UNSOURCED). Status: experimental.
// Sources: kinematics for the ranges; TOE_LAG_MAX UNSOURCED (an assumption, not measured on a filmed foot: a toe that
// takes longer would fall outside the margin); ARRIVE_SHARE UNSOURCED, set on the tuning runs of the synthetic jumps
// (volleyball-heldout.test.ts: seeds 1 to 300 per rate, noise 0.5 to 1.5 px, toe-offs of 0 to 30 ms). Status:
// experimental.
const ARRIVE_SHARE = 0.25;
export const TOE_LAG_MAX = 0.04;
// The speed is a least-squares slope of noisy samples: this many of its standard errors, as a share of the speed; and
// the crossing is read on noisy samples, the ground line too: this many noise standard deviations over the speed (a
// term that does not shrink with the frame rate). Source: UNSOURCED, kept from the first version and checked on the same
// tuning runs. Status: experimental.
const SPEED_SE_K = 2;
const NOISE_K = 1;
// No correction is longer than this. Source: UNSOURCED (a foot that takes 0.1 s to cross a few centimetres is not
// leaving or reaching the ground). Status: experimental.
const MAX_CORRECTION_SEC = 0.1;
// A jump's height is read from the hip's flight, a parabola: its top, from a least-squares fit of the hip's samples in
// the air, known to this many standard errors. Source: UNSOURCED (three standard errors, a convention; at two, 94 to 98
// in 100 tops of the tuning runs fell inside). Status: experimental.
const APEX_K = 3;
// The fit needs at least this many hip samples in the air (a parabola has three unknowns, one more to check it).
// Source: convention. Status: convention.
const APEX_MIN_SAMPLES = 4;
// The fit's own scatter stands for the hip's noise only when it has at least this many degrees of freedom left (samples
// less the parabola's three unknowns); with fewer, the foot's noise on the ground stands alone. Source: convention (a
// variance from one residual is not an estimate). Status: convention.
const RESIDUAL_MIN_DOF = 2;
// The hip falls at g in the air: the leg length that fall implies (g over twice the parabola's curvature, in leg
// lengths per second²) must lie between these, in metres, or the hip is not in free flight and no height is read.
// Source: UNSOURCED (a generous range around adult hip-to-ankle lengths). Status: experimental.
const LEG_MIN_M = 0.5;
const LEG_MAX_M = 1.2;
// ... checked at this many standard errors of the fitted leg length: a fit is refused only when its leg lies outside the
// range by more than that. Source: convention (two standard errors). Status: convention.
const LEG_K = 2;
// The flight time caps the height from above (g·t²/8 at the flight's upper end, measure): when that cap leaves less
// than this share of the interval from the hip's top, or lies below it, the two readings of one jump disagree (the hip
// is then not moving as the body's centre of mass) and no height is shown for it. Source: UNSOURCED (a review of 14
// October 2026 found the cap cutting the interval below a tenth in 5 of 992 heights with the hip rising 2 to 5 cm
// relative to the centre of mass, all 5 outside their margin, and never with the hip as the centre of mass); how
// often it fires is printed by volleyball-heldout.test.ts. Status: experimental.
const CAP_MIN_SHARE = 0.1;
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
// A read of fewer samples than this is refused whole: under a second at 15 samples a second, too short to hold a
// standing level and a jump. Source: UNSOURCED. Status: experimental.
const MIN_SAMPLES = 10;
// A jump's takeoff and landing are read from flights of at least this many samples (one sample above the band may be a
// foot point's noise, as for a stride's minSamples). Source: UNSOURCED. Status: experimental.
const MIN_CONTACT_SAMPLES = 2;
// A jump's cycle ends when the smoothed hip falls back under this share of minRise above standing (two levels, as for
// the feet). Source: UNSOURCED (a two-level threshold, convention). Status: experimental.
const CYCLE_EXIT_SHARE = 0.5;
// The knee and ankle gaps at a landing's lowest point are read as the median of that sample and its two neighbours,
// so one noisy sample does not set the ratio. Source: UNSOURCED (the smallest median window, convention).
// Status: experimental.
const RATIO_WINDOW = 1;

/** h = g·t²/8 (flight-time method, Bosco et al. 1983), in centimetres: the rise when the hip lands where it took off. */
export const flightHeightCm = (flight: number) => (G * flight * flight) / 8 * 100;

/**
 * The rise of a body that leaves the ground at its takeoff level and lands `drop` metres lower, `flight` seconds later,
 * in centimetres: v0 = (g·t²/2 − Δ)/t, h = v0²/2g. With Δ = 0 it is g·t²/8.
 */
export function riseCm(flight: number, drop: number) {
  const v0 = (G * flight * flight / 2 - drop) / flight;
  return (v0 * v0) / (2 * G) * 100;
}

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
  /** The foot's noise on the ground (standard deviation, leg lengths), and whether it, not the floor, set the band. */
  noise: number;
  bandFromNoise: boolean;
  events: Record<string, FoundEvent[]>;
  specs: Record<string, EventSpec>;
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
 * The foot's speed at a contact's crossing, in leg lengths per second, with its standard error: the least-squares slope
 * of the samples within SPEED_WINDOW_SEC of the crossing `x`, from the sample in the air (`air`) to the highest sample of
 * the window, on the contact's side of the flight's top: a sample the next one shows to be the top is left out, so the
 * slope never reads across it. `ground` is the crossing's sample on the ground side: when it is already above `lift` it
 * belongs to the flight (the contact came before it) and is read too. `dir` is +1 at a takeoff (reading forwards), -1 at
 * a landing (reading backwards). At least two samples. `lead` is how far the samples' mean time lies from the crossing:
 * the slope reads the speed there, not at the crossing.
 */
function contactSpeed(h: (number | null)[], t: number[], x: number, ground: number, air: number,
  dir: 1 | -1, lift: number, noise: number): { v: number; se: number; lead: number } | null {
  const at = (i: number) => (i >= 0 && i < t.length ? h[i] : null);
  let near = air;
  for (let g = ground; g >= 0 && g < t.length && h[g] !== null && (h[g] as number) > lift && Math.abs(t[g] - x) <= SPEED_WINDOW_SEC; g -= dir) near = g;
  let far = air;
  for (let i = air + dir; i >= 0 && i < t.length && Math.abs(t[i] - x) <= SPEED_WINDOW_SEC; i += dir) {
    if (h[i] !== null && (h[far] === null || (h[i] as number) > (h[far] as number))) far = i;
  }
  // At a low frame rate the window may hold no other sample: the next one is read if the foot is still rising there.
  const next = air + dir;
  if (far === near && at(next) !== null && (at(next) as number) > (h[air] as number)) far = next;
  // The top of the flight: when the sample beyond `far` is lower (or unseen), `far` may be the top itself, and a slope
  // read to it would mix the rise and the fall. It is dropped; with nothing left, there is no speed.
  const beyond = at(far + dir);
  if (far !== near && (beyond === null || beyond < (h[far] as number))) far -= dir;
  if (far === near || (dir > 0 ? far < near : far > near)) return null;
  const from = Math.min(near, far), to = Math.max(near, far);
  const v = slope(h, t, from, to);
  if (v === null || dir * v <= 0) return null;
  const ts: number[] = [];
  for (let i = from; i <= to; i++) if (h[i] !== null) ts.push(t[i]);
  const mt = ts.reduce((s, x2) => s + x2, 0) / ts.length, sxx = ts.reduce((s, x2) => s + (x2 - mt) ** 2, 0);
  return { v: dir * v, se: sxx > 0 ? noise / Math.sqrt(sxx) : 0, lead: Math.abs(mt - x) };
}

/**
 * Airborne phases: a flight starts when the signal rises above the band and ends when it falls back under EXIT_SHARE of
 * it. Each contact is timed where the foot crosses that level ℓ (the band at a takeoff, the exit level at a touchdown):
 * it lies between the last sample on one side and the first on the other, at their midpoint moved by the time the foot
 * takes between the ground and ℓ (contact). Its margin is half the samples' spacing plus that correction's own
 * uncertainty; the correction is never more than MAX_CORRECTION_SEC. A takeoff is timed at the band, not lower: on the
 * toes just before leaving, the foot's lowest point reads noisier than standing, and a lower level would let that noise
 * pass for the takeoff (measured: 1 in 300 tuning runs at 60 a second, 29 ms early against a margin of 15 ms).
 */
function airborne(ctx: Context, key: string, spec: Extract<EventSpec, { kind: 'airborne' }>): FoundEvent[] {
  const h = ctx.heights[spec.signal], t = ctx.t, n = t.length;
  const exit = EXIT_SHARE * ctx.band;
  const state: (boolean | null)[] = [];
  let air = false;
  for (const v of h) {
    if (v === null) { state.push(null); continue; }
    air = air ? v > exit : v > ctx.band;
    state.push(air);
  }
  ctx.states[key] = state;
  const lift = Math.max(LIFT_K * ctx.noise, LIFT_BAND * ctx.band);
  /**
   * The crossing at `x` moved by the correction towards the ground, with its margin; null without a speed.
   * `top` is the flight's highest sample: between the crossing and the top the foot only slows down (at a touchdown,
   * read backwards, it only sped up), so its speed at the crossing is at least the chord's, (h[top] − ℓ)/|t[top] − x|.
   * When the slope is missing (it could only be read across the top) or under the chord, the chord bounds the speed
   * from below only: the correction then lies between 0 and ℓ over the chord's speed, and its middle is taken.
   */
  const contact = (x: number, spacing: number, sp: { v: number; se: number; lead: number } | null, top: number, level: number, takeoff: boolean) => {
    const span = Math.abs(t[top] - x), chord = span > 0 && h[top] !== null ? ((h[top] as number) - level) / span : 0;
    const bounded = !sp || sp.v < chord;
    if (bounded && !(chord > 0)) return null;
    const speed = bounded ? { v: chord, se: (Math.SQRT2 * ctx.noise) / span } : (sp as { v: number; se: number });
    const lo = bounded ? 0 : level / speed.v;
    // A toe that leaves at zero speed and reaches v within TOE_LAG_MAX covers ℓ within √(2ℓ·lag/v) when its speed rises
    // uniformly (constant acceleration v/lag), or ℓ/v + lag/2 when ℓ lies beyond the v·lag/2 it covers meanwhile.
    const atSpeed = level / speed.v;
    const hi = !takeoff ? atSpeed : level <= (speed.v * TOE_LAG_MAX) / 2 ? Math.sqrt((2 * level * TOE_LAG_MAX) / speed.v) : atSpeed + TOE_LAG_MAX / 2;
    const delta = (lo + hi) / 2;
    if (delta > MAX_CORRECTION_SEC) return null;
    // The speed read: at a touchdown a share of ℓ/v; at a takeoff the toe's slowing between the crossing and the samples
    // the slope is read from (none when the chord sets the speed: the range then starts at 0).
    const read = !takeoff ? ARRIVE_SHARE * atSpeed : bounded ? 0 : atSpeed * (G / LEG_MIN_M) * (sp as { lead: number }).lead / speed.v;
    const model = (hi - lo) / 2 + read;
    // The crossing is read on noisy samples: the noise over the foot's speed there. At a takeoff the toe may still be
    // accelerating at the crossing, as slow as ℓ over the longest time it can have taken (ℓ/hi), not yet at v.
    const slowest = takeoff ? Math.min(speed.v, level / hi) : speed.v;
    return { delta, margin: spacing / 2 + model + SPEED_SE_K * (speed.se / speed.v) * delta + NOISE_K * ctx.noise / slowest };
  };
  const out: FoundEvent[] = [];
  for (let i = 0; i < n; i++) {
    if (state[i] !== true || (i > 0 && state[i - 1] === true)) continue;
    let c = i;
    while (c + 1 < n && state[c + 1] === true) c += 1;
    const ev: FoundEvent = { start: i, end: c };
    let top = i;
    for (let k = i; k <= c; k++) if (h[k] !== null && (h[top] === null || (h[k] as number) > (h[top] as number))) top = k;
    const a = i - 1, d = c + 1;
    if (a >= 0 && state[a] === false) {
      const x = (t[a] + t[i]) / 2;
      const k = contact(x, t[i] - t[a], contactSpeed(h, t, x, a, i, 1, lift, ctx.noise), top, ctx.band, true);
      if (k) { ev.takeoff = x - k.delta; ev.takeoffMargin = k.margin; }
    }
    if (d < n && state[d] === false) {
      const x = (t[c] + t[d]) / 2;
      const k = contact(x, t[d] - t[c], contactSpeed(h, t, x, d, c, -1, lift, ctx.noise), top, exit, false);
      if (k) { ev.landing = x + k.delta; ev.landingMargin = k.margin; }
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
 * The top of the hip's flight: a least-squares parabola through the hip's samples from `from` to `to` (the feet above
 * the band), with the standard error of its top's time from the noise σ (leg lengths). Null when the samples are too
 * few, the parabola does not open downwards, or its curvature is not a fall at g for a human leg (LEG_MIN_M, LEG_MAX_M).
 */
function hipApex(h: (number | null)[], t: number[], from: number, to: number, sigmaFloor: number) {
  const pts: [number, number][] = [];
  for (let i = from; i <= to; i++) if (h[i] !== null) pts.push([t[i], h[i] as number]);
  if (pts.length < APEX_MIN_SAMPLES) return null;
  const tm = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  // Normal equations of y = c0 + c1·u + c2·u², u = t − tm.
  const S = [0, 0, 0, 0, 0], Y = [0, 0, 0];
  for (const [ti, y] of pts) {
    const u = ti - tm;
    let p = 1;
    for (let k = 0; k < 5; k++) { S[k] += p; if (k < 3) Y[k] += p * y; p *= u; }
  }
  const M = [[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]];
  const inv = invert3(M);
  if (!inv) return null;
  const c = [0, 1, 2].map(r => inv[r][0] * Y[0] + inv[r][1] * Y[1] + inv[r][2] * Y[2]);
  if (!(c[2] < 0)) return null;
  const rss = pts.reduce((s, [ti, y]) => { const u = ti - tm; return s + (y - (c[0] + c[1] * u + c[2] * u * u)) ** 2; }, 0);
  const dof = pts.length - 3;
  const sigma = Math.max(sigmaFloor, dof >= RESIDUAL_MIN_DOF ? Math.sqrt(rss / dof) : 0);
  const cov = (r: number, q: number) => sigma * sigma * inv[r][q];
  const top = -c[1] / (2 * c[2]);
  // Its standard error, to first order: ∂top/∂c1 = −1/(2·c2), ∂top/∂c2 = c1/(2·c2²).
  const g1 = -1 / (2 * c[2]), g2 = c[1] / (2 * c[2] * c[2]);
  const se = Math.sqrt(Math.max(0, g1 * g1 * cov(1, 1) + 2 * g1 * g2 * cov(1, 2) + g2 * g2 * cov(2, 2)));
  // The hip falls at g: in leg lengths, c2 = −g/(2·L), so the leg is L = −g/(2·c2) metres long, ± its error.
  const leg = -G / (2 * c[2]), legSe = (G / (2 * c[2] * c[2])) * Math.sqrt(cov(2, 2));
  if (leg + LEG_K * legSe < LEG_MIN_M || leg - LEG_K * legSe > LEG_MAX_M) return null;
  return { at: tm + top, se, leg };
}

function invert3(m: number[][]): number[][] | null {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!(Math.abs(det) > 1e-300)) return null;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}

/**
 * Jumps: cycles of the hip that carry a flight. A cycle starts when the smoothed hip rises above standing by minRise and
 * ends when it falls back under CYCLE_EXIT_SHARE of that (two levels, so noise at one level never starts two). The
 * flights inside one cycle are one jump: its takeoff is the first one's, its landing the last one's. Each jump also
 * carries the top of its hip's flight (hipApex), from which its height is read.
 */
function jumps(ctx: Context, spec: Extract<EventSpec, { kind: 'jump' }>): FoundEvent[] {
  const flights = ctx.events[spec.flight] ?? [], state = ctx.states[spec.flight] ?? [];
  const raw = ctx.heights[spec.hip];
  const hip = smooth(raw, ctx.rate);
  const rest = standing(hip, state), high = rest + spec.minRise.value, low = rest + CYCLE_EXIT_SHARE * spec.minRise.value;
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
    // The takeoff and the landing are read from the first and last flights of at least MIN_CONTACT_SAMPLES: one sample
    // above the band just before the takeoff or just after the touchdown is the foot's noise (seed 255 at 120 a second
    // and 1.75 px: one toe sample read 3 cm up 6 ms after the touchdown, and the landing came 13 ms late).
    const long = inside.filter(f => f.end - f.start + 1 >= MIN_CONTACT_SAMPLES);
    if (!long.length) continue;
    const first = long[0], last = long[long.length - 1];
    const ev: FoundEvent = { start: first.start, end: last.end };
    if (first.takeoff !== undefined) { ev.takeoff = first.takeoff; ev.takeoffMargin = first.takeoffMargin; }
    if (last.landing !== undefined) { ev.landing = last.landing; ev.landingMargin = last.landingMargin; }
    if (ev.takeoff !== undefined && ev.landing !== undefined) {
      ev.flight = ev.landing - ev.takeoff;
      ev.flightMargin = (ev.takeoffMargin as number) + (ev.landingMargin as number);
    }
    // The hip's noise: the foot's own on the ground (both are pose points read the same way), or the fit's scatter.
    const apex = hipApex(raw, ctx.t, first.start, last.end, ctx.noise);
    if (apex) {
      ev.apex = apex.at; ev.apexMargin = APEX_K * apex.se; ev.legM = apex.leg;
      // How much lower the hip lands than it took off: on the parabola, Δ = g·t·(mid-flight − top), in metres.
      if (ev.flight !== undefined) ev.drop = G * ev.flight * ((ev.takeoff as number) + ev.flight / 2 - apex.at);
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
/** A French or English noun in the plural from two on. */
const plural = (k: number, word: string) => (k > 1 ? `${word}s` : word);

function measure(spec: MeasureSpec, ctx: Context, view: ActivityResult['view']): MeasureResult {
  const base = { key: spec.key, label: spec.label, unit: spec.unit, formulaText: spec.formulaText, source: spec.source, status: spec.status, error: spec.error };
  const refuse = (refused: Text): MeasureResult => ({ ...base, value: null, margin: null, values: [], refused });
  const events = ctx.events[spec.of] ?? [];
  const f = spec.formula;
  if (spec.view === 'front' && view !== 'front') {
    return refuse({ fr: 'Mesure possible de face uniquement\u00A0: filmez de face.', en: 'Measurable from the front only: film from the front.' });
  }
  if (f.kind === 'count') return { ...base, value: events.length, margin: null, values: [], refused: null };
  // French: awaiting David's approval (R10), every line of this function.
  if (!events.length) return refuse({ fr: 'Aucun saut détecté.', en: 'No jump detected.' });
  const values: MeasureValue[] = [];
  // An event whose value was computed but not shown (its margin too wide): its interval, from which the highest can
  // still be named when it lies wholly below the others (see below).
  const unshown: ({ lo: number; hi: number } | null)[] = events.map(() => null);
  // Why each event left without a value has none, in a few words, for its cell in the table. French: written after
  // the third review (14 October 2026), awaiting David's approval (R10), as every reason below.
  const withheld: { event: number; reason: Text }[] = [];
  const marginTooWide = { fr: 'La marge dépasse le quart de la valeur.', en: 'The margin exceeds a quarter of the value.' };
  // Why the highest or the lowest cannot be named, in the words of what is measured; and what a mean was taken over.
  let unnamed: Text = { fr: 'Impossible de désigner la valeur extrême\u00A0: un événement n’est pas mesuré.', en: 'The extreme value cannot be named: an event is not measured.' };
  let scope: Text | undefined;
  const tooWide = { fr: `Pas mesurable à ${fps(ctx.rate)}${NB}images par seconde\u00A0: la marge dépasserait le quart de la valeur.`, en: `Not measurable at ${fps(ctx.rate)} frames a second: the margin would exceed a quarter of the value.` };
  if (f.kind === 'flightHeight') {
    // The rise from the takeoff to the top of the hip's flight: v0 = g·(top − takeoff), h = v0²/2g. It is the flight-time
    // formula corrected for a landing lower than the takeoff: with Δ read on the same parabola, v0 = (g·t²/2 − Δ)/t
    // reduces to g·(top − takeoff), so the touchdown's own error cancels and the margin is the takeoff's and the top's.
    // A body leaves the ground fully extended on its toes and cannot land more extended (Δ ≥ 0), so it never rises more
    // than g·t²/8: when the flight is timed, that height's upper end caps the interval. Source: UNSOURCED (kinematics of
    // a jump on level ground; a landing on a raised surface would break it). Status: experimental. The cap is also a
    // check: when it leaves less than CAP_MIN_SHARE of the interval, the two readings disagree and the jump's height is
    // not shown; and it never makes the margin smaller than the flight-time method's own (heightMarginCm), so two
    // readings that barely meet do not pass for a precise one. The value shown is the middle of the interval.
    let whole = 0, disagree = 0;
    const unseen = { fr: 'Décollage ou sommet de la hanche non vu.', en: 'Takeoff or top of the hip not seen.' };
    events.forEach((e, i) => {
      if (e.takeoff === undefined || e.apex === undefined) { withheld.push({ event: i, reason: unseen }); return; }
      const up = e.apex - e.takeoff, m = (e.takeoffMargin as number) + (e.apexMargin as number);
      if (!(up > 0)) { withheld.push({ event: i, reason: unseen }); return; }
      whole += 1;
      const lo = (G * Math.max(0, up - m) ** 2) / 2 * 100;
      let hi = (G * (up + m) ** 2) / 2 * 100, floor = 0;
      if (e.flight !== undefined && e.flightMargin !== undefined) {
        const cap = flightHeightCm(e.flight + e.flightMargin);
        if (cap - lo < CAP_MIN_SHARE * (hi - lo)) {
          disagree += 1;
          withheld.push({ event: i, reason: { fr: 'Le temps de vol et la courbe de la hanche ne concordent pas.', en: 'The flight time and the hip\'s curve disagree.' } });
          return;
        }
        hi = Math.min(hi, cap);
        floor = heightMarginCm(e.flight, e.flightMargin);
      }
      const h = (lo + hi) / 2, margin = Math.max((hi - lo) / 2, floor);
      if (margin <= f.maxRelError.value * h) values.push({ value: h, margin, event: i });
      else { unshown[i] = { lo: h - margin, hi: h + margin }; withheld.push({ event: i, reason: marginTooWide }); }
    });
    if (!whole) return refuse({ fr: 'Aucun saut vu du décollage jusqu’au sommet.', en: 'No jump seen from the takeoff to the top.' });
    if (!values.length) {
      return refuse(disagree === whole
        ? { fr: 'Pas de hauteur\u00A0: le temps de vol et la courbe de la hanche ne concordent pas.', en: 'No height: the flight time and the hip\'s curve disagree.' }
        : tooWide);
    }
    unnamed = { fr: `Hauteur mesurée sur ${values.length}${NB}${plural(values.length, 'saut')} sur ${events.length}\u00A0: impossible de désigner le meilleur.`, en: `Height measured on ${values.length} ${plural(values.length, 'jump')} of ${events.length}: the best cannot be named.` };
  } else if (f.kind === 'contactBefore') {
    const before = ctx.events[f.before] ?? [];
    // The flights the `before` events are drawn from (a stride's), and the fewest samples a stride is read from.
    const from = ctx.specs[f.before], stride = from && from.kind === 'stride' ? from : null;
    const flights = stride ? ctx.events[stride.flight] ?? [] : [], minSamples = stride ? stride.minSamples.value : 1;
    if (ctx.rate < f.minRate.value) {
      return refuse({ fr: `Élan non mesurable à ${fps(ctx.rate)}${NB}images par seconde\u00A0: les foulées sont trop brèves pour cette cadence.`, en: `Run-up not measurable at ${fps(ctx.rate)} frames a second: the strides are too brief for this frame rate.` });
    }
    // A stride's flight clears the ground by a few centimetres only: when the foot's own noise sets the ground band
    // (above its floor), a stride can hide under the band or noise can pass for one. Measured on the synthetic run-ups
    // without this check (800 at 30 to 240 a second): at 2.5 px of noise 3 of the 65 values shown fell outside their
    // margin, at 2 px 1 of 199. Source: UNSOURCED. Status: experimental.
    if (ctx.bandFromNoise) {
      return refuse({ fr: 'Pas mesurable sur cette vidéo\u00A0: les pieds bougent trop à l’image pour voir des foulées de quelques centimètres.', en: 'Not measurable on this video: the feet jitter too much in the image to see strides of a few centimetres.' });
    }
    let seen = 0, brief = false, undated = false;
    events.forEach((e, i) => {
      if (e.takeoff === undefined) { withheld.push({ event: i, reason: { fr: 'Décollage non vu.', en: 'Takeoff not seen.' } }); return; }
      const takeoff = e.takeoff;
      const last = [...before].reverse().find(b => b.end < e.start);
      if (!last || takeoff - ctx.t[last.end] > f.withinSec.value) {
        withheld.push({ event: i, reason: { fr: 'Aucun élan détecté avant ce saut.', en: 'No run-up detected before this jump.' } });
        return;
      }
      seen += 1;
      // A rise of the foot between the last stride and the takeoff too brief to be read as a stride (fewer than its
      // minSamples): a step missed, or noise. Either way the last stride read may not be the last one made.
      if (flights.some(x => x.start > last.end && x.end < e.start && x.end - x.start + 1 < minSamples)) {
        brief = true;
        withheld.push({ event: i, reason: { fr: 'Juste avant le décollage, le pied se soulève trop brièvement pour savoir si c’est un pas.', en: 'Just before the takeoff the foot lifts too briefly to tell whether it is a step.' } });
        return;
      }
      if (last.landing === undefined) {
        undated = true;
        withheld.push({ event: i, reason: { fr: 'Le moment où le pied se repose au dernier appui ne peut pas être daté.', en: 'The moment the foot comes down on the last step cannot be timed.' } });
        return;
      }
      const value = takeoff - last.landing;
      const margin = (e.takeoffMargin as number) + (last.landingMargin as number);
      if (margin <= f.maxRelError.value * value) values.push({ value, margin, event: i });
      else withheld.push({ event: i, reason: marginTooWide });
    });
    if (!values.length) {
      return refuse(brief
        ? { fr: `Pas mesurable à ${fps(ctx.rate)}${NB}images par seconde\u00A0: juste avant le décollage, le pied se soulève trop brièvement pour savoir si c’est un pas.`, en: `Not measurable at ${fps(ctx.rate)} frames a second: just before the takeoff the foot lifts too briefly to tell whether it is a step.` }
        : undated
        ? { fr: `Pas mesurable à ${fps(ctx.rate)}${NB}images par seconde\u00A0: le moment où le pied se repose au dernier appui ne peut pas être daté.`, en: `Not measurable at ${fps(ctx.rate)} frames a second: the moment the foot comes down on the last step cannot be timed.` }
        : seen
        ? tooWide
        : { fr: `Aucun élan détecté\u00A0: saut sans course d’élan, ou foulées trop brèves pour ${fps(ctx.rate)}${NB}images par seconde.`, en: `No run-up detected: a standing jump, or strides too brief for ${fps(ctx.rate)} frames a second.` });
    }
    // A mean says what it was taken over: the run-ups measured, among those detected.
    const n = values.length;
    scope = n === seen
      ? { fr: `Moyenne sur ${n}${NB}${plural(n, 'élan')}.`, en: `Mean of ${n} ${plural(n, 'run-up')}.` }
      : { fr: `Moyenne sur ${n} des ${seen}${NB}élans détectés.`, en: `Mean of ${n} of the ${seen} run-ups detected.` };
  } else if (f.kind === 'widthRatio') {
    const num = ctx.widths[f.num], den = ctx.widths[f.den];
    const kneesUnseen = { fr: 'Genoux ou chevilles non vus à la réception.', en: 'Knees or ankles not seen on landing.' };
    events.forEach((e, i) => {
      if (e.at === undefined) { withheld.push({ event: i, reason: kneesUnseen }); return; }
      const window: number[] = [];
      for (let k = e.at - RATIO_WINDOW; k <= e.at + RATIO_WINDOW; k++) window.push(k);
      const around = (s: (number | null)[]) => median(window.map(k => s[k]).filter((v): v is number => v !== null && v !== undefined));
      const n = around(num), d = around(den);
      if (Number.isFinite(n) && Number.isFinite(d) && d > 0) { const r = n / d; values.push({ value: r, margin: null, event: i, flag: r < f.below.value }); }
      else withheld.push({ event: i, reason: kneesUnseen });
    });
    if (!values.length) return refuse(kneesUnseen);
    unnamed = { fr: `Genoux vus sur ${values.length}${NB}${plural(values.length, 'réception')} sur ${events.length}\u00A0: impossible de désigner celle où ils rentrent le plus.`, en: `Knees seen on ${values.length} ${plural(values.length, 'landing')} of ${events.length}: the one where they come in most cannot be named.` };
  }
  // The highest or the lowest names one event among all. With an event left unshown it can still be named when every
  // event left unshown has an interval wholly below the highest lower bound among those shown (for the lowest, above
  // the lowest upper bound): none of them can then be the true highest. Otherwise the summary is refused, and each
  // event's value is kept, so the values that were measured are still shown event by event.
  if (spec.summary === 'max' || spec.summary === 'min') {
    const max = spec.summary === 'max';
    const known = values.every(v => v.margin !== null);
    const bound = known ? (max ? Math.max(...values.map(v => v.value - (v.margin as number))) : Math.min(...values.map(v => v.value + (v.margin as number)))) : NaN;
    const named = events.every((_, i) => values.some(v => v.event === i) || (known && unshown[i] !== null
      && (max ? (unshown[i] as { hi: number }).hi < bound : (unshown[i] as { lo: number }).lo > bound)));
    if (!named) return { ...base, value: null, margin: null, values, refused: unnamed, withheld };
  }
  const pick = spec.summary === 'max' ? values.reduce((a, b) => (b.value > a.value ? b : a))
    : spec.summary === 'min' ? values.reduce((a, b) => (b.value < a.value ? b : a)) : null;
  const value = pick ? pick.value : values.reduce((s, v) => s + v.value, 0) / values.length;
  const margins = values.map(v => v.margin).filter((m): m is number => m !== null);
  const known = margins.length === values.length;
  // The highest value shown lies within the largest margin of the true highest (each value within its own margin, and
  // no event left unshown can be the highest), and a mean within the mean of the margins of the mean of the truths.
  const margin = !known ? null : pick ? Math.max(...margins) : margins.reduce((s, m) => s + m, 0) / margins.length;
  const flagged = values.some(v => v.flag) ? true : values.some(v => v.flag === false) ? false : undefined;
  return { ...base, value, margin, values, refused: null, withheld, ...(scope ? { scope } : {}), ...(flagged === undefined ? {} : { flagged }) };
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
  // French: awaiting David's approval (R10).
  if (!rate || t.length < MIN_SAMPLES) return empty({ fr: 'Vidéo trop courte pour être analysée.', en: 'Video too short to analyse.' });
  if (!leg || seenGround.length < MIN_SEEN * t.length) {
    return empty({ fr: 'Pieds ou jambes trop peu visibles\u00A0: filmez le corps entier, pieds compris.', en: 'Feet or legs too rarely seen: film the whole body, feet included.' });
  }
  const ground = median(seenGround);
  const heights: Record<string, (number | null)[]> = {}, widths: Record<string, (number | null)[]> = {};
  for (const [key, s] of Object.entries(spec.signals)) {
    if (s.kind === 'width') widths[key] = raw[key];
    else heights[key] = raw[key].map(y => (y === null ? null : (ground - y) / leg));
  }
  // The ground band: the airborne event's floor, or its noise on the ground if that is larger.
  const air = Object.values(spec.events).find((e): e is Extract<EventSpec, { kind: 'airborne' }> => e.kind === 'airborne');
  let band = 0, noise = 0, bandFromNoise = false;
  if (air) {
    const near = (heights[air.signal] ?? []).filter((v): v is number => v !== null && Math.abs(v) < NEAR_GROUND);
    const m = median(near), mad = median(near.map(v => Math.abs(v - m)));
    // 1.4826: the median absolute deviation's factor to a standard deviation for Gaussian noise. Status: convention.
    noise = 1.4826 * (Number.isFinite(mad) ? mad : 0);
    band = Math.max(air.floor.value, air.noiseK.value * noise);
    bandFromNoise = air.noiseK.value * noise > air.floor.value;
  }
  const ctx: Context = { read, t, dt, rate, heights, widths, band, noise, bandFromNoise, events: {}, specs: spec.events, states: {} };
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
