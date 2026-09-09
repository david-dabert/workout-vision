/**
 * Camera viewpoint inference from MediaPipe landmarks.
 *
 * Determines whether the camera is positioned in front, to the side,
 * or behind the subject, based on shoulder width vs torso height ratio
 * and nose-hip-ankle alignment.
 *
 * Used by the analysis pipeline to select the most reliable signals
 * for each exercise (e.g., side-view is better for squats, front-view
 * for bench press depth-axis signals).
 */

import { LANDMARKS } from './poseAnalysis';

/**
 * @typedef {Object} ViewpointResult
 * @property {'front'|'side'|'rear'|'unknown'} angle
 * @property {number} confidence - 0-1
 */

/**
 * Detect camera viewpoint from a single frame of landmarks.
 *
 * Heuristics:
 * - Shoulder width (x-distance) vs torso height ratio:
 *   Wide shoulders + visible hips = front or rear view.
 *   Narrow shoulders + hips at similar x = side view.
 * - Nose-hip-ankle x-alignment distinguishes front from rear:
 *   Front view: nose visible with high confidence.
 *   Rear view: nose occluded (low visibility).
 *
 * @param {Array} landmarks - 33 MediaPipe pose landmarks
 * @returns {ViewpointResult}
 */
export function detectViewpoint(landmarks) {
  if (!landmarks || landmarks.length < 33) {
    return { angle: 'unknown', confidence: 0 };
  }

  const ls = landmarks[LANDMARKS.LEFT_SHOULDER];
  const rs = landmarks[LANDMARKS.RIGHT_SHOULDER];
  const lh = landmarks[LANDMARKS.LEFT_HIP];
  const rh = landmarks[LANDMARKS.RIGHT_HIP];
  const nose = landmarks[LANDMARKS.NOSE];

  // Need at least shoulders and hips
  if (!ls || !rs || !lh || !rh) {
    return { angle: 'unknown', confidence: 0 };
  }

  const shoulderWidth = Math.abs(ls.x - rs.x);
  const midShoulderY = (ls.y + rs.y) / 2;
  const midHipY = (lh.y + rh.y) / 2;
  const torsoHeight = Math.abs(midHipY - midShoulderY);

  // Avoid division by zero
  if (torsoHeight < 0.01) {
    return { angle: 'unknown', confidence: 0 };
  }

  const widthToHeight = shoulderWidth / torsoHeight;

  // Hip x-spread (should be similar to shoulders for front/rear)
  const hipWidth = Math.abs(lh.x - rh.x);

  // Nose visibility for front vs rear
  const noseVis = nose ? (nose.visibility || 0) : 0;

  // Side view indicators:
  // - Narrow shoulder spread (< 0.35 of torso height)
  // - Hips at similar x position
  const isSideView = widthToHeight < 0.35;

  // Front/rear indicators:
  // - Wide shoulder spread (> 0.5 of torso height)
  const isFrontalView = widthToHeight > 0.5;

  if (isSideView) {
    const confidence = Math.min(1, (0.35 - widthToHeight) / 0.20 * 0.5 + 0.5);
    return { angle: 'side', confidence: Math.round(confidence * 100) / 100 };
  }

  if (isFrontalView) {
    // Distinguish front from rear using nose visibility
    if (noseVis > 0.6) {
      const confidence = Math.min(1, noseVis * 0.6 + (widthToHeight - 0.5) * 0.4);
      return { angle: 'front', confidence: Math.round(confidence * 100) / 100 };
    } else if (noseVis < 0.3) {
      const confidence = Math.min(1, (1 - noseVis) * 0.5 + (widthToHeight - 0.5) * 0.3);
      return { angle: 'rear', confidence: Math.round(confidence * 100) / 100 };
    }
    // Ambiguous nose visibility: lean toward front but low confidence
    return { angle: 'front', confidence: 0.4 };
  }

  // In-between: moderate width ratio, uncertain
  return { angle: 'unknown', confidence: 0.2 };
}

/**
 * Detect viewpoint from multiple frames (more robust).
 * Takes the majority vote across frames.
 *
 * @param {Array<Array>} frames - array of landmark arrays
 * @returns {ViewpointResult}
 */
export function detectViewpointFromFrames(frames) {
  if (!frames || frames.length === 0) {
    return { angle: 'unknown', confidence: 0 };
  }

  const votes = { front: 0, side: 0, rear: 0, unknown: 0 };
  let totalConf = 0;
  let count = 0;

  for (const frame of frames) {
    const result = detectViewpoint(frame);
    votes[result.angle]++;
    totalConf += result.confidence;
    count++;
  }

  if (count === 0) return { angle: 'unknown', confidence: 0 };

  // Find winner
  let bestAngle = 'unknown';
  let bestCount = 0;
  for (const [angle, cnt] of Object.entries(votes)) {
    if (cnt > bestCount) {
      bestCount = cnt;
      bestAngle = angle;
    }
  }

  const confidence = (bestCount / count) * (totalConf / count);
  return {
    angle: bestAngle,
    confidence: Math.round(Math.min(1, confidence) * 100) / 100,
  };
}
