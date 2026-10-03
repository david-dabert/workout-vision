// A restored backup can name any exercise (keep-sets.js checks it is a string): a name that is also a property every
// object inherits, such as "constructor", is shown as written, never as nothing (audit of 3 October).
import { describe, expect, it, vi } from 'vitest';
// exercise-info.js reaches the drawing code, which reads the screen when it loads (as in sets-csv.test.js).
vi.hoisted(() => {
  const any = new Proxy(function stub() {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : any), apply: () => any, set: () => true });
  globalThis.window ??= { devicePixelRatio: 1 };
  globalThis.document ??= { createElement: () => any };
});
import { exerciseName } from '../exercise-info';

describe('an exercise the app does not know', () => {
  it('is shown by its key, inherited names included', () => {
    for (const key of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) expect(exerciseName(key, 'fr'), key).toBe(key);
    expect(exerciseName('squat', 'fr')).toBeTruthy();
  });
});
