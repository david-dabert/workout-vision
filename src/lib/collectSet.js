/**
 * One set collected: the video's landmarks extracted at the app's settings (15 fps, 640 px long side,
 * the same worker and decoder as the app), with the user's count, view and the video's SHA-256, as the
 * .json.gz the build and exam scripts read. Shared by the collector (collect.html) and the batch
 * collector (collect-batch.html), so every set is read the one same way. No video leaves the phone.
 *
 * signal: aborting it (the page hidden, in the pages) stops the set, and no file is made.
 */
import { extractFramesStreaming } from './frameExtractor';
import { TARGET_FPS, MAX_LONG_SIDE, MAX_FRAMES } from './extractionConfig';
import { setFileName, setPayload, hashVideoContent, gzipBlob, sampleSet, refusal } from './collector';
import { jointRange } from './counting/core';

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

export async function collectSet(file, { lift, count, view }, { signal, onStatus = () => {}, onProgress = () => {} } = {}) {
  onStatus('Hashing video…');
  const sha256 = await hashVideoContent(file);
  // A hide during hashing stops here, before any worker exists to be left running.
  signal?.throwIfAborted();
  onStatus('Loading pose model…');
  const worker = new Worker(new URL('./corePoseWorker.js', import.meta.url));
  let reqId = 0;
  const pending = new Map();
  worker.onmessage = ({ data }) => {
    const req = pending.get(data.id);
    if (!req) return;
    clearTimeout(req.timer);
    pending.delete(data.id);
    if (data.error) req.reject(new Error(data.error));
    else req.resolve(data);
  };
  const send = (msg, transfer = []) => new Promise((resolve, reject) => {
    const id = reqId++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Worker timed out')); }, 60_000);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ ...msg, id }, transfer);
  });
  const aborted = new Promise((_, reject) => signal?.addEventListener('abort', () => reject(signal.reason), { once: true }));
  aborted.catch(() => {});
  try {
    signal?.throwIfAborted();
    await Promise.race([send({ type: 'init' }), aborted]);
  } catch (err) {
    worker.terminate();
    throw err;
  }

  onStatus('Extracting landmarks…');
  const set = sampleSet();
  let frameWidth = 0, frameHeight = 0;
  const metadata = await extractFramesStreaming(
    file, TARGET_FPS, MAX_FRAMES, MAX_LONG_SIDE,
    async (canvas, index, timestamp) => {
      frameWidth = canvas.width;
      frameHeight = canvas.height;
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer;
      let result;
      try {
        result = await send({ pixels, width: canvas.width, height: canvas.height, timestamp: index * 1000 / TARGET_FPS }, [pixels]);
      } catch (err) {
        set.fail(index);
        // The extractor ends on this error (third audit, C06), so the refusal is said here.
        throw new Error(`the pose model could not read sample ${index} (${err?.message || String(err)}). No file is offered. Pick the video again.`, { cause: err });
      }
      set.add(index, result.world, timestamp, result.image);
    },
    pct => onProgress(pct),
    { deterministic: true, signal },
  ).finally(() => worker.terminate());
  // A set hidden at any moment before this point makes no file.
  signal?.throwIfAborted();
  const worldLandmarks = set.world, imageLandmarks = set.image, timestamps = set.timestamps;
  // The file carries the count for the whole video, so its landmarks must cover all of it.
  const refused = refusal({ samples: worldLandmarks.length, duration: metadata.duration, fps: TARGET_FPS, maxFrames: MAX_FRAMES, failed: set.failed, posed: set.posed });
  if (refused) throw new Error(refused);
  onStatus(`Done: ${worldLandmarks.length} samples from ${metadata.method}.`);

  const payload = setPayload({
    worldLandmarks, imageLandmarks, timestamps, lift, count, view, sha256,
    frameWidth, frameHeight, version: VERSION, extractor: metadata,
  });
  const blob = await gzipBlob(JSON.stringify(payload));
  signal?.throwIfAborted();
  // How far the lift's own joint moves: small means the video is likely not the labelled lift (jointRange).
  return { blob, name: setFileName(lift, count, view, sha256), sha256, samples: worldLandmarks.length, method: metadata.method, jointRange: jointRange(worldLandmarks, timestamps, lift) };
}
