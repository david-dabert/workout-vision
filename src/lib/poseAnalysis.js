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
import { KalmanLandmarkFilter } from './KalmanLandmarkFilter';
import { detectCapabilities, isSimdSupported } from './gpuBenchmark';
import {
  GHOST_DECAY_START,
  GHOST_DECAY_RATE,
  GHOST_MAX_FRAMES,
  MEDIAPIPE_WASM_VERSION,
} from './analysisConfig';

// ─── CDN lazy loader: bypasses Vite's esbuild minifier which breaks MediaPipe WASM on iOS Safari ───
let _mpVision = null;
async function getMediaPipeVision() {
  if (_mpVision) return _mpVision;
  _mpVision = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/+esm');
  return _mpVision;
}

const modelCache = localforage.createInstance({ name: 'wv-model-cache' });
const MODEL_CACHE_KEY = 'pose-landmarker-full-v2-0.10.8'; // includes version so model updates don't serve stale cache

let poseLandmarker = null;
let modelLoadPromise = null;
let lastVideoTime = -1;
let lastResult = null;

// Shared Kalman filter instances (one per detection path to avoid cross-contamination)
let _kalmanImage = new KalmanLandmarkFilter();
let _kalmanVideo = new KalmanLandmarkFilter();

// Last valid landmarks for anatomical plausibility fallback
let _lastValidLandmarksImage = null;
let _lastValidLandmarksVideo = null;

// Ghost pose tracking: counts consecutive frames where detection fails
// and we return the stale lastResult instead.
let _ghostFrameCount = 0;
let _totalGhostFrames = 0;

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
const VISION_WASM_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_WASM_VERSION}/wasm`;
// Local WASM files copied by vite build plugin (scripts/copy-models.js).
// Prefer local: serves from service worker cache (offline-capable), eliminates CDN latency.
// FilesetResolver auto-selects SIMD vs non-SIMD binary from this directory.
const VISION_WASM_LOCAL = `${import.meta.env.BASE_URL}mediapipe`;
const VIS = 0.3; // minimum landmark visibility to draw/use (below 0.3 landmarks are hallucinated)

// ─── Core: single model instance with IndexedDB cache ───

// Progress callback set by loadModelWithRetry, read by fetchModelBuffer
let _downloadProgressCb = null;

// Minimum valid model size: pose_landmarker_full.task is ~9.4MB (float16).
// A cached buffer smaller than this was a partial download or corruption.
const MIN_MODEL_BYTES = 5 * 1024 * 1024; // 5 MB

async function fetchModelBuffer() {
  // Try IndexedDB cache first (instant on repeat visits, works offline)
  try {
    const cached = await modelCache.getItem(MODEL_CACHE_KEY);
    if (cached && cached.byteLength >= MIN_MODEL_BYTES) {
      return cached;
    }
    if (cached) {
      console.warn(`[PoseAnalysis] Cached model too small (${(cached.byteLength / 1024 / 1024).toFixed(1)}MB), re-downloading`);
      modelCache.removeItem(MODEL_CACHE_KEY).catch(() => {});
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
    return buffer;
  }

  // Fallback: no Content-Length or no streaming body (older browsers)
  const buffer = await response.arrayBuffer();
  modelCache.setItem(MODEL_CACHE_KEY, buffer).catch(() => {});
  return buffer;
}

// Cached capability detection result (populated on first createLandmarker call)
let _deviceCaps = null;

/**
 * Get device capabilities (cached). Exposed for UI telemetry.
 * @returns {Promise<Object>}
 */
async function getDeviceCapabilities() {
  if (!_deviceCaps) _deviceCaps = await detectCapabilities();
  return _deviceCaps;
}

async function createLandmarker() {
  const mp = await getMediaPipeVision();

  // Try local WASM first (offline-capable via service worker), CDN fallback
  let vision;
  try {
    vision = await mp.FilesetResolver.forVisionTasks(VISION_WASM_LOCAL);
  } catch (e) {
    console.warn('[PoseAnalysis] Local WASM failed, falling back to CDN:', e.message);
    vision = await mp.FilesetResolver.forVisionTasks(VISION_WASM_CDN);
  }

  const modelBuffer = await fetchModelBuffer();

  // Detect device capabilities to select optimal delegate order
  const caps = await getDeviceCapabilities();
  const simd = isSimdSupported();

  console.info(
    `[PoseAnalysis] Device: SIMD=${simd}, WebGL2=${caps.webgl2}, ` +
    `GPU=${caps.unmaskedRenderer || caps.webgl2Renderer || 'unknown'}, ` +
    `recommendedDelegate=${caps.recommendedDelegate}`
  );
  if (caps.gpuBlockedReason) {
    console.warn(`[PoseAnalysis] ${caps.gpuBlockedReason}`);
  }

  // Order delegates: use capability detection to skip known-bad GPU renderers
  const delegates = caps.recommendedDelegate === 'CPU'
    ? ['CPU']
    : ['GPU', 'CPU'];

  for (const delegate of delegates) {
    try {
      const landmarker = await mp.PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetBuffer: new Uint8Array(modelBuffer), delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.35,
        minPosePresenceConfidence: 0.4,
        minTrackingConfidence: 0.5,
      });
      console.info(`[PoseAnalysis] Landmarker created with ${delegate} delegate (SIMD=${simd})`);
      return landmarker;
    } catch (e) {
      console.warn(`[PoseAnalysis] ${delegate} delegate failed:`, e.message);
      if (delegate === delegates[delegates.length - 1]) throw e;
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
    poseLandmarker = await withTimeout(createLandmarker(), 30000, 'Model load');
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
async function loadModelWithRetry(onProgress, attempt = 1) {
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
async function getVideoLandmarker() {
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
  _kalmanImage = new KalmanLandmarkFilter();
  _kalmanVideo = new KalmanLandmarkFilter();
  _lastValidLandmarksImage = null;
  _lastValidLandmarksVideo = null;
}

/**
 * Check if any joint angle exceeds biomechanical limits.
 * Returns true if landmarks are anatomically implausible.
 */
function _isAnatomicallyImplausible(landmarks) {
  if (!landmarks || landmarks.length < 33) return false;
  const L = landmarks;
  const angles = [
    { name: 'leftKnee', val: calculateAngle(L[LANDMARKS.LEFT_HIP], L[LANDMARKS.LEFT_KNEE], L[LANDMARKS.LEFT_ANKLE]), max: 185 },
    { name: 'rightKnee', val: calculateAngle(L[LANDMARKS.RIGHT_HIP], L[LANDMARKS.RIGHT_KNEE], L[LANDMARKS.RIGHT_ANKLE]), max: 185 },
    { name: 'leftElbow', val: calculateAngle(L[LANDMARKS.LEFT_SHOULDER], L[LANDMARKS.LEFT_ELBOW], L[LANDMARKS.LEFT_WRIST]), max: 180 },
    { name: 'rightElbow', val: calculateAngle(L[LANDMARKS.RIGHT_SHOULDER], L[LANDMARKS.RIGHT_ELBOW], L[LANDMARKS.RIGHT_WRIST]), max: 180 },
    { name: 'leftHip', val: calculateAngle(L[LANDMARKS.LEFT_SHOULDER], L[LANDMARKS.LEFT_HIP], L[LANDMARKS.LEFT_KNEE]), max: 200 },
    { name: 'rightHip', val: calculateAngle(L[LANDMARKS.RIGHT_SHOULDER], L[LANDMARKS.RIGHT_HIP], L[LANDMARKS.RIGHT_KNEE]), max: 200 },
  ];
  return angles.some(a => a.val > a.max);
}

/**
 * Filter anatomically implausible landmarks, returning previous valid ones if current fail.
 */
function filterAnatomicallyImplausible(landmarks, lastValid) {
  if (!landmarks) return lastValid;
  if (_isAnatomicallyImplausible(landmarks)) {
    return lastValid || landmarks; // fall back to last valid, or keep current if no history
  }
  return landmarks;
}

/**
 * Detect pose on a single image/frame (video upload analysis).
 * Uses detectForVideo with a deterministic timestamp so that the same
 * frame sequence always produces the same landmarks (MediaPipe's VIDEO
 * mode applies temporal smoothing based on timestamp deltas).
 *
 * @param {PoseLandmarker} landmarker
 * @param {HTMLCanvasElement} source
 * @param {number} [timestamp] - deterministic timestamp in ms (frameIdx * 1000/fps).
 *   Falls back to performance.now() if not provided (live mode).
 */
export function detectPoseImage(landmarker, source, timestamp) {
  try {
    const ts = timestamp != null ? timestamp : performance.now();
    const result = landmarker.detectForVideo(source, ts);
    // Apply Kalman filter to smooth landmark coordinates before downstream use
    if (result && result.landmarks) {
      for (let i = 0; i < result.landmarks.length; i++) {
        result.landmarks[i] = _kalmanImage.filter(result.landmarks[i]) || result.landmarks[i];
        // Anatomical plausibility check
        result.landmarks[i] = filterAnatomicallyImplausible(result.landmarks[i], _lastValidLandmarksImage);
        if (result.landmarks[i] && !_isAnatomicallyImplausible(result.landmarks[i])) {
          _lastValidLandmarksImage = result.landmarks[i];
        }
      }
    }
    // Preserve worldLandmarks (metric-scale, hip-origin, in meters) if present.
    // These are passed through unfiltered; Kalman and plausibility checks
    // apply only to normalized landmarks used for rendering.
    // worldLandmarks are used downstream for accurate velocity/ROM calculations.
    return result;
  } catch (e) {
    console.warn('[PoseAnalysis] Detection error (image):', e);
    return null;
  }
}

/**
 * Detect pose on video frame (live camera).
 * Caches last valid result with progressive ghost decay.
 *
 * Ghost decay logic:
 * - After GHOST_DECAY_START consecutive ghost frames, visibility scores
 *   are reduced by GHOST_DECAY_RATE per additional frame.
 * - After GHOST_MAX_FRAMES consecutive ghost frames, returns null
 *   instead of stale pose data.
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
    // Apply Kalman filter to smooth landmark coordinates
    if (result && result.landmarks) {
      for (let i = 0; i < result.landmarks.length; i++) {
        result.landmarks[i] = _kalmanVideo.filter(result.landmarks[i]) || result.landmarks[i];
        // Anatomical plausibility check
        result.landmarks[i] = filterAnatomicallyImplausible(result.landmarks[i], _lastValidLandmarksVideo);
        if (result.landmarks[i] && !_isAnatomicallyImplausible(result.landmarks[i])) {
          _lastValidLandmarksVideo = result.landmarks[i];
        }
      }
    }
    if (result && result.landmarks && result.landmarks.length > 0) {
      lastResult = result;
      _ghostFrameCount = 0;
      return result;
    }
    // Detection failed — enter ghost mode
    _ghostFrameCount++;
    _totalGhostFrames++;
    return _getGhostResult();
  } catch (e) {
    console.warn('[PoseAnalysis] Detection error (video):', e);
    _ghostFrameCount++;
    _totalGhostFrames++;
    return _getGhostResult();
  }
}

/**
 * Return ghost (stale) result with decayed visibility, or null if too stale.
 * @returns {Object|null}
 */
function _getGhostResult() {
  if (_ghostFrameCount >= GHOST_MAX_FRAMES || !lastResult) {
    return null;
  }
  if (_ghostFrameCount <= GHOST_DECAY_START) {
    return lastResult;
  }
  // Decay visibility scores on the cached result
  const decayFrames = _ghostFrameCount - GHOST_DECAY_START;
  const decayFactor = Math.max(0, 1 - decayFrames * GHOST_DECAY_RATE);
  const decayed = { ...lastResult };
  if (decayed.landmarks) {
    decayed.landmarks = decayed.landmarks.map(pose =>
      pose.map(lm => ({
        ...lm,
        visibility: (lm.visibility || 0) * decayFactor,
      }))
    );
  }
  return decayed;
}

/**
 * Get the total number of ghost frames accumulated in this session.
 * @returns {number}
 */
export function getGhostFrameCount() {
  return _totalGhostFrames;
}

export function resetTimestamp() {
  lastVideoTime = -1;
  lastResult = null;
  _kalmanVideo = new KalmanLandmarkFilter();
  _lastValidLandmarksVideo = null;
  _ghostFrameCount = 0;
  _totalGhostFrames = 0;
}

export function resetKalmanFilters() {
  _kalmanImage = new KalmanLandmarkFilter();
  _kalmanVideo = new KalmanLandmarkFilter();
  _lastValidLandmarksImage = null;
  _lastValidLandmarksVideo = null;
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
      if ((lm.visibility || 0) < VIS) continue;
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

// ─── Mirror detection ───

// Left-right landmark pairs for mirror comparison
const MIRROR_PAIRS = [
  [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER],
  [LANDMARKS.LEFT_ELBOW, LANDMARKS.RIGHT_ELBOW],
  [LANDMARKS.LEFT_WRIST, LANDMARKS.RIGHT_WRIST],
  [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
  [LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE],
  [LANDMARKS.LEFT_ANKLE, LANDMARKS.RIGHT_ANKLE],
];

/**
 * Detect if two poses are mirror images of each other (e.g. gym mirror reflection).
 * Compares pose A's left landmarks against pose B's right landmarks.
 * If they match within threshold, selects the pose closer to the camera (lower avg z).
 * @param {Array} landmarksArray - array of pose landmark arrays
 * @returns {Array} filtered landmarksArray with mirror duplicates removed
 */
function detectMirror(landmarksArray) {
  if (!landmarksArray || landmarksArray.length < 2) return landmarksArray;

  const THRESHOLD = 0.05; // normalized distance threshold
  const keep = new Array(landmarksArray.length).fill(true);

  for (let a = 0; a < landmarksArray.length; a++) {
    if (!keep[a]) continue;
    for (let b = a + 1; b < landmarksArray.length; b++) {
      if (!keep[b]) continue;
      const poseA = landmarksArray[a];
      const poseB = landmarksArray[b];
      if (!poseA || !poseB || poseA.length < 33 || poseB.length < 33) continue;

      // Check if A's left matches B's right (mirror)
      let totalDist = 0;
      let pairCount = 0;
      for (const [leftIdx, rightIdx] of MIRROR_PAIRS) {
        const aLeft = poseA[leftIdx];
        const bRight = poseB[rightIdx];
        if (!aLeft || !bRight) continue;
        const dx = aLeft.x - (1 - bRight.x); // mirror x: bRight.x reflected = 1 - bRight.x
        const dy = aLeft.y - bRight.y;
        totalDist += Math.sqrt(dx * dx + dy * dy);
        pairCount++;
      }

      if (pairCount === 0) continue;
      const avgDist = totalDist / pairCount;

      if (avgDist < THRESHOLD) {
        // It's a mirror; keep the pose with lower average z (closer to camera)
        const avgZA = poseA.reduce((s, lm) => s + (lm.z || 0), 0) / poseA.length;
        const avgZB = poseB.reduce((s, lm) => s + (lm.z || 0), 0) / poseB.length;
        if (avgZA <= avgZB) {
          keep[b] = false;
        } else {
          keep[a] = false;
        }
      }
    }
  }

  return landmarksArray.filter((_, i) => keep[i]);
}

// ─── Landmark interpolation for occluded frames ───

const VIS_INTERP_THRESHOLD = 0.45;
const MAX_INTERP_GAP = 15; // Don't interpolate across gaps longer than 15 frames (~500ms at 30fps)

/**
 * Interpolate individual landmark coordinates when visibility drops below threshold.
 * Uses linear interpolation from nearest good-visibility frames on both sides.
 * Falls back to nearest-neighbor if only one side has good data.
 *
 * Operates in-place on a copy of the array. Returns the cleaned array.
 * Designed for post-capture use in finalize() and recalibrate(), not live mode.
 *
 * @param {Array<Array>} landmarksArray - Array of per-frame landmark arrays (33 landmarks each)
 * @param {number} [visThreshold=0.45] - Visibility below this triggers interpolation
 * @returns {Array<Array>} New array with interpolated landmarks
 */
export function interpolateOccludedLandmarks(landmarksArray, visThreshold = VIS_INTERP_THRESHOLD) {
  if (!landmarksArray || landmarksArray.length < 3) return landmarksArray;

  const N = landmarksArray.length;
  // Deep-copy so we don't mutate originals
  const out = landmarksArray.map(frame =>
    frame ? frame.map(lm => ({ ...lm })) : null
  );

  // For each landmark index (0-32), scan for low-visibility frames and interpolate
  for (let li = 0; li < 33; li++) {
    // Build visibility array for this landmark
    const vis = new Array(N);
    for (let f = 0; f < N; f++) {
      vis[f] = out[f] && out[f][li] ? (out[f][li].visibility || 0) : 0;
    }

    // Find runs of low-visibility frames
    let i = 0;
    while (i < N) {
      if (vis[i] >= visThreshold) { i++; continue; }

      // Start of a low-vis run
      const runStart = i;
      while (i < N && vis[i] < visThreshold) i++;
      const runEnd = i; // exclusive

      // Find nearest good frame before and after
      let before = runStart - 1;
      while (before >= 0 && vis[before] < visThreshold) before--;
      let after = runEnd;
      while (after < N && vis[after] < visThreshold) after++;

      const hasBefore = before >= 0 && out[before] && out[before][li];
      const hasAfter = after < N && out[after] && out[after][li];

      if (!hasBefore && !hasAfter) continue; // no reference data at all

      // Safety cap: don't interpolate across gaps longer than MAX_INTERP_GAP frames
      const gapLen = runEnd - runStart;
      if (gapLen > MAX_INTERP_GAP) continue;

      for (let f = runStart; f < runEnd; f++) {
        if (!out[f] || !out[f][li]) continue;

        if (hasBefore && hasAfter) {
          // Linear interpolation
          const t = (f - before) / (after - before);
          const lmB = out[before][li];
          const lmA = out[after][li];
          out[f][li].x = lmB.x + t * (lmA.x - lmB.x);
          out[f][li].y = lmB.y + t * (lmA.y - lmB.y);
          out[f][li].z = (lmB.z || 0) + t * ((lmA.z || 0) - (lmB.z || 0));
          out[f][li].visibility = lmB.visibility + t * (lmA.visibility - lmB.visibility);
        } else {
          // Nearest-neighbor fill
          const ref = hasBefore ? out[before][li] : out[after][li];
          out[f][li].x = ref.x;
          out[f][li].y = ref.y;
          out[f][li].z = ref.z || 0;
          // Keep original low visibility so downstream still knows it's estimated
        }
      }
    }
  }

  return out;
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

// ─── Form check → affected landmark segments ───
// Maps form check names containing these keywords to landmark indices involved.
// Checks that don't match any keyword affect all segments (whole-body feedback).
const KEYWORD_TO_LANDMARKS = {
  knee: [23, 24, 25, 26, 27, 28],
  depth: [23, 24, 25, 26],
  squat: [23, 24, 25, 26, 27, 28],
  hip: [11, 12, 23, 24, 25, 26],
  hinge: [11, 12, 23, 24],
  trunk: [11, 12, 23, 24],
  torso: [11, 12, 23, 24],
  back: [11, 12, 23, 24],
  lumbar: [11, 12, 23, 24],
  spine: [11, 12, 23, 24],
  elbow: [11, 12, 13, 14, 15, 16],
  arm: [11, 12, 13, 14, 15, 16],
  wrist: [13, 14, 15, 16],
  shoulder: [11, 12, 13, 14],
  press: [11, 12, 13, 14, 15, 16],
  lockout: [13, 14, 15, 16],
  overhead: [11, 12, 13, 14, 15, 16],
  scapular: [11, 12],
  plank: [11, 12, 23, 24],
  shrug: [11, 12],
  elevation: [11, 12],
  retraction: [11, 12],
  chin: [11, 12, 13, 14, 15, 16],
  hang: [11, 12, 13, 14, 15, 16],
  pull: [11, 12, 13, 14, 15, 16],
  crunch: [11, 12, 23, 24],
  pelvic: [23, 24, 25, 26],
  lean: [11, 12, 23, 24],
  abduction: [23, 24, 25, 26],
  leg: [23, 24, 25, 26, 27, 28],
  body: [], // whole body = all segments
};

// Cache: check name → affected landmark index set
const _checkLandmarkCache = {};
function getAffectedLandmarks(checkName) {
  if (_checkLandmarkCache[checkName]) return _checkLandmarkCache[checkName];
  const lower = checkName.toLowerCase();
  for (const [kw, indices] of Object.entries(KEYWORD_TO_LANDMARKS)) {
    if (lower.includes(kw)) {
      _checkLandmarkCache[checkName] = indices;
      return indices;
    }
  }
  // No keyword match = whole-body feedback (empty = affects everything)
  _checkLandmarkCache[checkName] = [];
  return [];
}

/**
 * Map quality score (0.0-1.0) to HSL color.
 * 1.0 = cyan (#00f5d4, hue ~168), 0.5 = yellow (hue ~50), 0.0 = red (#ff3b5c, hue ~350)
 */
function qualityToColor(q) {
  // Clamp
  const cq = Math.max(0, Math.min(1, q));
  // HSL interpolation: red(0) → yellow(50) → cyan(168)
  let hue;
  if (cq <= 0.5) {
    // 0.0→0.5 maps red(0) → yellow(50)
    hue = cq * 2 * 50;
  } else {
    // 0.5→1.0 maps yellow(50) → cyan(168)
    hue = 50 + (cq - 0.5) * 2 * (168 - 50);
  }
  return `hsl(${Math.round(hue)}, 100%, 50%)`;
}

function getSegmentColor(i, j, formFeedback) {
  if (!formFeedback || formFeedback.length === 0) return '#00f5d4';

  // Find the minimum quality score across all checks affecting this segment
  let minQuality = 1.0;
  let hasRelevantCheck = false;

  for (const f of formFeedback) {
    const q = typeof f.quality === 'number' ? f.quality : (f.passed ? 1.0 : 0.0);
    const affected = getAffectedLandmarks(f.name);

    // Empty affected = whole-body check, applies to all segments
    if (affected.length === 0 || (affected.includes(i) || affected.includes(j))) {
      hasRelevantCheck = true;
      if (q < minQuality) minQuality = q;
    }
  }

  if (!hasRelevantCheck) return '#00f5d4';
  return qualityToColor(minQuality);
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

  // Soft visibility filter: removes truly junk landmarks (noise, hallucinated
  // limbs) while preserving detection on non-upright poses.
  const ok = (lm) => lm != null && (lm.visibility == null || lm.visibility > 0.15);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const lw = Math.max(6, Math.round(width / 50));

  // Black outline behind skeleton for contrast
  ctx.lineWidth = lw + 4;
  ctx.strokeStyle = '#000000';
  for (const [i, j] of connections) {
    if (!ok(landmarks[i]) || !ok(landmarks[j])) continue;
    ctx.beginPath();
    ctx.moveTo(landmarks[i].x * width, landmarks[i].y * height);
    ctx.lineTo(landmarks[j].x * width, landmarks[j].y * height);
    ctx.stroke();
  }

  // Bright skeleton lines (color-coded by form feedback)
  ctx.lineWidth = lw;
  for (const [i, j] of connections) {
    if (!ok(landmarks[i]) || !ok(landmarks[j])) continue;
    ctx.strokeStyle = getSegmentColor(i, j, formFeedback);
    ctx.beginPath();
    ctx.moveTo(landmarks[i].x * width, landmarks[i].y * height);
    ctx.lineTo(landmarks[j].x * width, landmarks[j].y * height);
    ctx.stroke();
  }

  // Joint dots — body landmarks only (11-32), skip face (0-10)
  // Color-coded by quality: cyan (perfect) → yellow → red (failing)
  const dotR = Math.max(4, Math.round(width / 80));
  for (let k = 11; k < Math.min(landmarks.length, 33); k++) {
    if (!ok(landmarks[k])) continue;
    // Use getSegmentColor with (k, k) to find worst quality for this joint
    ctx.fillStyle = formFeedback ? getSegmentColor(k, k, formFeedback) : '#00f5d4';
    ctx.beginPath();
    ctx.arc(landmarks[k].x * width, landmarks[k].y * height, dotR, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw overlay message when no pose detected.
 */
function drawOverlayMessage(ctx, line1, line2) {
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
