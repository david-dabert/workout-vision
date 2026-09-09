/**
 * VideoSuitabilityDetector — pre-analysis video quality check.
 *
 * Runs on the first ~30 frames before full analysis begins. Evaluates
 * whether the video is likely to produce a reliable rep count by checking
 * person visibility, landmark coverage, camera stability, person size,
 * and movement presence.
 *
 * Returns a structured assessment that the UI can use to show early
 * warnings or abort before wasting compute on an unsuitable video.
 */

import { VISIBILITY_THRESHOLD } from './analysisConfig';
import { LANDMARKS } from './poseAnalysis';

/**
 * @typedef {Object} SuitabilityResult
 * @property {'good'|'questionable'|'poor'} suitable
 * @property {number} score - 0-1 composite
 * @property {string[]} issues - human-readable issue descriptions
 * @property {boolean} personDetected - at least one person found
 * @property {number} landmarkCoverage - 0-1 fraction of landmarks visible
 * @property {number} stability - 0-1 camera stability
 * @property {number} personSize - fraction of frame area
 * @property {number} brightness - 0-1 estimated (from landmark confidence proxy)
 */

export class VideoSuitabilityDetector {
  /**
   * Assess video suitability from early frames.
   *
   * @param {Array} frames - array of MediaPipe landmark arrays (first ~30 frames)
   * @returns {SuitabilityResult}
   */
  assess(frames) {
    const issues = [];
    if (!frames || frames.length === 0) {
      return {
        suitable: 'poor',
        score: 0,
        issues: ['No frames provided'],
        personDetected: false,
        landmarkCoverage: 0,
        stability: 0,
        personSize: 0,
        brightness: 0,
      };
    }

    // ── Person detection rate ──
    let validFrames = 0;
    for (const frame of frames) {
      if (frame && Array.isArray(frame) && frame.length >= 33) {
        validFrames++;
      }
    }
    const detectionRate = validFrames / frames.length;
    const personDetected = detectionRate > 0.3;

    if (!personDetected) {
      issues.push('Person not reliably detected in video');
    } else if (detectionRate < 0.7) {
      issues.push(`Person visible in only ${(detectionRate * 100).toFixed(0)}% of frames`);
    }

    // ── Landmark coverage (mean visibility) ──
    let totalVis = 0;
    let visCount = 0;
    for (const frame of frames) {
      if (!frame || !Array.isArray(frame)) continue;
      for (const lm of frame) {
        if (lm && lm.visibility != null) {
          totalVis += lm.visibility;
          visCount++;
        }
      }
    }
    const meanVis = visCount > 0 ? totalVis / visCount : 0;
    const landmarkCoverage = Math.min(1, meanVis / 0.8); // normalize: 0.8 vis = full coverage

    if (meanVis < 0.4) {
      issues.push('Landmarks poorly visible; person may be partially out of frame');
    }

    // ── Camera stability (variance of static joints across frames) ──
    const stability = _computeStability(frames);
    if (stability < 0.5) {
      issues.push('Camera appears shaky or moving significantly');
    }

    // ── Person size (bounding box as fraction of frame) ──
    const personSize = _computePersonSize(frames);
    if (personSize < 0.15) {
      issues.push('Person is very small in frame; move camera closer');
    }

    // ── Movement detection (angle changes across frames) ──
    const hasMovement = _detectMovement(frames);
    if (!hasMovement) {
      issues.push('No significant movement detected in sample frames');
    }

    // ── Brightness proxy (use mean visibility as rough brightness indicator) ──
    const brightness = Math.min(1, meanVis);

    // ── Composite score ──
    const score = (
      detectionRate * 0.30 +
      landmarkCoverage * 0.25 +
      stability * 0.15 +
      Math.min(1, personSize / 0.3) * 0.15 +
      (hasMovement ? 1 : 0) * 0.15
    );

    let suitable;
    if (score >= 0.70 && personDetected && hasMovement) {
      suitable = 'good';
    } else if (score >= 0.40 && personDetected) {
      suitable = 'questionable';
    } else {
      suitable = 'poor';
    }

    return {
      suitable,
      score: Math.round(score * 100) / 100,
      issues,
      personDetected,
      landmarkCoverage: Math.round(landmarkCoverage * 100) / 100,
      stability: Math.round(stability * 100) / 100,
      personSize: Math.round(personSize * 1000) / 1000,
      brightness: Math.round(brightness * 100) / 100,
    };
  }
}

/**
 * Compute camera stability from hip position variance across frames.
 * Hips are relatively static joints; high variance = camera moving.
 * @param {Array} frames
 * @returns {number} 0-1 (1 = very stable)
 */
function _computeStability(frames) {
  const hipXs = [];
  const hipYs = [];
  const LH = LANDMARKS.LEFT_HIP;
  const RH = LANDMARKS.RIGHT_HIP;

  for (const frame of frames) {
    if (!frame || !frame[LH] || !frame[RH]) continue;
    const mx = (frame[LH].x + frame[RH].x) / 2;
    const my = (frame[LH].y + frame[RH].y) / 2;
    hipXs.push(mx);
    hipYs.push(my);
  }

  if (hipXs.length < 5) return 0.5; // not enough data

  const varX = _variance(hipXs);
  const varY = _variance(hipYs);
  const totalVar = varX + varY;

  // Threshold: variance < 0.001 = very stable, > 0.01 = very shaky
  return Math.max(0, Math.min(1, 1 - totalVar * 100));
}

/**
 * Compute average person bounding box as fraction of frame area.
 * @param {Array} frames
 * @returns {number} 0-1
 */
function _computePersonSize(frames) {
  let totalArea = 0;
  let count = 0;

  for (const frame of frames) {
    if (!frame || !Array.isArray(frame)) continue;
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    let hasVisible = false;
    for (const lm of frame) {
      if (!lm || (lm.visibility || 0) < 0.3) continue;
      hasVisible = true;
      minX = Math.min(minX, lm.x);
      maxX = Math.max(maxX, lm.x);
      minY = Math.min(minY, lm.y);
      maxY = Math.max(maxY, lm.y);
    }
    if (hasVisible) {
      totalArea += (maxX - minX) * (maxY - minY);
      count++;
    }
  }

  return count > 0 ? totalArea / count : 0;
}

/**
 * Detect whether significant joint angle changes occur across frames.
 * @param {Array} frames
 * @returns {boolean}
 */
function _detectMovement(frames) {
  // Check elbow and knee angle range across sample frames
  const LE = LANDMARKS.LEFT_ELBOW;
  const LS = LANDMARKS.LEFT_SHOULDER;
  const LW = LANDMARKS.LEFT_WRIST;
  const LK = LANDMARKS.LEFT_KNEE;
  const LH = LANDMARKS.LEFT_HIP;
  const LA = LANDMARKS.LEFT_ANKLE;

  const elbowAngles = [];
  const kneeAngles = [];

  for (const frame of frames) {
    if (!frame || frame.length < 33) continue;
    // Simple 2D angle for movement detection (no need for precision here)
    const eAngle = _simpleAngle(frame[LS], frame[LE], frame[LW]);
    const kAngle = _simpleAngle(frame[LH], frame[LK], frame[LA]);
    if (eAngle != null) elbowAngles.push(eAngle);
    if (kAngle != null) kneeAngles.push(kAngle);
  }

  const elbowRange = elbowAngles.length > 2
    ? Math.max(...elbowAngles) - Math.min(...elbowAngles)
    : 0;
  const kneeRange = kneeAngles.length > 2
    ? Math.max(...kneeAngles) - Math.min(...kneeAngles)
    : 0;

  // At least 10 degrees of movement in some joint
  return elbowRange > 10 || kneeRange > 10;
}

/**
 * Simple 2D angle between three points.
 * @returns {number|null} angle in degrees
 */
function _simpleAngle(a, b, c) {
  if (!a || !b || !c) return null;
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);
  if (magBA < 1e-6 || magBC < 1e-6) return null;
  const cos = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Compute variance of a numeric array.
 * @param {number[]} arr
 * @returns {number}
 */
function _variance(arr) {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
}
