
// Auto-generated shim for Node.js benchmark replay.
// Provides LANDMARKS, calculateAngle, extractJointAngles without MediaPipe.

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

function calculateTrunkAngle(landmarks) {
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
export function selectSubjectPose() { return null; }
export function drawSkeleton() {}
export function loadModelWithRetry() { return Promise.resolve(null); }
