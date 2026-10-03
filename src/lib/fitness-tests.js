// Standardised fitness tests that are counts in a fixed time (David, 2 October 2026: tests a kinésithérapeute
// already uses, so the app's count has a protocol and a meaning). Two items of the Senior Fitness Test
// (Rikli & Jones): the 30-second chair stand and the 30-second arm curl. Each is counted by its movement's
// definition (core.ts LIFTS) and scored over a window that opens at the first rise.
//
// Protocol rules, as published for the 30-second chair stand (Jones, Rikli & Beam 1999, Res Q Exerc Sport
// 70(2):113-119) and applied alike to the arm curl in the same battery: the score is the number of full
// repetitions in 30 seconds; a repetition more than halfway up when time ends counts. Status: literature
// (protocol), not measured by us; the timing starts at the first rise because a video has no "go" signal
// (convention). No norm by age or sex is shown: the published tables could not be checked from here, and a
// norm from memory is not shown (R9).
import { COUNTABLE_RANGE_DEG } from './counting/core';

export const FITNESS_TESTS = {
  chair_stand_test: {
    windowSec: 30, illustration: 'bodyweight_squat', view: 'side',
    fr: 'Lever de chaise, 30 secondes', en: '30-second chair stand',
    steps: {
      fr: ['Posez le téléphone à la verticale, sur le côté, pour qu’il vous voie de profil.', 'Asseyez-vous au milieu d’une chaise sans accoudoirs, bras croisés sur la poitrine, le corps entier dans le cadre.', 'Levez-vous complètement et rasseyez-vous, le plus de fois possible en 30\u00A0secondes\u00A0; filmez quelques secondes de plus.'],
      en: ['Stand the phone upright at your side, so it sees you in profile.', 'Sit in the middle of a chair without armrests, arms crossed on your chest, your whole body in the frame.', 'Stand up fully and sit back down, as many times as you can in 30 seconds; keep filming a few seconds more.'],
    },
  },
  arm_curl_test: {
    // The protocol's weights, 5 lb for women and 8 lb for men (Rikli & Jones 1999), are given in kilograms.
    // Status: literature, to be checked against the published manual before release.
    windowSec: 30, illustration: 'bicep_curl', view: 'side',
    fr: 'Flexions de bras, 30 secondes', en: '30-second arm curl',
    steps: {
      fr: ['Posez le téléphone sur le côté, le bras qui travaille face à l’objectif.', 'Asseyez-vous dos droit, un haltère dans la main\u00A0: 2,3\u00A0kg pour une femme, 3,6\u00A0kg pour un homme.', 'Pliez puis tendez le bras en entier, le plus de fois possible en 30\u00A0secondes\u00A0; filmez quelques secondes de plus.'],
      en: ['Stand the phone at your side, working arm facing the lens.', 'Sit up straight with a dumbbell in hand: 2.3\u00A0kg for a woman, 3.6\u00A0kg for a man.', 'Curl all the way up and down, as many times as you can in 30 seconds; keep filming a few seconds more.'],
    },
  },
};

export const isTest = key => Object.hasOwn(FITNESS_TESTS, key);

/**
 * The rise left open at the end of the video: a test's last stand or curl often ends at the top, so the core,
 * which counts a cycle only once it returns to rest, leaves it out. After `afterSec`, a rise that starts at rest
 * (beyond the rest threshold), passes halfway between the thresholds and reaches the working threshold, with no
 * lost pose on the way, is returned as a rep cut by the end of the video (`clipped`, as core.ts marks one), with
 * `halfTime` added; else null. Nothing is returned when the set's range is under the core's countable range: a
 * still or barely moving video scores 0 (R8; review of 2 October). Halfway is the protocol's own rule (Jones,
 * Rikli & Beam 1999; literature). Used only for tests, inside their window: the general rule for a cut last rep
 * stays withdrawn (TRIED.md), since after a set the same rise can be anything.
 */
export function openRise(smoothed, timestamps, low, high, rest, afterSec, minRange = COUNTABLE_RANGE_DEG) {
  const valid = smoothed.filter(a => a !== null);
  const lo = Math.min(...valid), hi = Math.max(...valid);
  if (!valid.length || hi - lo < minRange) return null;
  // A video held mostly at one end (one stand, then standing to the end) leaves the core's percentile
  // thresholds together; the rise is then read between the video's own extremes, a tenth in from each.
  if (high - low < minRange / 2) { low = lo + (hi - lo) / 10; high = hi - (hi - lo) / 10; }
  const up = rest === 'low', mid = (low + high) / 2;
  const atRest = a => (up ? a <= low : a >= high), pastHalf = a => (up ? a >= mid : a <= mid), working = a => (up ? a >= high : a <= low);
  let start = null, half = null;
  for (let i = 0; i < smoothed.length; i++) {
    const a = smoothed[i];
    if (timestamps[i] <= afterSec) continue;
    if (a === null) { start = half = null; continue; }  // a lost pose breaks the rise (review 04)
    if (atRest(a)) { start = i; half = null; continue; }
    if (start === null) continue;
    if (half === null && pastHalf(a)) half = i;
    else if (half !== null && !pastHalf(a)) half = null;  // fell back before the top: not this rise
    if (half !== null && working(a)) {
      const seg = smoothed.slice(start, i + 1), dt = timestamps[i] - timestamps[start];
      let peak = 0;
      for (let k = 1; k < seg.length; k++) peak = Math.max(peak, Math.abs(seg[k] - seg[k - 1]) / (timestamps[start + k] - timestamps[start + k - 1]));
      const rom = Math.abs(seg.at(-1) - seg[0]);
      return { startTime: timestamps[start], endTime: timestamps.at(-1), romDegrees: rom, concentricSec: dt, eccentricSec: 0, peakSpeed: peak, meanSpeed: dt > 0 ? rom / dt : 0, clipped: true, halfTime: timestamps[half] };
    }
  }
  return null;
}

/**
 * When each counted rep passes half its movement: the first moment its angle crosses the middle of the set's
 * thresholds, the same middle as the open rise's (openRise), interpolated between samples. Half the rise's time
 * is used only when the angle never crosses (audit FINDING-014: completed reps were judged on half their time,
 * the open rise on half its angle; a rise slow at first passes half its time well before half its movement).
 */
export function riseHalfTimes(smoothed, timestamps, low, high, rest, reps) {
  const mid = (low + high) / 2, past = rest === 'low' ? a => a >= mid : a => a <= mid;
  return (reps || []).map(r => {
    let prev = null;
    for (let i = 0; i < timestamps.length && timestamps[i] <= r.endTime; i++) {
      if (timestamps[i] < r.startTime) continue;
      const a = smoothed[i];
      if (a === null || a === undefined) { prev = null; continue; }
      if (past(a)) {
        if (prev === null) return timestamps[i];
        const [t0, a0] = prev, u = a === a0 ? 1 : (mid - a0) / (a - a0);
        return t0 + Math.min(1, Math.max(0, u)) * (timestamps[i] - t0);
      }
      prev = [timestamps[i], a];
    }
    return r.startTime + (Number.isFinite(r.concentricSec) ? r.concentricSec / 2 : (r.endTime - r.startTime) / 2);
  });
}

/**
 * The test's score from the counted reps: the reps whose rise is past halfway within the window, the window
 * opening at the first rise, the open rise (openRise) among them. `complete` is false when the video ends
 * before the window does; with no rise at all, the window is measured from the start of the video.
 */
export function scoreTest(reps, videoEndSec, windowSec, openRep = null, videoStartSec = null) {
  // The protocol starts seated (arm straight for the curl). A first rep the video starts inside is a person
  // filmed from standing sitting down, not a stand (David, 2 October 2026: 9 stands, the app said 10): it is
  // not scored, and the window opens at the first rise from rest.
  const fromRest = Number.isFinite(videoStartSec) && reps.length && reps[0].clipped && reps[0].startTime <= videoStartSec + 0.05 ? reps.slice(1) : reps;
  const all = openRep ? [...fromRest, openRep] : fromRest;
  if (!all.length) return { score: 0, reps: [], t0: null, open: false, complete: Number.isFinite(videoEndSec) && videoEndSec >= windowSec, beyond: 0 };
  const t0 = all[0].startTime, end = t0 + windowSec;
  const halfway = r => (Number.isFinite(r.halfTime) ? r.halfTime : Number.isFinite(r.concentricSec) ? r.startTime + r.concentricSec / 2 : (r.startTime + r.endTime) / 2);
  const kept = all.filter(r => halfway(r) <= end).map((r, i) => { const { halfTime: _h, ...rep } = r; return { ...rep, index: i + 1 }; });
  return { score: kept.length, reps: kept, t0, open: !!openRep && halfway(openRep) <= end, complete: Number.isFinite(videoEndSec) && videoEndSec >= end, beyond: all.length - kept.length };
}
