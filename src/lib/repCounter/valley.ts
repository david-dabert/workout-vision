/**
 * Adaptive multi-signal selection for rep counting.
 *
 * Instead of hardcoding which signal to track per exercise, tests ALL
 * available signals and lets the data decide. This makes rep counting
 * robust to arbitrary camera angles, body orientations, and exercise
 * variations.
 *
 * For each candidate signal, run the hysteresis state machine and score by:
 *   score = reps × consistency × autocorrelationQuality(signal, detected_period)
 *
 * Three-factor scoring:
 *   - reps: more reps = higher signal (but capped by overcounting guard)
 *   - consistency: low CV of inter-valley gaps → even timing → real reps
 *   - autocorrelationQuality: does the detected period actually dominate the signal?
 */

import type { LandmarkArray } from '../types';
import type { Exercise, ValleyResult, SignalCandidate, DiagCandidate } from './types';
import { extractSignals3D, getSignalPriority } from '../SignalExtractor3D';
import {
  interpolateNulls,
  smoothSignal,
  autocorrelationQuality,
} from '../valleyCounter';
import { countRepsStateMachine } from './stateMachine';

interface AdaptiveResult {
  signal: number[];
  invert: boolean;
  result: ValleyResult;
  name: string;
  diagCandidates: DiagCandidate[];
}

/**
 * Compute consistency and AC quality score for a state machine result.
 */
function scoreResult(
  result: ValleyResult,
  signal: number[],
): { score: number; consistency: number } {
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

  const detectedPeriodFrames = result.reps > 0
    ? Math.round(signal.length / result.reps)
    : 0;
  const acQuality = detectedPeriodFrames > 0
    ? Math.max(0.1, autocorrelationQuality(signal, detectedPeriodFrames))
    : 0.1;

  return {
    score: result.reps * consistency * acQuality,
    consistency,
  };
}

/**
 * Run adaptive multi-signal selection using the hysteresis state machine.
 *
 * Tests the primary signal and all biomechanically relevant 3D alternatives.
 * An alternative must beat the primary score by >= 20% margin (or 5% if it
 * finds fewer reps) to override.
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

  // Add biomechanically relevant alternatives
  const priority: string[] | null = getSignalPriority(exerciseKey, exercise.joint);
  if (priority && priority.length > 0) {
    try {
      const signals3D = extractSignals3D(cleanedLandmarks);
      const altSmoothWindow = (exercise.minSpacing != null && exercise.minSpacing < 0.2)
        ? (exercise.smoothing != null ? exercise.smoothing : 1) : 9;

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

  // Establish primary baseline with exercise-defined orientation
  const exInv: boolean = exercise.downThreshold > exercise.upThreshold;
  const primarySignal = exInv ? primarySmoothed.map((v: number) => -v) : primarySmoothed;
  const primaryCount = countRepsStateMachine(primarySignal, fps);
  const { score: primaryScore, consistency: primaryConsistency } = scoreResult(primaryCount, primarySignal);

  let bestScore = primaryScore;
  let bestCand: { original: number[]; inv: boolean; name: string } = { original: primarySmoothed, inv: exInv, name: 'primary' };
  let bestResult: ValleyResult = primaryCount;

  const diagCandidates: DiagCandidate[] = [{ name: 'primary', reps: primaryCount.reps, score: primaryScore, consistency: primaryConsistency, winner: false }];

  for (const cand of candidates) {
    if (cand.name === 'primary' || cand.name === 'primary_inv') continue;

    const result = countRepsStateMachine(cand.countSignal, fps);
    if (result.reps === 0) continue;

    // Overcounting guard
    if (primaryCount.reps >= 3 && result.reps > primaryCount.reps * 1.3) continue;
    if (primaryCount.reps >= 1 && result.reps > primaryCount.reps * 2) continue;

    const { score, consistency } = scoreResult(result, cand.countSignal);
    diagCandidates.push({ name: cand.name, reps: result.reps, score, consistency, winner: false });

    // Asymmetric margin: fewer reps need less margin (corrects overcounting),
    // more reps need higher margin (prevents noise inflation)
    const margin = result.reps < primaryCount.reps ? 1.05 : 1.4;
    if (score > bestScore * margin) {
      bestScore = score;
      bestCand = cand;
      bestResult = result;
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
