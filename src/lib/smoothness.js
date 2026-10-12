/**
 * smoothness.js — Movement smoothness (SPARC) and rep consistency (DTW).
 *
 * 100% on-device biomechanical intelligence for WorkoutVision.
 *
 * Literature:
 *   - Balasubramanian S et al., 2015, J NeuroEngineering Rehab
 *     "On the analysis of movement smoothness" (SPARC spectral arc length metric)
 *   - Sakoe H & Chiba S, 1978, IEEE Trans Acoust Speech Signal Process
 *     "Dynamic programming algorithm optimization for spoken word recognition" (DTW)
 *   - McLaughlin TM et al., 1977, Res Q
 *     "A kinematic model of performance in the parallel squat" (Bar path drift)
 */

import { liftDefinition } from './counting/core';

export const JOINT_POINTS = {
  elbow: { left: [11, 13, 15], right: [12, 14, 16] },
  shoulder: { left: [23, 11, 13], right: [24, 12, 14] },
  knee: { left: [23, 25, 27], right: [24, 26, 28] },
  hip: { left: [11, 23, 25], right: [12, 24, 26] },
};

function round(v, d = 2) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

/**
 * Resamples an array of numeric values to a target length using linear interpolation.
 */
export function resampleSignal(arr, targetLen = 40) {
  if (!arr || arr.length === 0) return [];
  if (arr.length === targetLen) return arr.slice();
  if (arr.length === 1) return new Array(targetLen).fill(arr[0]);

  const result = new Array(targetLen);
  const step = (arr.length - 1) / (targetLen - 1);
  for (let i = 0; i < targetLen; i++) {
    const pos = i * step;
    const low = Math.floor(pos);
    const high = Math.min(arr.length - 1, Math.ceil(pos));
    const weight = pos - low;
    result[i] = arr[low] * (1 - weight) + arr[high] * weight;
  }
  return result;
}

/**
 * SPARC: Spectral Arc Length (movement smoothness metric).
 * Balasubramanian et al., 2015.
 *
 * Computes the arc length of the normalized Fourier magnitude spectrum of the speed profile.
 * Monotonic, noise-robust, and dimensionless.
 * Typical values:
 *   > -1.6 : very smooth (minimum jerk, elite motor control)
 *   -1.6 to -2.5 : smooth (normal controlled repetition)
 *   -2.5 to -3.8 : moderate (minor tremors/adjustments)
 *   < -3.8 : jerky (fatigue, hesitation, technical breakdown)
 *
 * @param {number[]} speedProfile Array of non-negative speed/velocity magnitudes
 * @param {number} fps Sampling rate in frames per second
 * @returns {number|null} SPARC metric (negative number) or null if profile is too short
 */
export function computeSPARC(speedProfile, fps = 15) {
  if (!speedProfile || speedProfile.length < 8) return null;

  const N = speedProfile.length;
  let fftSize = 1;
  while (fftSize < N) fftSize *= 2;
  // Use at least 64 bins for clean frequency resolution
  if (fftSize < 64) fftSize = 64;

  const padded = new Array(fftSize).fill(0);
  for (let i = 0; i < N; i++) padded[i] = speedProfile[i];

  // Discrete Fourier Transform magnitude spectrum
  const halfSize = fftSize / 2;
  const mag = new Array(halfSize).fill(0);
  for (let k = 0; k < halfSize; k++) {
    let re = 0, im = 0;
    const factor = (-2 * Math.PI * k) / fftSize;
    for (let n = 0; n < fftSize; n++) {
      const angle = factor * n;
      re += padded[n] * Math.cos(angle);
      im += padded[n] * Math.sin(angle);
    }
    mag[k] = Math.sqrt(re * re + im * im);
  }

  const maxMag = Math.max(...mag);
  if (maxMag <= 1e-9) return null;
  const norm = mag.map(m => m / maxMag);

  const df = fps / fftSize;
  const cutoffHz = Math.min(20, fps / 2); // At most 20 Hz or Nyquist frequency
  const maxBin = Math.min(norm.length, Math.ceil(cutoffHz / df));
  if (maxBin < 2) return null;

  let arcLength = 0;
  for (let k = 1; k < maxBin; k++) {
    const dMag = norm[k] - norm[k - 1];
    const dFreq = df / cutoffHz;
    arcLength += Math.sqrt(dMag * dMag + dFreq * dFreq);
  }

  return round(-arcLength, 2);
}

/**
 * Dynamic Time Warping (DTW) distance between two trajectories.
 * Sakoe & Chiba, 1978.
 *
 * @param {number[]} a First series
 * @param {number[]} b Second series
 * @returns {number} Average normalized warping distance
 */
export function dtwDistance(a, b) {
  if (!a?.length || !b?.length) return Infinity;
  const N = a.length, M = b.length;

  const dtw = new Array(N + 1);
  for (let i = 0; i <= N; i++) {
    dtw[i] = new Array(M + 1).fill(Infinity);
  }
  dtw[0][0] = 0;

  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      const cost = Math.abs(a[i - 1] - b[j - 1]);
      dtw[i][j] = cost + Math.min(dtw[i - 1][j], dtw[i][j - 1], dtw[i - 1][j - 1]);
    }
  }

  return dtw[N][M] / (N + M);
}

function compute3DAngle(a, b, c) {
  if (!a || !b || !c) return null;
  const v1x = a.x - b.x, v1y = a.y - b.y, v1z = (a.z ?? 0) - (b.z ?? 0);
  const v2x = c.x - b.x, v2y = c.y - b.y, v2z = (c.z ?? 0) - (b.z ?? 0);
  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const m1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
  const m2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);
  if (m1 === 0 || m2 === 0) return null;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Analyzes movement quality: SPARC smoothness and DTW rep consistency.
 *
 * @param {Array} worldLandmarks 3D world landmarks array per frame
 * @param {number[]} timestamps Timestamp array in seconds
 * @param {string} lift The lift key
 * @param {Array} reps The rep details array from countSummary
 * @param {string} [arm='both'] The side tracked
 * @returns {object|null} Quality analysis or null if insufficient reps
 */
export function analyzeMovementQuality(worldLandmarks, timestamps, lift, reps, arm = 'both') {
  if (!worldLandmarks?.length || !timestamps?.length || !reps || reps.length < 2) {
    return null;
  }

  const def = liftDefinition(lift);
  const joint = def?.joint || 'elbow';
  const jointPts = JOINT_POINTS[joint];
  if (!jointPts) return null;

  const side = arm === 'left' ? 'left' : arm === 'right' ? 'right' : 'left';
  const [aIdx, vIdx, bIdx] = jointPts[side];

  // Extract angles across all frames
  const allAngles = [];
  for (let i = 0; i < worldLandmarks.length; i++) {
    const lm = worldLandmarks[i];
    if (!lm) { allAngles.push(null); continue; }
    allAngles.push(compute3DAngle(lm[aIdx], lm[vIdx], lm[bIdx]));
  }

  const fps = Math.round(timestamps.length / Math.max(0.1, timestamps[timestamps.length - 1] - timestamps[0])) || 15;

  // Extract per-rep angle curves and angular velocity profiles
  const repCurves = [];
  const sparcList = [];

  for (let rIdx = 0; rIdx < reps.length; rIdx++) {
    const r = reps[rIdx];
    if (r.clipped) continue;

    const repAngleSamples = [];
    const repSpeeds = [];

    for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i];
      if (t >= r.startTime && t <= r.endTime) {
        const ang = allAngles[i];
        if (ang !== null) repAngleSamples.push(ang);
      }
    }

    if (repAngleSamples.length >= 8) {
      // Angular velocity profile (deg/s)
      for (let i = 1; i < repAngleSamples.length; i++) {
        const dt = Math.max(0.001, 1 / fps);
        const speed = Math.abs(repAngleSamples[i] - repAngleSamples[i - 1]) / dt;
        repSpeeds.push(speed);
      }

      const sparc = computeSPARC(repSpeeds, fps);
      if (sparc !== null) {
        sparcList.push({ repIndex: r.index ?? rIdx + 1, sparc });
      }

      // Resample rep angle curve to standard length (40 points)
      repCurves.push(resampleSignal(repAngleSamples, 40));
    }
  }

  // Smoothness evaluation
  let smoothness = null;
  if (sparcList.length > 0) {
    const avgSparc = round(sparcList.reduce((acc, s) => acc + s.sparc, 0) / sparcList.length, 2);
    let quality = 'moderate';
    if (avgSparc >= -1.6) quality = 'very_smooth';
    else if (avgSparc >= -2.5) quality = 'smooth';
    else if (avgSparc < -3.8) quality = 'jerky';

    smoothness = {
      avgSparc,
      quality,
      perRep: sparcList,
    };
  }

  // DTW Rep Consistency evaluation
  let consistency = null;
  if (repCurves.length >= 2) {
    const numPoints = 40;
    // Compute median template rep
    const template = new Array(numPoints);
    for (let pt = 0; pt < numPoints; pt++) {
      const vals = repCurves.map(c => c[pt]).sort((x, y) => x - y);
      const mid = Math.floor(vals.length / 2);
      template[pt] = vals.length % 2 !== 0 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
    }

    const deviations = [];
    let worstDev = -1;
    let worstRepIndex = 1;

    for (let i = 0; i < repCurves.length; i++) {
      const dev = dtwDistance(repCurves[i], template);
      deviations.push(dev);
      if (dev > worstDev) {
        worstDev = dev;
        worstRepIndex = i + 1;
      }
    }

    const avgDev = deviations.reduce((s, d) => s + d, 0) / deviations.length;
    // Convert deviation degrees to 0-100 score: <=5° dev is ~95-100, 15° is 70, >30° is <40
    const score = Math.max(0, Math.min(100, Math.round(100 - avgDev * 2)));
    const rating = score >= 85 ? 'high' : score >= 70 ? 'moderate' : 'inconsistent';

    consistency = {
      score,
      rating,
      avgDeviationDeg: round(avgDev, 1),
      mostInconsistentRep: worstRepIndex,
    };
  }

  // Biomechanical form checks
  const lKey = String(lift || '').toLowerCase();
  const isSquat = lKey.includes('squat');
  const isLower = isSquat || lKey.includes('press') || lKey.includes('thrust') || lKey.includes('lunge');
  const formChecks = {};

  if (isSquat) {
    formChecks.squatDepth = detectSquatDepth(worldLandmarks, timestamps, reps);
    formChecks.kneeValgus = detectKneeValgus(worldLandmarks, timestamps, reps);
  }
  formChecks.lockout = detectLockout(worldLandmarks, timestamps, reps, lift);

  return { smoothness, consistency, formChecks };
}

/**
 * Detects whether squat reps reach or break parallel depth.
 * Schoenfeld 2010, Escamilla 2001.
 */
export function detectSquatDepth(worldLandmarks, timestamps, reps) {
  if (!worldLandmarks?.length || !reps?.length) return null;
  const results = [];
  for (const r of reps) {
    if (r.clipped) continue;
    let maxHipY = -Infinity;
    let bottomIdx = -1;
    for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i];
      if (t >= r.startTime && t <= r.endTime) {
        const lm = worldLandmarks[i];
        if (!lm || !lm[23] || !lm[24]) continue;
        const hipY = (lm[23].y + lm[24].y) / 2;
        if (hipY > maxHipY) {
          maxHipY = hipY;
          bottomIdx = i;
        }
      }
    }
    if (bottomIdx >= 0) {
      const lm = worldLandmarks[bottomIdx];
      const hipY = (lm[23].y + lm[24].y) / 2;
      const kneeY = (lm[25].y + lm[26].y) / 2;
      // In MediaPipe, positive Y points downwards. Parallel depth occurs when hip drops level with or below knee.
      const parallelOrBelow = hipY >= kneeY - 0.02;
      results.push({ repIndex: r.index, parallelOrBelow });
    }
  }
  if (!results.length) return null;
  const parallelCount = results.filter(r => r.parallelOrBelow).length;
  return {
    parallelRate: round(parallelCount / results.length, 2),
    allParallel: parallelCount === results.length,
    count: parallelCount,
    total: results.length,
  };
}

/**
 * Detects knee valgus (inward knee collapse) during squat / leg exercises.
 * Kiesel et al. 2007, Hewett et al. 2005.
 */
export function detectKneeValgus(worldLandmarks, timestamps, reps) {
  if (!worldLandmarks?.length || !reps?.length) return null;
  const valgusDetected = [];
  for (const r of reps) {
    if (r.clipped) continue;
    let minKneeToAnkleRatio = Infinity;
    for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i];
      if (t >= r.startTime && t <= r.endTime) {
        const lm = worldLandmarks[i];
        if (!lm || !lm[25] || !lm[26] || !lm[27] || !lm[28]) continue;
        if ((lm[25].visibility ?? 0) < 0.45 || (lm[26].visibility ?? 0) < 0.45) continue;
        const kneeDist = Math.abs(lm[25].x - lm[26].x);
        const ankleDist = Math.abs(lm[27].x - lm[28].x);
        if (ankleDist > 0.08) {
          const ratio = kneeDist / ankleDist;
          if (ratio < minKneeToAnkleRatio) minKneeToAnkleRatio = ratio;
        }
      }
    }
    if (Number.isFinite(minKneeToAnkleRatio)) {
      valgusDetected.push({ repIndex: r.index, valgus: minKneeToAnkleRatio < 0.8 });
    }
  }
  if (!valgusDetected.length) return null;
  const valgusCount = valgusDetected.filter(v => v.valgus).length;
  return {
    valgusRate: round(valgusCount / valgusDetected.length, 2),
    detected: valgusCount > 0,
    count: valgusCount,
    total: valgusDetected.length,
  };
}

/**
 * Detects terminal joint lockout consistency at rep completion.
 * Neumann 2017.
 */
export function detectLockout(worldLandmarks, timestamps, reps, lift) {
  if (!worldLandmarks?.length || !reps?.length) return null;
  const def = liftDefinition(lift);
  const isLower = def?.joint === 'knee' || def?.joint === 'hip';
  const jointPtsL = isLower ? JOINT_POINTS.knee.left : JOINT_POINTS.elbow.left;
  const jointPtsR = isLower ? JOINT_POINTS.knee.right : JOINT_POINTS.elbow.right;

  const lockoutReps = [];
  for (const r of reps) {
    if (r.clipped) continue;
    let endIdx = -1;
    let minDiff = Infinity;
    for (let i = 0; i < timestamps.length; i++) {
      const diff = Math.abs(timestamps[i] - r.endTime);
      if (diff < minDiff) {
        minDiff = diff;
        endIdx = i;
      }
    }
    if (endIdx >= 0 && minDiff < 0.25) {
      const lm = worldLandmarks[endIdx];
      if (lm) {
        const angL = compute3DAngle(lm[jointPtsL[0]], lm[jointPtsL[1]], lm[jointPtsL[2]]);
        const angR = compute3DAngle(lm[jointPtsR[0]], lm[jointPtsR[1]], lm[jointPtsR[2]]);
        const maxAng = Math.max(angL || 0, angR || 0);
        if (maxAng > 0) {
          lockoutReps.push({ repIndex: r.index, lockout: maxAng >= 165, angle: Math.round(maxAng) });
        }
      }
    }
  }
  if (!lockoutReps.length) return null;
  const lockoutCount = lockoutReps.filter(l => l.lockout).length;
  return {
    lockoutRate: round(lockoutCount / lockoutReps.length, 2),
    fullLockout: lockoutCount === lockoutReps.length,
    count: lockoutCount,
    total: lockoutReps.length,
  };
}

