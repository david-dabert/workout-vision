/**
 * Test helpers — synthetic landmark generators for pose analysis tests.
 *
 * MediaPipe Pose Landmarker outputs 33 landmarks, each with
 * {x, y, z, visibility} in normalized coordinates (0-1).
 *
 * Key indices used by the app:
 *   11/12 = left/right shoulder
 *   13/14 = left/right elbow
 *   15/16 = left/right wrist
 *   23/24 = left/right hip
 *   25/26 = left/right knee
 *   27/28 = left/right ankle
 */

/**
 * Generate a 33-point landmark array with default values.
 * Default pose: standing upright, all joints visible.
 * @param {Object} overrides - Map of landmark index to partial {x, y, z, visibility}
 * @returns {Array<{x: number, y: number, z: number, visibility: number}>}
 */
export function fakeLandmarks(overrides = {}) {
  // Default standing pose — approximate normalized coordinates.
  // y increases downward in MediaPipe's coordinate system.
  const defaults = {
    0:  { x: 0.50, y: 0.10, z: 0 },   // nose
    1:  { x: 0.49, y: 0.09, z: 0 },
    2:  { x: 0.48, y: 0.09, z: 0 },
    3:  { x: 0.47, y: 0.09, z: 0 },
    4:  { x: 0.51, y: 0.09, z: 0 },
    5:  { x: 0.52, y: 0.09, z: 0 },
    6:  { x: 0.53, y: 0.09, z: 0 },
    7:  { x: 0.46, y: 0.08, z: 0 },
    8:  { x: 0.54, y: 0.08, z: 0 },
    9:  { x: 0.48, y: 0.11, z: 0 },
    10: { x: 0.52, y: 0.11, z: 0 },
    11: { x: 0.42, y: 0.25, z: 0 },   // left shoulder
    12: { x: 0.58, y: 0.25, z: 0 },   // right shoulder
    13: { x: 0.38, y: 0.40, z: 0 },   // left elbow
    14: { x: 0.62, y: 0.40, z: 0 },   // right elbow
    15: { x: 0.36, y: 0.55, z: 0 },   // left wrist
    16: { x: 0.64, y: 0.55, z: 0 },   // right wrist
    17: { x: 0.35, y: 0.57, z: 0 },
    18: { x: 0.65, y: 0.57, z: 0 },
    19: { x: 0.34, y: 0.58, z: 0 },
    20: { x: 0.66, y: 0.58, z: 0 },
    21: { x: 0.34, y: 0.56, z: 0 },
    22: { x: 0.66, y: 0.56, z: 0 },
    23: { x: 0.45, y: 0.52, z: 0 },   // left hip
    24: { x: 0.55, y: 0.52, z: 0 },   // right hip
    25: { x: 0.44, y: 0.72, z: 0 },   // left knee
    26: { x: 0.56, y: 0.72, z: 0 },   // right knee
    27: { x: 0.43, y: 0.92, z: 0 },   // left ankle
    28: { x: 0.57, y: 0.92, z: 0 },   // right ankle
    29: { x: 0.42, y: 0.95, z: 0 },   // left heel
    30: { x: 0.58, y: 0.95, z: 0 },   // right heel
    31: { x: 0.41, y: 0.96, z: 0 },   // left foot index
    32: { x: 0.59, y: 0.96, z: 0 },   // right foot index
  };

  const landmarks = [];
  for (let i = 0; i < 33; i++) {
    const base = defaults[i] || { x: 0.5, y: 0.5, z: 0 };
    const override = overrides[i] || {};
    landmarks.push({
      x: override.x ?? base.x,
      y: override.y ?? base.y,
      z: override.z ?? base.z,
      visibility: override.visibility ?? 0.99,
    });
  }
  return landmarks;
}

/**
 * Create landmarks where the knee angle approximates the given value.
 *
 * The knee angle is the angle at the knee joint between hip-knee and knee-ankle vectors.
 * We position the hip, knee, and ankle on a 2D plane to produce the desired angle.
 *
 * At 170 degrees: legs nearly straight (standing).
 * At 90 degrees: deep squat position.
 *
 * @param {number} kneeAngleDeg - Desired knee angle in degrees (both sides)
 * @param {number} timestamp - Frame timestamp in seconds
 * @returns {Array} 33-point landmark array
 */
export function fakeSquatFrame(kneeAngleDeg, timestamp) {
  // Place hip at a fixed point, knee below it, ankle positioned
  // to create the desired angle.
  //
  // calculateAngle(hip, knee, ankle) measures the angle at the knee vertex
  // between vectors (knee->hip) and (knee->ankle).
  // For a straight leg (180 deg): hip, knee, ankle are collinear vertically.
  // For a deep squat (90 deg): ankle is offset so the angle is acute.
  const rad = (kneeAngleDeg * Math.PI) / 180;

  // Hip position (fixed, above knee in screen coords)
  const hipY = 0.45;
  const hipX = 0.50;

  // Knee is below the hip
  const kneeY = 0.65;
  const kneeX = 0.50;

  // knee->hip direction in screen coords
  const kneeToHipDx = hipX - kneeX; // 0
  const kneeToHipDy = hipY - kneeY; // -0.20
  const kneeToHipAngle = Math.atan2(kneeToHipDy, kneeToHipDx); // -pi/2

  // Rotate by kneeAngleDeg from the knee->hip direction to get knee->ankle direction
  const legLen = 0.20;
  const ankleDirectionAngle = kneeToHipAngle + rad;
  const ankleX = kneeX + legLen * Math.cos(ankleDirectionAngle);
  const ankleY = kneeY + legLen * Math.sin(ankleDirectionAngle);

  // Shoulder position (upright trunk)
  const shoulderY = 0.25;

  return fakeLandmarks({
    11: { x: 0.45, y: shoulderY },   // left shoulder
    12: { x: 0.55, y: shoulderY },   // right shoulder
    23: { x: hipX - 0.03, y: hipY }, // left hip
    24: { x: hipX + 0.03, y: hipY }, // right hip
    25: { x: kneeX - 0.03, y: kneeY }, // left knee
    26: { x: kneeX + 0.03, y: kneeY }, // right knee
    27: { x: ankleX - 0.03, y: ankleY }, // left ankle
    28: { x: ankleX + 0.03, y: ankleY }, // right ankle
  });
}

/**
 * Create landmarks that simulate a bicep curl position.
 * The elbow angle is set to the given value.
 *
 * calculateAngle(shoulder, elbow, wrist) measures the angle at the elbow
 * vertex between the shoulder-elbow and elbow-wrist vectors.
 * 170 degrees = arm nearly straight (extended).
 * 40 degrees = arm fully curled.
 *
 * @param {number} elbowAngleDeg - Desired elbow angle (170=extended, 40=curled)
 * @returns {Array} 33-point landmark array
 */
export function fakeCurlFrame(elbowAngleDeg) {
  const rad = (elbowAngleDeg * Math.PI) / 180;

  // Shoulder fixed at top
  const shoulderX = 0.45, shoulderY = 0.25;
  // Elbow directly below shoulder (upper arm hangs vertically)
  const elbowX = 0.45, elbowY = 0.45;

  // calculateAngle(shoulder, elbow, wrist) computes the angle at elbow
  // between vectors (elbow->shoulder) and (elbow->wrist).
  // For a straight arm (180 deg): wrist is directly below elbow (same direction as shoulder->elbow).
  // For a fully curled arm (40 deg): wrist is near the shoulder.
  //
  // In screen coords (y increases downward):
  //   shoulder is above elbow: shoulder-elbow direction in screen = (0, -0.20)
  //   elbow->shoulder vector: (0, -0.20)
  //
  // We need elbow->wrist to form elbowAngleDeg with elbow->shoulder.
  // For 180 deg: wrist below elbow (same line), elbow->wrist = (0, 0.15) in screen.
  // For 40 deg: wrist near shoulder level.
  //
  // elbow->shoulder direction angle in screen coords using atan2(dy, dx):
  //   dy = shoulderY - elbowY = -0.20, dx = 0 => atan2(-0.20, 0) = -pi/2
  //
  // We place wrist at angle = elbowToShoulderScreenAngle + elbowAngleDeg from the
  // elbow->shoulder direction, measured in screen coords.
  const forearmLen = 0.15;
  const elbowToShoulderDx = shoulderX - elbowX; // 0
  const elbowToShoulderDy = shoulderY - elbowY; // -0.20
  const elbowToShoulderScreenAngle = Math.atan2(elbowToShoulderDy, elbowToShoulderDx); // -pi/2

  // Rotate by elbowAngleDeg from the elbow->shoulder direction to get elbow->wrist direction.
  // The sign of rotation does not matter for the angle magnitude; we choose one consistently.
  const wristDirAngle = elbowToShoulderScreenAngle + rad;
  const wristX = elbowX + forearmLen * Math.cos(wristDirAngle);
  const wristY = elbowY + forearmLen * Math.sin(wristDirAngle);

  return fakeLandmarks({
    11: { x: shoulderX, y: shoulderY },
    12: { x: shoulderX + 0.16, y: shoulderY },
    13: { x: elbowX, y: elbowY },
    14: { x: elbowX + 0.16, y: elbowY },
    15: { x: wristX, y: wristY },
    16: { x: wristX + 0.16, y: wristY },
    // Standing upright — knees and hips nearly straight
    23: { x: 0.47, y: 0.52 },
    24: { x: 0.53, y: 0.52 },
    25: { x: 0.46, y: 0.72 },
    26: { x: 0.54, y: 0.72 },
    27: { x: 0.45, y: 0.92 },
    28: { x: 0.55, y: 0.92 },
  });
}
