/**
 * Pose analysis engine — MediaPipe Pose Landmarker.
 * Runs on-device (WASM + GPU with CPU fallback).
 *
 * Design decisions:
 * - Lite model (3MB) for fast load + inference. Heavy model gains <5% accuracy
 *   on joint angles but costs 8x model size and 3x inference time.
 * - GPU delegate with automatic CPU fallback. Many mobile GPUs reject the delegate
 *   silently; we catch and retry.
 * - IMAGE mode for video upload analysis (each frame independent — no stale
 *   temporal state between different videos).
 * - VIDEO mode for live camera (uses temporal tracking for smoother results).
 */

import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let poseLandmarkerVideo = null;
let poseLandmarkerImage = null;
let visionFiles = null;
let lastVideoTime = -1;
let modelLoadPromise = null;

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

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const VISION_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';

async function getVisionFiles() {
  if (!visionFiles) {
    visionFiles = await FilesetResolver.forVisionTasks(VISION_WASM);
  }
  return visionFiles;
}

async function createLandmarker(runningMode) {
  const vision = await getVisionFiles();

  // Try GPU first, fall back to CPU
  for (const delegate of ['GPU', 'CPU']) {
    try {
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode,
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      console.log(`Pose landmarker created with ${delegate} delegate (${runningMode})`);
      return landmarker;
    } catch (e) {
      console.warn(`${delegate} delegate failed for ${runningMode}:`, e.message);
      if (delegate === 'CPU') throw e; // both failed
    }
  }
}

/**
 * Pre-load model. Call once at app startup.
 * Uses IMAGE mode for video upload (stateless — no cross-video contamination).
 */
// Hard timeout wrapper — prevents model loading from hanging forever on mobile
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export function preloadModel() {
  if (modelLoadPromise) return modelLoadPromise;
  modelLoadPromise = (async () => {
    try {
      // Close any stale instance before creating a new one (WebGL context leak prevention)
      if (poseLandmarkerImage) {
        try { poseLandmarkerImage.close(); } catch (_) {}
        poseLandmarkerImage = null;
      }
      // 30s hard timeout: if WASM/model download stalls, fail instead of hanging forever
      poseLandmarkerImage = await withTimeout(createLandmarker('IMAGE'), 30000, 'Model load');
      console.log('[PoseAnalysis] Model loaded successfully');
      return true;
    } catch (e) {
      console.error('[PoseAnalysis] Failed to preload pose model:', e);
      modelLoadPromise = null;
      return false;
    }
  })();
  return modelLoadPromise;
}

export async function getImageLandmarker() {
  if (poseLandmarkerImage) return poseLandmarkerImage;
  await preloadModel();
  return poseLandmarkerImage;
}

export async function getVideoLandmarker() {
  if (poseLandmarkerVideo) return poseLandmarkerVideo;
  // No early return — close any zombie reference before creating (WebGL context leak prevention)
  poseLandmarkerVideo = await createLandmarker('VIDEO');
  return poseLandmarkerVideo;
}

/**
 * Dispose all active landmarker instances.
 * Call on component unmount to free WebGL contexts.
 * iOS Safari hard-limits ~16 contexts; without disposal,
 * navigating between LiveCamera and VideoUpload leaks them.
 */
export function disposeAllLandmarkers() {
  if (poseLandmarkerVideo) {
    try { poseLandmarkerVideo.close(); } catch (_) { /* already closed */ }
    poseLandmarkerVideo = null;
  }
  if (poseLandmarkerImage) {
    try { poseLandmarkerImage.close(); } catch (_) { /* already closed */ }
    poseLandmarkerImage = null;
  }
  modelLoadPromise = null;
  lastVideoTime = -1;
}

/**
 * Detect pose on a single frame (for video upload analysis).
 * Uses IMAGE mode — each frame is independent, no temporal state
 * that could contaminate results when analyzing multiple videos.
 */
export function detectPoseImage(landmarker, source) {
  try {
    return landmarker.detect(source);
  } catch (e) {
    console.warn('Pose detection error (image):', e);
    return null;
  }
}

/**
 * Detect pose on video frame (for live camera).
 */
export function detectPoseVideo(landmarker, videoElement, timestamp) {
  if (timestamp === lastVideoTime) return null;
  lastVideoTime = timestamp;
  try {
    return landmarker.detectForVideo(videoElement, timestamp);
  } catch (e) {
    console.warn('Pose detection error (video):', e);
    return null;
  }
}

export function resetTimestamp() {
  lastVideoTime = -1;
}

/**
 * Calculate angle between three 3D points (degrees).
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

/**
 * Extract all key joint angles from landmarks.
 * Includes per-side visibility so bilateral exercises can use the better-tracked side.
 */
export function extractJointAngles(landmarks) {
  if (!landmarks || landmarks.length < 33) return null;
  const L = landmarks;

  // Visibility: minimum visibility of the three landmarks forming each joint angle.
  // MediaPipe visibility is 0-1; below ~0.5 the landmark is likely hallucinated.
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
    // Visibility scores for bilateral selection
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

/**
 * Draw skeleton on canvas.
 */
export function drawPose(ctx, landmarks, width, height) {
  if (!landmarks || landmarks.length === 0) return;

  const connections = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24],
    [23, 25], [25, 27], [24, 26], [26, 28],
    [27, 29], [29, 31], [28, 30], [30, 32],
  ];

  ctx.strokeStyle = '#00FF88';
  ctx.lineWidth = Math.max(2, width / 200);
  ctx.lineCap = 'round';
  for (const [i, j] of connections) {
    if (landmarks[i] && landmarks[j] && (landmarks[i].visibility || 0) > 0.3 && (landmarks[j].visibility || 0) > 0.3) {
      ctx.beginPath();
      ctx.moveTo(landmarks[i].x * width, landmarks[i].y * height);
      ctx.lineTo(landmarks[j].x * width, landmarks[j].y * height);
      ctx.stroke();
    }
  }

  const dotSize = Math.max(3, width / 120);
  for (const lm of landmarks) {
    if ((lm.visibility || 0) < 0.3) continue;
    ctx.fillStyle = '#FF3355';
    ctx.beginPath();
    ctx.arc(lm.x * width, lm.y * height, dotSize, 0, 2 * Math.PI);
    ctx.fill();
  }
}
