/**
 * The edges of the video, second pass (window-edges experiment, 3 October 2026). On the public build half A,
 * the sets counted one short cluster at the edges of the clip: a last rep the clip stops on its way back, and a
 * clip that opens on the working end, where only its first sample is past the working threshold.
 * - The sample that enters a rep is checked against the working threshold like every later one (detectReps):
 *   unchecked, a rep filmed from its working end counted only when a second sample was there too.
 * - A last rep stopped on its way back counts once its return has covered CUT_RETURN_SHARE of the way to the
 *   rest threshold, within RETURN_WINDOW_SEC of its working half; it is marked clipped. A cut half way back
 *   still does not count (edges.test.ts), nor does a movement after the set that goes somewhere and stays.
 * Status: experimental.
 */
import { describe, it, expect } from 'vitest';
import { countReps, type Lift } from '../core';
import { jointFrame, sample, timestamps, type Joint, type Segment } from './synthetic';

const frames = (joint: Joint, angles: number[]) => angles.map(a => jointFrame(joint, { left: a }));
const reps = (rest: number, work: number, n: number, bottomSec = 0): Segment[] => {
  const p: Segment[] = [{ hold: rest, sec: 0.8 }];
  for (let r = 0; r < n; r++) {
    p.push({ to: work, sec: 1 });
    if (bottomSec) p.push({ hold: work, sec: bottomSec });
    p.push({ to: rest, sec: 1 }, { hold: rest, sec: 0.8 });
  }
  return p;
};
const run = (lift: Lift, joint: Joint, a: number[], sps: number) => countReps(frames(joint, a), timestamps(a.length, sps), lift);

// rest, working end, and the rest threshold's side: a lift resting high (curl, squat) or low (pushdown).
const CUT_BACK: { lift: Lift; joint: Joint; rest: number; work: number }[] = [
  { lift: 'bicep_curl', joint: 'elbow', rest: 170, work: 50 },
  { lift: 'triceps_pushdown', joint: 'elbow', rest: 70, work: 165 },
  { lift: 'squat', joint: 'knee', rest: 175, work: 80 },
];

describe('a last rep the video stops on its way back', () => {
  for (const sps of [15, 30]) {
    for (const { lift, joint, rest, work } of CUT_BACK) {
      // Five whole reps, then a sixth stopped where its return is 0.9 of the way from the working end to the
      // rest threshold (the threshold read from the set itself, so the cut is where the test says it is).
      const cutAt = (share: number, holdSec = 0) => {
        const whole = run(lift, joint, sample(reps(rest, work, 5), rest, sps), sps);
        const threshold = rest > work ? whole.highThreshold : whole.lowThreshold;
        const stop = work + share * (threshold - work);
        const path: Segment[] = [...reps(rest, work, 5), { to: work, sec: 1 }, { to: stop, sec: share }];
        if (holdSec) path.push({ hold: stop, sec: holdSec });
        return { a: sample(path, rest, sps), threshold };
      };
      it(`${lift} at ${sps} sps: stopped nine tenths of the way back, the sixth rep counts, marked clipped`, () => {
        const { a, threshold } = cutAt(0.9);
        const r = run(lift, joint, a, sps);
        expect(rest > work ? r.highThreshold : r.lowThreshold).toBeCloseTo(threshold, 0);
        expect(r.count).toBe(6);
        expect(r.reps[5].clipped).toBe(true);
        expect(r.reps.slice(0, 5).every(x => !x.clipped)).toBe(true);
      });
      it(`${lift} at ${sps} sps: held nine tenths of the way back for 2.5 s to the end, it is not a rep cut on its way back`, () => {
        const r = run(lift, joint, cutAt(0.9, 2.5).a, sps);
        expect(r.count).toBe(5);
      });
    }
  }
});

describe('a video that opens on the working end, one sample past the working threshold', () => {
  for (const sps of [15, 30]) {
    // A squat filmed from the bottom: its lift, the rise, is on video (edges.test.ts, third review). The first
    // sample is the only one past the working threshold; the rise then takes 0.8 s.
    it(`squat at ${sps} sps: the rise from the bottom counts`, () => {
      const set = reps(175, 80, 5, 0.4);
      const lo = run('squat', 'knee', sample(set, 175, sps), sps).lowThreshold;
      const first = lo - 4, second = lo + 4;
      const a = [first, second, ...sample([{ to: 175, sec: 0.8 }, ...set], second, sps)];
      const r = run('squat', 'knee', a, sps);
      expect(r.smoothedAngles[0]).toBeLessThanOrEqual(r.lowThreshold);
      expect(r.smoothedAngles.slice(1).findIndex(x => x !== null && x <= r.lowThreshold)).toBeGreaterThan(sps);
      expect(r.count).toBe(6);
      expect(r.reps[0].clipped).toBe(true);
    });
  }
});
