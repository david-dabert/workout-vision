import { describe, expect, it } from 'vitest';
import { restClock, keepAwakeDuringRest, REST_AWAKE_CAP_MS } from '../rest-clock';

// C9 of the design review (7 October 2026): the screen is held awake while the rest runs, up to ten minutes; let go
// on stop, on leaving and at the cap; taken again when the page shows after iOS dropped it while hidden.
function rig() {
  const log = [], timers = [], listeners = {};
  const hold = () => { log.push('take'); return () => log.push('release'); };
  const doc = { visibilityState: 'visible', addEventListener: (k, f) => { listeners[k] = f; }, removeEventListener: k => { delete listeners[k]; } };
  const setT = (f, ms) => { timers.push({ f, ms }); return timers.length; };
  const clearT = id => { timers[id - 1].cleared = true; };
  return { log, timers, listeners, hold, doc, setT, clearT };
}

describe('the screen kept awake during the rest', () => {
  it('takes the lock as the rest runs and lets it go when the rest stops', () => {
    const r = rig(), clock = restClock(); clock.start();
    const stop = keepAwakeDuringRest(clock, r);
    expect(r.log).toEqual(['take']);
    expect(r.timers[0].ms).toBeGreaterThan(REST_AWAKE_CAP_MS - 1000);
    expect(REST_AWAKE_CAP_MS).toBe(600000);
    stop();
    expect(r.log).toEqual(['take', 'release']);
    expect(r.timers[0].cleared).toBe(true);
    expect(r.listeners.visibilitychange).toBeUndefined();
  });

  it('lets it go at the cap, and does not take it again after', () => {
    const r = rig(), clock = restClock(); clock.start();
    const stop = keepAwakeDuringRest(clock, r);
    clock.start(Date.now() - REST_AWAKE_CAP_MS - 1); // ten minutes on
    r.timers[0].f();
    expect(r.log).toEqual(['take', 'release']);
    r.listeners.visibilitychange();
    expect(r.log).toEqual(['take', 'release']);
    stop();
    expect(r.log).toEqual(['take', 'release']);
  });

  it('takes it again when the page shows, under the cap', () => {
    const r = rig(), clock = restClock(); clock.start();
    const stop = keepAwakeDuringRest(clock, r);
    r.doc.visibilityState = 'hidden'; r.listeners.visibilitychange();
    expect(r.log).toEqual(['take']);
    r.doc.visibilityState = 'visible'; r.listeners.visibilitychange();
    expect(r.log).toEqual(['take', 'release', 'take']);
    stop();
    expect(r.log).toEqual(['take', 'release', 'take', 'release']);
  });

  it('takes nothing for a rest already past the cap', () => {
    const r = rig(), clock = restClock(); clock.start(Date.now() - REST_AWAKE_CAP_MS - 5000);
    const stop = keepAwakeDuringRest(clock, r);
    expect(r.log).toEqual([]);
    expect(r.timers[0].ms).toBe(0);
    stop();
    expect(r.log).toEqual([]);
  });
});
