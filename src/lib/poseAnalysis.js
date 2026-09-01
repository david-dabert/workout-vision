/**
 * Pose analysis engine — MediaPipe Pose Landmarker (unified single instance).
 * Runs on-device (WASM + GPU with CPU fallback).
 *
 * Architecture:
 * - Single full model instance shared between live camera and video upload.
 * - VIDEO running mode (works for both live and frame-by-frame analysis).
 * - GPU delegate with automatic CPU fallback.
 * - Retry with exponential backoff on load failure.
 * - Confidence-decayed ghost pose when detection drops frames.
 */

import localforage from 'localforage';

// ─── CDN lazy loader: bypasses Vite's esbuild minifier which breaks MediaPipe WASM on iOS Safari ───
let _mpVision = null;
async function getMediaPipeVision() {
  if (_mpVision) return _mpVision;
  _mpVision = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/+esm');
  return _mpVision;
}

const modelCache = localforage.createInstance({ name: 'wv-model-cache' });
const MODEL_CACHE_KEY = 'pose-landmarker-full-v1';

let poseLandmarker = null;
let modelLoadPromise = null;
let lastVideoTime = -1;
let lastResult = null;

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

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const VISION_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

// ─── Core: single model instance with IndexedDB cache ───

// Progress callback set by loadModelWithRetry, read by fetchModelBuffer
let _downloadProgressCb = null;

async function fetchModelBuffer() {
  // Try IndexedDB cache first (instant on repeat visits, works offline)
  try {
    const cached = await modelCache.getItem(MODEL_CACHE_KEY);
    if (cached) {
      console.log('[PoseAnalysis] Model loaded from IndexedDB cache');
      return cached;
    }
  } catch (_) {}

  // Fetch from CDN with progressive download reporting
  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error(`Model fetch failed: ${response.status}`);

  const contentLength = parseInt(response.headers.get('Content-Length') || '0', 10);

  // If streaming body is available and content-length known, use progressive download
  if (response.body && contentLength > 0) {
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (_downloadProgressCb) {
        const percent = Math.round((received / contentLength) * 100);
        _downloadProgressCb(percent);
      }
    }

    // Assemble into single ArrayBuffer
    const buffer = new ArrayBuffer(received);
    const view = new Uint8Array(buffer);
    let offset = 0;
    for (const chunk of chunks) {
      view.set(chunk, offset);
      offset += chunk.length;
    }

    modelCache.setItem(MODEL_CACHE_KEY, buffer).catch(() => {});
    console.log('[PoseAnalysis] Model fetched from CDN (progressive) and cached');
    return buffer;
  }

  // Fallback: no Content-Length or no streaming body (older browsers)
  const buffer = await response.arrayBuffer();
  modelCache.setItem(MODEL_CACHE_KEY, buffer).catch(() => {});
  console.log('[PoseAnalysis] Model fetched from CDN (fallback) and cached');
  return buffer;
}

async function createLandmarker() {
  const mp = await getMediaPipeVision();
  const vision = await mp.FilesetResolver.forVisionTasks(VISION_WASM);
  const modelBuffer = await fetchModelBuffer();

  for (const delegate of ['GPU', 'CPU']) {
    try {
      const landmarker = await mp.PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetBuffer: new Uint8Array(modelBuffer), delegate },
        runningMode: 'VIDEO',
        numPoses: 3,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      console.log(`[PoseAnalysis] Created with ${delegate} delegate`);
      return landmarker;
    } catch (e) {
      console.warn(`[PoseAnalysis] ${delegate} delegate failed:`, e.message);
      if (delegate === 'CPU') throw e;
    }
  }
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function getPoseLandmarker() {
  if (poseLandmarker) return Promise.resolve(poseLandmarker);
  if (modelLoadPromise) return modelLoadPromise;
  modelLoadPromise = (async () => {
    poseLandmarker = await withTimeout(createLandmarker(), 120000, 'Model load');
    return poseLandmarker;
  })();
  return modelLoadPromise;
}

// ─── Public API ───

/**
 * Preload model at app startup. Returns true on success.
 */
export function preloadModel() {
  return getPoseLandmarker().then(() => true).catch((e) => {
    console.error('[PoseAnalysis] Preload failed:', e);
    modelLoadPromise = null;
    return false;
  });
}

/**
 * Load model with retry and progress callback.
 * @param {function} onProgress - (progress: number, message: string) => void
 * @param {number} attempt - current attempt number
 */
export async function loadModelWithRetry(onProgress, attempt = 1) {
  const MAX_ATTEMPTS = 3;
  onProgress?.(10 + (attempt - 1) * 30, `Loading AI engine... Attempt ${attempt}/${MAX_ATTEMPTS}`);

  // Wire progressive download progress into the onProgress callback
  _downloadProgressCb = (percent) => {
    // Map download progress (0-100%) into the 10-85 range of the overall progress bar
    const mapped = 10 + Math.round(percent * 0.75);
    onProgress?.(mapped, `Downloading model: ${percent}%`);
  };

  try {
    const landmarker = await getPoseLandmarker();
    _downloadProgressCb = null;
    onProgress?.(100, 'AI Engine Ready');
    return landmarker;
  } catch (err) {
    _downloadProgressCb = null;
    // Reset so next attempt can try fresh
    modelLoadPromise = null;
    poseLandmarker = null;

    if (attempt < MAX_ATTEMPTS) {
      const delay = Math.pow(2, attempt) * 1000;
      onProgress?.(10 + attempt * 30, `Retrying in ${delay / 1000}s... (${err.message})`);
      await new Promise(r => setTimeout(r, delay));
      return loadModelWithRetry(onProgress, attempt + 1);
    }
    throw new Error(`Failed to load AI model after ${MAX_ATTEMPTS} attempts. Check your connection.`);
  }
}

/**
 * Get the unified landmarker instance (for live camera).
 */
export async function getVideoLandmarker() {
  return getPoseLandmarker();
}

/**
 * Get the unified landmarker instance (for image/video upload).
 * Same instance — VIDEO mode handles single frames fine with unique timestamps.
 */
export async function getImageLandmarker() {
  return getPoseLandmarker();
}

/**
 * Dispose the landmarker and free WebGL context.
 */
export function disposeAllLandmarkers() {
  if (poseLandmarker) {
    try { poseLandmarker.close(); } catch (_) {}
    poseLandmarker = null;
  }
  modelLoadPromise = null;
  lastVideoTime = -1;
  lastResult = null;
}

/**
 * Detect pose on a single image/frame (video upload analysis).
 * Uses detectForVideo with a unique timestamp for compatibility with VIDEO mode.
 */
export function detectPoseImage(landmarker, source) {
  try {
    const ts = performance.now();
    return landmarker.detectForVideo(source, ts);
  } catch (e) {
    console.warn('[PoseAnalysis] Detection error (image):', e);
    return null;
  }
}

/**
 * Detect pose on video frame (live camera).
 * Caches last valid result for confidence decay.
 */
export function detectPoseVideo(landmarker, videoElement, timestamp) {
  const EPSILON = 0.001;
  if (Math.abs(timestamp - lastVideoTime) < EPSILON) {
    return lastResult;
  }
  lastVideoTime = timestamp;
  try {
    const result = landmarker.detectForVideo(videoElement, timestamp);
    // Free segmentation masks to prevent GPU memory leaks on mobile
    if (result && result.segmentationMasks) {
      result.segmentationMasks.forEach(m => { try { m.close(); } catch (_) {} });
    }
    if (result && result.landmarks && result.landmarks.length > 0) {
      lastResult = result;
    }
    return result;
  } catch (e) {
    console.warn('[PoseAnalysis] Detection error (video):', e);
    return lastResult;
  }
}

export function resetTimestamp() {
  lastVideoTime = -1;
  lastResult = null;
}

// ─── Person lock: select the subject (largest + most centered) ───

/**
 * From multiple detected poses, select the one most likely to be the user.
 * Prioritizes body area (closest to camera = largest bounding box) and
 * penalizes distance from frame center. In a gym selfie, the user is the
 * largest and most centered person; background people are smaller and off-center.
 */
export function selectSubjectPose(landmarksArray) {
  if (!landmarksArray || landmarksArray.length === 0) return null;
  if (landmarksArray.length === 1) return landmarksArray[0];

  let bestPose = landmarksArray[0];
  let bestScore = -Infinity;

  for (const pose of landmarksArray) {
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const lm of pose) {
      if ((lm.visibility || 0) < 0.3) continue;
      minX = Math.min(minX, lm.x);
      maxX = Math.max(maxX, lm.x);
      minY = Math.min(minY, lm.y);
      maxY = Math.max(maxY, lm.y);
    }
    const area = (maxX - minX) * (maxY - minY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    // Distance from frame center (0.5, 0.5) in normalized coords
    const dist = Math.sqrt((cx - 0.5) ** 2 + (cy - 0.5) ** 2);
    // Area dominates; center distance is a tiebreaker
    const score = area * 1000 - dist * 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestPose = pose;
    }
  }
  return bestPose;
}

// ─── Geometry ───

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

// ─── Drawing ───

// ─── Form check → affected landmark indices ───
const FORM_CHECK_LANDMARKS = {
  'Knee valgus': [23, 24, 25, 26, 27, 28],
  'Hip depth': [11, 12, 23, 24, 25, 26],
  'Trunk angle': [11, 12, 23, 24],
  'Bar path': [13, 14, 15, 16],
  'Elbow flare': [11, 12, 13, 14, 15, 16],
  'Wrist position': [13, 14, 15, 16],
  'Scapular retraction': [11, 12],
  'Lumbar flexion': [11, 12, 23, 24],
  'Hip hinge': [23, 24, 25, 26, 27, 28],
  'Knee position': [23, 24, 25, 26, 27, 28],
  'Shoulder protraction': [11, 12, 13, 14],
  'Tempo': [],
};

function getSegmentColor(i, j, formFeedback) {
  if (!formFeedback || formFeedback.length === 0) return '#00f5d4';
  let hasMajor = false, hasMinor = false;
  for (const f of formFeedback) {
    if (f.passed) continue;
    const affected = FORM_CHECK_LANDMARKS[f.name] || [];
    const hit = affected.includes(i) || affected.includes(j);
    if (hit && f.severity === 'major') hasMajor = true;
    if (hit && f.severity === 'minor') hasMinor = true;
  }
  if (hasMajor) return '#ff3b5c';
  if (hasMinor) return '#ffb836';
  return '#00f5d4';
}

/**
 * Draw skeleton overlay with alpha and optional form feedback.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} landmarks - MediaPipe pose landmarks
 * @param {number} width - canvas width
 * @param {number} height - canvas height
 * @param {number} alpha - opacity
 * @param {Array|null} formFeedback - array of {name, passed, severity} from RepCounter
 */
export function drawPose(ctx, landmarks, width, height, alpha = 1.0, formFeedback = null) {
  if (!landmarks || landmarks.length === 0) return;
  const connections = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24],
    [23, 25], [25, 27], [24, 26], [26, 28],
    [27, 29], [29, 31], [28, 30], [30, 32],
  ];

  ctx.globalAlpha = alpha;

  const baseW = Math.max(8, width / 40); // ~12px on 480p, ~27px on 1080p

  // Glow layer — wide soft neon behind the skeleton
  ctx.lineCap = 'round';
  ctx.lineWidth = baseW * 3;
  for (const [i, j] of connections) {
    if (landmarks[i] && landmarks[j] && (landmarks[i].visibility || 0) > 0.3 && (landmarks[j].visibility || 0) > 0.3) {
      const color = getSegmentColor(i, j, formFeedback);
      ctx.strokeStyle = color === '#ff3b5c' ? 'rgba(255,59,92,0.25)'
        : color === '#ffb836' ? 'rgba(255,184,54,0.25)'
        : 'rgba(0,245,212,0.25)';
      ctx.beginPath();
      ctx.moveTo(landmarks[i].x * width, landmarks[i].y * height);
      ctx.lineTo(landmarks[j].x * width, landmarks[j].y * height);
      ctx.stroke();
    }
  }

  // Shadow/outline
  ctx.lineWidth = baseW + 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  for (const [i, j] of connections) {
    if (landmarks[i] && landmarks[j] && (landmarks[i].visibility || 0) > 0.3 && (landmarks[j].visibility || 0) > 0.3) {
      ctx.beginPath();
      ctx.moveTo(landmarks[i].x * width, landmarks[i].y * height);
      ctx.lineTo(landmarks[j].x * width, landmarks[j].y * height);
      ctx.stroke();
    }
  }

  // Skeleton segments — color-coded by form feedback
  ctx.lineWidth = baseW;
  for (const [i, j] of connections) {
    if (landmarks[i] && landmarks[j] && (landmarks[i].visibility || 0) > 0.3 && (landmarks[j].visibility || 0) > 0.3) {
      ctx.strokeStyle = getSegmentColor(i, j, formFeedback);
      ctx.beginPath();
      ctx.moveTo(landmarks[i].x * width, landmarks[i].y * height);
      ctx.lineTo(landmarks[j].x * width, landmarks[j].y * height);
      ctx.stroke();
    }
  }

  // Joints — bold circles with dark outline
  const dotSize = baseW * 0.8;
  for (const lm of landmarks) {
    if ((lm.visibility || 0) < 0.3) continue;
    const x = lm.x * width, y = lm.y * height;
    // Dark outline
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.arc(x, y, dotSize + 2, 0, 2 * Math.PI);
    ctx.fill();
    // Bright joint
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, dotSize, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.globalAlpha = 1.0;
}

/**
 * Draw overlay message when no pose detected.
 */
export function drawOverlayMessage(ctx, line1, line2) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = '#f0f0f5';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(line1, ctx.canvas.width / 2, ctx.canvas.height / 2 - 15);
  ctx.font = '16px sans-serif';
  ctx.fillText(line2, ctx.canvas.width / 2, ctx.canvas.height / 2 + 15);
}
