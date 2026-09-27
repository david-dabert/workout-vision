/**
 * Synthetic sets for the counting core's tests: a joint angle over time, turned
 * into MediaPipe world-landmark frames. Only the three landmarks of the joint are
 * visible (0.99); every other landmark is at 0.1, as a hidden one would be.
 */
import type { WorldLandmark, WorldLandmarkFrame } from '../core';

export type Joint = 'elbow' | 'shoulder' | 'knee' | 'hip';
export type Side = 'left' | 'right';

// The joint's three landmarks (first point, vertex, last point), left then right.
const POINTS: Record<Joint, { left: [number, number, number]; right: [number, number, number] }> = {
  elbow: { left: [11, 13, 15], right: [12, 14, 16] },     // shoulder, elbow, wrist
  shoulder: { left: [23, 11, 13], right: [24, 12, 14] },  // hip, shoulder, elbow
  knee: { left: [23, 25, 27], right: [24, 26, 28] },      // hip, knee, ankle
  hip: { left: [11, 23, 25], right: [12, 24, 26] },       // shoulder, hip, knee
};

const hidden = (): WorldLandmark => ({ x: 0, y: 0, z: 0, visibility: 0.1 });

/** One frame with the given angle on each side listed; an absent side stays hidden. */
export function jointFrame(joint: Joint, angles: Partial<Record<Side, number>>): WorldLandmarkFrame {
  const frame: WorldLandmark[] = Array.from({ length: 33 }, hidden);
  for (const side of ['left', 'right'] as const) {
    const angle = angles[side];
    if (angle === undefined) continue;
    const [a, v, c] = POINTS[joint][side];
    const offset = side === 'left' ? -0.2 : 0.2; // the two sides apart, as on a body
    const rad = (Math.PI - (angle * Math.PI) / 180);
    frame[a] = { x: offset, y: -0.3, z: 0, visibility: 0.99 };
    frame[v] = { x: offset, y: 0, z: 0, visibility: 0.99 };
    frame[c] = { x: offset + 0.3 * Math.sin(rad), y: 0.3 * Math.cos(rad), z: 0, visibility: 0.99 };
  }
  return frame;
}

/** A seeded generator (mulberry32), so a failing seed can be replayed. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gaussian noise of the given standard deviation (Box–Muller). */
export function gaussian(rng: () => number, sd: number): number {
  const u = Math.max(rng(), 1e-12), v = rng();
  return sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * A path of the joint angle, as segments: hold an angle, or move linearly to one.
 * Sampled by timestamp at `sps` samples per second.
 */
export type Segment = { hold: number; sec: number } | { to: number; sec: number };

export function sample(path: Segment[], start: number, sps: number): number[] {
  const out: number[] = [];
  let angle = start;
  for (const seg of path) {
    const n = Math.max(1, Math.round(seg.sec * sps));
    if ('hold' in seg) {
      angle = seg.hold;
      for (let i = 0; i < n; i++) out.push(angle);
    } else {
      const from = angle;
      for (let i = 1; i <= n; i++) out.push(from + ((seg.to - from) * i) / n);
      angle = seg.to;
    }
  }
  return out;
}

export function timestamps(n: number, sps: number): number[] {
  return Array.from({ length: n }, (_, i) => i / sps);
}

/**
 * Ten (or `reps`) cycles of one joint between its rest angle and its working
 * angle: rest, first phase, second phase, rest again.
 */
export function cycles({ rest, work, reps = 10, firstSec = 1, secondSec = 1, restSec = 0.8 }: {
  rest: number; work: number; reps?: number; firstSec?: number; secondSec?: number; restSec?: number;
}): Segment[] {
  const path: Segment[] = [{ hold: rest, sec: restSec }];
  for (let r = 0; r < reps; r++) path.push({ to: work, sec: firstSec }, { to: rest, sec: secondSec }, { hold: rest, sec: restSec });
  return path;
}

/** Wobble of a fraction of the range, uniform, from a seeded generator. */
export function wobble(angles: number[], amplitude: number, rng: () => number): number[] {
  return angles.map(a => a + (rng() - 0.5) * amplitude);
}
