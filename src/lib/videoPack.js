/**
 * One video made small for the packer (pack.html; rules in pack.js). The pictures are the app's own: the frame reader
 * the count uses (frameExtractor.js, extractFramesWebCodecs: the phone's hardware decoder, 15 pictures a second from
 * the video's first frame, 640 px on the long side, rotation applied). Each picture is encoded once by the browser's
 * VideoEncoder (the iPhone's hardware H.264, VP9 where there is none) and written to an MP4 (mp4-muxer, MIT) with
 * the picture's own time, so the packed video holds what the phone's count reads, on its own clock. No sound.
 */
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { extractFramesWebCodecs } from './frameExtractor';
import { MAX_LONG_SIDE, TARGET_FPS } from './extractionConfig';
import { KEY_EVERY_SEC, crc32, pickEncoder } from './pack';

// Pictures the encoder may hold before the reader waits: keeps memory flat on a long video. Source: convention
// (the frame reader's own back-pressure holds 1 to 2 decoded frames, frameExtractor.js). Status: convention.
const MAX_ENCODE_QUEUE = 2;

/**
 * Resolves { blob, size, crc, source, packed } for the file, or rejects (AbortError on a cancel; an Error saying why
 * otherwise: a codec the phone cannot decode, no encoder). onProgress(0..100) follows the pictures read.
 */
export async function packVideo(file, { signal, onProgress, bpp, deps = {} } = {}) {
  const extract = deps.extract ?? extractFramesWebCodecs;
  const Encoder = deps.VideoEncoder ?? globalThis.VideoEncoder;
  const Frame = deps.VideoFrame ?? globalThis.VideoFrame;
  if (!Encoder || !Frame) throw new Error('this browser has no video encoder (WebCodecs)');
  let encoder = null, muxer = null, target = null, picked = null, source = null, first = null, last = 0;
  let frames = 0, encodeError = null;
  const keyEvery = Math.max(1, Math.round(KEY_EVERY_SEC * TARGET_FPS));
  const t0 = performance.now();
  try {
    const read = await extract(file, TARGET_FPS, Infinity, MAX_LONG_SIDE, async (canvas, index, timestamp) => {
      if (!encoder) {
        picked = await pickEncoder(canvas.width, canvas.height, c => Encoder.isConfigSupported(c), bpp);
        if (!picked) throw new Error('this browser encodes neither H.264 nor VP9');
        target = new ArrayBufferTarget();
        muxer = new Muxer({ target, video: { codec: picked.mux, width: canvas.width, height: canvas.height }, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
        encoder = new Encoder({ output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta); } catch (e) { encodeError ??= e; } }, error: e => { encodeError ??= e; } });
        encoder.configure(picked.config);
        first = timestamp;
      }
      if (encodeError) throw encodeError;
      const us = Math.round((timestamp - first) * 1e6);
      last = us;
      const frame = new Frame(canvas, { timestamp: us, duration: Math.round(1e6 / TARGET_FPS) });
      try { encoder.encode(frame, { keyFrame: index % keyEvery === 0 }); } finally { frame.close(); }
      frames++;
      while (encoder.encodeQueueSize > MAX_ENCODE_QUEUE && !encodeError) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        await new Promise(r => setTimeout(r, 0));
      }
    }, onProgress, { signal, onSource: s => { source = s; } });
    if (!encoder || frames === 0) throw new Error('no picture could be read from this video');
    await encoder.flush();
    if (encodeError) throw encodeError;
    muxer.finalize();
    const bytes = new Uint8Array(target.buffer);
    return {
      blob: new Blob([bytes], { type: 'video/mp4' }), size: bytes.length, crc: crc32(bytes), source,
      packed: {
        codec: picked.config.codec, width: picked.config.width, height: picked.config.height, fps: TARGET_FPS, frames,
        seconds: Math.round(last / 1e3) / 1e3, bitrate: picked.config.bitrate, sourceDuration: read?.duration ?? null,
        rotation: read?.rotationDecision || null, packSeconds: Math.round((performance.now() - t0) / 100) / 10,
      },
    };
  } finally {
    if (encoder && encoder.state !== 'closed') { try { encoder.close(); } catch { /* already closed */ } }
  }
}
