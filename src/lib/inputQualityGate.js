/**
 * Input Quality Gate — decides whether analysis output is trustworthy.
 *
 * Runs AFTER detection + rep counting, BEFORE form scoring is shown to user.
 * Four checks:
 *   1. Frame continuity — detects temporal jumps in landmark data
 *   2. Detection confidence — hard gate on low-confidence exercise ID
 *   3. Plausibility — per-exercise bounds on rep count, set duration, tempo
 *   4. Signal amplitude — observed joint angle range vs expected range
 *
 * Returns { pass, reasons[], insufficientFootage } so the caller can
 * decide whether to show full results or a degraded "insufficient footage" UI.
 */

// ---------------------------------------------------------------------------
// 1. Frame continuity — detect landmark gaps / jumps
// ---------------------------------------------------------------------------

/**
 * Scan frame timestamps for gaps exceeding the expected interval.
 * A gap > 3× expected interval means frames were dropped or the video
 * had a cut. Returns the fraction of "clean" frames (no jump before them).
 *
 * @param {number[]} timestamps - per-frame timestamps in seconds
 * @param {number} fps - expected frames per second
 * @returns {{ continuity: number, jumpCount: number }}
 */
function assessFrameContinuity(timestamps, fps) {
  if (!timestamps || timestamps.length < 2) {
    return { continuity: 0, jumpCount: 0 };
  }
  const expectedInterval = 1 / fps;
  const jumpThreshold = expectedInterval * 3;
  let jumpCount = 0;

  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i] - timestamps[i - 1];
    if (gap > jumpThreshold || gap < 0) {
      jumpCount++;
    }
  }

  const continuity = 1 - jumpCount / (timestamps.length - 1);
  return { continuity: Math.max(0, continuity), jumpCount };
}

// ---------------------------------------------------------------------------
// 2. Per-exercise plausibility bounds
// ---------------------------------------------------------------------------

// Bounds: [minReps, maxReps, minDurationSec, maxDurationSec]
// These are generous — they catch obvious misfires, not edge cases.
const PLAUSIBILITY_BOUNDS = {
  // Compound lifts
  squat:          [1, 30, 3, 180],
  bench_press:    [1, 25, 3, 150],
  deadlift:       [1, 20, 3, 150],
  overhead_press: [1, 25, 3, 150],

  // Upper body
  bicep_curl:     [1, 30, 3, 120],
  tricep_extension: [1, 30, 3, 120],
  lateral_raise:  [1, 30, 3, 120],
  front_raise:    [1, 30, 3, 120],
  pull_up:        [1, 30, 3, 180],
  push_up:        [1, 50, 3, 180],
  dip:            [1, 30, 3, 150],

  // Lower body
  lunge:          [1, 30, 3, 180],
  leg_extension:  [1, 30, 3, 120],
  leg_curl:       [1, 30, 3, 120],
  calf_raise:     [1, 40, 3, 120],
  hip_thrust:     [1, 25, 3, 150],

  // Core
  sit_up:         [1, 50, 3, 180],
  crunch:         [1, 50, 3, 180],

  // Full body / conditioning
  battle_rope:    [1, 100, 3, 300],
  burpee:         [1, 30, 3, 180],
};

// Fallback for exercises not in the table
const DEFAULT_BOUNDS = [1, 60, 2, 300];

/**
 * Check whether rep count and duration fall within plausible ranges.
 *
 * @param {string} exercise - exercise key
 * @param {number} reps
 * @param {number} durationSec - set duration in seconds
 * @returns {{ plausible: boolean, reason?: string }}
 */
function checkPlausibility(exercise, reps, durationSec) {
  const [minR, maxR, minD, maxD] = PLAUSIBILITY_BOUNDS[exercise] || DEFAULT_BOUNDS;

  if (reps < minR) {
    return { plausible: false, reason: `rep_count_too_low` };
  }
  if (reps > maxR) {
    return { plausible: false, reason: `rep_count_too_high` };
  }
  if (durationSec < minD) {
    return { plausible: false, reason: `duration_too_short` };
  }
  if (durationSec > maxD) {
    return { plausible: false, reason: `duration_too_long` };
  }

  // Average rep tempo check: typical rep is 1-10 seconds
  if (reps > 0 && durationSec > 0) {
    const avgRepTime = durationSec / reps;
    if (avgRepTime < 0.3) {
      return { plausible: false, reason: `tempo_implausible_fast` };
    }
    if (avgRepTime > 30) {
      return { plausible: false, reason: `tempo_implausible_slow` };
    }
  }

  return { plausible: true };
}

// ---------------------------------------------------------------------------
// 3. Signal amplitude plausibility
// ---------------------------------------------------------------------------

// Minimum observed signal range (degrees) for the primary joint angle.
// Derived from each exercise's downThreshold/upThreshold: the expected
// amplitude is |up - down|, and we require at least 40% of that to pass.
// Generic default: 20° — any movement producing <20° of joint angle
// change is almost certainly noise or a stationary camera.
const MIN_AMPLITUDE = {
  // Compound lifts (knee: 120→155 = 35°, min 14°... too tight. Use absolute minimums)
  squat:          20,  // knee signal should span ≥20°
  bench_press:    20,  // elbow
  deadlift:       15,  // hip
  overhead_press: 20,  // shoulder

  // Upper body
  bicep_curl:     40,  // elbow: 80→145 = 65° expected, 40° minimum
  tricep_extension: 30,
  lateral_raise:  25,  // shoulder
  front_raise:    25,  // shoulder
  pull_up:        25,  // elbow
  push_up:        15,  // elbow (smaller range when prone)
  dip:            20,  // elbow

  // Lower body
  lunge:          20,  // knee
  leg_extension:  25,  // knee
  leg_curl:       25,  // knee
  calf_raise:     8,   // ankle (small range)
  hip_thrust:     15,  // hip

  // Core
  sit_up:         15,  // trunk
  crunch:         10,  // trunk (small range)

  // Full body
  battle_rope:    5,   // wrist Y (very small signal)
  burpee:         15,  // mixed
};

const DEFAULT_MIN_AMPLITUDE = 15;

/**
 * Check whether the observed signal amplitude is plausible.
 *
 * @param {string} exercise - exercise key
 * @param {number} observedRange - degrees of primary signal range from RepCounter diagnostics
 * @returns {{ plausible: boolean, reason?: string }}
 */
function checkAmplitude(exercise, observedRange) {
  if (observedRange == null || observedRange < 0) {
    return { plausible: false, reason: 'signal_no_amplitude' };
  }
  const minAmp = MIN_AMPLITUDE[exercise] ?? DEFAULT_MIN_AMPLITUDE;
  if (observedRange < minAmp) {
    return { plausible: false, reason: 'signal_amplitude_too_low' };
  }
  return { plausible: true };
}

// ---------------------------------------------------------------------------
// 4. Main gate
// ---------------------------------------------------------------------------

/**
 * Run the input quality gate on analysis results.
 *
 * @param {Object} params
 * @param {string} params.exercise - exercise key
 * @param {number} params.reps - detected rep count
 * @param {number} params.durationSec - video/set duration in seconds
 * @param {boolean} params.detectionLowConfidence - from ExerciseAutoDetector
 * @param {number[]} [params.frameTimestamps] - per-frame timestamps for continuity check
 * @param {number} [params.fps] - analysis FPS
 * @param {number} [params.observedRange] - primary signal amplitude in degrees from RepCounter diagnostics
 * @returns {{ pass: boolean, insufficientFootage: boolean, reasons: string[] }}
 */
export function runInputQualityGate({
  exercise,
  reps,
  durationSec,
  detectionLowConfidence,
  frameTimestamps = [],
  fps = 8,
  observedRange,
}) {
  const reasons = [];

  // Gate 1: Detection confidence
  if (detectionLowConfidence) {
    reasons.push('detection_low_confidence');
  }

  // Gate 2: Frame continuity
  if (frameTimestamps.length >= 2) {
    const { continuity } = assessFrameContinuity(frameTimestamps, fps);
    if (continuity < 0.5) {
      reasons.push('frame_continuity_poor');
    }
  }

  // Gate 3: Plausibility
  const plausibility = checkPlausibility(exercise, reps, durationSec);
  if (!plausibility.plausible) {
    reasons.push(plausibility.reason);
  }

  // Gate 4: Signal amplitude
  if (observedRange != null) {
    const amplitude = checkAmplitude(exercise, observedRange);
    if (!amplitude.plausible) {
      reasons.push(amplitude.reason);
    }
  }

  const pass = reasons.length === 0;
  const insufficientFootage = !pass;

  return { pass, insufficientFootage, reasons };
}
