import { countReps, liftDefinition } from './counting/core';
import { FITNESS_TESTS, isTest, openRise, scoreTest } from './fitness-tests';
import { extractFramesStreaming } from './frameExtractor';
import { TARGET_FPS, MAX_LONG_SIDE, MAX_FRAMES } from './extractionConfig';

import { OFFERED, isOffered } from './offer';

// Every offered exercise: the lifts of LIFT TIERS and every countable exercise of the guide (offer.js).
export const APPROVED_LIFTS = OFFERED;

export function summarizeCount(worldLandmarks, timestamps, lift) {
  const core = countReps(worldLandmarks, timestamps, lift);
  // A strict majority of unavailable joint angles is the only counting refusal.
  // Use the core's own raw-angle validity (before outlier removal/bridging).
  const visible = core.angles.filter(angle => angle !== null).length;
  const refused = visible < worldLandmarks.length / 2 || worldLandmarks.length === 0;
  // A fitness test is scored over its window (fitness-tests.js): the count and the marks are the reps in it.
  if (isTest(lift) && !refused) {
    const after = core.reps.length ? core.reps.at(-1).endTime : -Infinity;
    const open = openRise(core.smoothedAngles, timestamps, core.lowThreshold, core.highThreshold, liftDefinition(lift).rest, after);
    const t = scoreTest(core.reps, timestamps.at(-1), FITNESS_TESTS[lift].windowSec, open, timestamps[0]);  // count = reps kept, the open rise among them
    return { ...core, count: t.score, reps: t.reps, refused, test: { windowSec: FITNESS_TESTS[lift].windowSec, t0: t.t0, complete: t.complete, beyond: t.beyond, open: t.open, counted: core.count } };
  }
  return { ...core, refused };
}

/**
 * A read that is not whole: { read, expected } unless exactly floor(duration x fps) samples came
 * back, else null. On 29 September David's iPhone read 181 of the 439 samples of his lateral raise
 * clip and the app counted 2 of 10. The collector's rule (collector.js, setIsWhole) holds for the app:
 * fewer samples, more samples (a failed first decoding pass leaves its samples behind), a length the
 * video does not report, or more samples than the cap, and no count is shown (R8; review 01).
 * Status: convention, from the extractor's own sampling rule.
 */
export function unreadSamples({ samples, duration, fps, maxFrames }) {
  const expected = Math.floor(duration * fps);
  const whole = Number.isFinite(expected) && expected > 0 && expected <= maxFrames && samples === expected;
  return whole ? null : { read: samples, expected: Number.isFinite(expected) && expected > 0 ? expected : null };
}

export class PartialReadError extends Error {
  constructor({ read, expected, decoder = '' }) { super(`${read} samples read where the video holds ${expected ?? 'an unknown number'}`); this.name = 'PartialReadError'; this.read = read; this.expected = expected; this.decoder = decoder; }
}

export async function analyzeCoreVideo(file, lift, { signal, onProgress = () => {}, onPhase = () => {}, onLandmarks = () => {}, path } = {}) {
  if (!isOffered(lift)) throw new Error('Choose an approved lift');
  const worker = new Worker(new URL('./corePoseWorker.js', import.meta.url));
  let id = 0;
  const pending = new Map();
  const failAll = (error) => {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error); }
    pending.clear();
  };
  worker.onmessage = ({ data }) => {
    const request = pending.get(data.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(data.id);
    if (data.error) request.reject(new Error(data.error));
    else request.resolve(data);
  };
  worker.onerror = (event) => failAll(new Error(event.message || 'Pose worker failed'));
  const abort = () => { worker.terminate(); failAll(new DOMException('Cancelled', 'AbortError')); };
  const send = (message, transfer = []) => new Promise((resolve, reject) => {
    const requestId = id++;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Pose worker timed out')); }, 60000);
    pending.set(requestId, { resolve, reject, timer });
    worker.postMessage({ ...message, id: requestId }, transfer);
  });
  signal?.addEventListener('abort', abort, { once: true });
  try {
    signal?.throwIfAborted();
    onPhase('model');
    await send({ type: 'init' });
    onPhase('extracting');
    const imageLandmarks = [], worldLandmarks = [], timestamps = [];
    const metadata = await extractFramesStreaming(file, TARGET_FPS, MAX_FRAMES, MAX_LONG_SIDE, async (canvas, index, timestamp) => {
      signal?.throwIfAborted();
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer;
      const result = await send({ pixels, width: canvas.width, height: canvas.height, timestamp: index * 1000 / TARGET_FPS }, [pixels]);
      imageLandmarks.push(result.image);
      worldLandmarks.push(result.world);
      timestamps.push(timestamp);
      onLandmarks(result.image, canvas.width, canvas.height);
    }, onProgress, { deterministic: true, signal, ...(path ? { path } : {}) });
    signal?.throwIfAborted();
    const missed = unreadSamples({ samples: timestamps.length, duration: metadata?.duration, fps: TARGET_FPS, maxFrames: MAX_FRAMES });
    if (missed) throw new PartialReadError({ ...missed, decoder: metadata?.method || '' });
    const result = { ...summarizeCount(worldLandmarks, timestamps, lift), exercise: lift, metadata, imageLandmarks, worldLandmarks, timestamps };
    // Local diagnostic event: tests observe actual app output, never inject landmarks.
    window.dispatchEvent(new CustomEvent('wv:core-result', { detail: result }));
    return result;
  } finally {
    signal?.removeEventListener('abort', abort);
    worker.terminate();
    failAll(new Error('Analysis finished'));
  }
}
