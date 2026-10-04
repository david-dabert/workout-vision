/**
 * Third audit, 3 October 2026. A failure of the caller's analysis (the pose worker) ends the extraction on both
 * decoding paths (C06): the playback path swallowed it and took the sample again from a later frame, or hung
 * 60 s a frame on a dead worker, and the WebCodecs path took it for a decoder failure and decoded the whole video
 * again. A pose-model exception is posted as an error, not as an empty frame (C07).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('web-demuxer', () => ({
  WebDemuxer: class {
    async load() {}
    async getMediaInfo() { return { duration: 2, streams: [{ codec_type_string: 'video', width: 640, height: 480, rotation: 0 }] }; }
    async getDecoderConfig() { return { codec: 'avc1' }; }
    read() { return new ReadableStream({ start(c) { for (let i = 0; i < 60; i++) c.enqueue({ t: i / 30 }); c.close(); } }); }
    destroy() {}
  },
}));

const context = () => ({ drawImage() {}, save() {}, restore() {}, translate() {}, rotate() {}, getImageData: () => ({ data: new Uint8ClampedArray(32 * 32 * 4).fill(200) }) });

// A <video> that plays 2 s at 30 frames a second, one frame callback per frame.
function fakeVideo() {
  const video = {
    duration: 2, videoWidth: 640, videoHeight: 480, paused: true, ended: false, t: 0, callbacks: [],
    load() { if (this.src) setTimeout(() => this.onloadeddata?.(), 0); },
    pause() { this.paused = true; },
    play() {
      if (!this.paused) return Promise.resolve();
      this.paused = false;
      const tick = () => {
        if (this.paused) return;
        this.t += 1 / 30;
        const due = this.callbacks.splice(0);
        for (const cb of due) cb(0, { mediaTime: this.t });
        setTimeout(tick, 0);
      };
      setTimeout(tick, 0);
      return Promise.resolve();
    },
    requestVideoFrameCallback(cb) { this.callbacks.push(cb); },
    addEventListener() {}, removeEventListener() {},
  };
  return video;
}

function stubPage({ webcodecs }) {
  vi.stubGlobal('location', { origin: 'https://app.test' });
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: () => 'blob:x', revokeObjectURL() {} }));
  const videos = [];
  vi.stubGlobal('document', { createElement: tag => {
    if (tag === 'video') { const v = fakeVideo(); videos.push(v); return v; }
    return { getContext: context };
  } });
  vi.stubGlobal('HTMLVideoElement', class { requestVideoFrameCallback() {} });
  if (webcodecs) {
    vi.stubGlobal('VideoDecoder', class {
      static async isConfigSupported() { return { supported: true }; }
      constructor({ output }) { this.output = output; this.decodeQueueSize = 0; }
      configure() {}
      decode(chunk) { this.output({ timestamp: chunk.t * 1e6, displayWidth: 640, displayHeight: 480, codedWidth: 640, codedHeight: 480, close() {} }); }
      async flush() {}
      close() {}
    });
  } else vi.stubGlobal('VideoDecoder', undefined);
  return videos;
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('a failed analysis of one sample (third audit, C06)', () => {
  it('ends the playback path with that error, the sample not taken again from a later frame', async () => {
    stubPage({ webcodecs: false });
    const { extractFramesRVFC } = await import('../frameExtractor');
    const calls = [];
    const onFrame = async (_canvas, index) => { calls.push(index); if (index === 3) throw new Error('Pose worker timed out'); };
    await expect(extractFramesRVFC(new Blob(['x']), 15, Infinity, 640, onFrame, null, {})).rejects.toThrow('Pose worker timed out');
    expect(calls).toEqual([0, 1, 2, 3]);
  });
  it('is not taken for a decoder failure: no second pass on the playback path after WebCodecs', async () => {
    const videos = stubPage({ webcodecs: true });
    const { extractFramesStreaming } = await import('../frameExtractor');
    const calls = [];
    const onFrame = async (_canvas, index) => { calls.push(index); if (index === 3) throw new Error('Pose worker timed out'); };
    await expect(extractFramesStreaming(new Blob(['x']), 15, Infinity, 640, onFrame, null, {})).rejects.toThrow('Pose worker timed out');
    expect(calls).toEqual([0, 1, 2, 3]);
    expect(videos).toHaveLength(0);
  });
});

// Frozen-read incident, 3 October 2026: at a demo on David's iPhone a machine lateral raise counted 0, twice. The
// playback path paused the video before drawing it, and a paused video may draw a stale frame on WebKit; a decoder
// that hands on the same picture again and again gave a still pose and a confident 0. Each canvas here holds what
// was last drawn on it: a moving source gives a new picture each sample, a frozen one the same picture throughout.
function stubFrozenPage({ webcodecsFrozen, rvfcFrozen }) {
  const videos = stubPage({ webcodecs: true });
  const draws = [];
  const value = src => {
    if (typeof src.timestamp === 'number') return webcodecsFrozen ? 200 : 1 + Math.round(src.timestamp / 1e6 * 30);
    draws.push({ t: src.t, paused: src.paused });
    return rvfcFrozen ? 200 : 1 + Math.round(src.t * 30);
  };
  vi.stubGlobal('document', { createElement: tag => {
    if (tag === 'video') { const v = fakeVideo(); videos.push(v); return v; }
    let shown = 0;
    const ctx = { drawImage(src) { shown = value(src); }, save() {}, restore() {}, translate() {}, rotate() {}, getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(Math.min(w * h, 32 * 32) * 4).fill(shown) }) };
    return { width: 640, height: 480, getContext: () => ctx };
  } });
  return { videos, draws };
}

describe('a frozen read (frozen-read incident, 3 October)', () => {
  it('the playback path draws each sample while its frame plays, then pauses the video', async () => {
    const { draws } = stubFrozenPage({ webcodecsFrozen: false, rvfcFrozen: false });
    const { extractFramesRVFC } = await import('../frameExtractor');
    const meta = await extractFramesRVFC(new Blob(['x']), 15, Infinity, 640, async () => {}, null, {});
    expect(meta.frameCount).toBe(30);
    expect(draws).toHaveLength(30);
    expect(draws.every(d => d.paused === false)).toBe(true);
  });
  it('a moving read through WebCodecs is kept, the playback path never started', async () => {
    const { videos } = stubFrozenPage({ webcodecsFrozen: false, rvfcFrozen: false });
    const { extractFramesStreaming } = await import('../frameExtractor');
    const result = await extractFramesStreaming(new Blob(['x']), 15, Infinity, 640, async () => {}, null, {});
    expect(result.method).toBe('webcodecs');
    expect(videos).toHaveLength(0);
  });
  it('a frozen WebCodecs read falls back to the playback path, which starts again at sample 0', async () => {
    const { videos } = stubFrozenPage({ webcodecsFrozen: true, rvfcFrozen: false });
    const { extractFramesStreaming } = await import('../frameExtractor');
    const calls = [];
    const result = await extractFramesStreaming(new Blob(['x']), 15, Infinity, 640, async (_c, i) => { calls.push(i); }, null, {});
    expect(result.method).toMatch(/^webcodecs failed after 30 samples \(frozen read: 29 of 30 samples repeat the one before\), then rvfc$/);
    expect(videos).toHaveLength(1);
    expect(calls.slice(0, 30)).toEqual([...Array(30).keys()]);
    expect(calls.slice(30)).toEqual([...Array(30).keys()]);
  });
  it('both reads frozen: an error, never a count', async () => {
    stubFrozenPage({ webcodecsFrozen: true, rvfcFrozen: true });
    const { extractFramesStreaming } = await import('../frameExtractor');
    const run = extractFramesStreaming(new Blob(['x']), 15, Infinity, 640, async () => {}, null, {});
    await expect(run).rejects.toThrow(/No decoder could process this file[\s\S]*WebCodecs: frozen read[\s\S]*RVFC: frozen read: 29 of 30/);
  });
  it('the playback path forced and frozen (the check page): an error, WebCodecs not tried behind its back', async () => {
    stubFrozenPage({ webcodecsFrozen: false, rvfcFrozen: true });
    const { extractFramesStreaming } = await import('../frameExtractor');
    await expect(extractFramesStreaming(new Blob(['x']), 15, Infinity, 640, async () => {}, null, { path: 'rvfc' })).rejects.toThrow(/RVFC: frozen read/);
  });
});

describe('a pose-model exception (third audit, C07)', () => {
  it('reads as no person by default, and is thrown when the worker asks for it', async () => {
    const { detectPoseImage } = await import('../poseAnalysis');
    const landmarker = { detect() { throw new Error('wasm abort'); }, detectForVideo() { throw new Error('wasm abort'); } };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(detectPoseImage(landmarker, {}, 0)).toBeNull();
    expect(() => detectPoseImage(landmarker, {}, 0, { rethrow: true })).toThrow('wasm abort');
    warn.mockRestore();
  });
});

describe('the pose worker on a pose-model exception (third audit, C07)', () => {
  it('posts the error, so the run ends as an error and not as a frame without a person', async () => {
    vi.doMock('../poseAnalysis', async (original) => ({
      ...(await original()),
      getImageLandmarker: async () => ({ detect() { throw new Error('wasm abort'); }, detectForVideo() { throw new Error('wasm abort'); } }),
    }));
    const posted = [];
    vi.stubGlobal('self', { postMessage: m => posted.push(m) });
    vi.stubGlobal('OffscreenCanvas', class { constructor(w, h) { this.width = w; this.height = h; } getContext() { return { putImageData() {} }; } });
    vi.stubGlobal('ImageData', class { constructor(d, w, h) { this.data = d; this.width = w; this.height = h; } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await import('../corePoseWorker');
    await globalThis.self.onmessage({ data: { id: 0, type: 'init' } });
    await globalThis.self.onmessage({ data: { id: 1, pixels: new Uint8ClampedArray(16).buffer, width: 2, height: 2, timestamp: 0 } });
    warn.mockRestore();
    vi.doUnmock('../poseAnalysis');
    expect(posted).toEqual([{ id: 0 }, { id: 1, error: 'wasm abort' }]);
  });
});
