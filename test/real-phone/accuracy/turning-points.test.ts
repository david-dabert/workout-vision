import { expect, it } from 'vitest';
import { turningPoints } from './turning-points';

// A curl-like angle resting high at 160°, 9 reps down to 60° over 15 s, sampled at 15 per second.
const ts = Array.from({ length: 226 }, (_, i) => i / 15);
const angle = ts.map(t => 110 + 50 * Math.cos((2 * Math.PI * 9 * t) / 15));

it('finds one turning point per rep, whatever the thresholds of the core', () => {
  expect(turningPoints(angle, ts, true, 0.3)).toHaveLength(9);
});
it('gives the times, so a labelled window can be counted', () => {
  const inside = turningPoints(angle, ts, true, 0.3).filter(t => t >= 5 && t <= 10);
  expect(inside).toHaveLength(3);
});
