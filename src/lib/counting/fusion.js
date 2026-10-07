/**
 * The motion rhythm as a safety net for the skeleton's count (7 October; TRIED.md). The skeleton's count stays the
 * app's count whenever it is confident; the rhythm count (motionRhythm.js, image motion, no skeleton) only ever asks
 * the person to confirm (R8: no grade, the person gives or confirms the number):
 *  1. the skeleton refused the set, or saw the body in fewer than COVERAGE_FLOOR of the samples: the rhythm count is
 *     proposed as the number to confirm (when the rhythm found a period and is at least MIN_RHYTHM_CONFIDENCE sure);
 *  2. the skeleton counted and the rhythm, having found a period, counts another number: the set is marked to
 *     confirm, and the number proposed is still the skeleton's.
 * When the two agree, or the rhythm found no period, nothing changes.
 *
 * Off in the app (RHYTHM_FUSION = false): measured on David's 13 real videos, the occlusion bench and MM-Fit
 * (test/real-phone/motion/fusion.test.ts, fusion.txt; TRIED.md, 7 October); the result screen reads none of it. Left off
 * because rule 1 makes 4 occluded synthetic sets newly off by 3 or more (side-view alternating curls refused by the
 * skeleton, the rhythm counting half), and on real videos it adds no exact count (4 of 5 wrong counts marked, 1 false
 * alarm in 6 exact sets). Bench hook:
 * globalThis.__WV_BENCH_FUSION__ (true turns it on, as for the other bench hooks); the app never sets it.
 *
 * COVERAGE_FLOOR 0.8: the task's rule (David's request, 7 October), UNSOURCED. MIN_RHYTHM_CONFIDENCE 0.3: the cross-check
 * of 7 October (motionRhythm.js crossCheck), UNSOURCED. Status: experimental.
 */
export const RHYTHM_FUSION = false;
export const COVERAGE_FLOOR = 0.8;
export const MIN_RHYTHM_CONFIDENCE = 0.3;

export const fusionOn = () => RHYTHM_FUSION || globalThis.__WV_BENCH_FUSION__ === true;

/**
 * @param {{ count: number, refused: boolean }} skeleton the counter's result (summarizeCount)
 * @param {number} coverage share of samples with a pose (0 to 1)
 * @param {{ count: number, period: number | null, confidence: number } | null} rhythm motionCount's result, or null when
 *   no motion frames were kept
 * @returns {{ count: number | null, source: 'skeleton' | 'rhythm' | 'none', toConfirm: boolean, reason: 'refused' | 'coverage' | 'disagree' | null }}
 *   count: the number shown (to confirm when toConfirm), null when there is none to propose.
 */
export function fuseCounts(skeleton, coverage, rhythm, { coverageFloor = COVERAGE_FLOOR, minConfidence = MIN_RHYTHM_CONFIDENCE } = {}) {
  const own = skeleton.refused ? null : skeleton.count;
  const found = !!rhythm && rhythm.period != null && rhythm.count > 0;
  const weak = skeleton.refused || coverage < coverageFloor;
  if (weak) {
    const reason = skeleton.refused ? 'refused' : 'coverage';
    if (found && rhythm.confidence >= minConfidence) return { count: rhythm.count, source: 'rhythm', toConfirm: true, reason };
    // No rhythm to offer: the skeleton's own outcome, as without the net.
    return own === null ? { count: null, source: 'none', toConfirm: false, reason: null } : { count: own, source: 'skeleton', toConfirm: own !== rhythm?.count && found, reason: own !== rhythm?.count && found ? 'disagree' : null };
  }
  if (found && rhythm.count !== own) return { count: own, source: 'skeleton', toConfirm: true, reason: 'disagree' };
  return { count: own, source: 'skeleton', toConfirm: false, reason: null };
}
