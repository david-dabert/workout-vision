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
