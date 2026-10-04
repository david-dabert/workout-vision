/**
 * A first rep whose return is all the video shows (HEAD_RETURN_SHARE in core.ts, 3 October 2026).
 * The video opens at the working end and the first return to rest is shorter than the shortest rep
 * (MIN_REP_SEC). It counts, marked clipped, only when that return took at least half of the set's own
 * return time (the median over its accepted reps, from each rep's working extreme to its rest threshold).
 * A quick move to rest before a slow set (edges.test.ts: 0.35 s against 1 s returns) stays uncounted.
 * Source: UNSOURCED. Status: experimental (chosen on the public build half A).
 */
import { describe, it, expect } from 'vitest';
import { countReps } from '../core';
import { jointFrame, sample, timestamps, type Segment } from './synthetic';

const frames = (angles: number[]) => angles.map(a => jointFrame('knee', { left: a }));
// A fast squat set: 0.6 s down, 0.6 s up, 0.5 s standing.
const fast = (n: number): Segment[] => {
  const p: Segment[] = [{ hold: 175, sec: 0.5 }];
  for (let r = 0; r < n; r++) p.push({ to: 80, sec: 0.6 }, { to: 175, sec: 0.6 }, { hold: 175, sec: 0.5 });
  return p;
};
const run = (path: Segment[], sps: number) => {
  const a = sample(path, 80, sps);
  return countReps(frames(a), timestamps(a.length, sps), 'squat');
};

describe('a first rep whose return is all the video shows', () => {
  for (const sps of [15, 30]) {
    it(`squat at ${sps} sps: a return as long as the set's own returns counts, marked clipped`, () => {
      const r = run([{ hold: 80, sec: 0.1 }, { to: 175, sec: 0.45 }, ...fast(5)], sps);
      expect(r.count).toBe(6);
      expect(r.reps[0].clipped).toBe(true);
    });
    it(`squat at ${sps} sps: a return much quicker than the set's own returns does not count`, () => {
      const r = run([{ hold: 80, sec: 0.1 }, { to: 175, sec: 0.15 }, ...fast(5)], sps);
      expect(r.count).toBe(5);
    });
    it(`squat at ${sps} sps: with a single rep after it there is nothing to compare with, and it does not count`, () => {
      const r = run([{ hold: 80, sec: 0.1 }, { to: 175, sec: 0.45 }, ...fast(1)], sps);
      expect(r.count).toBe(1);
    });
  }
});
