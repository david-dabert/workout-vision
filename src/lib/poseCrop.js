/**
 * Second look on a lost frame (audit of 6 October, action 3). The pose model runs on the whole frame (IMAGE mode;
 * its person detector sees the frame shrunk to 224 px), so a body that fills little of the frame drops out on
 * scattered samples: David's hip thrust of 5 October (sets-05oct/hip_thrust_13) has a pose in 105 of 280 samples
 * mid-set. On a frame where the whole-frame pass finds no pose, the model runs again on a square crop around the
 * last accepted pose, drawn larger, and the landmarks found are mapped back to the whole frame.
 *
 * Pure geometry here; the detection itself is in poseAnalysis.js (detectPoseImage).
 */

// Crop side = CROP_SCALE x the larger side of the last pose's box, so a body that moves or stretches between two
// samples stays inside. Source: UNSOURCED (the audit's proposal). Status: experimental (measured on synthetic
// far-camera sets only, test/real-phone/far-camera/README.md).
export const CROP_SCALE = 2;
// The crop is drawn on a canvas of CROP_PX x CROP_PX before detection. Source: UNSOURCED (the audit's range,
// 256-512; MediaPipe's pose detector reads 224 px, so a larger canvas adds no detail to it). Status: experimental.
export const CROP_PX = 256;
// A seed older than this (no pose accepted for that long) is not used: the person may have moved anywhere.
// Source: UNSOURCED (the audit's proposal). Status: experimental.
export const CROP_SEED_MS = 1000;
// The smallest crop side in frame pixels, so a collapsed skeleton's tiny box never yields a crop of a few pixels.
// Source: UNSOURCED. Status: experimental.
export const CROP_MIN_SIDE_PX = 64;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/**
 * The square crop around a pose: { sx, sy, side } in frame pixels, inside the frame, or null.
 * landmarks: normalised image landmarks (points outside the frame are clamped to its edge).
 */
export function cropAround(landmarks, width, height) {
  if (!landmarks?.length || !(width > 0) || !(height > 0)) return null;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of landmarks) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const x = clamp(p.x, 0, 1) * width, y = clamp(p.y, 0, 1) * height;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (!Number.isFinite(x0) || !Number.isFinite(y0)) return null;
  const side = Math.min(Math.max(CROP_SCALE * Math.max(x1 - x0, y1 - y0), CROP_MIN_SIDE_PX), width, height);
  const sx = clamp((x0 + x1) / 2 - side / 2, 0, width - side), sy = clamp((y0 + y1) / 2 - side / 2, 0, height - side);
  return { sx, sy, side };
}

/**
 * Landmarks found in the crop (normalised to the crop) mapped to the whole frame's normalised coordinates.
 * z is MediaPipe's depth on the scale of x, so it is scaled as x is; visibility and presence are kept.
 */
export function mapFromCrop(landmarks, { sx, sy, side }, width, height) {
  return landmarks.map(p => ({ ...p, x: (sx + p.x * side) / width, y: (sy + p.y * side) / height, z: (p.z * side) / width }));
}
