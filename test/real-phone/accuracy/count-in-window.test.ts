import { expect, it } from 'vitest';
import { countInWindow } from './sets';

it('counts only the reps whose middle falls inside the labelled window', () => {
  const reps = [[0, 1], [1.2, 2.4], [2.5, 3.5], [8.6, 9.8]].map(([startTime, endTime]) => ({ startTime, endTime }));
  expect(countInWindow(reps, [1.5, 9])).toBe(2);
  expect(countInWindow(reps)).toBe(4);
});
