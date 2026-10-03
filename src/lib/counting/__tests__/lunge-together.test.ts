/**
 * Forward and reverse lunges, 3 October: both knees bend on every rep (`together`, core.ts). Counted on the knee
 * with more reps (eitherSide), a set where each knee loses sight of a different rep reads short on both, and a
 * set where each knee is in sight for under half of it was refused though one of them saw every rep. Both knees
 * are now counted and joined, and a sample is seen when either knee is (coreAnalysis.js).
 * Angles are illustrative (UNSOURCED): standing 175°, the lunge's bottom 95°.
 */
import { describe, expect, it } from 'vitest';
import { countReps } from '../core';
import { summarizeCount } from '../../coreAnalysis';
import { cycles, jointFrame, sample, timestamps } from './synthetic';

const SPS = 15;
// Six lunges: 1.5 s standing, then each rep 0.9 s down, 0.9 s up and 0.5 s standing (starting at 1.5, 3.8, 6.1,
// 8.4, 10.7 and 13 s), then `after` seconds standing.
const set = (after = 1) => sample([{ hold: 175, sec: 1 }, ...cycles({ rest: 175, work: 95, reps: 6, firstSec: 0.9, secondSec: 0.9, restSec: 0.5 }), { hold: 175, sec: after }], 175, SPS);

describe('a lunge counted on both knees together', () => {
  it('counts every rep when each knee loses sight of a different one', () => {
    const a = set(), ts = timestamps(a.length, SPS);
    // The left knee hidden through the second rep, the right through the fifth: each knee alone sees five.
    const wl = ts.map((t, i) => jointFrame('knee', {
      ...(t > 3.7 && t < 6.1 ? {} : { left: a[i] }),
      ...(t > 10.6 && t < 13 ? {} : { right: a[i] }),
    }));
    expect(countReps(wl, ts, 'forward_lunge').count).toBe(6);
    expect(countReps(wl, ts, 'lunge').count).toBe(6);
  });

  it('counts, and does not refuse, a set each knee sees under half of, when one or the other always does', () => {
    const a = set(3), ts = timestamps(a.length, SPS);
    // An 18.3 s set: the left knee seen until 8 s (three reps), the right from 7.3 s to 15.4 s (the last three),
    // both while the third rep rises: each knee under half the set, one or the other for 84 % of it.
    const wl = ts.map((t, i) => jointFrame('knee', { ...(t < 8 ? { left: a[i] } : {}), ...(t >= 7.3 && t < 15.4 ? { right: a[i] } : {}) }));
    const seen = (side: 25 | 26) => wl.filter(f => f![side].visibility > 0.5).length / wl.length;
    expect(Math.max(seen(25), seen(26))).toBeLessThan(0.5);
    const r = summarizeCount(wl, ts, 'reverse_lunge');
    expect(r.refused).toBe(false);
    expect(r.count).toBe(6);
  });

  it('keeps the knee with more reps when the two knees read in opposition (one bent while the other is straight)', () => {
    const a = set(), ts = timestamps(a.length, SPS);
    // The right knee reads straight at the left's bottom and bent while the left stands (seen so on public lunges
    // whose far leg the pose model misreads): its dips fall between the left's reps, and joined they would add up.
    const wl = ts.map((_, i) => jointFrame('knee', { left: a[i], right: 270 - a[i] }));
    expect(countReps(wl, ts, 'forward_lunge').count).toBe(6);
  });
});
