/**
 * A write still under way holds back the reload that installs a new version (main.jsx): David's collected set, hashed
 * then compressed after "Garder" closed the result, was lost when the update reloaded the page on the choice of lift
 * (live-app audit, 10 October 2026).
 */
import { describe, it, expect } from 'vitest';
import { holdWhile, whenWritesDone } from '../pendingWrites';

const settle = () => new Promise(r => setTimeout(r, 0));

describe('writes under way', () => {
  it('are waited for, whether they succeed or fail, before the page may reload', async () => {
    let finishA, failB, done = false;
    holdWhile(new Promise(r => { finishA = r; }));
    holdWhile(new Promise((_, j) => { failB = j; })).catch(() => {});
    whenWritesDone().then(() => { done = true; });
    await settle();
    expect(done).toBe(false);
    finishA();
    await settle();
    expect(done).toBe(false);
    failB(new Error('quota'));
    await settle();
    expect(done).toBe(true);
  });

  it('let the reload go at once when none is under way', async () => {
    let done = false;
    whenWritesDone().then(() => { done = true; });
    await settle();
    expect(done).toBe(true);
  });

  it('hand back the write itself, so its caller still sees its result', async () => {
    await expect(holdWhile(Promise.resolve(7))).resolves.toBe(7);
    await expect(holdWhile(Promise.reject(new Error('x')))).rejects.toThrow('x');
  });
});
