import { expect, it } from 'vitest';
import { matchReps } from './match-reps';

const L: [number, number][] = [[0, 2], [2, 4], [4, 6], [6, 8]];
it('finds every rep counted in its place', () => {
  expect(matchReps(L, [[0.1, 2], [2.1, 4], [4, 5.9], [6.2, 8]])).toEqual({ found: 4, missedFirst: false, missedLast: false, missedMiddle: 0, extra: 0 });
});
it('names a missed first or last rep apart from one in the middle', () => {
  expect(matchReps(L, [[2, 4], [4, 6]])).toEqual({ found: 2, missedFirst: true, missedLast: true, missedMiddle: 0, extra: 0 });
  expect(matchReps(L, [[0, 2], [6, 8]])).toEqual({ found: 2, missedFirst: false, missedLast: false, missedMiddle: 2, extra: 0 });
});
it('does not take a rep counted in the wrong place for a found one', () => {
  expect(matchReps(L, [[0, 0.5], [1.5, 2.5], [2, 4], [4, 6], [6, 8]])).toEqual({ found: 3, missedFirst: true, missedLast: false, missedMiddle: 0, extra: 2 });
});
it('matches one counted rep to one labelled rep only', () => {
  expect(matchReps([[0, 2], [2, 4]], [[0, 4]])).toMatchObject({ found: 1, extra: 0 });
});
