/**
 * Push-ups (3 October 2026): on the public build half the elbow of a body lying level is read through a narrow
 * range that varies from rep to rep, and the core counted push-ups short (publicA half: 43 sets under, 2 over).
 * Its thresholds sit a quarter of the set's range inside the percentiles, and a rep's own range floor is 15°
 * (DETECTION, core.ts). The side with more reps is never kept when the count would refuse it and not the other.
 * Angles are illustrative (UNSOURCED).
 */
import { describe, expect, it } from 'vitest';
import { countReps } from '../core';
import { jointFrame, sample, timestamps, type Segment } from './synthetic';

const SPS = 15;
const pushUps = (depths: number[], rest = 170): number[] => {
  const path: Segment[] = [{ hold: rest, sec: 1 }];
  for (const d of depths) path.push({ to: d, sec: 0.6 }, { to: rest, sec: 0.6 }, { hold: rest, sec: 0.3 });
  path.push({ hold: rest, sec: 1 });
  return sample(path, rest, SPS);
};

describe('push-ups the pose model reads shallow', () => {
  it('six push-ups, two of them read 36° short of the others, count six', () => {
    const a = pushUps([70, 70, 106, 70, 106, 70]);
    const ts = timestamps(a.length, SPS);
    expect(countReps(a.map(x => jointFrame('elbow', { left: x, right: x })), ts, 'push_up').count).toBe(6);
  });

  it('the side with more reps is not kept when it is seen in fewer than half the samples and the other is not', () => {
    // The left elbow is seen throughout but reads only two of the six push-ups; the right one reads the first
    // three, in the first 48 % of the samples, and is hidden after. Its three reps would make the set a refusal.
    const left = pushUps([70, 150, 70, 150, 150, 150]), right = pushUps([70, 70, 70, 70, 70, 70]);
    const ts = timestamps(left.length, SPS);
    const wl = ts.map((_, i) => jointFrame('elbow', i < 0.48 * ts.length ? { left: left[i], right: right[i] } : { left: left[i] }));
    const r = countReps(wl, ts, 'push_up');
    expect(r.arm).toBe('left');
    expect(r.count).toBe(2);
    expect(r.angles.filter(x => x !== null).length).toBeGreaterThanOrEqual(wl.length / 2);
  });
});
