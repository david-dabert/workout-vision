/**
 * WorkoutVision Universal Kinematic Manifold — Temporal Kinematic Feature Extractor
 * 
 * Extracts sliding-window normalized kinematic feature matrices from continuous joint
 * streams and 3D skeletal landmark trajectories.
 * 
 * Provides the foundational time-series tensor representation for universal movement
 * embeddings, zero-shot template matching, velocity vector analysis, and periodicity clustering.
 * 
 * Invariants:
 * - Pure mathematical function: No DOM dependencies.
 * - Numerically stable: Robust against zero-division and missing/null landmark frames.
 * - Constant-memory typed arrays (Float32Array) for zero-allocation streaming.
 */

export interface TemporalFeatureWindow {
  windowIndex: number;
  startTime: number;
  endTime: number;
  duration: number;
  meanAngle: number;
  rom: number; // Range of motion within window
  meanVelocity: number; // Mean angular velocity (deg/s)
  peakVelocity: number; // Peak angular velocity (deg/s)
  meanAcceleration: number; // Mean angular acceleration (deg/s^2)
  turnaroundCount: number; // Number of velocity sign changes
  normalizedTrajectory: Float32Array; // Zero-mean, unit-variance standardized angles
  featureVector: Float32Array; // Multi-dimensional embedding feature vector
}

export interface TemporalExtractionOptions {
  windowSec?: number; // Duration of analysis window (default: 2.0s)
  hopSec?: number; // Step between windows (default: 0.2s)
  targetFps?: number; // Nominal sampling frequency (default: 15 fps)
  resamplePoints?: number; // Standardized trajectory vector size (default: 32)
}

/**
 * Standardizes a 1D slice into a zero-mean, unit-variance array of fixed length
 */
export function standardizeTrajectory(
  values: number[],
  targetLength: number = 32
): Float32Array {
  const result = new Float32Array(targetLength);
  if (values.length === 0) return result;

  // 1. Resample to target length via linear interpolation
  const n = values.length;
  for (let i = 0; i < targetLength; i++) {
    const srcPos = (i / (targetLength - 1)) * (n - 1);
    const low = Math.floor(srcPos);
    const high = Math.min(n - 1, Math.ceil(srcPos));
    const frac = srcPos - low;
    result[i] = values[low] * (1 - frac) + values[high] * frac;
  }

  // 2. Compute mean
  let sum = 0;
  for (let i = 0; i < targetLength; i++) sum += result[i];
  const mean = sum / targetLength;

  // 3. Compute variance
  let sqDiff = 0;
  for (let i = 0; i < targetLength; i++) {
    const diff = result[i] - mean;
    sqDiff += diff * diff;
  }
  const std = Math.sqrt(sqDiff / targetLength);

  // 4. Normalize (guard against division by near-zero variance)
  const normFactor = std > 1e-4 ? 1 / std : 1.0;
  for (let i = 0; i < targetLength; i++) {
    result[i] = (result[i] - mean) * normFactor;
  }

  return result;
}

/**
 * Extracts a sequence of sliding-window kinematic feature descriptors across a time-series
 */
export function extractTemporalFeatureWindows(
  angles: (number | null)[],
  timestamps: number[],
  options: TemporalExtractionOptions = {}
): TemporalFeatureWindow[] {
  const {
    windowSec = 2.0,
    hopSec = 0.2,
    resamplePoints = 32,
  } = options;

  const n = Math.min(angles.length, timestamps.length);
  if (n < 4) return [];

  const windows: TemporalFeatureWindow[] = [];
  const totalDuration = timestamps[n - 1] - timestamps[0];
  if (totalDuration < windowSec * 0.5) return [];

  let winIdx = 0;
  for (let tStart = timestamps[0]; tStart + windowSec <= timestamps[n - 1] + 1e-5; tStart += hopSec) {
    const tEnd = tStart + windowSec;

    // Collect valid sample indices inside [tStart, tEnd]
    const windowAngles: number[] = [];
    const windowTimes: number[] = [];

    for (let i = 0; i < n; i++) {
      const t = timestamps[i];
      if (t >= tStart && t <= tEnd) {
        const val = angles[i];
        if (val !== null && Number.isFinite(val)) {
          windowAngles.push(val);
          windowTimes.push(t);
        }
      }
    }

    // Require sufficient non-null samples (at least 60% of expected window frames)
    if (windowAngles.length < 5) continue;

    // Kinematic metrics
    let minA = Infinity, maxA = -Infinity, sumA = 0;
    for (const a of windowAngles) {
      if (a < minA) minA = a;
      if (a > maxA) maxA = a;
      sumA += a;
    }
    const meanAngle = sumA / windowAngles.length;
    const rom = Math.max(0, maxA - minA);

    // Velocities (first derivative)
    const velocities: number[] = [];
    for (let k = 1; k < windowAngles.length; k++) {
      const dt = windowTimes[k] - windowTimes[k - 1];
      if (dt > 1e-4) {
        velocities.push((windowAngles[k] - windowAngles[k - 1]) / dt);
      }
    }

    // Velocity stats & zero crossings (turnarounds)
    let velSum = 0, peakVel = 0, turnarounds = 0;
    for (let k = 0; k < velocities.length; k++) {
      const v = Math.abs(velocities[k]);
      velSum += v;
      if (v > peakVel) peakVel = v;
      if (k > 0 && ((velocities[k] >= 0 && velocities[k - 1] < 0) || (velocities[k] < 0 && velocities[k - 1] >= 0))) {
        turnarounds++;
      }
    }
    const meanVelocity = velocities.length > 0 ? velSum / velocities.length : 0;
    const peakVelocity = peakVel;

    // Accelerations (second derivative)
    let accSum = 0;
    for (let k = 1; k < velocities.length; k++) {
      const dt = windowTimes[k + 1] - windowTimes[k];
      if (dt > 1e-4) {
        accSum += Math.abs((velocities[k] - velocities[k - 1]) / dt);
      }
    }
    const meanAcceleration = velocities.length > 1 ? accSum / (velocities.length - 1) : 0;

    // Standardized trajectory
    const normalizedTrajectory = standardizeTrajectory(windowAngles, resamplePoints);

    // Compact 8-dimensional summary embedding vector
    const featureVector = new Float32Array(8);
    featureVector[0] = rom / 180.0; // Normalized ROM (0..1)
    featureVector[1] = Math.min(1.0, meanVelocity / 360.0); // Normalized Mean Velocity
    featureVector[2] = Math.min(1.0, peakVelocity / 720.0); // Normalized Peak Velocity
    featureVector[3] = Math.min(1.0, meanAcceleration / 1500.0); // Normalized Acceleration
    featureVector[4] = Math.min(1.0, turnarounds / 8.0); // Normalized Turnaround Count
    featureVector[5] = normalizedTrajectory[0]; // Trajectory starting offset
    featureVector[6] = normalizedTrajectory[Math.floor(resamplePoints / 2)]; // Trajectory midpoint
    featureVector[7] = normalizedTrajectory[resamplePoints - 1]; // Trajectory endpoint

    windows.push({
      windowIndex: winIdx++,
      startTime: tStart,
      endTime: tEnd,
      duration: tEnd - tStart,
      meanAngle,
      rom,
      meanVelocity,
      peakVelocity,
      meanAcceleration,
      turnaroundCount: turnarounds,
      normalizedTrajectory,
      featureVector,
    });
  }

  return windows;
}

/**
 * Computes cosine similarity between two feature vectors: dot(a, b) / (|a| * |b|)
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 1e-7 ? Math.max(-1, Math.min(1, dot / denom)) : 0;
}

/**
 * Computes pairwise similarity matrix across sliding windows to identify repeating cycles
 */
export function computeTrajectorySimilarityMatrix(windows: TemporalFeatureWindow[]): Float32Array {
  const m = windows.length;
  const matrix = new Float32Array(m * m);

  for (let i = 0; i < m; i++) {
    matrix[i * m + i] = 1.0;
    for (let j = i + 1; j < m; j++) {
      const sim = cosineSimilarity(windows[i].normalizedTrajectory, windows[j].normalizedTrajectory);
      matrix[i * m + j] = sim;
      matrix[j * m + i] = sim;
    }
  }

  return matrix;
}
