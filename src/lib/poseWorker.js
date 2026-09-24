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
 *   { type: 'init', forceCPU?: boolean, useImageMode?: boolean }
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
} from './poseGeometry';

const MEDIAPIPE_VERSION = '0.10.8';
const CDN_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const WASM_CDN_URL = `${CDN_BASE}/wasm`;
const WASM_LOCAL_URL = 'mediapipe'; // local WASM files served by SW
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
// Cached after first init so reinit can recreate the landmarker without re-downloading
let _cachedModelBuffer = null;
let _cachedMpModule = null;
let _cachedVision = null;
// When true, always use CPU delegate for deterministic results (video upload mode)
let _forceCPU = false;
// When true, use IMAGE running mode instead of VIDEO for deterministic per-frame
// detection (no MediaPipe temporal state). See MediaPipe bug #5253.
let _useImageMode = false;
// MediaPipe's detectForVideo() requires strictly increasing timestamps.
// When processing multiple videos, caller timestamps reset to 0 for each new video.
// We track the highest timestamp seen and apply an offset after each reset
// so the landmarker always sees monotonically increasing values.
let tsOffset = 0;
let maxTsSeen = 0;

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
    case 'init':
      if (msg.forceCPU != null) _forceCPU = msg.forceCPU;
      if (msg.useImageMode != null) _useImageMode = msg.useImageMode;
      await handleInit();
      break;
    case 'reinit':
      if (msg.forceCPU != null) _forceCPU = msg.forceCPU;
      if (msg.useImageMode != null) _useImageMode = msg.useImageMode;
      await handleReinit();
      break;
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
      const mp = _cachedMpModule || await import(`${CDN_BASE}/+esm`);
      _cachedMpModule = mp;
      const modelBuffer = _cachedModelBuffer || await fetchModelWithVerification();
      _cachedModelBuffer = modelBuffer;
      // Try local WASM first (offline-capable via service worker), CDN fallback
      let vision = _cachedVision;
      if (!vision) {
        try {
          vision = await mp.FilesetResolver.forVisionTasks(WASM_LOCAL_URL);
        } catch (e) {
          console.warn('[PoseWorker] Local WASM failed, using CDN:', e.message);
          vision = await mp.FilesetResolver.forVisionTasks(WASM_CDN_URL);
        }
        _cachedVision = vision;
      }
      landmarker = await createLandmarkerWithFallback(mp, vision, modelBuffer);
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: `Init failed: ${err.message}` });
    } finally {
      initPromise = null;
    }
  })();

  await initPromise;
}

function getLandmarkerOpts() {
  return {
    runningMode: _useImageMode ? 'IMAGE' : 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.35,
    minPosePresenceConfidence: 0.4,
    minTrackingConfidence: 0.5,
  };
}

async function createLandmarkerWithFallback(mp, vision, modelBuffer) {
  const opts = getLandmarkerOpts();
  // Force CPU delegate for deterministic results in video upload mode.
  // GPU floating-point operations are non-deterministic: the same video
  // produces different landmark coordinates on different runs.
  if (_forceCPU) {
    console.info(`[PoseWorker] Using CPU delegate (deterministic mode, runningMode=${opts.runningMode})`);
    return await mp.PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetBuffer: new Uint8Array(modelBuffer), delegate: 'CPU' },
      ...opts,
    });
  }
  try {
    return await mp.PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetBuffer: new Uint8Array(modelBuffer), delegate: 'GPU' },
      ...opts,
    });
  } catch {
    return await mp.PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetBuffer: new Uint8Array(modelBuffer), delegate: 'CPU' },
      ...opts,
    });
  }
}

/**
 * Reinit: dispose the current landmarker (releases WebGL context) and create
 * a fresh one from cached model/WASM. No network fetches needed.
 * Critical for iOS Safari which exhausts GPU memory after 2-3 sequential
 * video analyses without releasing WebGL contexts.
 */
async function handleReinit() {
  if (!_cachedMpModule || !_cachedModelBuffer || !_cachedVision) {
    return handleInit();
  }
  try {
    if (landmarker) { landmarker.close(); landmarker = null; }
    kalmanStates = createKalmanStates(33);
    lastValidLandmarks = null;
    offscreenCanvas = null;
    offscreenCtx = null;
    canvasW = 0;
    canvasH = 0;
    tsOffset = maxTsSeen + 1000;
    landmarker = await createLandmarkerWithFallback(_cachedMpModule, _cachedVision, _cachedModelBuffer);
    self.postMessage({ type: 'ready' });
  } catch (err) {
    console.warn('[PoseWorker] Reinit failed, trying full init:', err.message);
    _cachedVision = null;
    return handleInit();
  }
}

function processDetection(source, timestamp, frameIndex) {
  if (!landmarker) {
    self.postMessage({ type: 'result', landmarks: null, angles: null, frameIndex, error: 'Not initialized' });
    return;
  }
  const t0 = performance.now();
  try {
    // IMAGE mode: no timestamp needed, no temporal state (deterministic per-frame).
    // VIDEO mode: timestamps must be monotonically increasing across videos.
    let result;
    if (_useImageMode) {
      result = landmarker.detect(source);
    } else {
      const adjustedTs = timestamp + tsOffset;
      if (adjustedTs > maxTsSeen) maxTsSeen = adjustedTs;
      result = landmarker.detectForVideo(source, adjustedTs);
    }
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
  try {
    ensureCanvas(bitmap.width, bitmap.height);
    offscreenCtx.drawImage(bitmap, 0, 0);
  } finally {
    try { bitmap.close(); } catch {}
  }
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
  // Bump offset so next video's timestamps continue above the previous peak.
  // The +1000 gap ensures no overlap even with rounding.
  tsOffset = maxTsSeen + 1000;
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
