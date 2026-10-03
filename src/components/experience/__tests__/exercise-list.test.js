// The searchable list under the cards (ExerciseList.jsx) holds every offered exercise but the fitness tests, each
// with its guide entry. Its comment gives the number, 183 on 3 October 2026 (third audit, C26: it said 181, while
// the README and e2e/collect.spec.js said 183); this keeps the comment, the README and the list in step. 179 since
// the same day's withdrawal of four floor exercises counted on both sides in profile (offer.js, WITHDRAWN, C21).
import { describe, expect, it, vi } from 'vitest';
// exercise-info.js reaches the drawing code, which reads the screen when it loads (as in exercise-name.test.js).
vi.hoisted(() => {
  const any = new Proxy(function stub() {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : any), apply: () => any, set: () => true });
  globalThis.window ??= { devicePixelRatio: 1 };
  globalThis.document ??= { createElement: () => any };
});
import { OFFERED } from '../../../lib/offer';
import { isTest } from '../../../lib/fitness-tests';
import { guideExercise } from '../exercise-info';

describe('the list of every counted exercise', () => {
  it('holds the 179 offered exercises, each with its guide entry, and no fitness test', () => {
    // The same rows as ExerciseList.jsx's ENTRIES.
    const exercises = OFFERED.filter(k => !isTest(k));
    expect(exercises).toHaveLength(179);
    expect(exercises.map(guideExercise).filter(Boolean)).toHaveLength(179);
  });
});
