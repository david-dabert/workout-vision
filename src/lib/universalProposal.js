// What the app shows for an exercise the counting core does not offer (CoreUpload.jsx): the "universal" engine's number
// is never a counted result (counting research of 14 October 2026). That engine (universalKinematics.js) has no
// visibility check and no refusal: on the 35 labelled sets it is exact on 10 and off by 3 or more on 10, and it gave
// David's prone Y raise 21 for 10 from the noise of wrists the pose model could not see (research/prone-report.md).
// So its read is turned into a refused set, as the core's own refusals are (coreAnalysis.js summarizeCount):
//   - refused, with no number, when the landmarks its signal needs are seen on fewer than half the samples (the core's
//     coverage rule, the same 0.5 visibility floor per landmark, core.ts VIS_THRESHOLD), or for a hold (plank, wall
//     sit...), whose "count" is the video's length in seconds, not a time held;
//   - otherwise refused with its number as `proposal`, which the result screen offers through "Proposition de l'appli":
//     a number to confirm, never a silent count, no grade, no measure, nothing saved until the person confirms (R8).
// Status of the rule: convention (the core's own refusal rule, applied unchanged). The universal count itself stays
// unvalidated (experimental).
import { ISOMETRIC_HOLDS } from './universalKinematics';

// The landmarks each signal of the universal engine reads (universalKinematics.js, extractFrameKinematics), by
// MediaPipe Pose index: 7/8 ears, 11/12 shoulders, 13/14 elbows, 15/16 wrists, 23/24 hips, 25/26 knees, 27/28 ankles,
// 31/32 feet.
export const CHANNEL_POINTS = Object.freeze({
  leftElbow: [11, 13, 15], rightElbow: [12, 14, 16],
  leftShoulder: [23, 11, 13], rightShoulder: [24, 12, 14],
  leftHip: [11, 23, 25], rightHip: [12, 24, 26],
  leftKnee: [23, 25, 27], rightKnee: [24, 26, 28],
  leftAnkle: [25, 27, 31], rightAnkle: [26, 28, 32],
  chestAperture: [11, 12, 15, 16],
  shrug: [7, 8, 11, 12, 23, 24],
  torso: [11, 12, 23, 24, 25, 26],
});

// The core's floors (core.ts VIS_THRESHOLD; coreAnalysis.js summarizeCount: refused under half the samples seen).
// Source: the counting core's own rule. Status: convention.
export const SEEN_VISIBILITY = 0.5;
export const MIN_SEEN_SHARE = 0.5;

/** Share of all samples (a sample with no body counts as unseen) where every landmark of `points` clears the floor. */
export function seenShare(worldLandmarks, points) {
  const n = worldLandmarks?.length ?? 0;
  if (!n || !points?.length) return 0;
  const seen = worldLandmarks.filter(wl => wl && points.every(k => (wl[k]?.visibility ?? 0) >= SEEN_VISIBILITY)).length;
  return seen / n;
}

/**
 * The universal engine's result as the result screen may show it: always refused, `count` 0 and no reps (so no grade,
 * no cell, no measure), the frames kept for the replay, `proposal` { count, by: 'universal' } only when the signal was
 * seen on at least half the samples and the engine found at least one rep, and `universal` { channel, seen, count,
 * hold } for the report of the count and for research.
 */
export function universalAsProposal(read, lift) {
  const hold = ISOMETRIC_HOLDS.has(lift) || !!read?.isIsometric;
  const channel = read?.dominantJoint ?? null;
  const seen = channel ? seenShare(read?.worldLandmarks, CHANNEL_POINTS[channel]) : 0;
  const n = Number.isInteger(read?.count) ? read.count : 0;
  const answers = !hold && seen >= MIN_SEEN_SHARE && n > 0;
  return {
    refused: true,
    count: 0,
    reps: [],
    arm: null,
    confidence: null,
    exercise: lift,
    metadata: read?.metadata ?? {},
    imageLandmarks: read?.imageLandmarks ?? [],
    worldLandmarks: read?.worldLandmarks ?? [],
    timestamps: read?.timestamps ?? [],
    universal: { channel, seen: Math.round(seen * 1000) / 1000, count: n, hold },
    proposal: answers ? { count: n, by: 'universal' } : null,
  };
}
