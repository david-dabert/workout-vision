import { countReps, liftDefinition } from './counting/core';
import { poseDoubt } from './counting/doubt';
import { FITNESS_TESTS, isTest, openRise, riseHalfTimes, scoreTest } from './fitness-tests';
import { extractFramesStreaming } from './frameExtractor';
import { isFrozenRead } from './frozenRead';
import { TARGET_FPS, MAX_LONG_SIDE, MAX_FRAMES } from './extractionConfig';

import { OFFERED, isOffered } from './offer';

// Every offered exercise: the lifts of LIFT TIERS and every countable exercise of the guide (offer.js).
export const APPROVED_LIFTS = OFFERED;

// Two skeletons equal to the last digit: the same picture went through the pose model twice.
const sameSkeleton = (a, b) => !!a && !!b && a.length === b.length && a.every((p, i) => p.x === b[i].x && p.y === b[i].y && p.z === b[i].z);

/**
 * Samples whose world skeleton repeats the one before exactly: { samples, repeats }. The app's pose worker runs
 * MediaPipe in IMAGE mode (corePoseWorker.js, getImageLandmarker: useImageMode, CPU), with no state carried from one
 * frame to the next, and the world landmarks pass through unfiltered (poseAnalysis.js, detectPoseImage): the same
 * picture gives the same skeleton, and a filmed person never gives the same skeleton twice. A frame with no person
 * (null) is never a repeat; it is the visibility refusal's business. Frozen-read incident, 3 October.
 */
export function repeatedSkeletons(worldLandmarks) {
  let repeats = 0;
  for (let i = 1; i < worldLandmarks.length; i++) if (sameSkeleton(worldLandmarks[i], worldLandmarks[i - 1])) repeats++;
  return { samples: worldLandmarks.length, repeats };
}

// A read whose skeletons repeat (repeatedSkeletons, isFrozenRead): an error of the read, never a count nor a refusal
// that would blame the person's position (frozen-read incident, 3 October). It is shown as the screen for a video
// that could not be read (CoreUpload.jsx, AnalysisError).
export class FrozenSkeletonsError extends Error {
  constructor({ samples, repeats }, decoder = '', fallback = null) { super(`${repeats} of ${samples} skeletons repeat the one before: the video was read frozen`); this.name = 'FrozenSkeletonsError'; this.samples = samples; this.repeats = repeats; this.decoder = decoder; this.fallback = fallback; }
}

export function summarizeCount(worldLandmarks, timestamps, lift) {
  const core = countReps(worldLandmarks, timestamps, lift);
  // A strict majority of unavailable joint angles is the only counting refusal.
  // Use the core's own raw-angle validity (before outlier removal/bridging).
  // A two-sided exercise is counted on both sides, so each must be in sight: the less visible side decides
  // (audit FINDING-012: one hidden arm let the other's reps through as the whole count).
  // A lunge's two knees bend together on every rep (core.ts, `together`): joined, either knee in sight sees the
  // rep, so a sample is seen when one of them is. Status: experimental (TRIED.md, 3 October).
  const seen = angles => angles.filter(angle => angle !== null).length;
  const either = (l, r) => l.filter((angle, i) => angle !== null || r[i] !== null).length;
  const visible = core.sides
    ? (liftDefinition(lift)?.together ? either(core.sides.left.angles, core.sides.right.angles) : Math.min(seen(core.sides.left.angles), seen(core.sides.right.angles)))
    : seen(core.angles);
  const refused = visible < worldLandmarks.length / 2 || worldLandmarks.length === 0;
  // Where the body went unseen (counting/doubt.js): measured and stored, read by no screen yet.
  const doubt = refused ? null : poseDoubt(core, timestamps, { together: !!liftDefinition(lift)?.together });
  // A fitness test is scored over its window (fitness-tests.js): the count and the marks are the reps in it.
  if (isTest(lift) && !refused) {
    const after = core.reps.length ? core.reps.at(-1).endTime : -Infinity;
    const open = openRise(core.smoothedAngles, timestamps, core.lowThreshold, core.highThreshold, liftDefinition(lift).rest, after);
    // Each rep's halfway is where its angle passes half the movement, as the open rise's is (FINDING-014).
    const halves = riseHalfTimes(core.smoothedAngles, timestamps, core.lowThreshold, core.highThreshold, liftDefinition(lift).rest, core.reps);
    const reps = core.reps.map((r, i) => ({ ...r, halfTime: halves[i] }));
    const t = scoreTest(reps, timestamps.at(-1), FITNESS_TESTS[lift].windowSec, open, timestamps[0]);  // count = reps kept, the open rise among them
    return { ...core, count: t.score, reps: t.reps, refused, doubt, test: { windowSec: FITNESS_TESTS[lift].windowSec, t0: t.t0, complete: t.complete, beyond: t.beyond, open: t.open, counted: core.count } };
  }
  return { ...core, refused, doubt };
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
  constructor({ read, expected, decoder = '', disordered = false, fallback = null }) { super(`${read} samples read${disordered ? ' out of time order' : ''} where the video holds ${expected ?? 'an unknown number'}`); this.name = 'PartialReadError'; this.read = read; this.expected = expected; this.decoder = decoder; this.disordered = disordered; this.fallback = fallback; }
}

export async function analyzeCoreVideo(file, lift, { signal, onProgress = () => {}, onPhase = () => {}, onLandmarks = () => {}, path, inject } = {}) {
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
    // `path` and `inject` come from the check page only (check-main.js): the app passes neither.
    const metadata = await extractFramesStreaming(file, TARGET_FPS, MAX_FRAMES, MAX_LONG_SIDE, async (canvas, index, timestamp) => {
      signal?.throwIfAborted();
      // A decoding path that fails part-way leaves its samples behind, and the fallback starts again at sample 0
      // (frameExtractor.js): only the last pass is kept, so a short first pass can never make up for samples the
      // second one missed (audit FINDING-002: 30 then 409 of 439 added up to a "whole" read).
      if (index === 0 && timestamps.length) { imageLandmarks.length = 0; worldLandmarks.length = 0; timestamps.length = 0; }
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer;
      const result = await send({ pixels, width: canvas.width, height: canvas.height, timestamp: index * 1000 / TARGET_FPS }, [pixels]);
      imageLandmarks.push(result.image);
      worldLandmarks.push(result.world);
      timestamps.push(timestamp);
      onLandmarks(result.image, canvas.width, canvas.height);
    }, onProgress, { deterministic: true, signal, ...(path ? { path } : {}), ...(inject ? { inject } : {}) });
    signal?.throwIfAborted();
    // Samples in time order, each after the last: a read that repeats or goes back is not whole either.
    // The real number of samples is kept beside the flag, so the screen never says "NaN %" (third audit, C08).
    const ordered = timestamps.every((t, i) => i === 0 || t > timestamps[i - 1]);
    const missed = unreadSamples({ samples: timestamps.length, duration: metadata?.duration, fps: TARGET_FPS, maxFrames: MAX_FRAMES });
    if (missed || !ordered) throw new PartialReadError({ ...(missed ?? { read: timestamps.length, expected: timestamps.length }), disordered: !ordered, decoder: metadata?.method || '', fallback: metadata?.fallback ?? null });
    // Defence in depth behind the extractor's frozen-read check (frozenRead.js, isFrozenRead, the same rule and
    // threshold): skeletons that repeat are a picture that did not move, read as a still person and a confident 0 on
    // David's iPhone at the demo of 3 October. No count is given; the app shows a read error. The healthy read of that
    // video gave 0 repeats in 460 samples; David's real-phone sets 0 in each; the 894 public build sets at most 8 of
    // 150 (5 %); synthetic renders up to 27 % (frozenRead.js). Source: this incident and these reads. Status:
    // experimental; the threshold is UNSOURCED.
    // Checked here, on the app's own read, and not in summarizeCount: the counter's unit tests feed it noiseless
    // synthetic skeletons whose holds repeat exactly, as a filmed person never does.
    const still = repeatedSkeletons(worldLandmarks);
    if (isFrozenRead(still)) throw new FrozenSkeletonsError(still, metadata?.method || '', metadata?.fallback ?? null);
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
