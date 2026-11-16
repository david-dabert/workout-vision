import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const demuxerState = { duration: 10, nbFrames: 100, timestampsUs: [] };

vi.mock('web-demuxer', () => ({
  AVLogLevel: { AV_LOG_QUIET: 0 },
  WebDemuxer: class {
    setLogLevel() {}
    async load() {}
    async getMediaInfo() {
      return {
        duration: demuxerState.duration,
        streams: [{
          codec_type_string: 'video',
          codec_string: 'avc1.4d401f',
          width: 4,
          height: 4,
          rotation: 0,
          nb_frames: demuxerState.nbFrames,
        }],
      };
    }
    async getDecoderConfig() {
      return { codec: 'avc1.4d401f', codedWidth: 4, codedHeight: 4 };
    }
    read() {
      let i = 0;
      return new ReadableStream({
        pull(controller) {
          if (i >= demuxerState.timestampsUs.length) { controller.close(); return; }
          controller.enqueue({ timestamp: demuxerState.timestampsUs[i++], duration: 33333 });
        },
      });
    }
    destroy() {}
  },
}));

import { extractFramesWebCodecs } from '../frameExtractor';
import { unreadSamples } from '../coreAnalysis';

describe('extractFramesWebCodecs low-fps and VFR whole-read accounting', () => {
  const prevWindow = globalThis.window;
  const prevLocation = globalThis.location;
  const prevDocument = globalThis.document;
  const prevVideoDecoder = globalThis.VideoDecoder;

  beforeEach(() => {
    globalThis.location = { origin: 'http://localhost' };
    globalThis.document = {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          save() {},
          translate() {},
          rotate() {},
          drawImage() {},
          restore() {},
          getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        }),
      }),
    };
    globalThis.VideoDecoder = class {
      static async isConfigSupported(config) { return { supported: true, config }; }
      constructor({ output }) { this._output = output; this.decodeQueueSize = 0; }
      configure() {}
      decode(chunk) {
        this._output({
          timestamp: chunk.timestamp,
          displayWidth: 4,
          displayHeight: 4,
          close() {},
        });
      }
      async flush() {}
      close() {}
    };
  });

  afterEach(() => {
    globalThis.window = prevWindow;
    globalThis.location = prevLocation;
    globalThis.document = prevDocument;
    globalThis.VideoDecoder = prevVideoDecoder;
  });

  it('marks CFR 9.79 fps stream decodedWhole and sampledSourceFrames === 117', async () => {
    demuxerState.duration = 11.953333;
    demuxerState.nbFrames = 117;
    demuxerState.timestampsUs = Array.from({ length: 117 }, (_, i) => Math.round((i / 9.79) * 1_000_000));
    const seen = [];
    const meta = await extractFramesWebCodecs(new Blob(['x']), 15, Infinity, 640, async (_c, _idx, t) => seen.push(t));
    expect(meta.decodedWhole).toBe(true);
    expect(meta.sourceFrames).toBe(117);
    expect(meta.sampledSourceFrames).toBe(117);
    expect(meta.frameCount).toBe(117);
    expect(unreadSamples({
      samples: seen.length,
      duration: meta.duration,
      fps: 15,
      maxFrames: Infinity,
      sourceFrames: meta.sourceFrames,
      sampledSourceFrames: meta.sampledSourceFrames,
      decodedWhole: meta.decodedWhole,
    })).toBeNull();
  });

  it('tracks sampler skips on a 10 fps VFR stream with an initial 30 fps burst so it is accepted whole', async () => {
    demuxerState.duration = 10.0;
    demuxerState.nbFrames = 100;
    demuxerState.timestampsUs = [
      ...Array.from({ length: 10 }, (_, i) => Math.round(i * 0.033 * 1_000_000)),
      ...Array.from({ length: 90 }, (_, i) => Math.round((0.300 + (i + 1) * 0.1077) * 1_000_000)),
    ];
    const seen = [];
    const meta = await extractFramesWebCodecs(new Blob(['x']), 15, Infinity, 640, async (_c, _idx, t) => seen.push(t));
    expect(meta.decodedWhole).toBe(true);
    expect(meta.sourceFrames).toBe(100);
    expect(meta.frameCount).toBe(seen.length);
    expect(meta.sampledSourceFrames).toBe(seen.length);
    expect(seen.length).toBeLessThan(100);
    expect(unreadSamples({
      samples: seen.length,
      duration: meta.duration,
      fps: 15,
      maxFrames: Infinity,
      sourceFrames: meta.sourceFrames,
      sampledSourceFrames: meta.sampledSourceFrames,
      decodedWhole: meta.decodedWhole,
    })).toBeNull();
  });

  it('sets decodedWhole=false when demuxer stops before EOF (maxFrames cap)', async () => {
    demuxerState.duration = 11.953333;
    demuxerState.nbFrames = 117;
    demuxerState.timestampsUs = Array.from({ length: 117 }, (_, i) => Math.round((i / 9.79) * 1_000_000));
    const meta = await extractFramesWebCodecs(new Blob(['x']), 15, 50, 640, async () => {});
    expect(meta.decodedWhole).toBe(false);
    expect(meta.sampledSourceFrames).toBeNull();
    expect(meta.frameCount).toBe(50);
  });
});
