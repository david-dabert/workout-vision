/**
 * Where the app did not see the body during a set, measured on the counter's own output (summarizeCount):
 * a sample is seen by the same rule as the refusal (coreAnalysis.js, `visible`): the tracked angle exists,
 * on both sides for a both-sides lift, on either side for a `together` lift.
 *
 * A hole is a run of unseen samples lasting at least HOLE_SHARE of the set's median rep, or HOLE_FALLBACK_SEC
 * when fewer than two reps were counted: long enough to hide a rep. A set is in doubt when it holds a hole or
 * when less than MIN_COVERAGE of its samples are seen. The result is measured and stored only; nothing on
 * screen reads it yet (swarm review of 6 October, action 1; the result screen waits for David, R8, R10).
 *
 * Thresholds. Source: UNSOURCED. Status: experimental, frozen on 6 October before any measurement on the
 * scoreboards. Measured that day on the public build half: 195 of 946 counted sets flagged, 33% exact among
 * them against 57% among the others; 23 of the 49 sets off by 3 or more flagged. On David's sets: the hip
 * thrust 7 for 13 and the squat 7 for 7 flagged. A worst-5-second-window rule was tried and added nothing
 * (TRIED.md, 6 October). npm run scoreboard and scoreboard:public print these figures.
 */
export const HOLE_SHARE = 0.5;
export const HOLE_FALLBACK_SEC = 2;
export const MIN_COVERAGE = 0.8;

const round2 = x => Math.round(x * 100) / 100;

/** The per-sample seen mask, by the refusal's rule. */
export function seenMask(core, together) {
  if (core.sides) {
    const l = core.sides.left.angles, r = core.sides.right.angles;
    return l.map((a, i) => (together ? a !== null || r[i] !== null : a !== null && r[i] !== null));
  }
  return (core.angles ?? []).map(a => a !== null);
}

/**
 * { coverage, holes, unseenSec, longestGapSec, flagged } for a counted set; null when there are no samples.
 * Times in seconds, from `timestamps` (seconds).
 */
export function poseDoubt(core, timestamps, { together = false } = {}) {
  const seen = seenMask(core, together);
  const n = Math.min(seen.length, timestamps.length);
  if (!n) return null;
  const step = n > 1 ? (timestamps[n - 1] - timestamps[0]) / (n - 1) : 0;
  const durs = (core.reps ?? []).map(r => r.endTime - r.startTime).filter(d => d > 0).sort((a, b) => a - b);
  const median = durs.length >= 2 ? durs[Math.floor(durs.length / 2)] : null;
  const minHole = median !== null ? HOLE_SHARE * median : HOLE_FALLBACK_SEC;
  let holes = 0, unseenSec = 0, longest = 0, seenCount = 0;
  for (let i = 0; i < n;) {
    if (seen[i]) { seenCount++; i++; continue; }
    let j = i;
    while (j < n && !seen[j]) j++;
    // A run of k unseen samples hides k sample periods of time.
    const sec = (j - i) * step;
    longest = Math.max(longest, sec);
    if (sec >= minHole) { holes++; unseenSec += sec; }
    i = j;
  }
  const coverage = seenCount / n;
  return { coverage: round2(coverage), holes, unseenSec: round2(unseenSec), longestGapSec: round2(longest), flagged: holes > 0 || coverage < MIN_COVERAGE };
}
