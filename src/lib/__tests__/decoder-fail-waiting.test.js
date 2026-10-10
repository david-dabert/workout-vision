// Re-review of 10 October 2026 (the video packer). A decoder that fails part-way while the reader waits for its next frame (Safari: decode() returns, then the error
// callback fires): the read must fail with `resume` (so withRestarts restarts it), not end early as a success.
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('web-demuxer', () => ({
  WebDemuxer: class {
    async load() {}
    async getMediaInfo() { return { duration: 2, streams: [{ codec_type_string: 'video', width: 640, height: 480, rotation: 0 }] }; }
    async getDecoderConfig() { return { codec: 'avc1' }; }
    read(_type, at) { return new ReadableStream({ start(c) { for (let i = 0; i < 60; i++) if (i / 30 >= at - 1e-9) c.enqueue({ t: i / 30 }); c.close(); } }); }
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
      if (this.first && ++this.n > 20) { this.closed = true; setTimeout(() => this.error(new DOMException('Decoder failure', 'EncodingError')), 0); return; }
      this.output({ timestamp: chunk.t * 1e6, close() {} });
    }
    async flush() {}
    close() { this.closed = true; }
  };
});

describe('a decoder failure while the reader waits', () => {
  it('is restarted by withRestarts and every sample is read', async () => {
    const { extractFramesWebCodecs, withRestarts } = await import('../frameExtractor');
    const at = [];
    const { result, restarts } = await withRestarts(pass => extractFramesWebCodecs(new Blob(['x']), 15, Infinity, 640, async (_c, _i, t) => { at.push(t); }, null, pass), {});
    expect(restarts).toBe(1);
    expect(at.length).toBe(30);
  });
});
