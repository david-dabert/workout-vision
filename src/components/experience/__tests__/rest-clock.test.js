import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restClock, restText, restSpoken, nextTick } from '../rest-clock';

// The rest clock counts up from a start time. A phone that sleeps, or a tab in the background,
// holds its timers back; the clock reads the wall clock each time, so it is right when it wakes.
describe('restClock', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 29, 18, 0, 0)); });
  afterEach(() => { vi.useRealTimers(); });

  it('reads zero until it starts, then the whole seconds since the start', () => {
    const clock = restClock();
    expect(clock.running).toBe(false);
    expect(clock.seconds()).toBe(0);
    clock.start();
    expect(clock.running).toBe(true);
    vi.advanceTimersByTime(999);
    expect(clock.seconds()).toBe(0);
    vi.advanceTimersByTime(1);
    expect(clock.seconds()).toBe(1);
    vi.advanceTimersByTime(89_000);
    expect(clock.seconds()).toBe(90);
  });

  it('is right after the phone slept: no timer ran, the time still passed', () => {
    const clock = restClock();
    clock.start();
    let ticks = 0;
    const id = setInterval(() => { ticks += 1; }, 1000);
    // Asleep: the wall clock moves on, the page's timers do not fire.
    vi.setSystemTime(Date.now() + 4 * 60_000 + 7_000);
    expect(ticks).toBe(0);
    expect(clock.seconds()).toBe(247);
    clearInterval(id);
  });

  it('stops at zero, and a second start starts again from the new time', () => {
    const clock = restClock();
    clock.start();
    vi.advanceTimersByTime(30_000);
    clock.stop();
    expect(clock.running).toBe(false);
    expect(clock.seconds()).toBe(0);
    clock.start();
    vi.advanceTimersByTime(5_000);
    expect(clock.seconds()).toBe(5);
  });

  it('never reads a negative time when the phone\'s clock is set back', () => {
    const clock = restClock();
    clock.start();
    vi.setSystemTime(Date.now() - 60_000);
    expect(clock.seconds()).toBe(0);
  });

  it('waits until the next whole second to draw again', () => {
    const clock = restClock();
    clock.start();
    expect(nextTick(clock)).toBe(1000);
    vi.advanceTimersByTime(1_250);
    expect(nextTick(clock)).toBe(750);
  });
});

describe('restText', () => {
  it('writes minutes and two-digit seconds, and hours past the hour', () => {
    expect(restText(0)).toBe('0:00');
    expect(restText(9)).toBe('0:09');
    expect(restText(90)).toBe('1:30');
    expect(restText(59 * 60 + 59)).toBe('59:59');
    expect(restText(3600 + 62)).toBe('1:01:02');
  });
});

describe('restSpoken', () => {
  it('says the rest in words, for screen readers', () => {
    expect(restSpoken(0, true)).toBe('0 seconde');
    expect(restSpoken(1, false)).toBe('1 second');
    expect(restSpoken(90, true)).toBe('1 minute 30 secondes');
    expect(restSpoken(125, false)).toBe('2 minutes 5 seconds');
    expect(restSpoken(120, true)).toBe('2 minutes');
    expect(restSpoken(3660, false)).toBe('1 hour 1 minute');
  });
});
