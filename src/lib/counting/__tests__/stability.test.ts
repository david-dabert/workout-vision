/**
 * Step 3c, rep details: ten reps separated by 2 s rests during which the angle
 * sits within 2° of the threshold that starts a rep, with 1° of random noise.
 * Across ten noise seeds, each rep's start may move by at most 0.2 s and its
 * range by at most 5°.
 *
 * The rest sits 1° on the rest side of the threshold. The threshold comes from
 * the set's own range, so the rest angle is found by asking the core for the
 * threshold of the noiseless set until the two agree.
 */
import { describe, it, expect } from 'vitest';
import { countReps, type Lift } from '../core';
import { jointFrame, sample, timestamps, seeded, gaussian, type Joint, type Segment } from './synthetic';

const SPS = 15; // the app's sampling
const SEEDS = 10;

type Case = { lift: Lift; joint: Joint; threshold: 'low' | 'high'; path: (rest: number) => Segment[] };

// Curl: rests with the arm nearly straight; each rep bends it, straightens it fully, settles.
// Lateral raise: rests with the arm slightly out; each rep raises it, lowers it fully, settles.
const CASES: Case[] = [
  {
    lift: 'bicep_curl', joint: 'elbow', threshold: 'high',
    path: rest => [{ hold: rest, sec: 2 }, ...Array.from({ length: 10 }, () => [
      { to: 50, sec: 0.8 }, { to: 170, sec: 1.0 }, { hold: 170, sec: 0.5 }, { to: rest, sec: 0.3 }, { hold: rest, sec: 2 },
    ] as Segment[]).flat()],
  },
  {
    lift: 'lateral_raise', joint: 'shoulder', threshold: 'low',
    path: rest => [{ hold: rest, sec: 2 }, ...Array.from({ length: 10 }, () => [
      { to: 100, sec: 0.8 }, { to: 10, sec: 1.0 }, { hold: 10, sec: 0.5 }, { to: rest, sec: 0.3 }, { hold: rest, sec: 2 },
    ] as Segment[]).flat()],
  },
];

function run(c: Case, rest: number, noise: (() => number) | null) {
  const angles = sample(c.path(rest), rest, SPS).map(a => (noise ? a + noise() : a));
  return countReps(angles.map(a => jointFrame(c.joint, { left: a })), timestamps(angles.length, SPS), c.lift);
}

function restNearThreshold(c: Case): number {
  let rest = c.threshold === 'high' ? 150 : 30;
  for (let k = 0; k < 20; k++) {
    const r = run(c, rest, null);
    const next = c.threshold === 'high' ? r.highThreshold + 1 : r.lowThreshold - 1;
    if (Math.abs(next - rest) < 0.01) break;
    rest = next;
  }
  return rest;
}

describe('Counting core — step 3c, rep details', () => {
  for (const c of CASES) {
    it(`${c.lift}: rests within 2° of the ${c.threshold} threshold, ten noise seeds, starts within 0.2 s and ranges within 5°`, () => {
      const rest = restNearThreshold(c);
      const check = run(c, rest, null);
      const threshold = c.threshold === 'high' ? check.highThreshold : check.lowThreshold;
      expect(Math.abs(rest - threshold)).toBeLessThanOrEqual(2);

      const starts: number[][] = [], ranges: number[][] = [];
      for (let seed = 1; seed <= SEEDS; seed++) {
        const rng = seeded(seed);
        const result = run(c, rest, () => gaussian(rng, 1));
        expect(result.count).toBe(10);
        result.reps.forEach((r, i) => {
          (starts[i] ||= []).push(r.startTime);
          (ranges[i] ||= []).push(r.romDegrees);
        });
      }
      const spread = (v: number[]) => Math.max(...v) - Math.min(...v);
      const worstStart = Math.max(...starts.map(spread));
      const worstRange = Math.max(...ranges.map(spread));
      expect(worstStart).toBeLessThanOrEqual(0.2);
      expect(worstRange).toBeLessThanOrEqual(5);
    });
  }
});
