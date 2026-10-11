import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Review of feature B, 29 September: while the example covers the entry, the entry's figure stops
// drawing (two full-screen loops cost frames and battery on older phones), and it resumes on close.
let images = [];
const ctx = new Proxy({ drawImage: (...a) => images.push(a.slice(1, 3).map(Math.round)) }, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => { t[k] = v; return true; } });
let queued = [];
beforeEach(() => {
  queued = [];
  vi.stubGlobal('requestAnimationFrame', cb => { queued.push(cb); return queued.length; });
  vi.stubGlobal('cancelAnimationFrame', id => { queued[id - 1] = null; });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
});
afterEach(() => vi.unstubAllGlobals());
const run = () => { const now = queued; queued = []; let n = 0; for (const cb of now) if (cb) { cb(performance.now()); n++; } return n; };

describe('the entry scene under the example', () => {
  it('draws no frame while paused, and draws again once resumed', async () => {
    const { createEntryScene } = await import('../entry-scene');
    const canvas = { clientWidth: 390, clientHeight: 664, width: 0, height: 0, getContext: () => ctx };
    const scene = createEntryScene(canvas, false, () => null);
    expect(run()).toBe(1);
    scene.pause();
    expect(run()).toBe(0);
    expect(run()).toBe(0);
    scene.resume();
    expect(run()).toBe(1);
    expect(run()).toBe(1);
    scene.dispose();
  });
  // Review, 30 September: every moving part (dust, breathing, shimmer) goes on from where it stopped,
  // not only the entrance; a minute under the example moves nothing on return.
  it('draws the first frame after a long pause as the last before it', async () => {
    let now = 10000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { createEntryScene } = await import('../entry-scene');
    const canvas = { clientWidth: 390, clientHeight: 664, width: 0, height: 0, getContext: () => ctx };
    const scene = createEntryScene(canvas, false, () => null);
    images = []; run();
    const before = images.slice(0, 48);
    scene.pause(); now += 60000; scene.resume(); now += 16;
    images = []; run();
    const after = images.slice(0, 48);
    const moved = Math.max(...after.map((p, i) => Math.hypot(p[0] - before[i][0], p[1] - before[i][1])));
    expect(moved).toBeLessThan(4);
    scene.dispose();
  });
});
