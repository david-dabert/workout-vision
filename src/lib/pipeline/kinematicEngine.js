/**
 * Layer 2: Deterministic Kinematic Engine
 *
 * Pure functions only. No side effects. No state.
 * Input: landmarks array + exercise name
 * Output: smoothed time series of angles, velocities, and ROM values
 *
 * Computes:
 * - Per-frame joint angles based on exercise-specific landmark triplets
 * - Butterworth low-pass filter for smoothing (cutoff ~6Hz at 30fps)
 * - Angular velocity and acceleration
 * - Range of motion per frame
 */

// ============================================================================
// Angle calculation (pure geometry)
// ============================================================================

/**
 * Calculate angle between three 3D points in degrees.
 * @param {{ x: number, y: number, z: number }} a
 * @param {{ x: number, y: number, z: number }} b - vertex
 * @param {{ x: number, y: number, z: number }} c
 * @returns {number} angle in degrees
 */
export function calculateAngle(a, b, c) {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };

  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);

  if (magBA < 1e-8 || magBC < 1e-8) return 0;

  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

// MediaPipe Pose landmark indices
const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
};

/**
 * Extract all relevant joint angles from a single frame's landmarks.
 * @param {Array} landmarks - MediaPipe pose landmarks (33 points)
 * @returns {Object} Joint angles in degrees
 */
export function extractJointAngles(landmarks) {
  if (!landmarks || landmarks.length < 33) return null;

  const lm = landmarks;

  return {
    // Elbow angles
    leftElbow: calculateAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]),
    rightElbow: calculateAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]),
    // Shoulder angles
    leftShoulder: calculateAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW]),
    rightShoulder: calculateAngle(lm[LM.RIGHT_HIP], lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW]),
    // Knee angles
    leftKnee: calculateAngle(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]),
    rightKnee: calculateAngle(lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE], lm[LM.RIGHT_ANKLE]),
    // Hip angles
    leftHip: calculateAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE]),
    rightHip: calculateAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE]),
    // Trunk angle (angle between vertical and shoulder-hip line)
    trunk: computeTrunkAngle(lm),
    // Visibility scores for bilateral selection
    _visLeftElbow: lm[LM.LEFT_ELBOW]?.visibility || 0,
    _visRightElbow: lm[LM.RIGHT_ELBOW]?.visibility || 0,
    _visLeftShoulder: lm[LM.LEFT_SHOULDER]?.visibility || 0,
    _visRightShoulder: lm[LM.RIGHT_SHOULDER]?.visibility || 0,
    _visLeftKnee: lm[LM.LEFT_KNEE]?.visibility || 0,
    _visRightKnee: lm[LM.RIGHT_KNEE]?.visibility || 0,
    _visLeftHip: lm[LM.LEFT_HIP]?.visibility || 0,
    _visRightHip: lm[LM.RIGHT_HIP]?.visibility || 0,
  };
}

function computeTrunkAngle(lm) {
  const midShoulder = {
    x: (lm[LM.LEFT_SHOULDER].x + lm[LM.RIGHT_SHOULDER].x) / 2,
    y: (lm[LM.LEFT_SHOULDER].y + lm[LM.RIGHT_SHOULDER].y) / 2,
  };
  const midHip = {
    x: (lm[LM.LEFT_HIP].x + lm[LM.RIGHT_HIP].x) / 2,
    y: (lm[LM.LEFT_HIP].y + lm[LM.RIGHT_HIP].y) / 2,
  };

  const dx = midShoulder.x - midHip.x;
  const dy = midShoulder.y - midHip.y;

  // Angle from vertical (0 = standing straight up)
  return Math.abs(Math.atan2(dx, -dy) * (180 / Math.PI));
}

// ============================================================================
// Exercise-specific signal extraction
// ============================================================================

const VIS_THRESHOLD = 0.55;

/**
 * Select the best side for bilateral exercises based on landmark visibility.
 * Uses Math.min for conservative estimation (form checks).
 */
function bestSide(angles, leftKey, rightKey, visLeftKey, visRightKey) {
  const lv = angles[visLeftKey] || 0;
  const rv = angles[visRightKey] || 0;
  const left = angles[leftKey];
  const right = angles[rightKey];
  const leftOk = lv >= VIS_THRESHOLD && left != null && !isNaN(left);
  const rightOk = rv >= VIS_THRESHOLD && right != null && !isNaN(right);
  if (leftOk && rightOk) return Math.min(left, right);
  if (leftOk) return left;
  if (rightOk) return right;
  if (left != null && !isNaN(left) && right != null && !isNaN(right)) {
    return lv >= rv ? left : right;
  }
  if (left != null && !isNaN(left)) return left;
  if (right != null && !isNaN(right)) return right;
  return null;
}

function bestSideMax(angles, leftKey, rightKey, visLeftKey, visRightKey) {
  const lv = angles[visLeftKey] || 0;
  const rv = angles[visRightKey] || 0;
  const left = angles[leftKey];
  const right = angles[rightKey];
  const leftOk = lv >= VIS_THRESHOLD && left != null && !isNaN(left);
  const rightOk = rv >= VIS_THRESHOLD && right != null && !isNaN(right);
  if (leftOk && rightOk) return Math.max(left, right);
  if (leftOk) return left;
  if (rightOk) return right;
  if (left != null && !isNaN(left) && right != null && !isNaN(right)) {
    return lv >= rv ? left : right;
  }
  if (left != null && !isNaN(left)) return left;
  if (right != null && !isNaN(right)) return right;
  return null;
}

/**
 * Exercise-specific signal configurations.
 * Defines which joint angle to track and how to extract it.
 * Preserves the exact same definitions from exerciseDefinitions.js
 */
const EXERCISE_SIGNALS = {
  bench_press: {
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 150,
  },
  bicep_curl: {
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 80,
    upThreshold: 145,
  },
  lat_pulldown: {
    getValue: (angles) => bestSide(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 40,
    upThreshold: 140,
  },
  lateral_raise: {
    getValue: (angles) => bestSideMax(angles, 'leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder'),
    downThreshold: 40,
    upThreshold: 70,
  },
  overhead_press: {
    getValue: (angles) => bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'),
    downThreshold: 100,
    upThreshold: 160,
  },
};

/**
 * Get the exercise signal configuration.
 * @param {string} exerciseName
 * @returns {Object|null}
 */
export function getExerciseSignal(exerciseName) {
  return EXERCISE_SIGNALS[exerciseName] || null;
}

// ============================================================================
// Butterworth low-pass filter (2nd order, cutoff ~6Hz at 30fps)
// ============================================================================

/**
 * Design a 2nd-order Butterworth low-pass filter.
 * @param {number} cutoffHz - Cutoff frequency in Hz
 * @param {number} sampleRateHz - Sample rate in Hz
 * @returns {Object} Filter coefficients { b0, b1, b2, a1, a2 }
 */
function butterworthCoeffs(cutoffHz, sampleRateHz) {
  const omega = Math.tan((Math.PI * cutoffHz) / sampleRateHz);
  const omega2 = omega * omega;
  const sqrt2 = Math.SQRT2;
  const denom = 1 + sqrt2 * omega + omega2;

  return {
    b0: omega2 / denom,
    b1: (2 * omega2) / denom,
    b2: omega2 / denom,
    a1: (2 * (omega2 - 1)) / denom,
    a2: (1 - sqrt2 * omega + omega2) / denom,
  };
}

/**
 * Apply a 2nd-order Butterworth low-pass filter (forward-backward for zero phase lag).
 * @param {number[]} signal - Input signal
 * @param {number} cutoffHz - Cutoff frequency (default 6Hz)
 * @param {number} sampleRateHz - Sample rate (default 30Hz)
 * @returns {number[]} Filtered signal
 */
export function butterworthFilter(signal, cutoffHz = 6, sampleRateHz = 30) {
  if (signal.length < 3) return signal.slice();

  const { b0, b1, b2, a1, a2 } = butterworthCoeffs(cutoffHz, sampleRateHz);

  // Forward pass
  const forward = new Array(signal.length);
  forward[0] = signal[0];
  forward[1] = signal[1];
  for (let i = 2; i < signal.length; i++) {
    forward[i] = b0 * signal[i] + b1 * signal[i - 1] + b2 * signal[i - 2]
      - a1 * forward[i - 1] - a2 * forward[i - 2];
  }

  // Backward pass (zero-phase)
  const backward = new Array(signal.length);
  backward[signal.length - 1] = forward[signal.length - 1];
  backward[signal.length - 2] = forward[signal.length - 2];
  for (let i = signal.length - 3; i >= 0; i--) {
    backward[i] = b0 * forward[i] + b1 * forward[i + 1] + b2 * forward[i + 2]
      - a1 * backward[i + 1] - a2 * backward[i + 2];
  }

  return backward;
}

// ============================================================================
// Main kinematic processing
// ============================================================================

/**
 * Process landmarks through the kinematic engine.
 * Pure function: no side effects, no state.
 *
 * @param {Array<{ timestamp: number, landmarks: Array }>} frames - From Layer 1
 * @param {string} exerciseName - Exercise key
 * @returns {Object} Kinematic data
 */
export function processKinematics(frames, exerciseName) {
  if (!frames || frames.length === 0) {
    return { angles: [], velocities: [], accelerations: [], rom: [], signal: [], fps: 30 };
  }

  const exerciseSignal = getExerciseSignal(exerciseName);
  if (!exerciseSignal) {
    return { angles: [], velocities: [], accelerations: [], rom: [], signal: [], fps: 30 };
  }

  const fps = 30; // Normalized from Layer 1

  // Step 1: Extract per-frame joint angles
  const allAngles = frames.map(f => extractJointAngles(f.landmarks));

  // Step 2: Extract the exercise-specific tracking signal
  const rawSignal = allAngles.map(a => {
    if (!a) return null;
    return exerciseSignal.getValue(a);
  });

  // Step 3: Interpolate nulls
  const interpolated = interpolateNulls(rawSignal);

  // Step 4: Apply Butterworth low-pass filter (6Hz cutoff at 30fps)
  const smoothed = butterworthFilter(interpolated, 6, fps);

  // Step 5: Compute angular velocity (deg/s)
  const dt = 1 / fps;
  const velocities = new Array(smoothed.length).fill(0);
  for (let i = 1; i < smoothed.length; i++) {
    velocities[i] = (smoothed[i] - smoothed[i - 1]) / dt;
  }

  // Step 6: Compute angular acceleration (deg/s^2)
  const accelerations = new Array(smoothed.length).fill(0);
  for (let i = 1; i < velocities.length; i++) {
    accelerations[i] = (velocities[i] - velocities[i - 1]) / dt;
  }

  // Step 7: Compute running range of motion
  const rom = new Array(smoothed.length).fill(0);
  let runningMin = Infinity;
  let runningMax = -Infinity;
  for (let i = 0; i < smoothed.length; i++) {
    if (smoothed[i] < runningMin) runningMin = smoothed[i];
    if (smoothed[i] > runningMax) runningMax = smoothed[i];
    rom[i] = runningMax - runningMin;
  }

  return {
    angles: allAngles,
    signal: smoothed,
    rawSignal: interpolated,
    velocities,
    accelerations,
    rom,
    fps,
    exerciseConfig: exerciseSignal,
  };
}

// ============================================================================
// Null interpolation (pure function)
// ============================================================================

/**
 * Linearly interpolate null values in a signal array.
 * @param {Array<number|null>} signal
 * @returns {number[]}
 */
function interpolateNulls(signal) {
  const result = signal.slice();

  // Find first non-null
  let firstValid = -1;
  for (let i = 0; i < result.length; i++) {
    if (result[i] != null) { firstValid = i; break; }
  }
  if (firstValid === -1) return result.map(() => 0);

  // Fill leading nulls
  for (let i = 0; i < firstValid; i++) result[i] = result[firstValid];

  // Fill trailing nulls
  let lastValid = firstValid;
  for (let i = firstValid + 1; i < result.length; i++) {
    if (result[i] != null) lastValid = i;
  }
  for (let i = lastValid + 1; i < result.length; i++) result[i] = result[lastValid];

  // Interpolate interior nulls
  let gapStart = -1;
  for (let i = 0; i < result.length; i++) {
    if (result[i] == null) {
      if (gapStart === -1) gapStart = i;
    } else {
      if (gapStart !== -1) {
        const startVal = result[gapStart - 1];
        const endVal = result[i];
        const gapLen = i - gapStart;
        for (let j = 0; j < gapLen; j++) {
          result[gapStart + j] = startVal + (endVal - startVal) * ((j + 1) / (gapLen + 1));
        }
        gapStart = -1;
      }
    }
  }

  return result;
}
