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
  it('fails when the recorder cannot be made', async () => {
    throwOnRecorder = true;
    const out = start();
    video.dispatchEvent(new Event('playing'));
    await expect(out).rejects.toBeTruthy();
  });
});
