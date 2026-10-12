/**
 * A WebCodecs decoder that stops answering (11 October 2026). The playback path ends a read that has given no frame
 * for 20 s; the WebCodecs path had no such watch: a VideoDecoder that took chunks and then gave neither a frame nor an
 * error left the analysis screen waiting until the user cancelled. Whether Safari does this is not proven; the read
 * must end within the same budget as a decoder failure ends it (with `resume`, so withRestarts restarts it, then the
 * playback path takes over), and never on a slow but healthy read.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('web-demuxer', () => ({
  AVLogLevel: { quiet: 0 },
  WebDemuxer: class {
    async load() {}
    async getMediaInfo() { return { duration: 2, streams: [{ codec_type_string: 'video', width: 640, height: 480, rotation: 0 }] }; }
    async getDecoderConfig() { return { codec: 'avc1' }; }
    read(_type, at) { return new ReadableStream({ start(c) { for (let i = 0; i < 60; i++) if (i / 30 >= at - 1e-9) c.enqueue({ t: i / 30 }); c.close(); } }); }
    destroy() {}
  },
}));

// The playback path's budget (STALL_MS in frameExtractor.js).
const BUDGET = 20_000;

// A <video> that plays 2 s at 30 frames a second, one frame callback per frame (as in pipeline-errors.test.js).
function fakeVideo() {
  return {
    duration: 2, videoWidth: 640, videoHeight: 480, paused: true, ended: false, t: 0, callbacks: [],
    load() { if (this.src) setTimeout(() => this.onloadeddata?.(), 0); },
    pause() { this.paused = true; },
    play() {
      if (!this.paused) return Promise.resolve();
      this.paused = false;
      const tick = () => {
        if (this.paused) return;
        this.t += 1 / 30;
        for (const cb of this.callbacks.splice(0)) cb(0, { mediaTime: this.t });
        setTimeout(tick, 0);
      };
      setTimeout(tick, 0);
      return Promise.resolve();
    },
    requestVideoFrameCallback(cb) { this.callbacks.push(cb); },
    addEventListener() {}, removeEventListener() {},
  };
}

// silentAfter[k]: the k-th decoder made gives a frame for its first silentAfter[k] chunks, then takes every chunk and
// answers nothing more: no frame, no error, and a flush that stays pending until close() (the spec's reset rejects it).
let silentAfter, decoders, frames, videos, lastOutputAt;
beforeEach(() => {
  vi.useFakeTimers();
  silentAfter = []; decoders = []; frames = []; videos = []; lastOutputAt = null;
  vi.stubGlobal('location', { origin: 'https://app.test' });
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: () => 'blob:x', revokeObjectURL() {} }));
  vi.stubGlobal('HTMLVideoElement', class { requestVideoFrameCallback() {} });
  // Each canvas holds a value of what was last drawn on it, so the frozen-read check sees a moving video.
  vi.stubGlobal('document', { createElement: tag => {
    if (tag === 'video') { const v = fakeVideo(); videos.push(v); return v; }
    let shown = 0;
    const ctx = {
      drawImage(src) { shown = 1 + Math.round((typeof src.timestamp === 'number' ? src.timestamp / 1e6 : src.t) * 30); },
      save() {}, restore() {}, translate() {}, rotate() {},
      getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(Math.min(w * h, 32 * 32) * 4).fill(shown) }),
    };
    return { width: 640, height: 480, getContext: () => ctx };
  } });
  vi.stubGlobal('VideoDecoder', class {
    static async isConfigSupported() { return { supported: true }; }
    constructor({ output, error }) {
      this.output = output; this.error = error; this.decodeQueueSize = 0; this.n = 0; this.closed = false;
      this.silentAfter = silentAfter[decoders.length] ?? Infinity;
      decoders.push(this);
    }
    configure() {}
    decode(chunk) {
      if (this.closed) throw new DOMException('closed', 'InvalidStateError');
      if (++this.n > this.silentAfter) return;
      const frame = { timestamp: chunk.t * 1e6, closed: false, close() { this.closed = true; } };
      frames.push(frame);
      lastOutputAt = Date.now();
      this.output(frame);
    }
    flush() {
      if (this.n <= this.silentAfter) return Promise.resolve();
      return new Promise((_resolve, reject) => { this.abortFlush = reject; });
    }
    close() { this.closed = true; this.abortFlush?.(new DOMException('closed', 'AbortError')); }
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

// Moves the fake clock on 10 ms at a time until the promise settles or `limit` ms have passed.
async function settle(promise, limit) {
  let outcome = null;
  promise.then(value => { outcome = { value }; }, error => { outcome = { error }; });
  const start = Date.now();
  while (!outcome && Date.now() - start < limit) await vi.advanceTimersByTimeAsync(10);
  return { settled: outcome !== null, ...outcome, at: Date.now() };
}

describe('a WebCodecs decoder that stops answering', () => {
  it('ends the read one budget after its last frame, as a decoder failure to restart from there', async () => {
    silentAfter = [20];
    const { extractFramesWebCodecs } = await import('../frameExtractor');
    const at = [];
    const read = extractFramesWebCodecs(new Blob(['x']), 15, Infinity, 640, async (_c, _i, t) => { at.push(t); }, null, {});
    const out = await settle(read, 3 * BUDGET);
    expect(out.settled).toBe(true);
    expect(out.error?.message).toMatch(/^Video decode failed: /);
    expect(out.error.resume.startFrame).toBe(10);
    expect(out.error.resume.origin).toBe(0);
    expect(out.error.resume.after).toBeCloseTo(18 / 30, 9);
    expect(at).toHaveLength(10);
    expect(out.at - lastOutputAt).toBeGreaterThanOrEqual(BUDGET);
    expect(out.at - lastOutputAt).toBeLessThan(BUDGET + 100);
    expect(decoders[0].closed).toBe(true);
    expect(frames.every(f => f.closed)).toBe(true);
  });

  it('is restarted by withRestarts from where it stopped, and every sample is read once', async () => {
    silentAfter = [20];
    const { extractFramesWebCodecs, withRestarts } = await import('../frameExtractor');
    const at = [];
    const run = withRestarts(pass => extractFramesWebCodecs(new Blob(['x']), 15, Infinity, 640, async (_c, _i, t) => { at.push(t); }, null, pass), {});
    const out = await settle(run, 3 * BUDGET);
    expect(out.error).toBeUndefined();
    expect(out.value?.restarts).toBe(1);
    expect(at.map(t => Math.round(t * 30))).toEqual([...Array(30).keys()].map(i => 2 * i));
    expect(decoders.every(d => d.closed)).toBe(true);
    expect(frames.every(f => f.closed)).toBe(true);
  });

  it('silent from its first chunk: restarted once, then the playback path reads the video', async () => {
    silentAfter = [0, 0];
    const { extractFramesStreaming } = await import('../frameExtractor');
    const calls = [];
    const run = extractFramesStreaming(new Blob(['x']), 15, Infinity, 640, async (_c, i) => { calls.push(i); }, null, {});
    const out = await settle(run, 4 * BUDGET);
    expect(out.error).toBeUndefined();
    expect(out.value?.method).toMatch(/^webcodecs failed after 0 samples \(Video decode failed: .+\), then rvfc$/);
    expect(decoders).toHaveLength(2);
    expect(decoders.every(d => d.closed)).toBe(true);
    expect(videos).toHaveLength(1);
    expect(calls).toEqual([...Array(30).keys()]);
  });

  it('never ends a healthy read on a slow phone, whose analysis of one sample outlasts the budget', async () => {
    const { extractFramesWebCodecs, withRestarts } = await import('../frameExtractor');
    const at = [];
    const slow = async (_c, i, t) => { at.push(t); if (i % 10 === 3) await new Promise(r => setTimeout(r, BUDGET + 5_000)); };
    const run = withRestarts(pass => extractFramesWebCodecs(new Blob(['x']), 15, Infinity, 640, slow, null, pass), {});
    const out = await settle(run, 6 * BUDGET);
    expect(out.error).toBeUndefined();
    expect(out.value?.restarts).toBe(0);
    expect(out.value?.result.frameCount).toBe(30);
    expect(at).toHaveLength(30);
    expect(decoders).toHaveLength(1);
  });
});
