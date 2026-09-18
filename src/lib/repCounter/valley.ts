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
      // EXCEPT for fast exercises (battle rope, jumping jacks) where
      // smoothing=5 kills the rapid oscillations that ARE the reps.
      const altSmoothWindow = (exercise.minSpacing != null && exercise.minSpacing < 0.2)
        ? (exercise.smoothing != null ? exercise.smoothing : 1) : 5;

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

    // Asymmetric margin: alternatives finding FEWER reps than primary only
    // need 5% margin (helps correct overcounting). Alternatives finding MORE
    // reps need 20% (prevents noise from inflating the count).
    const margin = result.reps < primaryCount.reps ? 1.05 : 1.2;
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
