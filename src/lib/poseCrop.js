/**
 * Second look on a lost frame (audit of 6 October, action 3). The pose model runs on the whole frame (IMAGE mode;
 * its person detector sees the frame shrunk to 224 px), so a body that fills little of the frame drops out on
 * scattered samples: David's back extension of 5 October (filed as a hip thrust until David named it on 6 October) (sets-05oct/machine_seated_back_extension_13) has a pose in 105 of 280 samples
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

/**
 * Backward pass (7 October; David's idea): a video is not live, so a frame still without a pose after the forward
 * pass (whole frame, then the crop around the LAST pose) can be read again on a crop around the NEXT accepted pose.
 * This reaches the frames before the first detection and the start of gaps the forward crop cannot seed. The app
 * keeps the pixels of the lost frames of the last BACK_KEEP_MS (no second decode), and when a pose is accepted it
 * reads them back, nearest first, each crop seeded by the pose just after it. A frame that already has a pose is
 * never read again and never changes.
 */
// The backward pass is OFF (7 October): on David's real videos it lost an exact count (barbell squat 9 -> 8 for 9) and
// moved a chin-up further off (6 -> 7 for 5), where on the synthetic far-camera sets it made 6 -> 8 of 8 exact
// (TRIED.md, "Pose detection"; test/real-phone/far-camera/README.md). Kept behind this flag for the benches
// (globalThis.__WV_BENCH_BACK__ turns it on there). Source: UNSOURCED (David's idea of 7 October). Status:
// experimental, not shipped.
export const BACK_PASS = false;
// Lost frames are kept this long, so a pose can seed a crop on the lost frames of the second before it: the forward
// crop's window, the other way. Source: UNSOURCED (same window as CROP_SEED_MS). Status: experimental.
export const BACK_KEEP_MS = CROP_SEED_MS;
// At most this many lost frames are kept (1 s at the app's 15 fps, plus one): a bound on memory whatever the
// timestamps say, about 0.9 MB each at 360 x 640. Source: UNSOURCED (arithmetic). Status: experimental.
export const BACK_MAX_FRAMES = 16;

/**
 * The lost frames still worth keeping at time `now`: those of the last `keepMs` (and not after `now`), the most
 * recent `max` of them, in time order. Returns { kept, dropped }; dropped frames may be recycled by the caller.
 */
export function keepLost(lost, now, keepMs = BACK_KEEP_MS, max = BACK_MAX_FRAMES) {
  const inWindow = lost.filter(f => f.t <= now && now - f.t <= keepMs);
  const kept = inWindow.slice(-max);
  return { kept, dropped: lost.filter(f => !kept.includes(f)) };
}

/**
 * Read lost frames backwards from a seed pose. lost: frames in time order, each { t, ... }; seed: { landmarks, t }
 * (the accepted pose just after them, image landmarks normalised to the frame). tryFrame(frame, seedLandmarks)
 * returns { landmarks, worldLandmarks } in whole-frame coordinates, or null. Frames are tried nearest first; a pose
 * found becomes the seed for the frames before it (as the forward crop chains); a frame more than seedMs before the
 * current seed ends the pass. Returns [{ frame, result }] for the frames that gained a pose, latest first.
 */
export function fillBackward(lost, seed, tryFrame, seedMs = CROP_SEED_MS) {
  const filled = [];
  let s = seed;
  for (let i = lost.length - 1; i >= 0; i--) {
    const f = lost[i];
    if (!(f.t < s.t)) continue;
    if (s.t - f.t > seedMs) break;
    const result = tryFrame(f, s.landmarks);
    if (result?.landmarks?.length) {
      filled.push({ frame: f, result });
      s = { landmarks: result.landmarks, t: f.t };
    }
  }
  return filled;
}
