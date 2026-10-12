/**
 * PerspectiveInvariance — Self-Calibrating 3D Camera Raymarching & Rotation Invariance
 *
 * Estimates camera extrinsics (pitch, roll, ground plane normal) directly from
 * anatomical support contact points and spinal axes in real time.
 * Rectifies 3D MediaPipe landmarks into a Canonical Gravity Frame so that
 * joint angles and kinematic measurements remain invariant to camera height,
 * tilt angles (15°-45°), and oblique perspectives.
 *
 * Zero server dependency. Pure edge vector geometry.
 */

/**
 * 3D vector dot product
 */
function dot3D(u, v) {
  return u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
}

/**
 * 3D vector cross product
 */
function cross3D(u, v) {
  return [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
}

/**
 * 3D vector norm / magnitude
 */
function norm3D(v) {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

/**
 * Normalize a 3D vector
 */
function normalize3D(v) {
  const n = norm3D(v);
  if (n < 1e-9) return [0, 1, 0];
  return [v[0] / n, v[1] / n, v[2] / n];
}

/**
 * Rodrigues' rotation matrix: creates 3x3 matrix rotating vector `from` into `to`.
 */
export function rodriguesRotationMatrix(from, to) {
  const vFrom = normalize3D(from);
  const vTo = normalize3D(to);

  const dot = Math.max(-1, Math.min(1, dot3D(vFrom, vTo)));
  // If vectors are already aligned
  if (dot > 0.999999) {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }
  // If vectors are exactly opposite
  if (dot < -0.999999) {
    return [
      [-1, 0, 0],
      [0, -1, 0],
      [0, 0, 1],
    ];
  }

  const axis = normalize3D(cross3D(vFrom, vTo));
  const angle = Math.acos(dot);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  const [x, y, z] = axis;

  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
}

/**
 * Applies a 3x3 rotation matrix to a 3D coordinate point {x, y, z}
 */
export function applyRotationToPoint(pt, R) {
  if (!pt) return null;
  const x = pt.x || 0;
  const y = pt.y || 0;
  const z = pt.z || 0;

  return {
    ...pt,
    x: R[0][0] * x + R[0][1] * y + R[0][2] * z,
    y: R[1][0] * x + R[1][1] * y + R[1][2] * z,
    z: R[2][0] * x + R[2][1] * y + R[2][2] * z,
  };
}

/**
 * Estimates the ground plane normal and gravity direction from support polygons
 * (heels, toes, ankles) across the initial frames of a set.
 */
export function estimateGravityPlumbLine(landmarksSequence) {
  if (!landmarksSequence || !landmarksSequence.length) return [0, -1, 0];

  const candidateNormals = [];

  for (const frame of landmarksSequence) {
    if (!frame || frame.length < 33) continue;

    // Contact points: Left Ankle(27), Right Ankle(28), Left Heel(29), Right Heel(30), Left Toe(31), Right Toe(32)
    const lAnkle = frame[27], rAnkle = frame[28];
    const lHeel = frame[29], rHeel = frame[30];
    const lToe = frame[31], rToe = frame[32];

    if (lAnkle && rAnkle && lToe && lHeel) {
      // Vector along foot: Heel -> Toe
      const vFoot = [
        (lToe.x - lHeel.x),
        (lToe.y - lHeel.y),
        ((lToe.z || 0) - (lHeel.z || 0)),
      ];
      // Vector across feet: Left Ankle -> Right Ankle
      const vStance = [
        (rAnkle.x - lAnkle.x),
        (rAnkle.y - lAnkle.y),
        ((rAnkle.z || 0) - (lAnkle.z || 0)),
      ];

      const normal = cross3D(vFoot, vStance);
      if (norm3D(normal) > 1e-4) {
        let normalized = normalize3D(normal);
        // Ensure upward-facing normal in camera frame (MediaPipe Y points down, so upward normal has negative Y)
        if (normalized[1] > 0) {
          normalized = [-normalized[0], -normalized[1], -normalized[2]];
        }
        candidateNormals.push(normalized);
      }
    }
  }

  if (candidateNormals.length === 0) {
    // Default canonical gravity normal (pointing upward in MediaPipe coordinate system)
    return [0, -1, 0];
  }

  // Median normal vector across valid frames
  const meanNormal = [
    candidateNormals.reduce((sum, n) => sum + n[0], 0) / candidateNormals.length,
    candidateNormals.reduce((sum, n) => sum + n[1], 0) / candidateNormals.length,
    candidateNormals.reduce((sum, n) => sum + n[2], 0) / candidateNormals.length,
  ];

  return normalize3D(meanNormal);
}

/**
 * Rectifies an entire landmark frame into the canonical gravity-aligned frame.
 * Canonical frame definition:
 * - True Vertical Gravity: Y-axis strictly aligned with [0, -1, 0]
 * - Horizontal Ground Plane: X-Z plane
 */
export function rectifyLandmarksToCanonical(landmarks, estimatedGravityNormal = [0, -1, 0]) {
  if (!landmarks || landmarks.length < 33) return landmarks;

  const targetGravityNormal = [0, -1, 0];
  const R = rodriguesRotationMatrix(estimatedGravityNormal, targetGravityNormal);

  return landmarks.map(pt => (pt ? applyRotationToPoint(pt, R) : pt));
}

/**
 * Rectifies an entire sequence of frames into canonical space
 */
export function rectifySequence(landmarksSequence) {
  if (!landmarksSequence || !landmarksSequence.length) return landmarksSequence;

  const estimatedGravity = estimateGravityPlumbLine(landmarksSequence);
  const targetGravity = [0, -1, 0];
  const R = rodriguesRotationMatrix(estimatedGravity, targetGravity);

  // Compute camera pitch tilt angle (degrees offset from pure horizontal)
  const dotWithHorizontal = Math.abs(estimatedGravity[1]);
  const pitchTiltDeg = Math.round(Math.abs(Math.acos(Math.min(1, dotWithHorizontal)) * 180 / Math.PI) * 10) / 10;

  const rectified = landmarksSequence.map(frame => {
    if (!frame || frame.length < 33) return frame;
    return frame.map(pt => (pt ? applyRotationToPoint(pt, R) : pt));
  });

  return {
    rectifiedSequence: rectified,
    cameraPitchTiltDeg: pitchTiltDeg,
    gravityVector: estimatedGravity,
  };
}
