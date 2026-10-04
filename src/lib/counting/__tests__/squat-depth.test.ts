/**
 * Squat depth (3 October 2026). A squat set whose depth varies from rep to rep, as a tiring
 * set does: the deep reps set the bottom of the set's range, and a rep that stops higher
 * still bends the knee most of the way down. The working-end threshold one fifth of the range
 * above the deepest level missed such reps; the squat's sits a third of the range above it.
 * A knee that bends less than that (shifting the feet at the top) still counts nothing.
 */
import { describe, it, expect } from 'vitest';
import { countReps } from '../core';
import { jointFrame, sample, timestamps, seeded, wobble, type Segment } from './synthetic';

const frames = (angles: number[]) => angles.map(a => jointFrame('knee', { left: a }));

/** Standing 2 s, then one rep per depth (1 s down, 1 s up, 0.3 s standing), then standing 2 s. */
function set(depths: number[], standing = 170): Segment[] {
  const path: Segment[] = [{ hold: standing, sec: 2 }];
  for (const d of depths) path.push({ to: d, sec: 1 }, { to: standing, sec: 1 }, { hold: standing, sec: 0.3 });
  path.push({ hold: standing, sec: 1.7 });
  return path;
}

describe('squat: reps of varying depth', () => {
  // Five reps to 90° and three that stop at 123°, 47° down from standing at 170°. The set's 10th to 90th
  // percentile range is about 102° to 171°: the old threshold (about 120°) misses the three, the squat's own
  // (about 128°) counts them.
  const depths = [90, 90, 123, 90, 123, 90, 123, 90];
  for (const sps of [15, 30, 60]) {
    it(`counts all 8, the three shallower ones among them, at ${sps} sps`, () => {
      const angles = wobble(sample(set(depths), 170, sps), 3, seeded(sps));
      const result = countReps(frames(angles), timestamps(angles.length, sps), 'squat');
      expect(result.count).toBe(8);
    });
  }

  it('does not count a knee bend of a fifth of the range at the top between reps', () => {
    // Four reps to 90°, and between the second and third a 16° bend (170° to 154°) that is no squat.
    const sps = 30;
    const path: Segment[] = [...set([90, 90]).slice(0, -1), { to: 154, sec: 0.6 }, { to: 170, sec: 0.6 }, { hold: 170, sec: 0.3 }, ...set([90, 90]).slice(1)];
    const angles = wobble(sample(path, 170, sps), 3, seeded(7));
    const result = countReps(frames(angles), timestamps(angles.length, sps), 'squat');
    expect(result.count).toBe(4);
  });
});
