/**
 * WebCodecs decoding cleans up on every exit (audit FINDING-006): the decoder was closed and the queued frames
 * released only on the normal path, and a cancel while waiting for a frame left the wait pending forever.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('web-demuxer', () => ({
  WebDemuxer: class {
    async load() {}
    async getMediaInfo() { return { duration: 2, streams: [{ codec_type_string: 'video', width: 640, height: 480, rotation: 0 }] }; }
    async getDecoderConfig() { return { codec: 'avc1' }; }
    read() { return globalThis.__stream(); }
    destroy() { globalThis.__destroyed = true; }
  },
}));

let decoders;
beforeEach(() => {
  decoders = [];
  globalThis.__destroyed = false;
  globalThis.location = { origin: 'https://app.test' };
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {}, save() {}, restore() {}, translate() {}, rotate() {} }) }) };
  globalThis.VideoDecoder = class {
    static async isConfigSupported() { return { supported: true }; }
    constructor({ output }) { this.output = output; this.closed = false; this.decodeQueueSize = 0; decoders.push(this); }
    configure() {}
    decode(chunk) { if (this.closed) throw new Error('closed'); if (globalThis.__emit) this.output(makeFrame(chunk.t)); }
    async flush() { if (globalThis.__hang) await new Promise(() => {}); }
    close() { this.closed = true; }
  };
});
afterEach(() => { delete globalThis.__emit; delete globalThis.__hang; });

const frames = [];
function makeFrame(t) { const f = { timestamp: t * 1e6, closed: false, close() { this.closed = true; } }; frames.push(f); return f; }
const chunks = n => new ReadableStream({ start(c) { for (let i = 0; i < n; i++) c.enqueue({ t: i / 30 }); c.close(); } });

describe('WebCodecs decoding on an error or a cancel', () => {
  it('an error in the frame callback closes the decoder and every frame still queued', async () => {
    const { extractFramesWebCodecs } = await import('../frameExtractor');
    globalThis.__emit = true; globalThis.__stream = () => chunks(60);
    await expect(extractFramesWebCodecs(new Blob(['x']), 15, Infinity, 640, async () => { throw new Error('callback failed'); }, null, {})).rejects.toThrow('callback failed');
    expect(decoders[0].closed).toBe(true);
    expect(frames.every(f => f.closed)).toBe(true);
    expect(globalThis.__destroyed).toBe(true);
  });
  it('a cancel while waiting for a frame ends the decoding at once', async () => {
    const { extractFramesWebCodecs } = await import('../frameExtractor');
    globalThis.__emit = false; globalThis.__hang = true; globalThis.__stream = () => new ReadableStream({ start() {} });
    const ac = new AbortController();
    const run = extractFramesWebCodecs(new Blob(['x']), 15, Infinity, 640, async () => {}, null, { signal: ac.signal });
    await new Promise(r => setTimeout(r, 20));
    ac.abort();
    const settled = await Promise.race([run.then(() => 'resolved', e => e.name), new Promise(r => setTimeout(() => r('still waiting'), 500))]);
    expect(settled).toBe('AbortError');
    expect(decoders[0].closed).toBe(true);
  });
});

// Second audit, 3 October: the sampling grid started at 0 s while a video whose first frame is later (a trimmed or
// edited file) gave every frame until the grid caught up, so the samples ran out before the end of the video.
describe('a video whose first frame is not at 0 s', () => {
  it('is sampled every fifteenth of a second from its first frame', async () => {
    const { extractFramesWebCodecs } = await import('../frameExtractor');
    globalThis.__emit = true;
    globalThis.__stream = () => new ReadableStream({ start(c) { for (let i = 0; i < 60; i++) c.enqueue({ t: 0.5 + i / 30 }); c.close(); } });
    const at = [];
    await extractFramesWebCodecs(new Blob(['x']), 15, Infinity, 640, async (_c, _i, t) => { at.push(t); }, null, {});
    expect(at[0]).toBeCloseTo(0.5, 3);
    for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1], `sample ${i}`).toBeCloseTo(1 / 15, 2);
  });
});
