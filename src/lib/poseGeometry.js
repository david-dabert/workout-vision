/**
 * poseGeometry.js — Shared geometry, filtering, and pose selection utilities.
 *
 * Single source of truth for logic used by both the main thread (poseAnalysis.js)
 * and the Web Worker (poseWorker.js). This module has zero dependencies so it can
 * be imported from a Worker loaded with { type: 'module' }.
 */

// ─── Landmark indices (MediaPipe Pose Landmarker 33-point model) ───

export const LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
};

// ─── 3-point joint angle ───

/**
 * Calculate the angle at vertex b formed by points a-b-c, in degrees.
 * Works in 3D (uses z if available, defaults to 0).
 */
export function calculateAngle(a, b, c) {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);
  if (magBA === 0 || magBC === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

// ─── Joint angle extraction ───

/**
 * Extract all 8 joint angles + trunk angle + per-joint visibility scores
 * from a 33-point landmark array.
 * @param {Array} landmarks - 33-element landmark array with {x, y, z, visibility}
 * @returns {Object|null} angles object or null if landmarks invalid
 */
export function extractJointAngles(landmarks) {
  if (!landmarks || landmarks.length < 33) return null;
  const L = landmarks;
  const vis = (a, b, c) => Math.min(L[a].visibility || 0, L[b].visibility || 0, L[c].visibility || 0);

  return {
    leftKnee: calculateAngle(L[LANDMARKS.LEFT_HIP], L[LANDMARKS.LEFT_KNEE], L[LANDMARKS.LEFT_ANKLE]),
    rightKnee: calculateAngle(L[LANDMARKS.RIGHT_HIP], L[LANDMARKS.RIGHT_KNEE], L[LANDMARKS.RIGHT_ANKLE]),
    leftHip: calculateAngle(L[LANDMARKS.LEFT_SHOULDER], L[LANDMARKS.LEFT_HIP], L[LANDMARKS.LEFT_KNEE]),
    rightHip: calculateAngle(L[LANDMARKS.RIGHT_SHOULDER], L[LANDMARKS.RIGHT_HIP], L[LANDMARKS.RIGHT_KNEE]),
    leftElbow: calculateAngle(L[LANDMARKS.LEFT_SHOULDER], L[LANDMARKS.LEFT_ELBOW], L[LANDMARKS.LEFT_WRIST]),
    rightElbow: calculateAngle(L[LANDMARKS.RIGHT_SHOULDER], L[LANDMARKS.RIGHT_ELBOW], L[LANDMARKS.RIGHT_WRIST]),
    leftShoulder: calculateAngle(L[LANDMARKS.LEFT_HIP], L[LANDMARKS.LEFT_SHOULDER], L[LANDMARKS.LEFT_ELBOW]),
    rightShoulder: calculateAngle(L[LANDMARKS.RIGHT_HIP], L[LANDMARKS.RIGHT_SHOULDER], L[LANDMARKS.RIGHT_ELBOW]),
    trunk: calculateTrunkAngle(landmarks),
    _visLeftElbow: vis(LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST),
    _visRightElbow: vis(LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST),
    _visLeftKnee: vis(LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE),
    _visRightKnee: vis(LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE),
    _visLeftHip: vis(LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE),
    _visRightHip: vis(LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE),
    _visLeftShoulder: vis(LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW),
    _visRightShoulder: vis(LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW),
  };
}

/**
 * Calculate trunk angle: angle between vertical reference and the
 * shoulder-midpoint to hip-midpoint line.
 */
export function calculateTrunkAngle(landmarks) {
  const midShoulder = {
    x: (landmarks[LANDMARKS.LEFT_SHOULDER].x + landmarks[LANDMARKS.RIGHT_SHOULDER].x) / 2,
    y: (landmarks[LANDMARKS.LEFT_SHOULDER].y + landmarks[LANDMARKS.RIGHT_SHOULDER].y) / 2,
    z: ((landmarks[LANDMARKS.LEFT_SHOULDER].z || 0) + (landmarks[LANDMARKS.RIGHT_SHOULDER].z || 0)) / 2,
  };
  const midHip = {
    x: (landmarks[LANDMARKS.LEFT_HIP].x + landmarks[LANDMARKS.RIGHT_HIP].x) / 2,
    y: (landmarks[LANDMARKS.LEFT_HIP].y + landmarks[LANDMARKS.RIGHT_HIP].y) / 2,
    z: ((landmarks[LANDMARKS.LEFT_HIP].z || 0) + (landmarks[LANDMARKS.RIGHT_HIP].z || 0)) / 2,
  };
  const verticalRef = { ...midHip, y: midHip.y - 1 };
  return calculateAngle(midShoulder, midHip, verticalRef);
}

// ─── Anatomical plausibility ───

/**
 * Check if any joint angle exceeds biomechanical limits.
 * Returns true if landmarks are anatomically implausible.
 */
export function isAnatomicallyImplausible(landmarks) {
  if (!landmarks || landmarks.length < 33) return false;
  const L = landmarks;
  const checks = [
    { val: calculateAngle(L[LANDMARKS.LEFT_HIP], L[LANDMARKS.LEFT_KNEE], L[LANDMARKS.LEFT_ANKLE]), max: 185 },
    { val: calculateAngle(L[LANDMARKS.RIGHT_HIP], L[LANDMARKS.RIGHT_KNEE], L[LANDMARKS.RIGHT_ANKLE]), max: 185 },
    { val: calculateAngle(L[LANDMARKS.LEFT_SHOULDER], L[LANDMARKS.LEFT_ELBOW], L[LANDMARKS.LEFT_WRIST]), max: 180 },
    { val: calculateAngle(L[LANDMARKS.RIGHT_SHOULDER], L[LANDMARKS.RIGHT_ELBOW], L[LANDMARKS.RIGHT_WRIST]), max: 180 },
    { val: calculateAngle(L[LANDMARKS.LEFT_SHOULDER], L[LANDMARKS.LEFT_HIP], L[LANDMARKS.LEFT_KNEE]), max: 200 },
    { val: calculateAngle(L[LANDMARKS.RIGHT_SHOULDER], L[LANDMARKS.RIGHT_HIP], L[LANDMARKS.RIGHT_KNEE]), max: 200 },
  ];
  return checks.some(a => a.val > a.max);
}

// ─── Subject selection ───

/** Minimum landmark visibility to consider for bounding box. */
const VIS_THRESHOLD = 0.3;

/**
 * From multiple detected poses, select the one most likely to be the user.
 * Prioritizes body area (closest to camera = largest bounding box) and
 * penalizes distance from frame center.
 */
export function selectSubjectPose(landmarksArray) {
  if (!landmarksArray || landmarksArray.length === 0) return null;
  if (landmarksArray.length === 1) return landmarksArray[0];

  let bestPose = landmarksArray[0];
  let bestScore = -Infinity;

  for (const pose of landmarksArray) {
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const lm of pose) {
      if ((lm.visibility || 0) < VIS_THRESHOLD) continue;
      minX = Math.min(minX, lm.x);
      maxX = Math.max(maxX, lm.x);
      minY = Math.min(minY, lm.y);
      maxY = Math.max(maxY, lm.y);
    }
    const area = (maxX - minX) * (maxY - minY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const dist = Math.sqrt((cx - 0.5) ** 2 + (cy - 0.5) ** 2);
    const score = area * 1000 - dist * 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestPose = pose;
    }
  }
  return bestPose;
}

// ─── Inline Kalman filter (zero-dependency, usable in Worker) ───

const KALMAN_VIS_THRESHOLD = 0.1;
const KALMAN_PROCESS_NOISE = 0.001;
const KALMAN_MEASUREMENT_NOISE = 0.05;

export function createKalmanStates(n) {
  return Array.from({ length: n }, () => [
    { x: 0, p: 1, init: false },
    { x: 0, p: 1, init: false },
    { x: 0, p: 1, init: false },
  ]);
}

function kalmanUpdate1D(state, measurement) {
  if (!state.init) {
    state.x = measurement;
    state.p = KALMAN_MEASUREMENT_NOISE;
    state.init = true;
    return state.x;
  }
  state.p += KALMAN_PROCESS_NOISE;
  const k = state.p / (state.p + KALMAN_MEASUREMENT_NOISE);
  state.x += k * (measurement - state.x);
  state.p *= 1 - k;
  return state.x;
}

export function kalmanFilter(landmarks, states) {
  if (!landmarks) return null;
  const out = new Array(landmarks.length);
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (!lm) { out[i] = null; continue; }
    if (lm.visibility < KALMAN_VIS_THRESHOLD) {
      out[i] = { x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility };
      continue;
    }
    const s = states[i];
    out[i] = {
      x: kalmanUpdate1D(s[0], lm.x),
      y: kalmanUpdate1D(s[1], lm.y),
      z: kalmanUpdate1D(s[2], lm.z),
      visibility: lm.visibility,
    };
  }
  return out;
}
