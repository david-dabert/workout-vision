import { afterEach, describe, expect, it, vi } from 'vitest';
import { attemptStill } from './attempt-export.js';

// A still of the patient's video for the report (attempt-export.js attemptStill), on a stand-in video and canvas.
function fakeVideo({ paused = true } = {}) {
  const listeners = {};
  const v = {
    paused, currentTime: 3, duration: 20, videoWidth: 360, videoHeight: 640, readyState: 0,
    pause: vi.fn(() => { v.paused = true; }),
    play: vi.fn(() => { v.paused = false; return Promise.resolve(); }),
    addEventListener: (e, f) => { (listeners[e] ??= []).push(f); },
    removeEventListener: (e, f) => { listeners[e] = (listeners[e] || []).filter(x => x !== f); },
    seek: () => (listeners.seeked || []).slice().forEach(f => f()),
  };
  return v;
}
const canvas = () => ({ width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }), toDataURL: () => 'data:image/jpeg;base64,AA==' });

describe('a still of the attempt', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('leaves a paused video paused, where it was (review of 17 October: an iPhone video left playing by itself)', async () => {
    vi.stubGlobal('document', { createElement: canvas });
    const v = fakeVideo();
    const p = attemptStill(v, 7, vi.fn());
    expect(v.currentTime).toBeCloseTo(7);
    v.seek();
    const out = await p;
    expect(out).toMatchObject({ w: 360, h: 640 });
    expect(v.paused).toBe(true);
    expect(v.play).not.toHaveBeenCalled();
    expect(v.currentTime).toBe(3);
  });

  it('plays again only when asked', async () => {
    vi.stubGlobal('document', { createElement: canvas });
    const v = fakeVideo({ paused: false });
    const p = attemptStill(v, 7, vi.fn(), { resume: true });
    v.seek();
    await p;
    expect(v.play).toHaveBeenCalledTimes(1);
  });

  it('stops at once when cancelled, without waiting for the frame', async () => {
    vi.stubGlobal('document', { createElement: canvas });
    const ctrl = new AbortController();
    const p = attemptStill(fakeVideo(), 7, vi.fn(), { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});
