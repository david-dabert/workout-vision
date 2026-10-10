/**
 * One video made small for the packer (pack.html; rules in pack.js). The pictures are the app's own: the frame reader
 * the count uses (frameExtractor.js, extractFramesWebCodecs: the phone's hardware decoder, 15 pictures a second from
 * the video's first frame, 640 px on the long side, rotation applied). Each picture is encoded once by the browser's
 * VideoEncoder (the iPhone's hardware H.264, VP9 where there is none) and written to an MP4 (mp4-muxer, MIT) with
 * the picture's own time, so the packed video holds what the phone's count reads, on its own clock. No sound.
 */
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { extractFramesWebCodecs, withRestarts } from './frameExtractor';
import { MAX_LONG_SIDE, TARGET_FPS } from './extractionConfig';
import { KEY_EVERY_SEC, crc32, pickEncoder } from './pack';

// Pictures the encoder may hold before the reader waits: keeps memory flat on a long video. Source: convention
// (the frame reader's own back-pressure holds 1 to 2 decoded frames, frameExtractor.js). Status: convention.
const MAX_ENCODE_QUEUE = 2;
// Each picture's duration: 1/15 s and 1 ms more. mp4-muxer takes every duration but the last from the gaps between
// pictures, so only the last picture is longer, and the file ends just after N/15 s: a reader taking
// floor(duration x 15) samples (frameExtractor.js) then reads all N. At exactly 1/15 s the stored length, rounded to
// the millisecond, fell under N/15 s for one count in three and the last picture was lost (review of 10 October 2026,
// reproduced with 155 pictures read as 154). Source: that reproduction. Status: validated (Chromium).
const FRAME_US = Math.round(1e6 / TARGET_FPS) + 1000;

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
    // A decoder that fails part-way (Safari's "Decoder failure", David's iPhone, 4 October) is replaced and goes on from
    // the sample where it stopped, as the app's own read does (frameExtractor.js, withRestarts); the encoder and the file
    // go on across the restart. An error of the packing itself (onFrame) is not retried.
    const onFrame = async (canvas, index, timestamp) => {
      try { await encodeOne(canvas, index, timestamp); } catch (e) { if (e && typeof e === 'object') e.fromOnFrame = true; throw e; }
    };
    const encodeOne = async (canvas, index, timestamp) => {
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
      const frame = new Frame(canvas, { timestamp: us, duration: FRAME_US });
      try { encoder.encode(frame, { keyFrame: index % keyEvery === 0 }); } finally { frame.close(); }
      frames++;
      while (encoder.encodeQueueSize > MAX_ENCODE_QUEUE && !encodeError) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        await new Promise(r => setTimeout(r, 0));
      }
    };
    const { result: read, restarts } = await (deps.withRestarts ?? withRestarts)(pass => extract(file, TARGET_FPS, Infinity, MAX_LONG_SIDE, onFrame, onProgress, pass), { signal, onSource: s => { source = s; } });
    if (!encoder || frames === 0) throw new Error('no picture could be read from this video');
    await encoder.flush();
    if (encodeError) throw encodeError;
    muxer.finalize();
    const bytes = new Uint8Array(target.buffer);
    return {
      blob: new Blob([bytes], { type: 'video/mp4' }), size: bytes.length, crc: crc32(bytes), source,
      packed: {
        codec: picked.config.codec, width: picked.config.width, height: picked.config.height, fps: TARGET_FPS, frames,
        seconds: Math.round((last + FRAME_US) / 1e3) / 1e3, bitrate: picked.config.bitrate, sourceDuration: read?.duration ?? null,
        rotation: read?.rotationDecision || null, restarts, packSeconds: Math.round((performance.now() - t0) / 100) / 10,
      },
    };
  } finally {
    if (encoder && encoder.state !== 'closed') { try { encoder.close(); } catch { /* already closed */ } }
  }
}
