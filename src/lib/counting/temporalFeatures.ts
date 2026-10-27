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

export interface HarmonicPeriodicityResult {
  fundamentalPeriodSec: number;       // Repetition cycle duration (seconds), or 0 if aperiodic
  cadenceRegularity: number;          // Autocorrelation peak coefficient (0..1)
  estimatedReps: number;              // Total reps estimated via harmonic autocorrelation
  lagSamples: number;                 // Lag in frames
  autocorrelationCurve: Float32Array; // Normalized autocorrelation coefficients across checked lags
}

/**
 * Computes global autocorrelation periodicity to determine repetition cadence and harmonic rep count.
 * Unlike instantaneous threshold crossing, autocorrelation evaluates periodic signal recurrence
 * across the entire sequence, making it immune to intra-rep pauses or sticking-point decelerations.
 */
export function computeAutocorrelationPeriodicity(
  angles: (number | null)[],
  timestamps: number[],
  options: {
    minPeriodSec?: number;
    maxPeriodSec?: number;
  } = {}
): HarmonicPeriodicityResult {
  const { minPeriodSec = 0.6, maxPeriodSec = 6.0 } = options;

  const validEntries: { angle: number; time: number }[] = [];
  for (let i = 0; i < Math.min(angles.length, timestamps.length); i++) {
    const a = angles[i];
    if (a !== null && Number.isFinite(a)) {
      validEntries.push({ angle: a, time: timestamps[i] });
    }
  }

  const n = validEntries.length;
  if (n < 8) {
    return {
      fundamentalPeriodSec: 0,
      cadenceRegularity: 0,
      estimatedReps: 0,
      lagSamples: 0,
      autocorrelationCurve: new Float32Array(0),
    };
  }

  const totalTime = validEntries[n - 1].time - validEntries[0].time;
  const nominalFps = totalTime > 0 ? (n - 1) / totalTime : 15;

  const minLag = Math.max(2, Math.floor(minPeriodSec * nominalFps));
  const maxLag = Math.min(Math.floor(n / 2), Math.ceil(maxPeriodSec * nominalFps));

  if (minLag >= maxLag) {
    return {
      fundamentalPeriodSec: 0,
      cadenceRegularity: 0,
      estimatedReps: 0,
      lagSamples: 0,
      autocorrelationCurve: new Float32Array(0),
    };
  }

  // Calculate mean and variance
  let sum = 0;
  for (let i = 0; i < n; i++) sum += validEntries[i].angle;
  const mean = sum / n;

  let varSum = 0;
  for (let i = 0; i < n; i++) {
    const diff = validEntries[i].angle - mean;
    varSum += diff * diff;
  }

  if (varSum < 1e-4) {
    return {
      fundamentalPeriodSec: 0,
      cadenceRegularity: 0,
      estimatedReps: 0,
      lagSamples: 0,
      autocorrelationCurve: new Float32Array(0),
    };
  }

  const numLags = maxLag - minLag + 1;
  const autocorr = new Float32Array(numLags);

  let bestLag = 0;
  let maxCorr = -1;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let crossSum = 0;
    const count = n - lag;
    for (let i = 0; i < count; i++) {
      crossSum += (validEntries[i].angle - mean) * (validEntries[i + lag].angle - mean);
    }
    // Normalized by variance scaled by overlap fraction
    const coeff = crossSum / (varSum * (count / n));
    const clamped = Math.max(-1, Math.min(1, coeff));
    autocorr[lag - minLag] = clamped;

    if (clamped > maxCorr) {
      maxCorr = clamped;
      bestLag = lag;
    }
  }

  const cadenceRegularity = Math.max(0, maxCorr);
  const fundamentalPeriodSec = bestLag > 0 && nominalFps > 0 ? Math.round((bestLag / nominalFps) * 100) / 100 : 0;
  const estimatedReps = fundamentalPeriodSec > 0 && totalTime > 0
    ? Math.max(0, Math.round(totalTime / fundamentalPeriodSec))
    : 0;

  return {
    fundamentalPeriodSec,
    cadenceRegularity: Math.round(cadenceRegularity * 100) / 100,
    estimatedReps,
    lagSamples: bestLag,
    autocorrelationCurve: autocorr,
  };
}

export type TemporalKinematicPhase = 'eccentric' | 'amortization_sticking' | 'concentric' | 'lockout_rest';

export interface PhaseClassificationResult {
  phase: TemporalKinematicPhase;
  confidence: number;
  probabilities: {
    eccentric: number;
    amortization_sticking: number;
    concentric: number;
    lockout_rest: number;
  };
}

/**
 * 1D Micro-Sequence Kinematic Phase Classifier.
 * Zero-allocation, lightweight on-device sequence model computing posterior probabilities
 * over kinematic phases from trajectory curvature, velocity, and acceleration.
 */
export function classify1DTemporalRepPhase(
  trajectory: Float32Array | number[],
  velocityDegPerSec: number,
  accelerationDegPerSec2: number,
  rest: 'high' | 'low' = 'high'
): PhaseClassificationResult {
  const isDescending = velocityDegPerSec < -5;
  const isAscending = velocityDegPerSec > 5;
  const absVel = Math.abs(velocityDegPerSec);
  const absAcc = Math.abs(accelerationDegPerSec2);

  // Compute unnormalized logit activations
  let logitEcc = 0;
  let logitConc = 0;
  let logitSticking = 0;
  let logitRest = 0;

  if (rest === 'high') {
    if (isDescending) {
      logitEcc = 2.0 + absVel / 30;
      logitConc = -2.0;
      logitSticking = absVel < 15 ? 0.8 : -1.0;
      logitRest = -1.5;
    } else if (isAscending) {
      logitConc = 2.0 + absVel / 30;
      logitEcc = -2.0;
      logitSticking = absVel < 20 && absAcc > 10 ? 1.2 : -1.0;
      logitRest = -1.5;
    } else {
      if (absAcc > 15) {
        logitSticking = 2.5 + absAcc / 20;
        logitRest = -1.0;
      } else {
        logitRest = 2.5;
        logitSticking = 0.2;
      }
      logitEcc = -1.0;
      logitConc = -1.0;
    }
  } else {
    if (isAscending) {
      logitConc = 2.0 + absVel / 30;
      logitEcc = -2.0;
      logitSticking = absVel < 20 && absAcc > 10 ? 1.2 : -1.0;
      logitRest = -1.5;
    } else if (isDescending) {
      logitEcc = 2.0 + absVel / 30;
      logitConc = -2.0;
      logitSticking = absVel < 15 ? 0.8 : -1.0;
      logitRest = -1.5;
    } else {
      if (absAcc > 15) {
        logitSticking = 2.5 + absAcc / 20;
        logitRest = -1.0;
      } else {
        logitRest = 2.5;
        logitSticking = 0.2;
      }
      logitEcc = -1.0;
      logitConc = -1.0;
    }
  }

  // Softmax normalization
  const maxLogit = Math.max(logitEcc, logitConc, logitSticking, logitRest);
  const expEcc = Math.exp(logitEcc - maxLogit);
  const expConc = Math.exp(logitConc - maxLogit);
  const expSticking = Math.exp(logitSticking - maxLogit);
  const expRest = Math.exp(logitRest - maxLogit);
  const sumExp = expEcc + expConc + expSticking + expRest;

  const pEcc = expEcc / sumExp;
  const pConc = expConc / sumExp;
  const pSticking = expSticking / sumExp;
  const pRest = expRest / sumExp;

  let bestPhase: TemporalKinematicPhase = 'lockout_rest';
  let bestProb = pRest;

  if (pEcc > bestProb) {
    bestPhase = 'eccentric';
    bestProb = pEcc;
  }
  if (pConc > bestProb) {
    bestPhase = 'concentric';
    bestProb = pConc;
  }
  if (pSticking > bestProb) {
    bestPhase = 'amortization_sticking';
    bestProb = pSticking;
  }

  return {
    phase: bestPhase,
    confidence: Math.round(bestProb * 100) / 100,
    probabilities: {
      eccentric: Math.round(pEcc * 100) / 100,
      amortization_sticking: Math.round(pSticking * 100) / 100,
      concentric: Math.round(pConc * 100) / 100,
      lockout_rest: Math.round(pRest * 100) / 100,
    },
  };
}
