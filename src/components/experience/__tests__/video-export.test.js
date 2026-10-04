import { describe, expect, it } from 'vitest';
import { pickMime, exportFileName, exportSize } from '../video-export';

describe('the exported video: format, name and size (step 4)', () => {
  it('prefers MP4 with H.264, which Safari on iPhone records and every phone plays', () => {
    const ok = m => ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm'].includes(m);
    expect(pickMime(ok)).toBe('video/mp4;codecs=avc1');
  });
  it('falls back to plain MP4, then WebM, and to nothing when the browser records neither', () => {
    expect(pickMime(m => m === 'video/mp4')).toBe('video/mp4');
    expect(pickMime(m => m === 'video/webm')).toBe('video/webm');
    expect(pickMime(() => false)).toBe('');
  });
  it('names the file after the exercise and the format', () => {
    expect(exportFileName('bicep_curl', 'video/mp4;codecs=avc1')).toBe('workoutvision-bicep-curl.mp4');
    expect(exportFileName('squat', 'video/webm')).toBe('workoutvision-squat.webm');
  });
  it('keeps the picture\'s proportions, at most 1280 px on the long side, in even pixels', () => {
    expect(exportSize(1920, 1080)).toEqual([1280, 720]);
    expect(exportSize(1080, 1920)).toEqual([720, 1280]);
    expect(exportSize(641, 361)).toEqual([640, 360]);
  });
});

// Review 01 of step 4: the export settles on every path and stops the recorder when it fails.
import { exportSetVideo } from '../video-export';
import { afterEach, beforeEach, vi } from 'vitest';

class FakeVideo extends EventTarget {
  constructor() { super(); this.style = {}; this.currentTime = 0; this.duration = 10; this.videoWidth = 720; this.videoHeight = 1280; }
  setAttribute() {} remove() {} pause() {} play() { return refusePlay ? Promise.reject(new DOMException('', 'NotAllowedError')) : Promise.resolve(); }
}
let video, recorders, throwOnRecorder, refusePlay;
class FakeRecorder {
  static isTypeSupported(m) { return m === 'video/mp4'; }
  constructor() { if (throwOnRecorder) throw new DOMException('', 'NotSupportedError'); this.state = 'inactive'; this.stop = vi.fn(() => { this.state = 'inactive'; }); recorders.push(this); }
  start() { this.state = 'recording'; }
}
const track = { stop: vi.fn() };
beforeEach(() => {
  vi.useFakeTimers();
  recorders = []; throwOnRecorder = false; refusePlay = false; track.stop.mockClear();
  const ctx = new Proxy({}, { get: (_, k) => (k === 'measureText' ? () => ({ width: 10 }) : () => {}) });
  globalThis.document = {
    body: { appendChild() {} },
    visibilityState: 'visible', addEventListener() {}, removeEventListener() {},
    createElement: tag => (tag === 'video' ? (video = new FakeVideo()) : { getContext: () => ctx, captureStream: () => ({ getTracks: () => [track] }) }),
  };
  globalThis.MediaRecorder = FakeRecorder;
  globalThis.requestAnimationFrame = () => 1; globalThis.cancelAnimationFrame = () => {};
});
afterEach(() => { vi.useRealTimers(); delete globalThis.document; delete globalThis.MediaRecorder; });
const start = () => exportSetVideo({ file: new Blob(['x']), result: { arm: 'left', reps: [] }, lift: 'bicep_curl' });

describe('the export settles and cleans up (review 01 of step 4)', () => {
  it('plays inside the tap, before any data has loaded', () => {
    const play = vi.spyOn(FakeVideo.prototype, 'play');
    start().catch(() => {});
    expect(play).toHaveBeenCalled();
    play.mockRestore();
  });
  it('fails, and stops the recorder, when the video pauses before its end (screen locked, app left)', async () => {
    const out = start();
    video.dispatchEvent(new Event('playing'));
    video.dispatchEvent(new Event('pause'));
    await expect(out).rejects.toThrow('interrupted');
    expect(recorders[0].stop).toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
  });
  it('fails when the video stops advancing for five seconds', async () => {
    const out = start();
    video.dispatchEvent(new Event('playing'));
    vi.advanceTimersByTime(7000); // first tick at 1 s sees 0, then five seconds without a move
    await expect(out).rejects.toThrow('stalled');
  });
  it('fails, and stops the recorder, when playback is refused', async () => {
    refusePlay = true;
    await expect(start()).rejects.toThrow();
  });
  it('refuses a recording whose frames stop short of the end, never hands over a cut file (David, 4 October)', async () => {
    const out = start();
    video.dispatchEvent(new Event('playing')); // one frame drawn, at 0 s, of a 10-second video
    video.currentTime = 4;
    video.dispatchEvent(new Event('ended'));
    await expect(out).rejects.toThrow('incomplete');
    expect(recorders[0].stop).toHaveBeenCalled();
  });
  it('records the video on screen when given one: played from the start, never removed, its listeners gone', async () => {
    const screen = new FakeVideo();
    screen.remove = vi.fn(); screen.currentTime = 7;
    const out = exportSetVideo({ file: new Blob(['x']), result: { arm: 'left', reps: [] }, lift: 'bicep_curl', screen });
    expect(screen.currentTime).toBe(0);
    expect(screen.muted).toBe(true);
    screen.dispatchEvent(new Event('playing'));
    screen.dispatchEvent(new Event('pause'));
    await expect(out).rejects.toThrow('interrupted');
    expect(screen.remove).not.toHaveBeenCalled();
    // The export's listeners are gone: a later pause of the replay is not an export failure.
    expect(() => screen.dispatchEvent(new Event('pause'))).not.toThrow();
  });
  it('fails when the recorder cannot be made', async () => {
    throwOnRecorder = true;
    const out = start();
    video.dispatchEvent(new Event('playing'));
    await expect(out).rejects.toBeTruthy();
  });
});

// Review of 1 October: after a correction the video states both counts, so it explains itself away
// from the app; without one it draws the count alone.
describe('the exported overlay after a correction', () => {
  const drawn = saved => {
    const text = [];
    const ctx = new Proxy({}, { get: (_, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'fillText' ? t => text.push(t) : () => {}) });
    document.createElement = tag => (tag === 'video' ? (video = new FakeVideo()) : { width: 390, height: 693, getContext: () => ctx, captureStream: () => ({ getTracks: () => [track] }) });
    const reps = Array.from({ length: 7 }, (_, i) => ({ index: i + 1, startTime: i, endTime: i + 0.8 }));
    exportSetVideo({ file: new Blob(['x']), result: { arm: 'left', count: 7, reps }, lift: 'bicep_curl', fr: false, saved }).catch(() => {});
    // The whole 10-second video drawn, six frames a second, then its end: only the end's words are kept.
    let n = 0;
    globalThis.requestAnimationFrame = cb => { if (n++ < 60) { video.currentTime = Math.min(10, n / 6); cb(); } return 1; };
    video.dispatchEvent(new Event('playing'));
    text.length = 0;
    video.dispatchEvent(new Event('ended'));
    return text;
  };
  it('draws both counts when the user saved another count', () => {
    expect(drawn(8)).toEqual(['7 / 7', 'The app detected 7 reps. You saved 8.']);
  });
  it('draws the count alone when the user kept the app\'s', () => {
    expect(drawn(7)).toEqual(['7 / 7']);
    expect(drawn(null)).toEqual(['7 / 7']);
  });
});

import { shareFailed } from '../video-export';
describe('a share that did not end well', () => {
  it('failed unless it was cancelled or a sheet was already open', () => {
    expect(shareFailed(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(false);
    expect(shareFailed(Object.assign(new Error('x'), { name: 'InvalidStateError' }))).toBe(false);
    expect(shareFailed(Object.assign(new Error('x'), { name: 'NotAllowedError' }))).toBe(true);
    expect(shareFailed(new TypeError('x'))).toBe(true);
    expect(shareFailed(undefined)).toBe(true);
  });
});
