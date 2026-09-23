/**
 * Named custom check and value functions that cannot be serialized to JSON.
 *
 * These are the truly custom implementations that use landmark data,
 * conditional logic, or multi-joint patterns. They are referenced by
 * name from the JSON exercise definitions via { type: 'namedCustom', ref: '...' }
 * or { type: 'namedCustomValue', ref: '...' }.
 *
 * Only 5 check functions and 2 value functions out of 274 exercises.
 */

import { bestSide, qualityBelow } from './exercises';

// ─── Named custom form checks ───

/** Knee valgus check via landmarks (squat family) */
const kneeValgus = {
  name: 'Knee valgus',
  viewpoint: 'frontal',
  check: (angles, landmarks) => {
    if (!landmarks || !landmarks[25] || !landmarks[26] || !landmarks[27] || !landmarks[28]) return true;
    const lk = landmarks[25], la = landmarks[27], rk = landmarks[26], ra = landmarks[28];
    const leftVis = (lk.visibility || 0) > 0.3 && (la.visibility || 0) > 0.3;
    const rightVis = (rk.visibility || 0) > 0.3 && (ra.visibility || 0) > 0.3;
    if (!leftVis && !rightVis) return true;
    const leftOk = !leftVis || (lk.x - la.x) > -0.02;
    const rightOk = !rightVis || (ra.x - rk.x) > -0.02;
    return leftOk && rightOk;
  },
  quality: (angles, landmarks) => {
    if (!landmarks || !landmarks[25] || !landmarks[26] || !landmarks[27] || !landmarks[28]) return 1;
    const lk = landmarks[25], la = landmarks[27], rk = landmarks[26], ra = landmarks[28];
    const leftVis = (lk.visibility || 0) > 0.3 && (la.visibility || 0) > 0.3;
    const rightVis = (rk.visibility || 0) > 0.3 && (ra.visibility || 0) > 0.3;
    if (!leftVis && !rightVis) return 1;
    const drifts = [];
    if (leftVis) drifts.push(lk.x - la.x);
    if (rightVis) drifts.push(ra.x - rk.x);
    const worstDrift = Math.min(...drifts);
    if (worstDrift >= -0.02) return 1;
    return Math.max(0, 1 - ((-0.02 - worstDrift) / 0.04));
  },
  good: 'Knees tracking over toes',
  bad: 'Knee cave detected',
  severity: 'major',
  citation: 'Hewett TE et al, 2005, Am J Sports Med',
};

/** Lumbar flexion check via landmarks (deadlift family) */
const lumbarFlexion = {
  name: 'Lumbar flexion',
  check: (angles, landmarks) => {
    if (!landmarks || !landmarks[11] || !landmarks[12] || !landmarks[23] || !landmarks[24]) return true;
    const midShoulderZ = ((landmarks[11].z || 0) + (landmarks[12].z || 0)) / 2;
    const midHipZ = ((landmarks[23].z || 0) + (landmarks[24].z || 0)) / 2;
    return (midHipZ - midShoulderZ) < 0.03;
  },
  quality: (angles, landmarks) => {
    if (!landmarks || !landmarks[11] || !landmarks[12] || !landmarks[23] || !landmarks[24]) return 1;
    const midShoulderZ = ((landmarks[11].z || 0) + (landmarks[12].z || 0)) / 2;
    const midHipZ = ((landmarks[23].z || 0) + (landmarks[24].z || 0)) / 2;
    const diff = midHipZ - midShoulderZ;
    if (diff < 0.03) return 1;
    return Math.max(0, 1 - (diff - 0.03) / 0.06);
  },
  good: 'Neutral spine maintained',
  bad: 'Potential lumbar rounding detected',
  severity: 'major',
  citation: 'McGill SM, 2007, Ultimate Back Fitness and Performance',
};

/** Hip thrust anterior pelvic tilt (conditional: only checks trunk when hip extended) */
const hip_thrust_check_2 = {
  name: 'Anterior pelvic tilt',
  check: (angles) => {
    const hipAngle = Math.min(angles.leftHip, angles.rightHip);
    if (hipAngle <= 160) return true;
    return angles.trunk < 20;
  },
  quality: (angles) => {
    const hipAngle = bestSide(angles, 'leftHip', 'rightHip', '_visLeftHip', '_visRightHip');
    if (hipAngle == null || hipAngle <= 160) return 1;
    return qualityBelow(angles.trunk, 20, 10);
  },
  good: 'Neutral spine at lockout',
  bad: 'Anterior pelvic tilt detected',
  severity: 'minor',
  citation: 'Contreras B et al, 2015, J Appl Biomech',
  phase: 'top',
};

/** Superset movement detection (OR of knee and elbow movement) */
const superset_check_0 = {
  name: 'Movement detected',
  check: (angles) => {
    const knee = Math.min(angles.leftKnee, angles.rightKnee);
    const elbow = Math.min(angles.leftElbow, angles.rightElbow);
    return knee < 160 || elbow < 160;
  },
  quality: (angles) => Math.max(
    qualityBelow(bestSide(angles, 'leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee'), 160, 15),
    qualityBelow(bestSide(angles, 'leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow'), 160, 15)
  ),
  good: 'Active movement',
  bad: 'No significant joint movement detected',
  severity: 'minor',
  citation: 'General observation',
};

// ─── Named custom value functions ───

/** Battle rope: average wrist Y position scaled to 0-100 */
const battle_rope_value = (angles, landmarks) => {
  if (landmarks && landmarks[15] && landmarks[16]) {
    return ((landmarks[15].y + landmarks[16].y) / 2) * 100;
  }
  return Math.min(angles.leftShoulder, 100);
};

/** Superset: pick the joint with the largest deviation from 180 */
const superset_value = (angles) => {
  const vals = [
    Math.min(angles.leftKnee, angles.rightKnee),
    Math.min(angles.leftElbow, angles.rightElbow),
    (angles.leftShoulder + angles.rightShoulder) / 2,
    (angles.leftHip + angles.rightHip) / 2,
  ];
  let best = vals[0], bestDelta = Math.abs(180 - vals[0]);
  for (let i = 1; i < vals.length; i++) {
    const d = Math.abs(180 - vals[i]);
    if (d > bestDelta) { best = vals[i]; bestDelta = d; }
  }
  return best;
};

// ─── Registry ───

export const CUSTOM_CHECKS = {
  kneeValgus,
  lumbarFlexion,
  hip_thrust_check_2,
  superset_check_0,
};

export const CUSTOM_VALUES = {
  battle_rope_value,
  superset_value,
};
