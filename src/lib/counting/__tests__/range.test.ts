/**
 * A rep's range, measured twice: the same set with 2° of independent noise on the
 * angle, as two browsers decoding the same video give slightly different angles.
 * Over ten pairs of noise seeds, every rep's range must agree within 5°.
 * Two lifts: a curl that pauses at the top, and a pulldown that drifts slowly at
 * the bottom before it returns.
 */
import { describe, it, expect } from 'vitest';
import { countReps, type Lift } from '../core';
import { jointFrame, sample, timestamps, seeded, gaussian, type Joint, type Segment } from './synthetic';

const SPS = 15; // the app's sampling
const NOISE = 2;
const PAIRS = 10;

const repeat = (n: number, segments: Segment[]) => Array.from({ length: n }, () => segments).flat();

const CASES: { lift: Lift; joint: Joint; rest: number; path: Segment[] }[] = [
  {
    lift: 'bicep_curl', joint: 'elbow', rest: 165,
    path: [{ hold: 165, sec: 1.5 }, ...repeat(8, [{ to: 50, sec: 0.8 }, { hold: 50, sec: 0.3 }, { to: 165, sec: 1.0 }, { hold: 165, sec: 1.5 }])],
  },
  {
    lift: 'lat_pulldown', joint: 'elbow', rest: 170,
    path: [{ hold: 170, sec: 1.5 }, ...repeat(8, [{ to: 65, sec: 0.5 }, { to: 68, sec: 0.6 }, { to: 170, sec: 1.2 }, { hold: 170, sec: 1.2 }])],
  },
];

function measure(c: (typeof CASES)[number], seed: number) {
  const rng = seeded(seed);
  const angles = sample(c.path, c.rest, SPS).map(a => a + gaussian(rng, NOISE));
  return countReps(angles.map(a => jointFrame(c.joint, { left: a })), timestamps(angles.length, SPS), c.lift);
}

describe('Counting core — a rep\'s range, measured twice', () => {
  for (const c of CASES) {
    it(`${c.lift}: two measurements with ${NOISE}° of noise agree on every rep's range within 5°`, () => {
      let worst = 0;
      for (let k = 0; k < PAIRS; k++) {
        const a = measure(c, 2 * k + 1), b = measure(c, 2 * k + 2);
        expect(a.count).toBe(8);
        expect(b.count).toBe(8);
        a.reps.forEach((r, i) => { worst = Math.max(worst, Math.abs(r.romDegrees - b.reps[i].romDegrees)); });
      }
      expect(worst).toBeLessThanOrEqual(5);
    });
  }
});
