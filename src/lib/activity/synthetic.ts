/**
 * Synthetic jumps with known truth (docs/VISION.md, the truth lab, level 1): the landmarks of a 1.75 m body whose hip
 * follows a ballistic arc in the air and whose toes leave and touch the ground at instants known exactly, sampled at a
 * chosen rate and phase, with optional Gaussian noise on every point.
 *
 * What it models: a countermovement (the hip drops, then drives up to the toes), the heels rising before the toes
 * leave, a toe-off whose speed rises from zero (toeLag), the knees tucking in the air, a touchdown with the hip lower
 * than at takeoff (drop: the legs land more bent than they left), the toes touching first on landing, the landing
 * absorbed by the hips and knees, a run-up of short strides with a brief flight each and a last contact of chosen
 * length (plant), the knees coming in on landing (the knee gap as a share of the ankle gap), and, on request, a hip
 * that moves relative to the centre of mass in the air (hipShift, metres, up positive: the arms or legs moving in the
 * air move the centre of mass relative to the hip, so the hip moves the other way relative to it). A toe-off of 0 (the default) is a limit, not a movement: a real toe leaves the
 * ground at zero vertical speed, so toeLag 0 is the fastest end of the range the engine allows for. What it does not
 * model: the pose model's own errors (motion blur, a foot point that lags or slips), the arms, perspective, a moving
 * camera. Those are level 2 (rendered bodies through the pose model) and level 3 (filmed people).
 *
 * The truth of a height is the hip's rise above its takeoff level, v0²/2g, with v0 = (g·t²/2 − drop)/t: h = g·t²/8 only
 * when the hip lands where it took off (drop 0).
 *
 * Every body proportion and timing below is a convention for a 1.75 m adult, UNSOURCED; status experimental. Nothing
 * here is read by a count.
 */
import type { Landmark, PoseRead } from './types';
import { G } from './engine';

export interface SyntheticJump {
  /** Seconds in the air. */
  flight: number;
  /** Strides of a run-up before the final contact (absent or 0: a standing jump). */
  approach?: number;
  /** Knee gap / ankle gap at the lowest point of the landing (absent: 1, knees over the ankles). */
  knees?: number;
  /** A squat instead of a jump: the hip goes down and up, the feet never leave the ground. */
  squat?: boolean;
  /** Metres the hip is lower at touchdown than at takeoff (absent: 0, the body lands as it took off). */
  drop?: number;
  /** Seconds the toe takes to reach the hip's speed after it leaves the ground, from zero vertical speed (absent: 0,
   *  the toe leaves at the hip's speed). */
  toeLag?: number;
  /** Seconds of the last contact of a run-up, from the last stride's touchdown to the takeoff (absent: 0.3). */
  plant?: number;
  /** Metres the hip rises relative to the body's centre of mass over the flight, and comes back over the landing
   *  (absent: 0, the hip moves as the centre of mass). The truth stays the centre of mass's rise: this is the error of
   *  taking the hip for the centre of mass, which the engine does (engine.ts, hipApex). */
  hipShift?: number;
}

export interface SyntheticOptions {
  jumps: SyntheticJump[];
  /** Samples per second. */
  rate: number;
  /** The first sample's time, in seconds (a phase within one sample interval). */
  phase?: number;
  view?: 'front' | 'side';
  /** Standard deviation of the noise on every point, in pixels, drawn by `noise`. */
  noisePx?: number;
  noise?: (sd: number) => number;
  width?: number;
  height?: number;
}

export interface SyntheticTruthJump {
  takeoff: number;
  landing: number;
  flight: number;
  /** The hip's rise above its takeoff level, v0²/2g, in centimetres (g·t²/8 when drop is 0). */
  heightCm: number;
  /** Metres the hip is lower at touchdown than at takeoff. */
  drop: number;
  /** Takeoff less the touchdown of the last run-up stride (null for a standing jump). */
  plant: number | null;
  knees: number;
}

export interface SyntheticRead extends PoseRead { truth: { jumps: SyntheticTruthJump[]; duration: number } }

// The body, in metres, and its timings, in seconds. Source: UNSOURCED, a convention for a 1.75 m adult chosen so the
// movement looks like a jump; none is measured on a filmed person. Status: experimental (every line below).
const HIP = 0.92;          // hip height standing
const ANKLE = 0.075;       // ankle above the sole
const TOES = 0.08;         // how far the heels, and with them the hip, rise when the body is on its toes
const DIP = 0.3;           // countermovement depth of the hip
const ABSORB = 0.3;        // how far the hip sinks to absorb a landing
const TUCK = 0.1;          // how far the feet rise towards the hip at the top of the flight
const STRIDE_DIP = 0.06;   // the hip during a run-up, below standing
const STRIDE_LIFT = 0.05;  // the lowest foot at the top of a stride's flight
const STRIDE_CONTACT = 0.24, STRIDE_FLIGHT = 0.1; // a run-up stride: its contact and its flight
const STAND = 1;           // standing still before the first jump and after each one
const DOWN = 0.35, UP = 0.25; // a standing jump's countermovement: the hip going down, then driving up to the toes
const PLANT = 0.3;         // a run-up's last contact (its default), half down, half up
const HEEL_RISE = 0.1;     // the heels rise over the last tenth of a second before the toes leave
const LAND = 0.3, RISE = 0.6; // the landing absorbed, then the body back to standing
const HEEL_DOWN = 0.08;    // the heels come down this long after the toes touch
const SQUAT = 0.6, SQUAT_DEPTH = 0.35; // a squat: each way, and how far the hip goes down
const STATURE = 1.75;

const ease = (u: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, u)))) / 2;
/** Cubic Hermite from p0 (velocity v0) to p1 (velocity v1) over `dur` seconds, at τ seconds in. */
function hermite(p0: number, v0: number, p1: number, v1: number, dur: number, tau: number) {
  const s = Math.min(1, Math.max(0, tau / dur)), s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * v0 * dur + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * v1 * dur;
}

/** The body at one instant: hip height, the feet's lowest point (toes) and heels above the ground, the knee ratio. */
interface Body { hip: number; toe: number; heel: number; knees: number; flex: number }
type Piece = { t0: number; t1: number; at: (tau: number) => Body };

function timeline(jumps: SyntheticJump[]) {
  const pieces: Piece[] = [];
  const truth: SyntheticTruthJump[] = [];
  let t = 0;
  const add = (dur: number, at: (tau: number) => Body) => { pieces.push({ t0: t, t1: t + dur, at }); t += dur; };
  const stand = (dur: number) => add(dur, () => ({ hip: HIP, toe: 0, heel: 0, knees: 1, flex: 0 }));
  stand(STAND);
  for (const jump of jumps) {
    const knees = jump.knees ?? 1;
    if (jump.squat) {
      add(SQUAT, tau => ({ hip: HIP - SQUAT_DEPTH * ease(tau / SQUAT), toe: 0, heel: 0, knees: 1, flex: ease(tau / SQUAT) }));
      add(SQUAT, tau => ({ hip: HIP - SQUAT_DEPTH * (1 - ease(tau / SQUAT)), toe: 0, heel: 0, knees: 1, flex: 1 - ease(tau / SQUAT) }));
      stand(STAND);
      continue;
    }
    const T = jump.flight, drop = jump.drop ?? 0, lag = jump.toeLag ?? 0, shift = jump.hipShift ?? 0;
    // Takeoff at the hip's level H0, touchdown at H0 − drop, T seconds later: v0 = (g·T²/2 − drop)/T.
    const v0 = (G * T * T / 2 - drop) / T;
    const strides = jump.approach ?? 0;
    let start = HIP, down = DOWN, up = UP, lastTouch: number | null = null;
    if (strides > 0) {
      for (let s = 0; s < strides; s++) {
        const from = s === 0 ? HIP : HIP - STRIDE_DIP;
        add(STRIDE_CONTACT, tau => ({ hip: from + (HIP - STRIDE_DIP - from) * ease(tau / STRIDE_CONTACT), toe: 0, heel: 0, knees: 1, flex: 0.2 }));
        add(STRIDE_FLIGHT, tau => {
          const lift = STRIDE_LIFT * Math.sin((Math.PI * tau) / STRIDE_FLIGHT);
          return { hip: HIP - STRIDE_DIP + 0.4 * lift, toe: lift, heel: lift, knees: 1, flex: 0.2 };
        });
      }
      lastTouch = t;
      const plant = jump.plant ?? PLANT;
      start = HIP - STRIDE_DIP; down = plant / 2; up = plant / 2;
    }
    const low = HIP - DIP, H0 = HIP + TOES;
    add(down, tau => ({ hip: start + (low - start) * ease(tau / down), toe: 0, heel: 0, knees: 1, flex: ease(tau / down) }));
    const heelFrom = up - HEEL_RISE;
    add(up, tau => ({ hip: hermite(low, 0, H0, v0, up, tau), toe: 0, heel: TOES * ease((tau - heelFrom) / HEEL_RISE), knees: 1, flex: 1 - ease(tau / up) }));
    const takeoff = t;
    add(T, tau => {
      const hip = H0 + v0 * tau - (G * tau * tau) / 2;
      // The toe follows the hip, tucks up towards it mid-flight, and reaches down by `drop` at touchdown (the legs land
      // more bent). With a lag it leaves the ground at zero vertical speed, the foot finishing its push: its speed below
      // the hip's is v0·(1 − u)² at u = τ/lag, so it rises from 0 at a constant acceleration at first and meets the
      // hip's at τ = lag. The toe then trails by v0·lag/3 (4 cm at 40 ms and 3 m/s), and the foot comes back under the
      // body over the flight, so it touches down when the hip is at H0 − drop.
      const u = lag > 0 ? Math.min(1, tau / lag) : 1;
      const trail = lag > 0 ? (v0 * lag * (1 - (1 - u) ** 3)) / 3 * (1 - ease(tau / T)) : 0;
      const toe = hip - H0 + TUCK * Math.sin((Math.PI * tau) / T) ** 2 + drop * ease(tau / T) - trail;
      // The hip landmark moves by `shift` relative to the centre of mass over the flight; the feet follow the centre.
      return { hip: hip + shift * ease(tau / T), toe, heel: toe + TOES, knees: 1, flex: 0.3 * Math.sin((Math.PI * tau) / T) ** 2 };
    });
    const landing = t;
    truth.push({ takeoff, landing, flight: T, heightCm: (v0 * v0) / (2 * G) * 100, drop, plant: lastTouch === null ? null : takeoff - lastTouch, knees });
    // The landing starts where the flight ends: the hip at H0 − drop, falling at g·T − v0.
    const top = H0 - drop, bottom = HIP - ABSORB, vLand = G * T - v0;
    add(LAND, tau => {
      // The centre of mass lands as above; the hip landmark comes back to it over the landing.
      const hip = hermite(top, -vLand, bottom, 0, LAND, tau) + shift * (1 - ease(tau / LAND));
      const depth = Math.min(1, Math.max(0, (top - hip) / (top - bottom)));
      return { hip, toe: 0, heel: TOES * (1 - ease(tau / HEEL_DOWN)), knees: 1 + (knees - 1) * depth, flex: depth };
    });
    add(RISE, tau => ({ hip: bottom + (HIP - bottom) * ease(tau / RISE), toe: 0, heel: 0, knees: 1 + (knees - 1) * (1 - ease(tau / RISE)), flex: 1 - ease(tau / RISE) }));
    stand(STAND);
  }
  return { pieces, truth, duration: t };
}

/**
 * The body of `jumps` at `t` seconds, in metres above the ground: the hip, and the feet's lowest point (the lower of
 * the toes and heels). The truth a test reads a contact's timing from (when the feet cross a level), at any precision.
 */
export function syntheticBodyAt(jumps: SyntheticJump[], t: number): { hip: number; feet: number } {
  const { pieces } = timeline(jumps);
  const piece = pieces.find(p => t < p.t1) ?? pieces[pieces.length - 1];
  const b = piece.at(t - piece.t0);
  return { hip: b.hip, feet: Math.min(b.toe, b.heel) };
}

/** The body's landmarks (33, MediaPipe order) in metres: x lateral or forward, z up. */
function bodyPoints(b: Body, view: 'front' | 'side'): [number, number][] {
  const ankle = b.heel + ANKLE;
  const knee = (b.hip + ankle) / 2;
  const sh = b.hip + 0.5, head = b.hip + 0.7;
  const p: [number, number][] = Array.from({ length: 33 }, () => [0, head]);
  if (view === 'front') {
    // The person's left (odd indices) on the image's right.
    const side = (l: number, r: number, x: number, z: number) => { p[l] = [x, z]; p[r] = [-x, z]; };
    p[0] = [0, head];
    side(1, 4, 0.02, head + 0.03); side(2, 5, 0.03, head + 0.03); side(3, 6, 0.045, head + 0.03);
    side(7, 8, 0.07, head); side(9, 10, 0.02, head - 0.04);
    side(11, 12, 0.2, sh); side(13, 14, 0.24, b.hip + 0.22); side(15, 16, 0.26, b.hip - 0.02);
    side(17, 18, 0.27, b.hip - 0.08); side(19, 20, 0.26, b.hip - 0.09); side(21, 22, 0.25, b.hip - 0.06);
    side(23, 24, 0.12, b.hip); side(25, 26, 0.13 * b.knees, knee); side(27, 28, 0.13, ankle);
    side(29, 30, 0.13, b.heel); side(31, 32, 0.15, b.toe);
  } else {
    // From the person's right: forward is the image's right; left and right points nearly overlap.
    const pair = (l: number, r: number, x: number, z: number) => { p[l] = [x - 0.01, z]; p[r] = [x + 0.01, z]; };
    p[0] = [0.1, head];
    pair(1, 4, 0.08, head + 0.03); pair(2, 5, 0.08, head + 0.03); pair(3, 6, 0.07, head + 0.03);
    pair(7, 8, 0, head); pair(9, 10, 0.08, head - 0.04);
    pair(11, 12, 0, sh); pair(13, 14, 0.02, b.hip + 0.22); pair(15, 16, 0.04, b.hip - 0.02);
    pair(17, 18, 0.05, b.hip - 0.08); pair(19, 20, 0.06, b.hip - 0.09); pair(21, 22, 0.05, b.hip - 0.06);
    pair(23, 24, 0, b.hip); pair(25, 26, 0.12 * b.flex, knee); pair(27, 28, 0, ankle);
    pair(29, 30, -0.05, b.heel); pair(31, 32, 0.17, b.toe);
  }
  return p;
}

/**
 * The jumps sampled at `rate` per second from `phase`, as a pose read (normalised landmarks, seconds, frame size),
 * with each jump's truth: takeoff, landing, flight, the hip's rise, the drop, the run-up's last contact, the knee ratio.
 */
export function syntheticJumps(opts: SyntheticOptions): SyntheticRead {
  const { jumps, rate, phase = 0, view = 'front', noisePx = 0, noise, width = 360, height = 640 } = opts;
  const { pieces, truth, duration } = timeline(jumps);
  const k = (0.55 * height) / STATURE;   // pixels per metre: the body takes 55 % of the frame's height
  const ground = 0.9 * height, cx = width / 2;
  const jitter = () => (noise && noisePx > 0 ? noise(noisePx) : 0);
  const landmarks: Landmark[][] = [], timestamps: number[] = [];
  let piece = 0;
  for (let i = 0; ; i++) {
    const t = phase + i / rate;
    if (t >= duration) break;
    while (piece < pieces.length - 1 && t >= pieces[piece].t1) piece += 1;
    const body = pieces[piece].at(t - pieces[piece].t0);
    landmarks.push(bodyPoints(body, view).map(([x, z]) => ({
      x: (cx + x * k + jitter()) / width,
      y: (ground - z * k + jitter()) / height,
      z: 0,
      visibility: 0.99,
    })));
    timestamps.push(t);
  }
  return { landmarks, timestamps, width, height, truth: { jumps: truth, duration } };
}

/** A seeded standard-normal noise for the screen's demonstration (mulberry32 and Box–Muller, as the counting tests'). */
export function seededNoise(seed: number): (sd: number) => number {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  return sd => sd * Math.sqrt(-2 * Math.log(Math.max(next(), 1e-12))) * Math.cos(2 * Math.PI * next());
}
