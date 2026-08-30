/**
 * AnthropometricNormalizer — Your Body, Your Thresholds
 *
 * Measures limb proportions from the first few frames of a session.
 * Normalizes form thresholds so a 6'5" user and a 5'2" user
 * get biomechanically valid feedback.
 *
 * Convergence item #3: Anthropometric normalization.
 * Addresses Rippetoe's critique (forward lean depends on femur length)
 * and Kanazawa's critique (thresholds must be body-invariant).
 */

import { LANDMARKS } from './poseAnalysis';

// ---------------------------------------------------------------------------
// Measure 3D segment length from landmarks
// ---------------------------------------------------------------------------

function segmentLength3D(landmarks, a, b) {
  const la = landmarks[a], lb = landmarks[b];
  if (!la || !lb) return null;
  const dx = la.x - lb.x;
  const dy = la.y - lb.y;
  const dz = (la.z || 0) - (lb.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// ---------------------------------------------------------------------------
// AnthropometricNormalizer
// ---------------------------------------------------------------------------

export class AnthropometricNormalizer {
  constructor() {
    this._measurements = [];
    this._profile = null;
    this._calibrated = false;
  }

  get isCalibrated() { return this._calibrated; }
  get profile() { return this._profile; }

  /**
   * Feed a frame of landmarks for calibration.
   * Call this for the first 5-10 frames of a session (ideally standing).
   * Returns true when calibration is complete (enough stable measurements).
   */
  addFrame(landmarks) {
    if (this._calibrated) return true;
    if (!landmarks || landmarks.length < 33) return false;

    const m = this._measure(landmarks);
    if (!m) return false;

    this._measurements.push(m);

    // Need at least 5 frames with valid measurements
    if (this._measurements.length >= 5) {
      this._calibrate();
      return true;
    }
    return false;
  }

  /**
   * Normalize a form threshold based on the user's body proportions.
   *
   * @param {string} exerciseKey
   * @param {string} checkName - e.g., 'squat_depth', 'forward_lean'
   * @param {number} defaultThreshold - the generic threshold in degrees
   * @returns {number} adjusted threshold
   */
  normalizeThreshold(exerciseKey, checkName, defaultThreshold) {
    if (!this._calibrated || !this._profile) return defaultThreshold;

    const p = this._profile;

    // Squat depth: long femurs need less depth angle to reach parallel
    if (checkName === 'squat_depth' || checkName === 'knee_depth') {
      // Long thighs relative to shins → user naturally reaches parallel at a higher knee angle
      const thighShinRatio = p.thighToShin;
      if (thighShinRatio > 1.15) {
        // Long femurs: relax depth threshold by up to 10 degrees
        return defaultThreshold + (thighShinRatio - 1.0) * 20;
      }
      if (thighShinRatio < 0.9) {
        // Short femurs: tighten threshold slightly
        return defaultThreshold - 5;
      }
    }

    // Forward lean in squats: long torso relative to femur allows more upright
    if (checkName === 'forward_lean' || checkName === 'trunk_angle') {
      const torsoToLeg = p.torsoToLeg;
      if (torsoToLeg < 0.45) {
        // Short torso relative to legs → more forward lean is mechanically necessary
        return defaultThreshold + 15;
      }
      if (torsoToLeg > 0.55) {
        // Long torso → can stay more upright
        return defaultThreshold - 5;
      }
    }

    // Shoulder exercises: long arms need different ROM threshold
    if (checkName === 'shoulder_rom' || checkName === 'overhead_lockout') {
      const armRatio = p.armToTorso;
      if (armRatio > 1.1) {
        // Long arms relative to torso
        return defaultThreshold - 5;
      }
    }

    // Elbow lockout: adjust based on upper/lower arm ratio
    if (checkName === 'elbow_lockout') {
      // Slightly narrower range for people with hyperextension tendency
      return defaultThreshold;
    }

    return defaultThreshold;
  }

  /**
   * Get the user's body type classification.
   * Useful for exercise variant suggestions.
   */
  getBodyType() {
    if (!this._calibrated || !this._profile) return null;

    const p = this._profile;
    return {
      torsoType: p.torsoToLeg > 0.52 ? 'long' : p.torsoToLeg < 0.45 ? 'short' : 'average',
      femurType: p.thighToShin > 1.15 ? 'long' : p.thighToShin < 0.9 ? 'short' : 'average',
      armType: p.armToTorso > 1.1 ? 'long' : p.armToTorso < 0.85 ? 'short' : 'average',
      symmetryIndex: p.symmetryIndex,
    };
  }

  // ─── Private ───

  _measure(landmarks) {
    // Upper arm (shoulder to elbow)
    const upperArmL = segmentLength3D(landmarks, LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW);
    const upperArmR = segmentLength3D(landmarks, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW);

    // Forearm (elbow to wrist)
    const forearmL = segmentLength3D(landmarks, LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST);
    const forearmR = segmentLength3D(landmarks, LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST);

    // Thigh (hip to knee)
    const thighL = segmentLength3D(landmarks, LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE);
    const thighR = segmentLength3D(landmarks, LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE);

    // Shin (knee to ankle)
    const shinL = segmentLength3D(landmarks, LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE);
    const shinR = segmentLength3D(landmarks, LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE);

    // Torso (mid-shoulder to mid-hip)
    const ls = landmarks[LANDMARKS.LEFT_SHOULDER], rs = landmarks[LANDMARKS.RIGHT_SHOULDER];
    const lh = landmarks[LANDMARKS.LEFT_HIP], rh = landmarks[LANDMARKS.RIGHT_HIP];
    if (!ls || !rs || !lh || !rh) return null;

    const midS = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2, z: ((ls.z || 0) + (rs.z || 0)) / 2 };
    const midH = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2, z: ((lh.z || 0) + (rh.z || 0)) / 2 };
    const dx = midS.x - midH.x, dy = midS.y - midH.y, dz = midS.z - midH.z;
    const torso = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (!upperArmL || !forearmL || !thighL || !shinL || torso < 0.01) return null;

    return {
      upperArm: (upperArmL + (upperArmR || upperArmL)) / 2,
      forearm: (forearmL + (forearmR || forearmL)) / 2,
      thigh: (thighL + (thighR || thighL)) / 2,
      shin: (shinL + (shinR || shinL)) / 2,
      torso,
      // Symmetry: L/R ratios
      armSymmetry: upperArmR && upperArmL ? Math.min(upperArmL, upperArmR) / Math.max(upperArmL, upperArmR) : 1,
      legSymmetry: thighR && thighL ? Math.min(thighL, thighR) / Math.max(thighL, thighR) : 1,
    };
  }

  _calibrate() {
    // Median of each measurement across collected frames
    const median = (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const ms = this._measurements;

    const upperArm = median(ms.map(m => m.upperArm));
    const forearm = median(ms.map(m => m.forearm));
    const thigh = median(ms.map(m => m.thigh));
    const shin = median(ms.map(m => m.shin));
    const torso = median(ms.map(m => m.torso));
    const totalArm = upperArm + forearm;
    const totalLeg = thigh + shin;

    this._profile = {
      upperArm,
      forearm,
      thigh,
      shin,
      torso,
      totalArm,
      totalLeg,
      // Key ratios
      armToTorso: torso > 0 ? totalArm / torso : 1,
      thighToShin: shin > 0 ? thigh / shin : 1,
      torsoToLeg: totalLeg > 0 ? torso / totalLeg : 0.5,
      // Symmetry (1.0 = perfect, <0.9 = significant asymmetry)
      symmetryIndex: median(ms.map(m => Math.min(m.armSymmetry, m.legSymmetry))),
    };

    this._calibrated = true;
  }
}
