
// Node.js shim for benchmark replay.
// Re-exports geometry from the shared module (single source of truth)
// and stubs MediaPipe-dependent functions that benchmarks don't call.

export {
  LANDMARKS,
  calculateAngle,
  extractJointAngles,
  selectSubjectPose,
} from './poseGeometry.js';

const VIS_INTERP_THRESHOLD = 0.45;
const MAX_INTERP_GAP = 15;

export function interpolateOccludedLandmarks(landmarksArray, visThreshold = VIS_INTERP_THRESHOLD) {
  if (!landmarksArray || landmarksArray.length < 3) return landmarksArray;
  const N = landmarksArray.length;
  const out = landmarksArray.map(frame =>
    frame ? frame.map(lm => ({ ...lm })) : null
  );
  for (let li = 0; li < 33; li++) {
    const vis = new Array(N);
    for (let f = 0; f < N; f++) {
      vis[f] = out[f] && out[f][li] ? (out[f][li].visibility || 0) : 0;
    }
    let i = 0;
    while (i < N) {
      if (vis[i] >= visThreshold) { i++; continue; }
      const runStart = i;
      while (i < N && vis[i] < visThreshold) i++;
      const runEnd = i;
      let before = runStart - 1;
      while (before >= 0 && vis[before] < visThreshold) before--;
      let after = runEnd;
      while (after < N && vis[after] < visThreshold) after++;
      const hasBefore = before >= 0 && out[before] && out[before][li];
      const hasAfter = after < N && out[after] && out[after][li];
      if (!hasBefore && !hasAfter) continue;
      const gapLen = runEnd - runStart;
      if (gapLen > MAX_INTERP_GAP) continue;
      for (let f = runStart; f < runEnd; f++) {
        if (!out[f] || !out[f][li]) continue;
        if (hasBefore && hasAfter) {
          const t = (f - before) / (after - before);
          const lmB = out[before][li];
          const lmA = out[after][li];
          out[f][li].x = lmB.x + t * (lmA.x - lmB.x);
          out[f][li].y = lmB.y + t * (lmA.y - lmB.y);
          out[f][li].z = (lmB.z || 0) + t * ((lmA.z || 0) - (lmB.z || 0));
          out[f][li].visibility = lmB.visibility + t * (lmA.visibility - lmB.visibility);
        } else {
          const ref = hasBefore ? out[before][li] : out[after][li];
          out[f][li].x = ref.x;
          out[f][li].y = ref.y;
          out[f][li].z = ref.z || 0;
        }
      }
    }
  }
  return out;
}

// Stubs for functions RepCounter doesn't actually call during finalize
export function getImageLandmarker() { return null; }
export function detectPoseImage() { return null; }
export function drawSkeleton() {}
export function loadModelWithRetry() { return Promise.resolve(null); }
