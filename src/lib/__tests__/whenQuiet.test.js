import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { whenQuiet } from '../whenQuiet';

// The next screens' code was loaded at fixed times (1.2 s and 3 s), whatever the visitor was
// doing, a swipe included. It now loads one screen at a time, in a pause (28 September 2026).
describe('whenQuiet', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('runs the tasks one at a time, each after a quiet pause', async () => {
    const target = new EventTarget(), ran = [];
    whenQuiet([() => ran.push('a'), () => ran.push('b')], 700, target);
    await vi.advanceTimersByTimeAsync(699);
    expect(ran).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(ran).toEqual(['a']);
    await vi.advanceTimersByTimeAsync(700);
    expect(ran).toEqual(['a', 'b']);
  });

  it('waits while a finger moves or a screen scrolls', async () => {
    const target = new EventTarget(), ran = [];
    whenQuiet([() => ran.push('a')], 700, target);
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(500);
      target.dispatchEvent(new Event(i % 2 ? 'pointermove' : 'scroll'));
    }
    expect(ran).toEqual([]);
    await vi.advanceTimersByTimeAsync(700);
    expect(ran).toEqual(['a']);
  });

  it('starts a task only once the one before has settled', async () => {
    const target = new EventTarget(), ran = [];
    let release = () => {};
    whenQuiet([() => new Promise(resolve => { ran.push('a'); release = resolve; }), () => ran.push('b')], 700, target);
    await vi.advanceTimersByTimeAsync(700);
    expect(ran).toEqual(['a']);
    await vi.advanceTimersByTimeAsync(5000);
    expect(ran).toEqual(['a']);
    release();
    await vi.advanceTimersByTimeAsync(700);
    expect(ran).toEqual(['a', 'b']);
  });

  it('goes on after a task that fails', async () => {
    const target = new EventTarget(), ran = [];
    whenQuiet([() => Promise.reject(new Error('offline')), () => ran.push('b')], 700, target);
    await vi.advanceTimersByTimeAsync(1400);
    expect(ran).toEqual(['b']);
  });

  it('stops listening once every task has run, and runs nothing once cancelled', async () => {
    const target = new EventTarget(), listening = new Set();
    const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target);
    target.addEventListener = (type, fn, options) => { listening.add(type); add(type, fn, options); };
    target.removeEventListener = (type, fn, options) => { listening.delete(type); remove(type, fn, options); };
    const ran = [];
    whenQuiet([() => ran.push('a')], 700, target);
    expect(listening.size).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(700);
    expect(ran).toEqual(['a']);
    expect(listening.size).toBe(0);

    const other = new EventTarget(), none = [];
    const stop = whenQuiet([() => none.push('x')], 700, other);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(none).toEqual([]);
  });
});
