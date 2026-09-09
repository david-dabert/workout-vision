/**
 * Camera Perspective Auto-Calibration
 *
 * During a 3-second setup phase ("Stand tall facing camera"), captures the user's
 * standing pose and computes a normalization transform. This corrects for:
 *   - Phone angle (tilted up/down)
 *   - Camera height (placed on floor vs chest-height)
 *   - Distance from camera (person scale in frame)
 *
 * The transform normalizes coordinates so that the trunk axis is vertical and
 * joint angles are camera-angle-invariant. Applied to all subsequent frames.
 */

const LANDMARKS = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
};

/**
 * Collect calibration frames during the 3-second "stand tall" phase.
 * Returns a calibration object when enough stable frames are collected.
 *
 * @param {Array<Array>} landmarkFrames - Array of per-frame landmarks from the setup phase
 * @param {number} fps - Frame rate
 * @returns {Object|null} Calibration transform, or null if insufficient data
 */
export function computeCalibration(landmarkFrames, fps = 15) {
  if (!landmarkFrames || landmarkFrames.length < fps) return null; // need at least 1 second

  // Average the landmark positions over all calibration frames (reduces jitter)
  const avgLandmarks = new Array(33);
  for (let i = 0; i < 33; i++) {
    let sx = 0, sy = 0, sz = 0, count = 0;
    for (const frame of landmarkFrames) {
      if (!frame || !frame[i] || (frame[i].visibility || 0) < 0.3) continue;
      sx += frame[i].x;
      sy += frame[i].y;
      sz += frame[i].z || 0;
      count++;
    }
    if (count > 0) {
      avgLandmarks[i] = { x: sx / count, y: sy / count, z: sz / count, visibility: 1 };
    } else {
      avgLandmarks[i] = { x: 0.5, y: 0.5, z: 0, visibility: 0 };
    }
  }

  // Compute trunk axis (midShoulder → midHip) in the standing pose
  const midShoulder = {
    x: (avgLandmarks[LANDMARKS.LEFT_SHOULDER].x + avgLandmarks[LANDMARKS.RIGHT_SHOULDER].x) / 2,
    y: (avgLandmarks[LANDMARKS.LEFT_SHOULDER].y + avgLandmarks[LANDMARKS.RIGHT_SHOULDER].y) / 2,
  };
  const midHip = {
    x: (avgLandmarks[LANDMARKS.LEFT_HIP].x + avgLandmarks[LANDMARKS.RIGHT_HIP].x) / 2,
    y: (avgLandmarks[LANDMARKS.LEFT_HIP].y + avgLandmarks[LANDMARKS.RIGHT_HIP].y) / 2,
  };

  // Trunk vector (should be vertical in ideal camera position)
  const trunkDx = midShoulder.x - midHip.x;
  const trunkDy = midShoulder.y - midHip.y;
  const trunkLen = Math.sqrt(trunkDx * trunkDx + trunkDy * trunkDy);

  if (trunkLen < 0.05) return null; // Person too small or not visible

  // Rotation angle to make trunk vertical (trunk should point straight up = negative y)
  // In normalized coords, up = negative y. Ideal trunk vector is (0, -1).
  // Current trunk vector is (trunkDx/trunkLen, trunkDy/trunkLen).
  // Rotation to align: angle between current trunk and (0, -1)
  const currentAngle = Math.atan2(trunkDx, -trunkDy); // angle from vertical

  // Scale factor: normalize person height to a reference proportion
  // Full standing height approximation: midAnkle to midShoulder
  const midAnkle = {
    x: (avgLandmarks[LANDMARKS.LEFT_ANKLE].x + avgLandmarks[LANDMARKS.RIGHT_ANKLE].x) / 2,
    y: (avgLandmarks[LANDMARKS.LEFT_ANKLE].y + avgLandmarks[LANDMARKS.RIGHT_ANKLE].y) / 2,
  };
  const fullHeight = Math.sqrt(
    (midShoulder.x - midAnkle.x) ** 2 + (midShoulder.y - midAnkle.y) ** 2
  );

  // Reference: person should occupy ~60% of frame height for good detection
  const refHeight = 0.6;
  const scale = fullHeight > 0.1 ? refHeight / fullHeight : 1;

  // Center: person center (midpoint of midShoulder and midHip)
  const centerX = (midShoulder.x + midHip.x) / 2;
  const centerY = (midShoulder.y + midHip.y) / 2;

  // Shoulder width for aspect ratio normalization
  const shoulderWidth = Math.abs(
    avgLandmarks[LANDMARKS.LEFT_SHOULDER].x - avgLandmarks[LANDMARKS.RIGHT_SHOULDER].x
  );

  return {
    rotationAngle: currentAngle,
    scale,
    centerX,
    centerY,
    trunkLength: trunkLen,
    shoulderWidth,
    frameCount: landmarkFrames.length,
    valid: true,
  };
}

/**
 * Apply calibration transform to a set of landmarks.
 * Rotates and scales coordinates so the person's trunk axis is vertical
 * and person size is normalized regardless of camera angle/distance.
 *
 * @param {Array} landmarks - 33-element landmark array
 * @param {Object} calibration - From computeCalibration()
 * @returns {Array} Transformed landmarks (new array, does not mutate input)
 */
export function applyCalibration(landmarks, calibration) {
  if (!landmarks || !calibration || !calibration.valid) return landmarks;

  const { rotationAngle, scale, centerX, centerY } = calibration;
  const cos = Math.cos(-rotationAngle);
  const sin = Math.sin(-rotationAngle);

  return landmarks.map(lm => {
    if (!lm) return lm;
    // Translate to center
    const dx = lm.x - centerX;
    const dy = lm.y - centerY;
    // Rotate to vertical
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    // Scale and translate back to [0,1] space
    return {
      x: rx * scale + 0.5,
      y: ry * scale + 0.5,
      z: lm.z * scale,
      visibility: lm.visibility,
    };
  });
}

/**
 * Check if calibration frames show a stable standing pose.
 * Returns a stability score (0-1) where 1 = perfectly still.
 *
 * @param {Array<Array>} landmarkFrames
 * @returns {number} Stability score
 */
function checkCalibrationStability(landmarkFrames) {
  if (!landmarkFrames || landmarkFrames.length < 5) return 0;

  // Check variance of key joint positions across frames
  const keyPoints = [
    LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER,
    LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP,
  ];

  let totalVariance = 0;
  let count = 0;

  for (const idx of keyPoints) {
    const xs = [], ys = [];
    for (const frame of landmarkFrames) {
      if (!frame || !frame[idx] || (frame[idx].visibility || 0) < 0.3) continue;
      xs.push(frame[idx].x);
      ys.push(frame[idx].y);
    }
    if (xs.length < 3) continue;
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    const varX = xs.reduce((a, x) => a + (x - meanX) ** 2, 0) / xs.length;
    const varY = ys.reduce((a, y) => a + (y - meanY) ** 2, 0) / ys.length;
    totalVariance += varX + varY;
    count++;
  }

  if (count === 0) return 0;
  const avgVariance = totalVariance / count;
  // Map variance to stability: < 0.0001 = very stable (1.0), > 0.005 = unstable (0.0)
  return Math.max(0, Math.min(1, 1 - avgVariance / 0.005));
}
