/**
 * poseWorker.js — Web Worker for offloading MediaPipe pose detection.
 *
 * Runs the full inference pipeline off the main thread:
 *   1. MediaPipe PoseLandmarker WASM inference
 *   2. Kalman filtering (per-landmark coordinate smoothing)
 *   3. Anatomical plausibility check
 *   4. Joint angle extraction
 *
 * Must be loaded as a module worker:
 *   new Worker(new URL('./poseWorker.js', import.meta.url), { type: 'module' })
 *
 * Messages accepted:
 *   { type: 'init' }
 *   { type: 'detect', bitmap: ImageBitmap, timestamp: number, frameIndex: number }
 *   { type: 'detectPixels', frameData: ArrayBuffer, width, height, timestamp, frameIndex }
 *   { type: 'reset' }
 *   { type: 'dispose' }
 *
 * Messages sent:
 *   { type: 'ready' }
 *   { type: 'result', landmarks, angles, frameIndex, inferenceMs }
 *   { type: 'error', message }
 */

import {
  extractJointAngles,
  isAnatomicallyImplausible,
  selectSubjectPose,
  createKalmanStates,
  kalmanFilter,
} from './poseGeometry.js';

const MEDIAPIPE_VERSION = '0.10.8';
const CDN_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const WASM_URL = `${CDN_BASE}/wasm`;
const CDN_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const LOCAL_MODEL_URL = 'mediapipe/pose_landmarker_full.task';
const LOCAL_MANIFEST_URL = 'mediapipe/manifest.json';

/**
 * Compute SHA-256 hex digest of an ArrayBuffer using Web Crypto API.
 */
async function sha256Hex(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = new Uint8Array(hashBuffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Fetch model with SHA-256 integrity verification.
 * Tries local vendored copy first; falls back to CDN on hash mismatch or fetch failure.
 */
async function fetchModelWithVerification() {
  let expectedHash = null;

  // Load manifest for expected hash
  try {
    const manifestResp = await fetch(LOCAL_MANIFEST_URL);
    if (manifestResp.ok) {
      const manifest = await manifestResp.json();
      expectedHash = manifest.files?.['pose_landmarker_full.task']?.sha256 || null;
    }
  } catch { /* manifest unavailable; proceed without verification */ }

  // Try local vendored model first
  try {
    const localResp = await fetch(LOCAL_MODEL_URL);
    if (localResp.ok) {
      const buffer = await localResp.arrayBuffer();
      if (expectedHash) {
        const actualHash = await sha256Hex(buffer);
        if (actualHash === expectedHash) {
          return buffer;
        }
        console.warn('[PoseWorker] Local model SHA-256 mismatch, falling back to CDN');
      } else {
        // No manifest hash available; trust the local copy
        return buffer;
      }
    }
  } catch { /* local fetch failed */ }

  // Fallback to CDN
  console.warn('[PoseWorker] Loading model from CDN fallback');
  const cdnResp = await fetch(CDN_MODEL_URL);
  if (!cdnResp.ok) throw new Error(`Model fetch failed: ${cdnResp.status}`);
  return cdnResp.arrayBuffer();
}

// ─── Worker state ───
let landmarker = null;
let initPromise = null;  // guards against concurrent init calls
let kalmanStates = createKalmanStates(33);
let lastValidLandmarks = null;
let offscreenCanvas = null;
let offscreenCtx = null;
let canvasW = 0, canvasH = 0;

function ensureCanvas(w, h) {
  if (offscreenCanvas && canvasW === w && canvasH === h) return;
  offscreenCanvas = new OffscreenCanvas(w, h);
  offscreenCtx = offscreenCanvas.getContext('2d');
  canvasW = w;
  canvasH = h;
}

// ─── Message handler ───
self.onmessage = async (e) => {
  const msg = e.data;
  switch (msg.type) {
    case 'init': await handleInit(); break;
    case 'detect': handleDetectBitmap(msg); break;
    case 'detectPixels': handleDetectPixels(msg); break;
    case 'reset': handleReset(); break;
    case 'dispose': handleDispose(); break;
    default: self.postMessage({ type: 'error', message: `Unknown: ${msg.type}` });
  }
};

async function handleInit() {
  // Serialize concurrent init calls: if one is running, wait for it to finish
  // before starting a new one. Prevents leaking MediaPipe landmarker instances.
  if (initPromise) {
    await initPromise.catch(() => {});
  }

  initPromise = (async () => {
    if (landmarker) { landmarker.close(); landmarker = null; }
    try {
      const mp = await import(`${CDN_BASE}/+esm`);
      const modelBuffer = await fetchModelWithVerification();
      const vision = await mp.FilesetResolver.forVisionTasks(WASM_URL);
      const opts = {
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.35,
        minPosePresenceConfidence: 0.4,
        minTrackingConfidence: 0.5,
      };
      // GPU first, CPU fallback
      try {
        landmarker = await mp.PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetBuffer: new Uint8Array(modelBuffer), delegate: 'GPU' },
          ...opts,
        });
      } catch {
        landmarker = await mp.PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetBuffer: new Uint8Array(modelBuffer), delegate: 'CPU' },
          ...opts,
        });
      }
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: `Init failed: ${err.message}` });
    } finally {
      initPromise = null;
    }
  })();

  await initPromise;
}

function processDetection(source, timestamp, frameIndex) {
  if (!landmarker) {
    self.postMessage({ type: 'result', landmarks: null, angles: null, frameIndex, error: 'Not initialized' });
    return;
  }
  const t0 = performance.now();
  try {
    const result = landmarker.detectForVideo(source, timestamp);
    let landmarks = null;
    let angles = null;

    if (result?.landmarks?.length) {
      // Select subject pose
      const raw = result.landmarks.length === 1
        ? result.landmarks[0]
        : selectSubjectPose(result.landmarks);

      if (raw) {
        // Kalman filter
        let filtered = kalmanFilter(raw, kalmanStates) || raw;
        // Anatomical plausibility
        if (isAnatomicallyImplausible(filtered)) {
          filtered = lastValidLandmarks || filtered;
        } else {
          lastValidLandmarks = filtered;
        }
        landmarks = filtered;
        angles = extractJointAngles(filtered);
      }
    }

    // Free segmentation masks
    if (result?.segmentationMasks) {
      result.segmentationMasks.forEach(m => { try { m.close(); } catch {} });
    }

    const inferenceMs = Math.round(performance.now() - t0);
    self.postMessage({ type: 'result', landmarks, angles, frameIndex, inferenceMs });
  } catch (err) {
    self.postMessage({ type: 'result', landmarks: null, angles: null, frameIndex, error: err.message });
  }
}

// ImageBitmap path (preferred — zero-copy transfer)
function handleDetectBitmap({ bitmap, timestamp, frameIndex }) {
  ensureCanvas(bitmap.width, bitmap.height);
  offscreenCtx.drawImage(bitmap, 0, 0);
  bitmap.close();
  processDetection(offscreenCanvas, timestamp, frameIndex);
}

// Raw pixel path (fallback for browsers without ImageBitmap transfer)
function handleDetectPixels({ frameData, width, height, timestamp, frameIndex }) {
  ensureCanvas(width, height);
  const pixels = new Uint8ClampedArray(frameData);
  const imageData = new ImageData(pixels, width, height);
  offscreenCtx.putImageData(imageData, 0, 0);
  processDetection(offscreenCanvas, timestamp, frameIndex);
}

function handleReset() {
  kalmanStates = createKalmanStates(33);
  lastValidLandmarks = null;
  self.postMessage({ type: 'resetDone' });
}

function handleDispose() {
  if (landmarker) { landmarker.close(); landmarker = null; }
  offscreenCanvas = null;
  offscreenCtx = null;
  canvasW = 0; canvasH = 0;
  kalmanStates = createKalmanStates(33);
  lastValidLandmarks = null;
  self.postMessage({ type: 'disposed' });
}
