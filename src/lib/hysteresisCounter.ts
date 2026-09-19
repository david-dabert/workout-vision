/**
 * Hysteresis FSM rep counter — the established, physics-based approach.
 *
 * Instead of finding local minima (valleys) and filtering by prominence,
 * this tracks phase transitions of the kinematic cycle using a finite
 * state machine with hysteresis thresholds.
 *
 * A rep is counted only when the signal completes a full cycle:
 *   TOP → crosses below lowThreshold → BOTTOM → crosses above highThreshold → TOP (+1 rep)
 *
 * Hysteresis prevents noise around a single threshold from creating false
 * state transitions. The signal must travel the full band between thresholds
 * before the state can reverse.
 *
 * Thresholds are auto-calibrated from robust statistics of the observed
 * signal (median ± k·MAD), making them immune to single-frame outliers
 * that plague raw min/max range estimation.
 *
 * References:
 *   - Pūioio (arXiv:2308.02420, 2023): BlazePose + state machine, ~98-99% accuracy
 *   - Standard pattern across open-source MediaPipe fitness counters
 *   - Classic hysteresis in signal processing (Schmitt trigger principle)
 *
 * Every function is stateless: takes a signal array + config, returns results.
 * Returns ValleyResult-compatible structure for drop-in replacement.
 */

import type { ValleyResult } from './repCounter/types';

interface ExerciseConfig {
  amplitudeRatio?: number;
  minSpacing?: number;
  downThreshold?: number;
  upThreshold?: number;
}

// FSM states — unidirectional transitions only
const TOP = 0;
const DESCENDING = 1;
const BOTTOM = 2;
const ASCENDING = 3;

/**
 * Auto-calibrate hysteresis thresholds from the signal's actual
 * rep motion — not from time-domain percentiles.
 *
 * 1. Find all local maxima and minima in the signal.
 * 2. Compute the median peak value and median valley value.
 * 3. Place thresholds at 25%/75% within that [medianValley, medianPeak] range.
 *
 * This is robust to:
 * - Single-frame outliers (don't form local extrema after smoothing)
 * - Setup/teardown motion (doesn't produce periodic peaks/valleys)
 * - Smoothing-dampened amplitude (calibrates from actual observed extrema)
 *
 * Falls back to p10/p90 percentile calibration if too few extrema found.
 */
function calibrateThresholds(signal: number[]): { low: number; high: number; robustRange: number } {
  // Find local maxima and minima (simple 3-point test)
  const peaks: number[] = [];
  const valleys: number[] = [];
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > signal[i - 1] && signal[i] >= signal[i + 1]) {
      peaks.push(signal[i]);
    }
    if (signal[i] < signal[i - 1] && signal[i] <= signal[i + 1]) {
      valleys.push(signal[i]);
    }
  }

  let medianPeak: number;
  let medianValley: number;

  if (peaks.length >= 2 && valleys.length >= 2) {
    // Calibrate from actual rep motion
    peaks.sort((a, b) => a - b);
    valleys.sort((a, b) => a - b);
    medianPeak = peaks[Math.floor(peaks.length / 2)];
    medianValley = valleys[Math.floor(valleys.length / 2)];
  } else {
    // Fallback to percentile calibration
    const sorted = [...signal].sort((a, b) => a - b);
    const n = sorted.length;
    medianValley = sorted[Math.floor(n * 0.10)];
    medianPeak = sorted[Math.floor(n * 0.90)];
  }

  const robustRange = medianPeak - medianValley;

  // Place thresholds at 25%/75% within the [valley, peak] range.
  // The signal must travel 50% of the actual rep amplitude to
  // trigger a state transition. This is the hysteresis band.
  const low = medianValley + robustRange * 0.25;
  const high = medianPeak - robustRange * 0.25;

  return { low, high, robustRange };
}

/**
 * Run the hysteresis FSM on the signal.
 *
 * The signal should already be smoothed and oriented so that valleys
 * correspond to the bottom of the rep (i.e., signal goes DOWN during
 * the eccentric phase and UP during the concentric phase).
 *
 * Returns a ValleyResult-compatible object.
 */
export function hysteresisCount(signal: number[], fps: number, exercise: ExerciseConfig): ValleyResult {
  const N = signal.length;
  if (N < 6) {
    return { reps: 0, valleyFrames: [], signalRange: 0 };
  }

  // Auto-calibrate thresholds from robust statistics
  const { low, high, robustRange } = calibrateThresholds(signal);

  if (robustRange < 8) {
    return { reps: 0, valleyFrames: [], signalRange: robustRange };
  }

  // Minimum spacing between reps (frames)
  const minSpacingSec = (exercise.minSpacing != null) ? exercise.minSpacing : 0.4;
  const minGap = Math.max(2, Math.round(fps * minSpacingSec));

  // Determine initial state from the first sample
  let phase: number;
  if (signal[0] <= low) {
    phase = BOTTOM;
  } else if (signal[0] >= high) {
    phase = TOP;
  } else {
    // In the middle — look at signal trend to decide
    // Default to TOP (waiting for first descent)
    phase = TOP;
  }

  const valleyFrames: number[] = [];
  let lastRepFrame = -Infinity;
  let currentValleyFrame = -1;
  let currentValleyVal = Infinity;

  for (let i = 1; i < N; i++) {
    const v = signal[i];

    switch (phase) {
      case TOP:
        // Waiting for signal to descend below low threshold
        if (v <= low) {
          phase = BOTTOM;
          currentValleyFrame = i;
          currentValleyVal = v;
        } else if (v < high) {
          // Entered transition zone — now descending
          phase = DESCENDING;
        }
        break;

      case DESCENDING:
        if (v <= low) {
          // Reached bottom region
          phase = BOTTOM;
          currentValleyFrame = i;
          currentValleyVal = v;
        } else if (v >= high) {
          // Went back up without reaching bottom — false start
          phase = TOP;
        }
        break;

      case BOTTOM:
        // Track the deepest point in the bottom region
        if (v < currentValleyVal) {
          currentValleyVal = v;
          currentValleyFrame = i;
        }
        if (v >= high) {
          // Full transition: bottom → top = 1 completed rep
          if (i - lastRepFrame >= minGap && currentValleyFrame >= 0) {
            valleyFrames.push(currentValleyFrame);
            lastRepFrame = i;
          }
          phase = TOP;
          currentValleyFrame = -1;
          currentValleyVal = Infinity;
        } else if (v > low) {
          // Left bottom region but haven't reached top yet
          phase = ASCENDING;
        }
        break;

      case ASCENDING:
        if (v >= high) {
          // Reached top — count the rep
          if (i - lastRepFrame >= minGap && currentValleyFrame >= 0) {
            valleyFrames.push(currentValleyFrame);
            lastRepFrame = i;
          }
          phase = TOP;
          currentValleyFrame = -1;
          currentValleyVal = Infinity;
        } else if (v <= low) {
          // Went back down — new bottom, don't count yet
          phase = BOTTOM;
          if (v < currentValleyVal) {
            currentValleyVal = v;
            currentValleyFrame = i;
          }
        }
        break;
    }
  }

  return {
    reps: valleyFrames.length,
    valleyFrames,
    signalRange: robustRange,
  };
}
