/**
 * Universal Kinetic Recurrence Segmenter — Self-Similarity Matrix & Poincaré Phase Decomposition.
 *
 * Decomposes arbitrary continuous multi-joint 3D kinematic landmark streams into discrete
 * repetitions and canonical phase envelopes without requiring prior exercise-specific
 * threshold calibration or manual exercise labeling.
 *
 * Mathematical Foundations:
 * 1. Kinetic Power Gating:
 *    P_k(t) = \sum_{j} m_j ||v_j(t)||^2
 *    Isolates active resistance exercise sets from stationary resting, setup, and camera handling
 *    using Winter/Dempster anthropometric segment mass proportions.
 *
 * 2. Continuous State-Space Self-Similarity Matrix (SSM):
 *    S(t_1, t_2) = \exp( - ||q(t_1) - q(t_2)||^2 / (2 \sigma^2) )
 *    Produces periodic diagonal recurrence bands invariant to non-linear velocity fluctuations.
 *
 * 3. Dominant Recurrence Period Estimation:
 *    R(L) = \frac{1}{N - L} \sum_{i=1}^{N - L} S(i, i + L)
 *    Identifies the fundamental movement frequency prior in the physiological range [0.5s, 8.0s].
 *
 * 4. Poincaré Section Zero-Crossing & Turnaround Extraction:
 *    Decomposes continuous limit cycles into discrete repetition bounds [t_start, t_peak, t_end]
 *    with sub-frame quadratic vertex interpolation.
 *
 * 5. Canonical Phase Envelope Synthesis:
 *    Maps segmented repetitions to phase tau in [0, 1] to produce mean reference trajectories
 *    q_bar(tau) and tolerance variance envelopes sigma(tau) for clinical kinesiotherapy.
 */

import { WorldLandmark, WorldLandmarkFrame } from './core';

// Anthropometric mass weights (Dempster 1955, Winter 2009) for biomechanical energy calculation.
// MediaPipe landmarks:
// 11, 12: shoulders; 13, 14: elbows; 15, 16: wrists;
// 23, 24: hips; 25, 26: knees; 27, 28: ankles.
const ANTHROPOMETRIC_WEIGHTS: Record<number, number> = {
  11: 0.14, // Torso / shoulders
  12: 0.14,
  13: 0.05, // Forearms & arms
  14: 0.05,
  15: 0.03, // Hands
  16: 0.03,
  23: 0.20, // Pelvis & thighs
  24: 0.20,
  25: 0.07, // Shanks & calves
  26: 0.07,
  27: 0.02, // Feet
  28: 0.02,
};

export interface SegmentedRepetition {
  repIndex: number;
  startTime: number;
  peakTime: number;
  endTime: number;
  durationSec: number;
  amplitude: number;
  trajectory: number[]; // primary normalized excursion across this rep
}

export interface CanonicalPhaseEnvelope {
  tau: number[];          // Phase points [0.0, ..., 1.0]
  meanTrajectory: number[]; // Average excursion
  stdTrajectory: number[];  // Spatial tolerance band
  peakPhaseTau: number;     // Normalized turnaround phase
}

export interface RecurrenceSegmentationResult {
  activeBout: { startTime: number; endTime: number };
  estimatedPeriodSec: number;
  reps: SegmentedRepetition[];
  canonicalEnvelope: CanonicalPhaseEnvelope | null;
  similarityMatrix?: number[][]; // For visual introspection if needed
}

/**
 * 3D vector arithmetic utilities.
 */
function distance3D(a: WorldLandmark, b: WorldLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function angle3D(a: WorldLandmark, b: WorldLandmark, c: WorldLandmark): number {
  const v1x = a.x - b.x, v1y = a.y - b.y, v1z = a.z - b.z;
  const v2x = c.x - b.x, v2y = c.y - b.y, v2z = c.z - b.z;
  const d1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
  const d2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);
  if (d1 < 1e-6 || d2 < 1e-6) return 0;
  const dot = (v1x * v2x + v1y * v2y + v1z * v2z) / (d1 * d2);
  const clamped = Math.max(-1, Math.min(1, dot));
  return (Math.acos(clamped) * 180) / Math.PI;
}

/**
 * Computes instantaneous whole-body kinetic power across time frames.
 */
export function computeKineticPower(
  frames: WorldLandmarkFrame[],
  timestamps: number[]
): number[] {
  const n = frames.length;
  const power = new Float64Array(n);

  for (let i = 1; i < n - 1; i++) {
    const prev = frames[i - 1];
    const next = frames[i + 1];
    if (!prev || !next) continue;

    const dt = timestamps[i + 1] - timestamps[i - 1];
    if (dt <= 1e-4) continue;

    let frameEnergy = 0;
    for (const [idxStr, mass] of Object.entries(ANTHROPOMETRIC_WEIGHTS)) {
      const idx = Number(idxStr);
      const p0 = prev[idx];
      const p1 = next[idx];
      if (!p0 || !p1) continue;
      if ((p0.visibility ?? 1) < 0.4 || (p1.visibility ?? 1) < 0.4) continue;

      const vx = (p1.x - p0.x) / dt;
      const vy = (p1.y - p0.y) / dt;
      const vz = (p1.z - p0.z) / dt;
      const vSq = vx * vx + vy * vy + vz * vz;
      frameEnergy += mass * vSq;
    }
    power[i] = frameEnergy;
  }
  if (n > 1) {
    power[0] = power[1];
    power[n - 1] = power[n - 2];
  }
  return Array.from(power);
}

/**
 * Identifies active exercise set bounds [start, end] based on kinetic energy profile.
 */
export function detectActiveBout(
  power: number[],
  timestamps: number[],
  minActiveDurationSec = 3.0
): { startTime: number; endTime: number; startIndex: number; endIndex: number } {
  const n = power.length;
  if (n === 0) return { startTime: 0, endTime: 0, startIndex: 0, endIndex: 0 };

  // Calculate baseline noise floor (p10) vs motion power (p90)
  const sorted = [...power].sort((a, b) => a - b);
  const p10 = sorted[Math.floor(sorted.length * 0.10)] || 0;
  const p90 = sorted[Math.floor(sorted.length * 0.90)] || 0.05;
  const threshold = Math.max(0.002, p10 + 0.10 * (p90 - p10));

  // Find continuous moving window
  let firstActive = 0;
  let lastActive = n - 1;

  for (let i = 0; i < n; i++) {
    if (power[i] > threshold) {
      firstActive = Math.max(0, i - 4);
      break;
    }
  }

  for (let i = n - 1; i >= 0; i--) {
    if (power[i] > threshold) {
      lastActive = Math.min(n - 1, i + 4);
      break;
    }
  }

  const duration = timestamps[lastActive] - timestamps[firstActive];
  if (duration < minActiveDurationSec) {
    return {
      startTime: timestamps[0],
      endTime: timestamps[n - 1],
      startIndex: 0,
      endIndex: n - 1,
    };
  }

  return {
    startTime: timestamps[firstActive],
    endTime: timestamps[lastActive],
    startIndex: firstActive,
    endIndex: lastActive,
  };
}

/**
 * Normalizes multi-joint kinematic posture vector q(t) to be scale- and translation-invariant.
 */
export function extractNormalizedPosture(frame: WorldLandmark[]): number[] {
  // Center at hip midpoint (landmarks 23 and 24)
  const lHip = frame[23];
  const rHip = frame[24];
  const lShoulder = frame[11];
  const rShoulder = frame[12];

  const midHipX = (lHip.x + rHip.x) * 0.5;
  const midHipY = (lHip.y + rHip.y) * 0.5;
  const midHipZ = (lHip.z + rHip.z) * 0.5;

  const midShoulderX = (lShoulder.x + rShoulder.x) * 0.5;
  const midShoulderY = (lShoulder.y + rShoulder.y) * 0.5;
  const midShoulderZ = (lShoulder.z + rShoulder.z) * 0.5;

  const torsoLen = Math.sqrt(
    Math.pow(midShoulderX - midHipX, 2) +
    Math.pow(midShoulderY - midHipY, 2) +
    Math.pow(midShoulderZ - midHipZ, 2)
  ) || 1.0;

  // Active keypoint indices to track
  const joints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  const q: number[] = [];

  for (const j of joints) {
    const p = frame[j];
    q.push((p.x - midHipX) / torsoLen);
    q.push((p.y - midHipY) / torsoLen);
    q.push((p.z - midHipZ) / torsoLen);
  }

  // Add 3D anatomical joint angles (invariant to 3D camera rotation)
  q.push(angle3D(frame[11], frame[13], frame[15]) / 180); // L elbow
  q.push(angle3D(frame[12], frame[14], frame[16]) / 180); // R elbow
  q.push(angle3D(frame[23], frame[25], frame[27]) / 180); // L knee
  q.push(angle3D(frame[24], frame[26], frame[28]) / 180); // R knee
  q.push(angle3D(frame[11], frame[23], frame[25]) / 180); // L hip
  q.push(angle3D(frame[12], frame[24], frame[26]) / 180); // R hip

  return q;
}

/**
 * Builds the Self-Similarity Matrix (SSM) over a sequence of posture vectors.
 */
export function buildSelfSimilarityMatrix(postures: number[][]): number[][] {
  const m = postures.length;
  const dist = Array.from({ length: m }, () => new Float64Array(m));
  let sumDist = 0;
  let count = 0;

  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) {
      let dSq = 0;
      const pi = postures[i];
      const pj = postures[j];
      for (let k = 0; k < pi.length; k++) {
        const diff = pi[k] - pj[k];
        dSq += diff * diff;
      }
      const d = Math.sqrt(dSq);
      dist[i][j] = d;
      dist[j][i] = d;
      sumDist += d;
      count++;
    }
  }

  const meanDist = count > 0 ? sumDist / count : 1.0;
  const sigma = Math.max(1e-3, meanDist * 0.5);
  const twoSigmaSq = 2 * sigma * sigma;

  const ssm: number[][] = [];
  for (let i = 0; i < m; i++) {
    const row: number[] = new Array(m);
    for (let j = 0; j < m; j++) {
      row[j] = Math.exp(-(dist[i][j] * dist[i][j]) / twoSigmaSq);
    }
    ssm.push(row);
  }
  return ssm;
}

/**
 * Computes the time-lagged diagonal recurrence profile and identifies dominant period T.
 */
export function estimateDominantPeriod(
  ssm: number[][],
  timestamps: number[],
  minPeriodSec = 0.6,
  maxPeriodSec = 8.0
): number {
  const m = ssm.length;
  if (m < 4) return 2.0;

  const avgSampleRate = (timestamps[m - 1] - timestamps[0]) / (m - 1);
  const minLag = Math.max(1, Math.round(minPeriodSec / avgSampleRate));
  const maxLag = Math.min(m - 1, Math.round(maxPeriodSec / avgSampleRate));

  let bestLag = minLag;
  let maxRecurrence = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    const nTerms = m - lag;
    for (let i = 0; i < nTerms; i++) {
      sum += ssm[i][i + lag];
    }
    const score = sum / nTerms;

    // Favor prominent local peak
    if (score > maxRecurrence) {
      maxRecurrence = score;
      bestLag = lag;
    }
  }

  return bestLag * avgSampleRate;
}

/**
 * Segments repetitions using Poincaré phase crossings along dominant motion projection.
 */
export function segmentRepetitionsFromPosture(
  postures: number[][],
  timestamps: number[],
  periodSec: number
): SegmentedRepetition[] {
  const m = postures.length;
  if (m < 5) return [];

  // Project multi-dimensional posture to 1D via 1st principal component
  const dim = postures[0].length;
  const mean = new Float64Array(dim);
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < dim; k++) mean[k] += postures[i][k];
  }
  for (let k = 0; k < dim; k++) mean[k] /= m;

  // Power iteration for 1st eigenvector
  let v = new Float64Array(dim).fill(1 / Math.sqrt(dim));
  for (let iter = 0; iter < 10; iter++) {
    const nextV = new Float64Array(dim);
    for (let i = 0; i < m; i++) {
      let dot = 0;
      for (let k = 0; k < dim; k++) dot += (postures[i][k] - mean[k]) * v[k];
      for (let k = 0; k < dim; k++) nextV[k] += (postures[i][k] - mean[k]) * dot;
    }
    let norm = 0;
    for (let k = 0; k < dim; k++) norm += nextV[k] * nextV[k];
    norm = Math.sqrt(norm) || 1e-6;
    for (let k = 0; k < dim; k++) v[k] = nextV[k] / norm;
  }

  // 1D trajectory
  const s = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < dim; k++) s[i] += (postures[i][k] - mean[k]) * v[k];
  }

  // Smooth the 1D projection with 5-point moving average to remove high-frequency landmark jitter
  const sSmooth = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    let sum = 0;
    let cnt = 0;
    for (let k = -2; k <= 2; k++) {
      const idx = i + k;
      if (idx >= 0 && idx < m) {
        sum += s[idx];
        cnt++;
      }
    }
    sSmooth[i] = sum / cnt;
  }

  // Calculate signal amplitude range and threshold
  let minS = Infinity, maxS = -Infinity;
  for (let i = 0; i < m; i++) {
    if (sSmooth[i] < minS) minS = sSmooth[i];
    if (sSmooth[i] > maxS) maxS = sSmooth[i];
  }
  const sRange = maxS - minS || 1.0;
  const minProminence = sRange * 0.25;

  const avgSampleRate = (timestamps[m - 1] - timestamps[0]) / (m - 1);
  const minPeakDistFrames = Math.max(3, Math.round((periodSec * 0.5) / avgSampleRate));

  // Find candidate peaks and candidate valleys
  interface ExtremaPoint {
    index: number;
    time: number;
    val: number;
  }

  const rawPeaks: ExtremaPoint[] = [];
  const rawValleys: ExtremaPoint[] = [];

  for (let i = 1; i < m - 1; i++) {
    if (sSmooth[i] > sSmooth[i - 1] && sSmooth[i] >= sSmooth[i + 1]) {
      // Sub-frame quadratic vertex interpolation
      const y0 = sSmooth[i - 1], y1 = sSmooth[i], y2 = sSmooth[i + 1];
      const a = 0.5 * (y0 - 2 * y1 + y2);
      const b = 0.5 * (y2 - y0);
      const dt = a !== 0 ? -b / (2 * a) : 0;
      const tPeak = timestamps[i] + dt * (timestamps[i] - timestamps[i - 1]);
      rawPeaks.push({ index: i, time: tPeak, val: y1 });
    } else if (sSmooth[i] < sSmooth[i - 1] && sSmooth[i] <= sSmooth[i + 1]) {
      const y0 = sSmooth[i - 1], y1 = sSmooth[i], y2 = sSmooth[i + 1];
      const a = 0.5 * (y0 - 2 * y1 + y2);
      const b = 0.5 * (y2 - y0);
      const dt = a !== 0 ? -b / (2 * a) : 0;
      const tValley = timestamps[i] + dt * (timestamps[i] - timestamps[i - 1]);
      rawValleys.push({ index: i, time: tValley, val: y1 });
    }
  }

  // Determine whether excursion peaks upwards (e.g. positive displacement) or downwards
  // by comparing prominence of rawPeaks vs rawValleys
  const filterPeaksWithDistance = (candidates: ExtremaPoint[], isMax: boolean): ExtremaPoint[] => {
    // Sort by prominence (distance from opposite median)
    const sorted = [...candidates].sort((a, b) => (isMax ? b.val - a.val : a.val - b.val));
    const kept: ExtremaPoint[] = [];

    for (const cand of sorted) {
      const tooClose = kept.some(k => Math.abs(k.index - cand.index) < minPeakDistFrames);
      if (!tooClose) {
        kept.push(cand);
      }
    }
    // Re-sort chronologically
    return kept.sort((a, b) => a.time - b.time);
  };

  const filteredPeaks = filterPeaksWithDistance(rawPeaks, true);
  const filteredValleys = filterPeaksWithDistance(rawValleys, false);

  // Choose the extrema type with higher dynamic variance as the turning point
  const peakVariance = filteredPeaks.length >= 2 ? filteredPeaks.reduce((acc, p) => acc + Math.abs(p.val - minS), 0) : 0;
  const valleyVariance = filteredValleys.length >= 2 ? filteredValleys.reduce((acc, v) => acc + Math.abs(maxS - v.val), 0) : 0;
  const isPeakTurningPoint = peakVariance >= valleyVariance;
  const turningPoints = isPeakTurningPoint ? filteredPeaks : filteredValleys;

  const reps: SegmentedRepetition[] = [];

  for (let k = 0; k < turningPoints.length; k++) {
    const tp = turningPoints[k];

    // If turning point is a peak, baseline troughs are minima.
    // If turning point is a valley, baseline troughs are maxima.
    const startIdx = k > 0 ? turningPoints[k - 1].index : 0;
    const endIdx = k < turningPoints.length - 1 ? turningPoints[k + 1].index : m - 1;

    let baseStartVal = isPeakTurningPoint ? Infinity : -Infinity;
    let bestStartIdx = startIdx;
    for (let i = startIdx; i <= tp.index; i++) {
      if (isPeakTurningPoint ? sSmooth[i] < baseStartVal : sSmooth[i] > baseStartVal) {
        baseStartVal = sSmooth[i];
        bestStartIdx = i;
      }
    }

    let baseEndVal = isPeakTurningPoint ? Infinity : -Infinity;
    let bestEndIdx = endIdx;
    for (let i = tp.index; i <= endIdx; i++) {
      if (isPeakTurningPoint ? sSmooth[i] < baseEndVal : sSmooth[i] > baseEndVal) {
        baseEndVal = sSmooth[i];
        bestEndIdx = i;
      }
    }

    const startTime = timestamps[bestStartIdx];
    const endTime = timestamps[bestEndIdx];
    const duration = endTime - startTime;

    if (duration < 0.4 || duration > 10.0) continue;

    const amp = Math.abs(tp.val - 0.5 * (baseStartVal + baseEndVal));
    if (amp < minProminence * 0.4) continue;

    const traj: number[] = [];
    for (let idx = bestStartIdx; idx <= bestEndIdx; idx++) traj.push(sSmooth[idx]);

    reps.push({
      repIndex: reps.length + 1,
      startTime,
      peakTime: tp.time,
      endTime,
      durationSec: duration,
      amplitude: amp,
      trajectory: traj,
    });
  }

  return reps;
}

/**
 * Builds canonical phase envelope q_bar(tau) and sigma(tau) from segmented reps.
 */
export function buildCanonicalPhaseEnvelope(
  reps: SegmentedRepetition[],
  numPhasePoints = 50
): CanonicalPhaseEnvelope | null {
  if (reps.length === 0) return null;

  const tauPoints: number[] = [];
  for (let i = 0; i < numPhasePoints; i++) {
    tauPoints.push(i / (numPhasePoints - 1));
  }

  const resampledReps: number[][] = [];
  const peakPhases: number[] = [];

  for (const rep of reps) {
    const raw = rep.trajectory;
    if (raw.length < 2) continue;

    const resampled: number[] = [];
    const minVal = Math.min(...raw);
    const maxVal = Math.max(...raw);
    const range = maxVal - minVal || 1.0;

    for (let p = 0; p < numPhasePoints; p++) {
      const targetRatio = p / (numPhasePoints - 1);
      const rawIdx = targetRatio * (raw.length - 1);
      const low = Math.floor(rawIdx);
      const high = Math.min(raw.length - 1, Math.ceil(rawIdx));
      const frac = rawIdx - low;
      const interp = (1 - frac) * raw[low] + frac * raw[high];
      resampled.push((interp - minVal) / range);
    }
    resampledReps.push(resampled);

    const normPeak = (rep.peakTime - rep.startTime) / rep.durationSec;
    peakPhases.push(normPeak);
  }

  if (resampledReps.length === 0) return null;

  const meanTrajectory: number[] = [];
  const stdTrajectory: number[] = [];

  for (let p = 0; p < numPhasePoints; p++) {
    let sum = 0;
    for (const r of resampledReps) sum += r[p];
    const mean = sum / resampledReps.length;
    meanTrajectory.push(mean);

    let varSum = 0;
    for (const r of resampledReps) varSum += Math.pow(r[p] - mean, 2);
    const std = Math.sqrt(varSum / resampledReps.length);
    stdTrajectory.push(std);
  }

  const avgPeakPhase = peakPhases.reduce((a, b) => a + b, 0) / peakPhases.length;

  return {
    tau: tauPoints,
    meanTrajectory,
    stdTrajectory,
    peakPhaseTau: avgPeakPhase,
  };
}

/**
 * End-to-end Universal Kinetic Recurrence Segmenter execution.
 */
export function runUniversalRecurrenceSegmenter(
  frames: WorldLandmarkFrame[],
  timestamps: number[]
): RecurrenceSegmentationResult {
  // 1. Kinetic energy gating
  const power = computeKineticPower(frames, timestamps);
  const activeBout = detectActiveBout(power, timestamps);

  // 2. Posture vector extraction for active bout
  const activeFrames: WorldLandmark[] = [];
  const activeTimestamps: number[] = [];

  for (let i = activeBout.startIndex; i <= activeBout.endIndex; i++) {
    const f = frames[i];
    if (f && f.length >= 29) {
      activeFrames.push(f as unknown as WorldLandmark);
      activeTimestamps.push(timestamps[i]);
    }
  }

  if (activeFrames.length < 5) {
    return {
      activeBout,
      estimatedPeriodSec: 2.0,
      reps: [],
      canonicalEnvelope: null,
    };
  }

  const postures = activeFrames.map(f => extractNormalizedPosture(f as unknown as WorldLandmark[]));

  // 3. Self-Similarity Matrix & period estimation
  const ssm = buildSelfSimilarityMatrix(postures);
  const estimatedPeriodSec = estimateDominantPeriod(ssm, activeTimestamps);

  // 4. Repetition segmentation
  const reps = segmentRepetitionsFromPosture(postures, activeTimestamps, estimatedPeriodSec);

  // 5. Canonical phase synthesis
  const canonicalEnvelope = buildCanonicalPhaseEnvelope(reps);

  return {
    activeBout,
    estimatedPeriodSec,
    reps,
    canonicalEnvelope,
  };
}
