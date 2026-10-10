// Re-review of 10 October 2026 (the video packer). A restart on a source under 15 pictures a second (or with a hole longer than 1/15 s): the samples must still move
// forward in time after the restart.
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('web-demuxer', () => ({
  WebDemuxer: class {
    async load() {}
    async getMediaInfo() { return { duration: 4, streams: [{ codec_type_string: 'video', width: 640, height: 480, rotation: 0 }] }; }
    async getDecoderConfig() { return { codec: 'avc1' }; }
    // 10 pictures a second from 0 s; the demuxer starts at the time asked (every picture a key picture).
    read(_type, at) { return new ReadableStream({ start(c) { for (let i = 0; i < 40; i++) if (i / 10 >= at - 1e-9) c.enqueue({ t: i / 10 }); c.close(); } }); }
    destroy() {}
  },
}));
let made = 0;
beforeEach(() => {
  made = 0;
  globalThis.location = { origin: 'https://app.test' };
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }) }) };
  globalThis.VideoDecoder = class {
    static async isConfigSupported() { return { supported: true }; }
    constructor({ output, error }) { this.output = output; this.error = error; this.decodeQueueSize = 0; this.n = 0; this.first = made++ === 0; this.closed = false; }
    configure() {}
    decode(chunk) {
      if (this.closed) throw new DOMException('closed', 'InvalidStateError');
      if (this.first && ++this.n > 20) { this.closed = true; this.error(new DOMException('Decoder failure', 'EncodingError')); return; }
      this.output({ timestamp: chunk.t * 1e6, close() {} });
    }
    async flush() {}
    close() { this.closed = true; }
  };
});
describe('a restart on a 10-a-second video', () => {
  it('never goes back in time', async () => {
    const { extractFramesWebCodecs, withRestarts } = await import('../frameExtractor');
    const at = [];
    const { restarts } = await withRestarts(pass => extractFramesWebCodecs(new Blob(['x']), 15, Infinity, 640, async (_c, _i, t) => { at.push(+t.toFixed(3)); await new Promise(r => setTimeout(r, 5)); }, null, pass), {});
    for (let i = 1; i < at.length; i++) expect(at[i], `sample ${i}`).toBeGreaterThan(at[i - 1]);
  });
});
