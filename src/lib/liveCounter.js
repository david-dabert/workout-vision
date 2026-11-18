// The count while a set is filmed live (Film screen, "En direct"). Nothing here counts on its own: every count, the
// provisional ones on screen and the final one, is summarizeCount (coreAnalysis.js) on the samples so far, the same
// function and the same samples the recorded path counts. The core is built for 15 samples a second (TARGET_FPS);
// the live capture samples the camera at that rate (liveEngine.js), so no assumption of the core changes.
import { summarizeCount, repeatedSkeletons, FrozenSkeletonsError, withProposal, withBodyCheck, withSensitivity } from './coreAnalysis';
import { isFrozenRead } from './frozenRead';
import { liftDefinition } from './counting/core';
import { TARGET_FPS, MAX_LONG_SIDE } from './extractionConfig';

/**
 * How often the count on screen is worked out again, in ms. Status: convention (UNSOURCED): about twice a second
 * reads as immediate for a rep that lasts one to three seconds, and leaves the phone time for the pose model.
 */
export const LIVE_EVAL_MS = 500;

/**
 * The longest live set, in seconds: ten minutes of samples (9,000) keeps the landmarks under about 50 MB on the
 * phone. A set that reaches it is stopped and counted. Status: convention (UNSOURCED), a memory bound, not measured.
 */
export const LIVE_MAX_SEC = 600;
export const LIVE_MAX_SAMPLES = LIVE_MAX_SEC * TARGET_FPS;

/**
 * The last second of samples decides whether the person is in view: the counted joint must be seen in at least half
 * of them, the rule summarizeCount applies to the whole set (a strict majority hidden is a refusal).
 * Status: convention, from summarizeCount's refusal rule applied to the last second.
 */
export const IN_VIEW_SAMPLES = TARGET_FPS;

// The samples of the counted joint the core could read, over the last `n` samples, as summarizeCount judges a set:
// a two-sided lift by its less visible side, a lunge by either knee.
function recentSeen(core, lift, n) {
  const tail = a => a.slice(-n);
  const seen = a => a.filter(v => v !== null && v !== undefined).length;
  if (core.sides) {
    const l = tail(core.sides.left.angles), r = tail(core.sides.right.angles);
    if (liftDefinition(lift)?.together) return { seen: l.filter((v, i) => v !== null || r[i] !== null).length, of: l.length };
    return { seen: Math.min(seen(l), seen(r)), of: l.length };
  }
  const a = tail(core.angles || []);
  return { seen: seen(a), of: a.length };
}

/**
 * A live counter for one set of `lift`. Samples go in with push(); evaluate() gives what the screen may show;
 * finish() gives the result in the recorded path's shape (coreAnalysis.js, analyzeCoreVideo).
 * `summarize` is summarizeCount; a test may pass another.
 */
/**
 * The numbers the live screen displayed, kept for the result screen (Live.jsx onCount, Result.jsx liveDiffers). The
 * screen displays a count only when it is above 0 (Live.jsx showNumber); a 0 or a null from evaluate() was never on the
 * screen, so it is not kept (9 October 2026: the result could say "En direct, l'appli affichait 0", a number never
 * shown; replayed on the synthetic set soldier-lateral_raise-v90-a20). prev: the record so far, or null; count: what
 * evaluate() returned. Returns { last, max }: the last number displayed and the highest, or null before any.
 */
export function nextShown(prev, count) {
  if (!Number.isInteger(count) || count <= 0) return prev;
  return { last: count, max: Math.max(prev?.max ?? 0, count) };
}
/**
 * The number the result screen compares with the final count: the last number displayed when it differs from the final,
 * else the highest one displayed when it went above the final (a rep announced, by voice too, that the final reading
 * does not find: on David's videos the back extension showed 18 and its final count is 17), else the last. So the
 * result asks whenever a number on the live screen is not the final one, and names a number that was really shown.
 * null when no number was displayed. Status: convention, from R8 (no new threshold).
 */
export function shownForResult(rec, final) {
  if (!rec) return null;
  if (rec.last !== final) return rec.last;
  return rec.max > final ? rec.max : rec.last;
}

export function createLiveCounter(lift, { summarize = summarizeCount } = {}) {
  const imageLandmarks = [], worldLandmarks = [], timestamps = [];
  let announced = 0, size = null;

  return {
    get length() { return timestamps.length; },
    get full() { return timestamps.length >= LIVE_MAX_SAMPLES; },
    /** One sample: the image and world landmarks (or null when nobody was found), its time in seconds, the frame size. */
    push({ image = null, world = null, t, width, height }) {
      if (timestamps.length >= LIVE_MAX_SAMPLES) return false;
      if (timestamps.length && !(t > timestamps[timestamps.length - 1])) throw new Error('Live samples must be in time order');
      imageLandmarks.push(image);
      worldLandmarks.push(world);
      timestamps.push(t);
      if (!size && width && height) size = [width, height];
      return true;
    },
    /**
     * What the screen may show now. `count` is null when no number may be shown (R8): nobody in view in the last
     * second, or a set the core would refuse. `announce` is the number to announce when the count went past every
     * number announced before, else null: each rep is announced once, and a count that drops back and rises again
     * is not announced twice.
     */
    evaluate() {
      if (!timestamps.length) return { count: null, inView: false, refused: true, announce: null, samples: 0 };
      const core = summarize(worldLandmarks, timestamps, lift);
      const { seen, of } = recentSeen(core, lift, IN_VIEW_SAMPLES);
      const inView = of > 0 && seen * 2 >= of;
      const shown = inView && !core.refused;
      let announce = null;
      if (shown && core.count > announced) { announced = core.count; announce = core.count; }
      return { count: shown ? core.count : null, inView, refused: core.refused, announce, samples: timestamps.length };
    },
    /**
     * The whole set, counted exactly as the recorded path counts a video. Throws FrozenSkeletonsError when more than
     * half the samples repeat the skeleton before them, the recorded path's frozen-read rule (coreAnalysis.js,
     * analyzeCoreVideo; frozenRead.js, isFrozenRead), applied to the camera: the pose worker reads each sample in
     * IMAGE mode with unfiltered world landmarks, so a repeated skeleton is a repeated picture, and a filmed person
     * never gives one. A camera feed that stalls (a frozen preview, a camera another app took, a phone throttling
     * the camera) hands the same picture on and on, which would read as a person standing still and a confident 0.
     * A camera that only slows down repeats some pictures too: past half of them, the set was sampled at under half
     * the 15 Hz the core is built for, which the live path refuses anyway (liveEngine.js, MAX_BACKLOG).
     * Source: the frozen-read incident of 3 October (recorded path); not yet seen live. Status: experimental, the
     * threshold UNSOURCED (frozenRead.js). Not in evaluate(): a frozen feed gives no new rep to show, so the
     * provisional count only stops rising.
     */
    finish() {
      const still = repeatedSkeletons(worldLandmarks);
      if (isFrozenRead(still)) throw new FrozenSkeletonsError(still, 'live');
      const [w, h] = size ?? [null, null];
      const duration = timestamps.length ? timestamps[timestamps.length - 1] - timestamps[0] + 1 / TARGET_FPS : 0;
      const metadata = { width: w, height: h, fps: TARGET_FPS, duration, frameCount: timestamps.length, method: 'live', live: true, maxLongSide: MAX_LONG_SIDE };
      // A refused set carries PSC's proposal and a counted one its body check, as the recorded path's do
      // (coreAnalysis.js, withProposal, withBodyCheck).
      return withSensitivity(withBodyCheck(withProposal({ ...summarize(worldLandmarks, timestamps, lift), exercise: lift, metadata, imageLandmarks: imageLandmarks.slice(), worldLandmarks: worldLandmarks.slice(), timestamps: timestamps.slice() }, lift), lift), lift);
    },
  };
}
