/**
 * Push-ups (3 October 2026): on the public build half the elbow of a body lying level is read through a narrow
 * range that varies from rep to rep, and the core counted push-ups short (publicA half: 43 sets under, 2 over).
 * Its thresholds sit a quarter of the set's range inside the percentiles, and a rep's own range floor is 15°
 * (DETECTION, core.ts). The side with more reps is never kept when the count would refuse it and not the other.
 * Third audit (3 October): a side seen in half the samples is kept over one seen in fewer even on a tie (C01); a
 * cut last push-up needs the lift's own 15° floor, not the core's 20° (C02); and the range the collector warns on
 * is the larger of the two elbows' (C03). Angles and visibilities are illustrative (UNSOURCED).
 */
import { describe, expect, it } from 'vitest';
import { countReps, jointRange, COUNTABLE_RANGE_DEG } from '../core';
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

  it('on a tie, the side seen in every sample is kept over a better summed one seen in fewer than half (C01)', () => {
    // The left shoulder and elbow read 1 and the wrist 1 on two samples of five, else 0.45 (under the 0.5 floor),
    // so the left side has the higher summed visibility but is seen in 40 % of the samples; the right side reads
    // 0.6 throughout. Both elbows do the same six push-ups.
    const a = pushUps([70, 70, 70, 70, 70, 70]);
    const ts = timestamps(a.length, SPS);
    const wl = a.map((x, i) => {
      const f = jointFrame('elbow', { left: x, right: x })!;
      f[11].visibility = 1; f[13].visibility = 1; f[15].visibility = i % 5 < 2 ? 1 : 0.45;
      f[12].visibility = 0.6; f[14].visibility = 0.6; f[16].visibility = 0.6;
      return f;
    });
    const r = countReps(wl, ts, 'push_up');
    expect(r.arm).toBe('right');
    expect(r.count).toBe(6);
    expect(r.angles.filter(x => x !== null).length).toBeGreaterThanOrEqual(wl.length / 2);
  });

  it('a last push-up of 15 to 20° stopped nearly back counts, as it does whole (C02)', () => {
    // Six push-ups 170 -> 140 -> 170, then a seventh to 146 that the video stops 94 % of the way back.
    const path: Segment[] = [{ hold: 170, sec: 1 }];
    for (let r = 0; r < 6; r++) path.push({ to: 140, sec: 0.6 }, { to: 170, sec: 0.6 }, { hold: 170, sec: 0.3 });
    const whole = [...path, { to: 146, sec: 0.6 }, { to: 170, sec: 0.6 }, { hold: 170, sec: 1 }] as Segment[];
    const run = (p: Segment[]) => {
      const a = sample(p, 170, SPS);
      return countReps(a.map(x => jointFrame('elbow', { left: x })), timestamps(a.length, SPS), 'push_up');
    };
    expect(run(whole).count).toBe(7);
    const probe = run([...path, { to: 146, sec: 0.6 }, { to: 170, sec: 0.6 }]);
    const stop = 146 + 0.94 * (probe.highThreshold - 146);
    const cut = run([...path, { to: 146, sec: 0.6 }, { to: stop, sec: 0.6 * 0.94 }]);
    expect(cut.count).toBe(7);
    expect(cut.reps[6].clipped).toBe(true);
  });

  it('a still, better seen elbow beside a working one does not read as too little movement (C03)', () => {
    // The left elbow is held at 165° (visibility 0.99), the right does six push-ups seen at 0.9.
    const a = pushUps([70, 70, 70, 70, 70, 70]);
    const ts = timestamps(a.length, SPS);
    const wl = a.map(x => {
      const f = jointFrame('elbow', { left: 165, right: x })!;
      f[12].visibility = 0.9; f[14].visibility = 0.9; f[16].visibility = 0.9;
      return f;
    });
    expect(countReps(wl, ts, 'push_up').count).toBe(6);
    expect(jointRange(wl, ts, 'push_up')).toBeGreaterThanOrEqual(COUNTABLE_RANGE_DEG);
  });
});
