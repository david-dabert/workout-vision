// One video packed (videoPack.js), with the frame reader and the encoder stood in for: what the packer itself decides.
// Re-review of 10 October 2026: the browser tests' drawn clips never landed on the cases below, so they are pinned here.
import { describe, expect, it } from 'vitest';
import { packVideo } from '../videoPack';
import { withRestarts } from '../frameExtractor';

class Frame { constructor(_c, { timestamp, duration }) { this.timestamp = timestamp; this.duration = duration; } close() {} }
// Node has no WebCodecs: a chunk as the browser's encoder hands it to mp4-muxer.
globalThis.EncodedVideoChunk ??= class { constructor({ type, timestamp, duration, data }) { Object.assign(this, { type, timestamp, duration, data }); this.byteLength = data.length; } copyTo(b) { b.set(this.data); } };
function encoderClass() {
  return class {
    static async isConfigSupported(c) { return { supported: c.codec.startsWith('vp09') }; }
    constructor({ output }) { this.output = output; this.state = 'unconfigured'; this.encodeQueueSize = 0; this.n = 0; }
    configure(c) { this.config = c; this.state = 'configured'; }
    encode(frame, { keyFrame }) {
      const first = this.n++ === 0;
      this.output(new EncodedVideoChunk({ type: keyFrame ? 'key' : 'delta', timestamp: frame.timestamp, duration: frame.duration, data: new Uint8Array([1, 2, 3, 4]) }),
        first ? { decoderConfig: { codec: this.config.codec, codedWidth: this.config.width, codedHeight: this.config.height, colorSpace: { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false } } } : undefined);
    }
    async flush() {}
    close() { this.state = 'closed'; }
  };
}
// The MP4's length as its movie header says (mvhd), in seconds.
function mp4Seconds(bytes) {
  const s = Buffer.from(bytes), at = s.indexOf('mvhd'), v = s[at + 4];
  const t = v === 1 ? s.readUInt32BE(at + 24) : s.readUInt32BE(at + 16), d = v === 1 ? Number(s.readBigUInt64BE(at + 28)) : s.readUInt32BE(at + 20);
  return d / t;
}
const canvas = { width: 360, height: 640 };
// A reader handing on `n` samples at exact 1/15 s steps from `t0`, optionally failing once part-way with `resume`.
const reader = ({ n, t0 = 0, failAt = null }) => {
  let failed = false;
  return async (_file, _fps, _max, _w, onFrame, _p, pass = {}) => {
    const from = pass.startFrame ?? 0;
    for (let i = from; i < n; i++) {
      if (failAt !== null && !failed && i === failAt) { failed = true; throw Object.assign(new Error('Video decode failed: Decoder failure'), { resume: { startFrame: i, origin: t0, after: t0 + (i - 1) / 15 } }); }
      await onFrame(canvas, i, t0 + i / 15);
    }
    return { duration: n / 15, frameCount: n - from };
  };
};
const deps = extract => ({ extract, withRestarts, VideoEncoder: encoderClass(), VideoFrame: Frame });

describe('one video packed', () => {
  it('ends after its last picture, so a reader at 15 a second takes every one (23 pictures: 23 = 2 mod 3)', async () => {
    for (const n of [23, 152, 155, 150, 151]) {
      const out = await packVideo(new Blob(['x']), { deps: deps(reader({ n, t0: 0.4 })) });
      const secs = mp4Seconds(new Uint8Array(await out.blob.arrayBuffer()));
      expect(Math.floor(secs * 15 + 1e-9), `${n} pictures`).toBeGreaterThanOrEqual(n);
      expect(out.packed.frames).toBe(n);
      expect(out.packed.seconds).toBeCloseTo(secs, 2);
    }
  });

  it('goes on after a decoder that fails part-way, keeping every picture once and the times in order', async () => {
    const out = await packVideo(new Blob(['x']), { deps: deps(reader({ n: 45, t0: 0.2, failAt: 10 })) });
    expect(out.packed.restarts).toBe(1);
    expect(out.packed.frames).toBe(45);
    expect(out.packed.whole).toBe(true);
  });

  it('says when fewer pictures were read than the app takes', async () => {
    const cut = async (_f, _fps, _m, _w, onFrame) => { for (let i = 0; i < 10; i++) await onFrame(canvas, i, i / 15); return { duration: 3, frameCount: 10 }; };
    const out = await packVideo(new Blob(['x']), { deps: deps(cut) });
    expect(out.packed).toMatchObject({ frames: 10, expected: 45, whole: false });
  });

  it('never retries an error of the packing itself', async () => {
    let calls = 0;
    const broken = class extends encoderClass() { encode() { throw new Error('encoder broke'); } };
    const extract = async (_f, _fps, _m, _w, onFrame) => { calls++; await onFrame(canvas, 0, 0); return { duration: 1 }; };
    await expect(packVideo(new Blob(['x']), { deps: { extract, withRestarts, VideoEncoder: broken, VideoFrame: Frame } })).rejects.toThrow('encoder broke');
    expect(calls).toBe(1);
  });
});
