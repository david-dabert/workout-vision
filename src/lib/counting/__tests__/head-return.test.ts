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

// Audit of 6 October 2026, action 4 (A): splitOverlongReps adds cycles after the working extremes were recorded,
// so the set's extreme-to-rest times were read against the wrong reps (a later rep's extreme, after this one's
// end) and their median could fall below zero: any quick first return then counted. The median is now taken on
// the accepted reps before the split.
describe('a quick first return before a set with a split rep', () => {
  const REST = 170, WORK = 50;
  const rep = (): Segment[] => [{ to: WORK, sec: 1 }, { to: REST, sec: 1 }, { hold: REST, sec: 0.8 }];
  const doubled: Segment[] = [
    { to: WORK, sec: 1 }, { to: 140, sec: 0.9 }, { to: WORK, sec: 0.9 }, { to: REST, sec: 1 }, { hold: REST, sec: 0.8 },
  ];
  const curl = (path: Segment[], sps: number) => {
    const a = sample(path, WORK, sps);
    return countReps(a.map(x => jointFrame('elbow', { left: x })), timestamps(a.length, sps), 'bicep_curl');
  };
  // The split rep comes first, so most of the set's reps follow it (and were misread before the fix).
  const body: Segment[] = [{ hold: REST, sec: 0.8 }, ...doubled, ...rep(), ...rep(), ...rep(), ...rep()];
  // The head holds 0.2 s at the working end first, so the outlier filter keeps its opening samples.
  it('at 30 sps, a 0.15 s head is not counted; the split rep still counts two', () => {
    expect(curl([{ hold: WORK, sec: 0.2 }, { to: REST, sec: 0.15 }, ...body], 30).count).toBe(6);
    expect(curl(body, 30).count).toBe(6);
  });
  it('at 30 sps, a head as long as the set\'s returns still counts', () => {
    const r = curl([{ hold: WORK, sec: 0.1 }, { to: REST, sec: 0.45 }, ...body], 30);
    expect(r.count).toBe(7);
    expect(r.reps[0].clipped).toBe(true);
  });
});
