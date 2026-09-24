/**
 * Adaptive multi-signal selection for rep counting.
 *
 * Instead of hardcoding which signal to track per exercise, tests ALL
 * available signals and lets the data decide. This makes rep counting
 * robust to arbitrary camera angles, body orientations, and exercise
 * variations.
 *
 * For each candidate signal (primary + ~28 3D alternatives, each in 2
 * orientations = ~58 candidates), run valley counting and score by:
 *   score = reps × (1 / (1 + CV))
 * where CV = coefficient of variation of inter-valley gaps.
 *
 * Real reps have even timing (low CV → high consistency → high score).
 * Noise produces irregular valleys (high CV → low consistency → low score).
 * The signal with the highest score wins.
 */

import type { LandmarkArray } from '../types';
import type { Exercise, ValleyResult, SignalCandidate, DiagCandidate } from './types';
import { extractSignals3D, getSignalPriority } from '../SignalExtractor3D';
import {
  findValleys,
  interpolateNulls,
  smoothSignal,
} from '../valleyCounter';

interface AdaptiveResult {
  signal: number[];
  invert: boolean;
  result: ValleyResult;
  name: string;
  diagCandidates: DiagCandidate[];
}

/**
 * Run adaptive multi-signal selection on cleaned landmarks.
 *
 * Tests the primary signal and all biomechanically relevant 3D alternatives.
 * An alternative must beat the primary score by >= 20% margin (or 5% if it
 * finds fewer reps) to override. This prevents marginal noise signals from
 * winning while still allowing genuine improvements.
 */
export function adaptiveSignalSelect(
  cleanedLandmarks: LandmarkArray[],
  primarySmoothed: number[],
  exercise: Exercise,
  exerciseKey: string,
  fps: number,
): AdaptiveResult {
  const candidates: SignalCandidate[] = [];

  // Primary signal in both orientations
  candidates.push({ name: 'primary', countSignal: primarySmoothed, original: primarySmoothed, inv: false });
  candidates.push({ name: 'primary_inv', countSignal: primarySmoothed.map(v => -v), original: primarySmoothed, inv: true });

  // Only add biomechanically relevant alternatives. Uses explicit
  // SIGNAL_PRIORITY_3D for ~30 exercises, falls back to joint-based
  // defaults for the remaining ~245. This extends adaptive selection
  // to all 275 exercises without testing irrelevant signals.
  const priority: string[] | null = getSignalPriority(exerciseKey, exercise.joint);
  if (priority && priority.length > 0) {
    try {
      const signals3D = extractSignals3D(cleanedLandmarks);
      // Alternative signals get stronger smoothing (5) to suppress noise,
      // EXCEPT when the exercise explicitly sets a smoothing override
      // (e.g. sit_up smoothing=1 for Nyquist-limited fast reps), or for
      // fast exercises (battle rope, jumping jacks) where smoothing=5
      // kills the rapid oscillations that ARE the reps.
      const altSmoothWindow = exercise.smoothing != null ? exercise.smoothing
        : (exercise.minSpacing != null && exercise.minSpacing < 0.2) ? 1 : 5;

      for (const sigName of priority) {
        const sig = signals3D.find((s: { name: string; values: (number | null)[] }) => s.name === sigName);
        if (!sig) continue;
        const smoothed = smoothSignal(interpolateNulls(sig.values), altSmoothWindow);
        candidates.push({ name: sigName, countSignal: smoothed, original: smoothed, inv: false });
        candidates.push({ name: sigName + '_inv', countSignal: smoothed.map((v: number) => -v), original: smoothed, inv: true });
      }
    } catch (_) {
      // 3D extraction failed; continue with primary only
    }
  }

  // First: establish the primary baseline with exercise-defined orientation.
  const exInv: boolean = exercise.downThreshold > exercise.upThreshold;
  const primaryCount: ValleyResult = findValleys(exInv ? primarySmoothed.map((v: number) => -v) : primarySmoothed, fps, exercise);
  let primaryConsistency = 1;
  if (primaryCount.valleyFrames.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < primaryCount.valleyFrames.length; i++) {
      gaps.push(primaryCount.valleyFrames[i] - primaryCount.valleyFrames[i - 1]);
    }
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const std = Math.sqrt(gaps.reduce((a, v) => a + (v - mean) ** 2, 0) / gaps.length);
    const cv = mean > 0 ? std / mean : 1;
    primaryConsistency = 1 / (1 + cv);
  }
  const primaryScore = primaryCount.reps * primaryConsistency;

  // Now score all candidates. An alternative must beat the primary score
  // by >= 20% margin to override. This prevents marginal noise signals
  // from winning while still allowing genuine improvements (e.g. hip_Y
  // for front-view squats where knee angles are compressed in 2D).
  let bestScore = primaryScore;
  let bestCand: { original: number[]; inv: boolean; name: string } = { original: primarySmoothed, inv: exInv, name: 'primary' };
  let bestResult: ValleyResult = primaryCount;

  const diagCandidates: DiagCandidate[] = [{ name: 'primary', reps: primaryCount.reps, score: primaryScore, consistency: primaryConsistency, winner: false }];

  // Store alternative results for consensus check after scoring
  const altResults: { name: string; reps: number; score: number; consistency: number; result: ValleyResult; cand: typeof bestCand }[] = [];

  for (const cand of candidates) {
    // Skip the two primary entries — we already computed the baseline
    if (cand.name === 'primary' || cand.name === 'primary_inv') continue;

    const result: ValleyResult = findValleys(cand.countSignal, fps, exercise);
    if (result.reps === 0) continue;

    // Overcounting guard: when primary finds >= 3 reps, reject alternatives
    // that find more than 1.5× the primary count. Double-counting from
    // mid-rep oscillation (knee wobble, head bob) typically produces ~2× reps.
    if (primaryCount.reps >= 3 && result.reps > primaryCount.reps * 1.5) continue;

    let consistency = 1;
    if (result.valleyFrames.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < result.valleyFrames.length; i++) {
        gaps.push(result.valleyFrames[i] - result.valleyFrames[i - 1]);
      }
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const std = Math.sqrt(gaps.reduce((a, v) => a + (v - mean) ** 2, 0) / gaps.length);
      const cv = mean > 0 ? std / mean : 1;
      consistency = 1 / (1 + cv);
    }

    const score = result.reps * consistency;

    diagCandidates.push({ name: cand.name, reps: result.reps, score, consistency, winner: false });
    altResults.push({ name: cand.name, reps: result.reps, score, consistency, result, cand: { original: cand.original, inv: cand.inv, name: cand.name } });

    // Asymmetric margin: alternatives finding FEWER reps than primary only
    // need 5% margin (helps correct overcounting). Alternatives finding MORE
    // reps need 10% margin. The 1.5x overcounting guard above already prevents
    // dramatic noise inflation; the margin here prevents marginal noise wins
    // without blocking legitimate undercounting corrections (e.g. 9→12 on
    // cable pushdowns where elbow angle is noisy but wrist_Y is clean).
    const margin = result.reps < primaryCount.reps ? 1.05 : 1.1;
    if (score > bestScore * margin) {
      bestScore = score;
      bestCand = cand;
      bestResult = result;
    }
  }

  // ── Bilateral flicker consensus detection ──
  // bestSide (Math.min) flips between left/right sides frame-to-frame when
  // both limbs are visible, creating false valleys that ~double the count.
  // The scoring function (reps × consistency) inherently favors overcounted
  // signals because 2× reps at moderate consistency outscores correct reps
  // at high consistency.
  //
  // Detection: when the winner's count is ≥ 1.8× the median of alternatives
  // that found ≥ 3 reps, and ≥ 3 alternatives cluster within ±30% of their
  // median, the winner is likely double-counting. In that case, pick the
  // best-scoring candidate from the consensus cluster.
  //
  // Evidence: deficit_push_up #9 (primary=18, 6 alts agree on ~6, expected 7),
  // lying_bicep_curl #7 (primary=12, 6 alts agree on ~6, expected 7).
  {
    const altsWithReps = altResults.filter(a => a.reps >= 3);
    if (altsWithReps.length >= 4) {
      const sortedReps = altsWithReps.map(a => a.reps).sort((a, b) => a - b);
      const median = sortedReps[Math.floor(sortedReps.length / 2)];
      const winnerReps = bestResult.reps;

      if (winnerReps > median * 1.7) {
        // Find the consensus cluster: alternatives within ±30% of median
        const clusterLow = median * 0.7;
        const clusterHigh = median * 1.3;
        const cluster = altsWithReps.filter(a => a.reps >= clusterLow && a.reps <= clusterHigh);

        if (cluster.length >= 3) {
          // Pick the highest-scoring candidate in the consensus cluster
          let clusterBest = cluster[0];
          for (const c of cluster) {
            if (c.score > clusterBest.score) clusterBest = c;
          }
          bestScore = clusterBest.score;
          bestCand = clusterBest.cand;
          bestResult = clusterBest.result;
        }
      }
    }
  }

  // ── High-consistency cluster override ──
  // When many alternative signals with very high consistency (>0.85) agree
  // on a rep count that is less than HALF the winner's count, the winner is
  // likely overcounting from noise or one-sided tracking failure.
  //
  // Thresholds are deliberately conservative (≥4 signals, consistency >0.85,
  // ratio <0.45) to avoid false triggers on exercises where the winner is
  // genuinely correct. Only fires on extreme overcounting (e.g. 15 vs 6).
  {
    const highConsAlts = altResults.filter(a => a.consistency > 0.85 && a.reps >= 2);
    if (highConsAlts.length >= 4 && bestResult.reps >= 10) {
      const repCounts = highConsAlts.map(a => a.reps).sort((a, b) => a - b);
      const hcMedian = repCounts[Math.floor(repCounts.length / 2)];
      const cluster = highConsAlts.filter(a => Math.abs(a.reps - hcMedian) <= 1);

      if (cluster.length >= 4 && hcMedian <= bestResult.reps * 0.40) {
        let clusterBest = cluster[0];
        for (const c of cluster) {
          if (c.score > clusterBest.score) clusterBest = c;
        }
        bestScore = clusterBest.score;
        bestCand = clusterBest.cand;
        bestResult = clusterBest.result;
      }
    }
  }

  return {
    signal: bestCand.original,
    invert: bestCand.inv,
    result: bestResult,
    name: bestCand.name,
    diagCandidates,
  };
}
