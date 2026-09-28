import { describe, it, expect } from 'vitest';
import { watchInterruption, whenVisible, settleRun, holdScreenAwake, isInterruption } from '../interruption';

// A document and a window reduced to what the watcher uses.
function fakeDoc(state = 'visible') {
  const t = new EventTarget();
  t.visibilityState = state;
  return t;
}
const hide = doc => { doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); };
const show = doc => { doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange')); };

describe('watchInterruption', () => {
  it('aborts the run when the page is hidden (screen locked, app left)', () => {
    const doc = fakeDoc(), win = new EventTarget(), c = new AbortController();
    watchInterruption(c, { doc, win });
    hide(doc);
    expect(c.signal.aborted).toBe(true);
    expect(isInterruption(c.signal.reason)).toBe(true);
  });

  it('aborts the run on pagehide', () => {
    const doc = fakeDoc(), win = new EventTarget(), c = new AbortController();
    watchInterruption(c, { doc, win });
    win.dispatchEvent(new Event('pagehide'));
    expect(c.signal.aborted).toBe(true);
    expect(isInterruption(c.signal.reason)).toBe(true);
  });


  it('does nothing while the page stays visible', () => {
    const doc = fakeDoc(), win = new EventTarget(), c = new AbortController();
    watchInterruption(c, { doc, win });
    show(doc);
    expect(c.signal.aborted).toBe(false);
  });

  it('stops watching once released: a finished run is never marked interrupted', () => {
    const doc = fakeDoc(), win = new EventTarget(), c = new AbortController();
    const release = watchInterruption(c, { doc, win });
    release();
    hide(doc);
    win.dispatchEvent(new Event('pagehide'));
    expect(c.signal.aborted).toBe(false);
  });

  it('aborts as an AbortError, so the decoder stops as for a cancel, not as a failure', () => {
    const doc = fakeDoc(), win = new EventTarget(), c = new AbortController();
    watchInterruption(c, { doc, win });
    hide(doc);
    expect(c.signal.reason.name).toBe('AbortError');
  });

  it('keeps a user cancel apart from an interruption', () => {
    const doc = fakeDoc(), win = new EventTarget(), c = new AbortController();
    watchInterruption(c, { doc, win });
    c.abort();
    hide(doc);
    expect(isInterruption(c.signal.reason)).toBe(false);
  });
});

describe('whenVisible', () => {
  it('resolves at once when the page is visible', async () => {
    await expect(whenVisible({ doc: fakeDoc() })).resolves.toBeUndefined();
  });
  it('waits for the page to be visible before a run starts (returning from the camera, a slow load)', async () => {
    const doc = fakeDoc('hidden');
    let started = false;
    const p = whenVisible({ doc }).then(() => { started = true; });
    await Promise.resolve();
    expect(started).toBe(false);
    show(doc);
    await p;
    expect(started).toBe(true);
  });
  it('gives up when the run is cancelled while waiting', async () => {
    const doc = fakeDoc('hidden'), c = new AbortController();
    const p = whenVisible({ doc, signal: c.signal });
    c.abort();
    await expect(p).rejects.toThrow();
  });
});

describe('settleRun: no count from an interrupted run', () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  it('returns the output when the page stays visible through the final beat', async () => {
    const doc = fakeDoc(), win = new EventTarget(), c = new AbortController();
    watchInterruption(c, { doc, win });
    await expect(settleRun(c.signal, { count: 5 }, 30)).resolves.toEqual({ count: 5 });
  });
  it('throws the interruption, not the count, when the page is hidden during the final beat', async () => {
    const doc = fakeDoc(), win = new EventTarget(), c = new AbortController();
    watchInterruption(c, { doc, win });
    const p = settleRun(c.signal, { count: 5 }, 30);
    await wait(5);
    hide(doc);
    await expect(p.catch(e => isInterruption(e))).resolves.toBe(true);
  });
  it('throws when the run was interrupted before the output arrived', async () => {
    const doc = fakeDoc(), win = new EventTarget(), c = new AbortController();
    watchInterruption(c, { doc, win });
    hide(doc);
    await expect(settleRun(c.signal, { count: 5 }, 0).catch(e => isInterruption(e))).resolves.toBe(true);
  });
});

describe('holdScreenAwake', () => {
  it('asks for a screen wake lock and releases it', async () => {
    const calls = [];
    const sentinel = { released: false, release: async () => { sentinel.released = true; } };
    const nav = { wakeLock: { request: async type => { calls.push(type); return sentinel; } } };
    const release = holdScreenAwake({ nav });
    await Promise.resolve(); await Promise.resolve();
    expect(calls).toEqual(['screen']);
    await release();
    expect(sentinel.released).toBe(true);
  });
  it('does nothing where the browser has no wake lock', async () => {
    const release = holdScreenAwake({ nav: {} });
    await expect(release()).resolves.toBeUndefined();
  });
  it('survives a refused request', async () => {
    const nav = { wakeLock: { request: async () => { throw new Error('NotAllowedError'); } } };
    const release = holdScreenAwake({ nav });
    await expect(release()).resolves.toBeUndefined();
  });
});
