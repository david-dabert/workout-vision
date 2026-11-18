import { describe, it, expect, vi } from 'vitest';
import { encodeVideo, EXPORT_FPS } from '../video-export';

// No DOM in these tests: the export canvas is a stand-in that takes its size and draws nothing.
globalThis.EncodedVideoChunk ??= class { constructor({ type, timestamp, duration, data }) { Object.assign(this, { type, timestamp, duration, data }); this.byteLength = data.length; } copyTo(b) { b.set(this.data); } };
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }) }) };

// A fake reader handing N pictures at 30 a second, and a fake encoder recording what it is given.
function fakes(n = 90) {
  const encoded = [];
  class Encoder {
    static isConfigSupported(c) { return Promise.resolve({ supported: c.codec.startsWith('vp09') }); }
    constructor({ output }) { this.output = output; this.state = 'unconfigured'; this.encodeQueueSize = 0; }
    configure(c) { this.config = c; this.state = 'configured'; }
    encode(frame, opts) {
      const first = encoded.length === 0;
      encoded.push({ ts: frame.timestamp, key: opts.keyFrame });
      this.output(new EncodedVideoChunk({ type: opts.keyFrame ? 'key' : 'delta', timestamp: frame.timestamp, duration: frame.duration, data: new Uint8Array([1, 2, 3, 4]) }),
        first ? { decoderConfig: { codec: this.config.codec, codedWidth: this.config.width, codedHeight: this.config.height, colorSpace: { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false } } } : undefined);
    }
    flush() { return Promise.resolve(); }
    close() { this.state = 'closed'; }
  }
  class Frame { constructor(_src, { timestamp, duration }) { this.timestamp = timestamp; this.duration = duration; } close() {} }
  const picture = { width: 1920, height: 1080 };
  const extract = vi.fn(async (_file, fps, _max, maxW, onFrame, onProgress) => {
    for (let i = 0; i < n; i++) { await onFrame(picture, i, 0.25 + i / fps); onProgress?.(Math.round(((i + 1) / n) * 100)); }
    return { duration: n / fps };
  });
  return { encoded, deps: { extract, VideoEncoder: Encoder, VideoFrame: Frame, withRestarts: (run, o) => run(o) } };
}

describe('encodeVideo: the set exported frame by frame (18 November 2026)', () => {
  it('encodes every picture the reader hands, at 30 a second, timestamps from zero, a key frame every 2 s', async () => {
    const { encoded, deps } = fakes(90);
    const draw = vi.fn();
    const file = await encodeVideo({ file: new Blob(), draw, name: m => `x.${m.split('/')[1]}`, deps });
    expect(deps.extract.mock.calls[0][1]).toBe(EXPORT_FPS);
    expect(encoded).toHaveLength(90);
    expect(draw).toHaveBeenCalledTimes(90);
    expect(draw.mock.calls[0][1]).toBeCloseTo(0.25); // the overlay reads the picture's own time, the count's clock
    expect(encoded[0].ts).toBe(0);
    expect(encoded[30].ts).toBe(1e6);
    expect(encoded.filter(e => e.key).length).toBe(2);
    expect(file.name).toBe('x.mp4');
    expect(file.type).toBe('video/mp4');
    expect(file.size).toBeGreaterThan(0);
  });
  it('is refused when no picture is read, and stops on a cancel', async () => {
    const none = fakes(0);
    await expect(encodeVideo({ file: new Blob(), draw: () => {}, name: () => 'x', deps: none.deps })).rejects.toThrow('unreadable');
    const c = new AbortController(); c.abort();
    await expect(encodeVideo({ file: new Blob(), draw: () => {}, name: () => 'x', signal: c.signal, deps: fakes(5).deps })).rejects.toThrow('aborted');
  });
});
