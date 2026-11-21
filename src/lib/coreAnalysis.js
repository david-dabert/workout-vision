import { countReps, liftDefinition } from './counting/core';
import { poseDoubt } from './counting/doubt';
import { readIsWhole } from './collector';
import { FITNESS_TESTS, isTest, openRise, riseHalfTimes, scoreTest } from './fitness-tests';
import { extractFramesStreaming } from './frameExtractor';
import { isFrozenRead } from './frozenRead';
import { pscProposal, signalBank } from './counting/psc';
import { bodyCheck, flatImage, signalProfile } from './counting/bodyCheck';
import { specGuidedCount } from './counting/sgc';
import { TARGET_FPS, MAX_LONG_SIDE, MAX_FRAMES } from './extractionConfig';

import { OFFERED, isOffered } from './offer';
import { chooseLifter } from './lifterTrack';

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

/** Whether a rise from rest past the working threshold is still open when the video stops (summarizeCount tailOpen). */
function openAtEnd(c, timestamps, rest) {
  if (!c?.smoothedAngles?.length) return false;
  const o = openRise(c.smoothedAngles, timestamps, c.lowThreshold, c.highThreshold, rest, c.reps?.length ? c.reps.at(-1).endTime : -Infinity);
  if (!o) return false;
  let last = null;
  for (let i = c.smoothedAngles.length - 1; i >= 0 && last === null; i--) last = c.smoothedAngles[i];
  const mid = (c.lowThreshold + c.highThreshold) / 2;
  return rest === 'low' ? last >= mid : last <= mid;
}

// tuning: a recount with nearby settings (core.ts CountTuning), only from withSensitivity below; the app's count has none.
export function summarizeCount(worldLandmarks, timestamps, lift, tuning = undefined, _imageLandmarks = undefined) {
  const effectiveWorld = worldLandmarks;
  const core = countReps(effectiveWorld, timestamps, lift, tuning);
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
    return { ...core, count: t.score, reps: t.reps, refused, doubt, worldLandmarks: effectiveWorld, test: { windowSec: FITNESS_TESTS[lift].windowSec, t0: t.t0, complete: t.complete, beyond: t.beyond, open: t.open, counted: core.count } };
  }
  // A rise left open at the end (fitness-tests.js openRise: from rest, past halfway, to the working threshold, with no
  // lost pose) after the last counted rep, and still past halfway on the last seen sample: the count left it out, and
  // one joint angle cannot tell a rep cut by the end of the video from a movement after the set (TRIED.md, 1 and 15
  // October, 15 November 2026). Each side of a both-sides lift is read on its own reps and thresholds (the side cut
  // mid-rep has one rep fewer, so it is never the primary; reviewer, 15 November 2026). The count stays; the set is
  // marked, and the result screen asks on David's #collecte phone only until he chooses (card 039). Status:
  // experimental: on the public build sets shown as sure a marked set is mostly short, on David's sets it caught no
  // error (TRIED.md, 15 November 2026).
  const tailOpen = !refused && (core.sides ? [core.sides.left, core.sides.right] : [core]).some(c => openAtEnd(c, timestamps, liftDefinition(lift).rest));
  return { ...core, refused, doubt, ...(tailOpen ? { tailOpen: true } : {}), worldLandmarks: effectiveWorld };
}

/**
 * The longest set PSC is run on for a proposal: 3 minutes of samples at 15 Hz. PSC's cost grows with the set's length
 * (about 70-130 ms for a 25-40 s set and 580 ms for 2.5 minutes in Node on the bench machine, 8 October); a longer set
 * gets no proposal rather than a frozen screen. Source: UNSOURCED. Status: convention (a time bound, not a measure of
 * accuracy).
 */
export const PROPOSAL_MAX_SAMPLES = 3 * 60 * TARGET_FPS;

/**
 * A set the core refused, with PSC's count as a proposal (src/lib/counting/psc.js, pscProposal): `proposal` is
 * { count, reps, period, confirm, ms } or null. The result screen offers it as a number to confirm, never a silent
 * count, never a grade, never a measure (R8; delegated decision of David, 8 October 2026). Measured on the official
 * variant evaluation before it was wired (TRIED.md, 8 October): no exact count lost, none newly off by 3, the public
 * halves 255 -> 264 and 235 -> 247 exact. A counted set, a fitness test (scored over its window) and a set longer than
 * PROPOSAL_MAX_SAMPLES are returned as they came. Status: validated (on the bench; David's iPhone check pending).
 * An alternating lift (bothSides: one rep per side) gets no proposal: PSC proposed 7 of the 14 occlusion alternating
 * curls at half their count (5 for 10), one cycle per left-right pair (TRIED.md, 8 October; delegated decision, 8 October).
 */
/**
 * ?poses=1 in the page's address (David, 19 November 2026): the phone records every person it sees on every sample,
 * up to 4, and offers the file to save when the read ends, so a skeleton that jumps to a bystander can be studied on
 * the phone's own read (the desktop read of the same video does not jump). The count reads the first pose, as always.
 * Diagnosis only: never on without the address flag.
 */
/**
 * ?lifter=1 in the page's address (card B, 19 November 2026): every person is read on every sample (as ?poses=1) and
 * the count reads the lifter chosen over the whole set by motion (lifterTrack.js) instead of the first pose. Off
 * without the flag: asking 4 poses moves the first pose itself on 336 of 4,555 synthetic samples, and David's labelled
 * videos are stored as 1-pose reads, so R2 cannot yet be measured for the app's default (TRIED.md, 19 November 2026).
 * On David's seated row (IMG_4186, label 10) the phone's file counts 9 on the first pose and 10 on the lifter
 * (test/real-phone/phone-poses/). Status: experimental.
 * The default changes here, in one line (true unless ?lifter=0), once phone-poses.test.ts's "default decision" holds on
 * a batch of David's labelled videos read with ?lifter=1&poses=1 (listed in test/real-phone/phone-poses/README.md).
 */
export function lifterAsked() {
  try { return typeof location !== 'undefined' && new URLSearchParams(location.search).get('lifter') === '1'; } catch { return false; }
}
export function allPosesAsked() {
  try { return typeof location !== 'undefined' && new URLSearchParams(location.search).get('poses') === '1'; } catch { return false; }
}
const r4 = v => Math.round(v * 1e4) / 1e4;
// The file also carries the lift chosen and the count this read gives (summarizeCount on the samples the app counts,
// before any read error is raised), so a stored file needs nothing from memory (test/real-phone/phone-poses/).
function saveAllPoses(file, frames, lift, counted) {
  try {
    const one = p => ({
      image: p.image?.map(q => [r4(q.x), r4(q.y), r4(q.visibility ?? 0)]) ?? null,
      world: p.world?.map(q => [r4(q.x), r4(q.y), r4(q.z)]) ?? null });
    const slim = frames.map(f => ({ t: f.t, poses: f.poses.map(one), ...(f.crop ? { crop: one(f.crop) } : {}) }));
    const blob = new Blob([JSON.stringify({ name: file?.name ?? null, userAgent: navigator.userAgent, lift: lift ?? null, count: counted ?? null, frames: slim })], { type: 'application/json' });
    // A visible button, tapped by David: Safari on iPhone downloads only on a tap (#499's automatic download did not).
    const name = `poses-${(file?.name ?? 'set').replace(/\.[^.]+$/, '')}.json`;
    document.getElementById('wv-save-poses')?.remove();
    const b = document.createElement('button');
    b.id = 'wv-save-poses';
    b.textContent = 'Enregistrer les poses';
    b.style.cssText = 'position:fixed;left:16px;right:16px;bottom:24px;z-index:99999;padding:16px;border-radius:12px;border:0;background:#e8c48a;color:#111;font:600 17px system-ui';
    b.onclick = async () => {
      const f = new File([blob], name, { type: 'application/json' });
      try { if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f] }); b.remove(); return; } } catch { /* fall back to a link */ }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      b.remove();
    };
    document.body.appendChild(b);
  } catch (e) { console.warn('[allPoses] not saved', e); }
}

export function withProposal(result, lift) {
  const needsProposal = !!result?.refused || result?.count === 0;
  if (!needsProposal || isTest(lift) || liftDefinition(lift)?.bothSides || !(result.timestamps?.length <= PROPOSAL_MAX_SAMPLES)) return result;
  const t0 = performance.now();
  const p = pscProposal(result);
  return { ...result, proposal: p ? { ...p, ms: Math.round(performance.now() - t0) } : null };
}

/**
 * The longest set the body check runs on: PSC's proposal's bound (PROPOSAL_MAX_SAMPLES, 3 minutes at 15 Hz), the same
 * per-set budget: both run on the page after the count, and a longer set is left unchecked, as every set was before the
 * check, rather than a frozen screen. The check and its second candidate cost less than the proposal at any length
 * (Node on the bench machine, 8 October: at 3 minutes 0.28-0.35 s against PSC's 0.39-0.50 s; at 10 minutes 0.9-1.2 s
 * against 2.1-2.4 s), so under this bound they stay within the cost the proposal was shipped with
 * (test/real-phone/accuracy/body-check.txt). A recorded video has no length bound (MAX_FRAMES), a live set stops at 10
 * minutes (liveCounter.js, LIVE_MAX_SEC); no set of the calibration is longer than a minute. Source: UNSOURCED.
 * Status: convention (a time bound, not a measure of accuracy).
 */
export const BODY_CHECK_MAX_SAMPLES = PROPOSAL_MAX_SAMPLES;

/**
 * A counted set with its body check (counting/bodyCheck.js, 8 October 2026): `bodyCheck` is
 * { agreement, flagged, signals, second, ms }, or null where the check cannot run (no motion spec for the exercise, an
 * alternating lift, too little seen, or a failure). A refused set, a set counted none in (its screen asks for the
 * count anyway, Result.jsx unsure), a fitness test and a set over BODY_CHECK_MAX_SAMPLES are returned as they came,
 * with no `bodyCheck` field. When the counted joint's angle disagrees with the rest of the body (flagged), the result
 * screen shows the count as one to confirm, with no grade (R8), and
 * `second` holds the spec-guided count (counting/sgc.js, specGuidedCount: the motion spec's signals with the core's own
 * rep logic) as { count, reps } when it finds a rep, offered beside the core's count when it differs. The count, the
 * reps, a refusal and the PSC proposal are never changed: the check only adds this field. Status: experimental (the
 * flag's threshold is the critic's, fixed before its run; calibrated on the official sets: body-check.txt).
 */
export function withBodyCheck(result, lift) {
  if (!result || result.refused || !(result.count > 0) || isTest(lift) || !(result.timestamps?.length <= BODY_CHECK_MAX_SAMPLES)) return result;
  const t0 = performance.now();
  let check = null;
  try {
    const profile = signalProfile(lift);
    if (profile) {
      const image = flatImage(result);
      const bank = signalBank(result.worldLandmarks, result.timestamps, image, { useImage: true });
      check = bodyCheck(result, lift, bank);
      if (check) {
        let second = null;
        if (check.flagged) {
          const g = specGuidedCount({ wl: result.worldLandmarks, ts: result.timestamps, image }, profile, summarizeCount, bank);
          if (g && g.count > 0) second = { count: g.count, reps: g.reps.map(r => ({ startTime: r.startTime, endTime: r.endTime })) };
        }
        check = { ...check, second };
      }
    }
  } catch (e) {
    // The check never stands between the person and their count: a failure leaves the result as it was, unchecked.
    console.warn('[body-check] not run', e);
    check = null;
  }
  return { ...result, bodyCheck: check ? { ...check, ms: Math.round(performance.now() - t0) } : null };
}

/**
 * The settings of the sensitivity check's recounts: the threshold margin x0.9, x1 and x1.1, each with the outlier filter
 * over 7 and over 9 samples (the two windows the app's own 0.5 s gives at 15 Hz, depending on how the sample rate rounds;
 * core.ts OUTLIER_WINDOW_SEC). Source: the stability study of 10 October 2026 (TRIED.md, "Counts that swing under
 * re-encoding"): the grid was fixed before the public run, after screening on David's 14 videos. Status: experimental.
 */
export const SENSITIVITY_GRID = Object.freeze([0.9, 1, 1.1].flatMap(marginScale => [7, 9].map(outlierWindow => Object.freeze({ marginScale, outlierWindow }))));

/**
 * Whether the sensitivity check's recounts ask the person to confirm the count (Result.jsx; sure.ts models it).
 * Asks when a recount is refused or differs from the count by 2 or more (David's ruling of 9 November 2026: one recount
 * off by one is accepted), or when 2 or more of the recounts differ from it (11 November 2026).
 * Source: measured on 11 November 2026 on the 744 public build sets that pass the body check (issue #190): asking on
 * any moved recount showed 670 as sure, 408 exact (60.9 %), 6 off by 3 or more; the ruling of 9 November alone 731,
 * 428 (58.5 %), 10; this rule 678, 409 (60.3 %), 6. The 61 sets the ruling alone added were exact 20 times.
 * Status: experimental. counts: the recounts, null for a refusal.
 */
export function sensitivityAsks(count, counts) {
  if (!Array.isArray(counts)) return true;
  return counts.some(c => c === null || Math.abs(c - count) >= 2) || counts.filter(c => c !== count).length >= 2;
}

/**
 * A counted set with its sensitivity check (stability study, 10 October 2026): the set is recounted with each setting of
 * SENSITIVITY_GRID; `sensitivity` is { moved, counts, ms }, `moved` true when any recount differs from the count (another
 * number, or a refusal). Such a count sits on a knife edge of the counter's own settings: on David's 14 videos read from
 * six encodings, the counts the check marks are the ones that swing between encodings, and on the 853 public counted
 * sets that decide it marks 103 (72 wrong, 31 exact), 19 of the 39 off by 3 or more (body check alone: 7). The result
 * screen may then show the count as one to confirm, with no grade (R8). The count, the reps, a refusal, the proposal and
 * the body check are never changed: the check only adds this field. A refused set, a set counted none in, a fitness test
 * and a set over BODY_CHECK_MAX_SAMPLES are returned as they came. Status: experimental.
 */
export function withSensitivity(result, lift) {
  if (!result || result.refused || !(result.count > 0) || isTest(lift) || !(result.timestamps?.length <= BODY_CHECK_MAX_SAMPLES)) return result;
  const t0 = performance.now();
  let sensitivity = null;
  try {
    const counts = SENSITIVITY_GRID.map(tuning => {
      const r = summarizeCount(result.worldLandmarks, result.timestamps, lift, tuning, result.imageLandmarks);
      return r.refused ? null : r.count;
    });
    sensitivity = { moved: counts.some(c => c !== result.count), counts };
  } catch (e) {
    // As the body check: a failure leaves the result as it was, unchecked.
    console.warn('[sensitivity] not run', e);
    sensitivity = null;
  }
  return { ...result, sensitivity: sensitivity ? { ...sensitivity, ms: Math.round(performance.now() - t0) } : null };
}

// The settings searched for a corrected count (recountTo): the threshold margin from half to one and a half times the
// app's, each with the outlier windows of the sensitivity check. Tried nearest the app's own settings first.
// Status: experimental (UNSOURCED; the span covers the sensitivity grid and twice its reach).
export const RECOUNT_GRID = Object.freeze(
  [1, 0.9, 1.1, 0.8, 1.2, 0.7, 1.3, 0.6, 1.4, 0.5, 1.5]
    .flatMap(marginScale => [undefined, 7, 9].map(outlierWindow => Object.freeze({ marginScale, ...(outlierWindow ? { outlierWindow } : {}) }))),
);

/**
 * The set read again for the count the person gave (David, 18 October 2026: "even when people manually correct
 * things, they still have an analysis that adapts"): the first setting of RECOUNT_GRID, nearest the app's own, under
 * which the counter finds exactly n reps, with those reps and their measures; null when none does, when the set was
 * refused or counted none, or when n is more than 3 away from the app's count (no setting is searched that far). The
 * app's count is never changed: the saved set keeps it as the machine's (saved-set.js). { tuning, reps, smoothedAngles,
 * arm, confidence }.
 */
export function recountTo(result, lift, n) {
  if (!result || result.refused || !(result.count > 0) || !Number.isInteger(n) || n < 1 || n === result.count
    || Math.abs(n - result.count) > 3 || isTest(lift) || !Array.isArray(result.worldLandmarks) || !Array.isArray(result.timestamps)) return null;
  for (const tuning of RECOUNT_GRID) {
    let r;
    try { r = summarizeCount(result.worldLandmarks, result.timestamps, lift, tuning, result.imageLandmarks); } catch { continue; }
    if (!r.refused && r.count === n) return { tuning, reps: r.reps, smoothedAngles: r.smoothedAngles, arm: r.arm, confidence: r.confidence };
  }
  return null;
}

/**
 * A read that is not whole: { read, expected } unless exactly floor(duration x fps) samples came
 * back, else null. On 29 September David's iPhone read 181 of the 439 samples of his lateral raise
 * clip and the app counted 2 of 10. The collector's rule (collector.js, setIsWhole) holds for the app:
 * fewer samples, more samples (a failed first decoding pass leaves its samples behind), a length the
 * video does not report, or more samples than the cap, and no count is shown (R8; review 01).
 * Status: convention, from the extractor's own sampling rule; a shortfall of 2 samples or 1 % is whole (collector.js,
 * READ_SHORT_TOLERANCE, 6 October).
 */
const MIN_SOURCE_FPS = 8;

export function unreadSamples({ samples, duration, fps, maxFrames, sourceFrames = null, sampledSourceFrames = null, decodedWhole = false }) {
  const targetExpected = Math.floor(duration * fps);
  // Natively < 15 fps clips (e.g. 9.79 fps MP4 or 8.44 fps MOV) decode 100% of their stream cleanly via WebCodecs;
  // accept sampledSourceFrames (or sourceFrames when VFR didn't skip bursts) only when EOF decoded whole and rate >= MIN_SOURCE_FPS (8 fps).
  const expected = decodedWhole && Number.isFinite(sourceFrames) && sourceFrames > 0
    && Number.isFinite(targetExpected) && sourceFrames < targetExpected
    && Number.isFinite(duration) && duration > 0 && sourceFrames / duration >= MIN_SOURCE_FPS
    ? (Number.isFinite(sampledSourceFrames) && sampledSourceFrames > 0 ? sampledSourceFrames : sourceFrames)
    : targetExpected;
  const whole = Number.isFinite(expected) && expected > 0 && expected <= maxFrames && readIsWhole(samples, expected);
  return whole ? null : { read: samples, expected: Number.isFinite(expected) && expected > 0 ? expected : null };
}

export class PartialReadError extends Error {
  constructor({ read, expected, decoder = '', disordered = false, fallback = null }) { super(`${read} samples read${disordered ? ' out of time order' : ''} where the video holds ${expected ?? 'an unknown number'}`); this.name = 'PartialReadError'; this.read = read; this.expected = expected; this.decoder = decoder; this.disordered = disordered; this.fallback = fallback; }
}

// One pose worker, and so one pose model and its WASM heap, at a time (crash investigation, 7 October, cause 3): an
// analysis started right after another (a cancel then another video, Restart) waits until the previous worker has
// closed its model, or for at most WORKER_CLOSE_MS, and has been terminated. A worker kept and reused across analyses
// would be simpler but would carry the pose model's state from one video to the next (poseAnalysis.js: the image
// smoothing, the crop seed and the backward pass are module state in the worker) and keep the model's memory while the
// result and the replay are on screen; a fresh worker per analysis keeps every analysis's landmarks as they were.
// WORKER_CLOSE_MS: convention, UNSOURCED (the model closes in a few milliseconds when the worker is idle).
const WORKER_CLOSE_MS = 1000;
// Samples sent to the pose worker and not yet placed, at most (analyzeCoreVideo, pipelining): 2 lets the next sample be
// decoded and read while the worker reads the one before; more would hold more pictures without reading faster, since
// the worker reads one at a time. Measured 7 October (TRIED.md). Source: UNSOURCED. Status: experimental.
const IN_FLIGHT = 2;
let previousWorkerGone = Promise.resolve();

export async function analyzeCoreVideo(file, lift, { signal, onProgress = () => {}, onPhase = () => {}, onLandmarks = () => {}, onDecoder, onSource, path, inject, poseMode, benchModel, delegate, model } = {}) {
  if (!isOffered(lift)) throw new Error('Choose an approved lift');
  // Analyses queue one behind the other: each waits for the worker of the one started before it.
  const before = previousWorkerGone;
  let workerGone;
  previousWorkerGone = new Promise(resolve => { workerGone = resolve; });
  try {
    await before;
    signal?.throwIfAborted();
  } catch (err) {
    workerGone();
    throw err;
  }
  let worker;
  try { worker = new Worker(new URL('./corePoseWorker.js', import.meta.url)); } catch (err) { workerGone(); throw err; }
  let ended = false;
  // Terminates the worker, at once on a cancel or a failure of the worker, else once it has closed its model.
  const endWorker = (graceful) => {
    if (ended) return;
    ended = true;
    if (!graceful) { worker.terminate(); workerGone(); return; }
    let timer, finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      worker.terminate();
      failAll(new Error('Pose worker closed'));
      workerGone();
    };
    timer = setTimeout(done, WORKER_CLOSE_MS);
    send({ type: 'close' }).then(done, done);
  };
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
  let workerFailed = false;
  worker.onerror = (event) => { workerFailed = true; failAll(new Error(event.message || 'Pose worker failed')); };
  const abort = () => { endWorker(false); failAll(new DOMException('Cancelled', 'AbortError')); };
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
    // MediaPipe in IMAGE mode: the person detector on every sample. VIDEO mode (it follows the body from the sample
    // before, 84 -> 60 ms a sample) shipped on the morning of 9 October 2026 and was withdrawn the same evening: on the
    // VP9 copies the real-video gate reads (test/real-phone/sets-07oct-video/, identical reads in IMAGE mode), VIDEO
    // mode counts 2 of 14 exact against 6 (R2: the exact count may not fall), and its proposals on the two refused sets
    // that have one move off the label (8 -> 6, 5 -> 4). Its reads stay measured (sets-09oct-video-mode/, TRIED.md).
    // poseMode 'video' (the check page's ?posemode=video) reads in VIDEO mode, to measure.
    // benchModel: another pose model's bytes, from the check page only (?posemodel=), to measure it.
    // delegate 'GPU' (the check page's ?delegate=gpu; pillar 4, 9 October 2026): MediaPipe's GPU delegate, to measure
    // its speed and landmarks on a phone; the app reads on the CPU.
    // model 'heavy': MediaPipe's larger pose model, for a physiotherapy attempt the patient asked to analyse again
    // (lib/reference/readPose.js); every count reads with the app's model.
    const lifterOn = lifterAsked();
    const allPoses = allPosesAsked() || lifterOn;
    const allFrames = [];
    const init = await send({ type: 'init', videoMode: poseMode === 'video', ...(allPoses ? { allPoses: true } : {}), ...(benchModel ? { benchModel } : {}), ...(delegate === 'GPU' ? { delegate: 'GPU' } : {}), ...(model === 'heavy' ? { model: 'heavy' } : {}) });
    // The model's time per sample, as the worker measured it: kept in metadata.pose for the check page, read by no count.
    const poseMs = [];
    onPhase('extracting');
    const imageLandmarks = [], worldLandmarks = [], timestamps = [];
    // The sample each worker timestamp was sent for, so the backward pass's results land on their own samples.
    const sampleAt = new Map();
    // A sample's answer from the worker, put in place in the order the samples were sent (the worker answers in that
    // order, and each step below waits for the one before it).
    const place = (result, sent, timestamp, width, height) => {
      // Backward pass (poseCrop.js): earlier samples without a pose that the worker has now read; a sample that has a
      // pose is never replaced.
      for (const b of result.back || []) {
        const i = sampleAt.get(b.timestamp);
        if (i != null && !worldLandmarks[i] && !imageLandmarks[i]) { imageLandmarks[i] = b.image; worldLandmarks[i] = b.world; }
      }
      sampleAt.set(sent, timestamps.length);
      if (Number.isFinite(result.ms)) poseMs.push(result.ms);
      imageLandmarks.push(result.image);
      worldLandmarks.push(result.world);
      timestamps.push(timestamp);
      // A sample with no pose on the whole frame may still be counted from the crop retry's pose: kept as `crop`, so
      // the file holds the very pose the count read.
      if (allPoses) allFrames.push({ t: timestamp, poses: result.all ?? [], crop: !(result.all?.length) && result.image ? { image: result.image, world: result.world } : null });
      onLandmarks(result.image, width, height);
    };
    // Pipelining (speed investigation, 7 October): the next sample is decoded, drawn and read on this thread while the
    // worker runs the pose model on the one before, instead of each waiting for the other. At most IN_FLIGHT samples
    // are sent and not yet placed; the worker reads them one after the other in the order sent, so every landmark is
    // the one the unpipelined read gave (SHA-256 of timestamps and landmarks, TRIED.md 7 October).
    let placed = Promise.resolve();
    const inFlight = [];
    const drain = async () => { while (inFlight.length) await inFlight.shift(); };
    // `path` and `inject` come from the check page only (check-main.js): the app passes neither.
    const metadata = await extractFramesStreaming(file, TARGET_FPS, MAX_FRAMES, MAX_LONG_SIDE, async (canvas, index, timestamp, read) => {
      signal?.throwIfAborted();
      // A decoding path that fails part-way leaves its samples behind, and the fallback starts again at sample 0
      // (frameExtractor.js): only the last pass is kept, so a short first pass can never make up for samples the
      // second one missed (audit FINDING-002: 30 then 409 of 439 added up to a "whole" read).
      if (index === 0) {
        await drain();
        if (timestamps.length) { imageLandmarks.length = 0; worldLandmarks.length = 0; timestamps.length = 0; allFrames.length = 0; sampleAt.clear(); }
      }
      // The pixels the extractor already read for its frozen-read check (one readback per sample, not two).
      const pixels = (read ?? canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)).data.buffer;
      const sent = index * 1000 / TARGET_FPS;
      const { width, height } = canvas;
      const answer = send({ pixels, width, height, timestamp: sent }, [pixels]);
      placed = placed.then(() => answer).then(result => place(result, sent, timestamp, width, height));
      // Handled here so a sample left unplaced by an earlier failure or a cancel is not reported as unhandled; the
      // failure itself reaches the caller through drain().
      placed.catch(() => {});
      inFlight.push(placed);
      if (inFlight.length >= IN_FLIGHT) await inFlight.shift();
    }, onProgress, { deterministic: true, signal, ...(path ? { path } : {}), ...(inject ? { inject } : {}),
      // The decoder path and the source, as soon as known, for the crash log (CoreUpload.jsx): nothing read changes.
      ...(onDecoder ? { onPath: onDecoder } : {}), ...(onSource ? { onSource } : {}) });
    await drain();
    signal?.throwIfAborted();
    // The file is offered only when asked (?poses=1), not for ?lifter=1 alone.
    if (allPosesAsked()) {
      let counted = null;
      try { const c = summarizeCount(worldLandmarks, timestamps, lift, undefined, imageLandmarks); counted = c.refused ? 'refused' : c.count; } catch { /* the file is saved without it */ }
      saveAllPoses(file, allFrames, lift, counted);
    }
    // Samples in time order, each after the last: a read that repeats or goes back is not whole either.
    // The real number of samples is kept beside the flag, so the screen never says "NaN %" (third audit, C08).
    const ordered = timestamps.every((t, i) => i === 0 || t > timestamps[i - 1]);
    const missed = unreadSamples({
      samples: timestamps.length,
      duration: metadata?.duration,
      fps: TARGET_FPS,
      maxFrames: MAX_FRAMES,
      sourceFrames: metadata?.sourceFrames ?? null,
      sampledSourceFrames: metadata?.sampledSourceFrames ?? null,
      decodedWhole: Boolean(metadata?.decodedWhole),
    });
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
    // A refused set may carry PSC's proposal; a counted one carries its body check (neither changes the count).
    const sorted = [...poseMs].sort((a, b) => a - b), at = q => (sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] * 10) / 10 : null);
    const pose = { delegate: init?.delegate ?? null, renderer: init?.renderer ?? null, msMedian: at(0.5), msP90: at(0.9), samples: sorted.length };

    // ?lifter=1: the lifter's pose on each sample replaces the first pose, for the count and the replay alike.
    if (lifterOn && allFrames.length === worldLandmarks.length) {
      const frames = allFrames.map(f => ({ t: f.t, poses: f.poses.length ? f.poses : f.crop ? [f.crop] : [] }));
      const sel = chooseLifter(frames, lift);
      if (!sel.single && sel.chosen >= 0 && sel.world) sel.world.forEach((w, i) => { worldLandmarks[i] = w; imageLandmarks[i] = sel.image[i]; });
    }
    const countSummary = summarizeCount(worldLandmarks, timestamps, lift, undefined, imageLandmarks);
    // The engines wired here on 11-13 October 2026 are no longer run on a set (honesty audit of 14 October 2026): the
    // bilateral symmetry score and trunk shift (asymmetryCoaching.js), consistency, SPARC and the form checks
    // (smoothness.js), joint loads from a fixed 75 kg body (jointTorqueEngine.js), the "execution certificate"
    // (complianceEngine.js) and VBT with its RIR and sticking point (vbtEngine.js). None was measured against known
    // truth; the audit found each wrong by construction or unsourced (R8, R9). Their modules stay for research and are
    // read by no screen. The core's partial reps (core.ts, detectPartialReps) stay in the result for research and reach
    // no screen either: on the 96 synthetic sets, built with none, they report 180 (research, 14 October 2026).
    const mergedSummary = {
      ...countSummary,
      exercise: lift,
      metadata: { ...metadata, pose },
      imageLandmarks,
      worldLandmarks,
      timestamps,
    };
    const result = withSensitivity(withBodyCheck(withProposal(mergedSummary, lift), lift), lift);
    // Local diagnostic event: tests observe actual app output, never inject landmarks.
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('wv:core-result', { detail: result }));
    return result;
  } finally {
    signal?.removeEventListener('abort', abort);
    failAll(new Error('Analysis finished'));
    endWorker(!workerFailed && !signal?.aborted);
  }
}
