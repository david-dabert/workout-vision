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

// ─── Inline Kalman filter (avoid cross-worker import issues) ───
const KALMAN_VIS_THRESHOLD = 0.1;
const KALMAN_PROCESS_NOISE = 0.001;
const KALMAN_MEASUREMENT_NOISE = 0.05;

function createKalmanStates(n) {
  return Array.from({ length: n }, () => [
    { x: 0, p: 1, init: false },
    { x: 0, p: 1, init: false },
    { x: 0, p: 1, init: false },
  ]);
}

function kalmanUpdate1D(state, measurement) {
  if (!state.init) {
    state.x = measurement;
    state.p = KALMAN_MEASUREMENT_NOISE;
    state.init = true;
    return state.x;
  }
  state.p += KALMAN_PROCESS_NOISE;
  const k = state.p / (state.p + KALMAN_MEASUREMENT_NOISE);
  state.x += k * (measurement - state.x);
  state.p *= 1 - k;
  return state.x;
}

function kalmanFilter(landmarks, states) {
  if (!landmarks) return null;
  const out = new Array(landmarks.length);
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (!lm) { out[i] = null; continue; }
    if (lm.visibility < KALMAN_VIS_THRESHOLD) {
      out[i] = { x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility };
      continue;
    }
    const s = states[i];
    out[i] = {
      x: kalmanUpdate1D(s[0], lm.x),
      y: kalmanUpdate1D(s[1], lm.y),
      z: kalmanUpdate1D(s[2], lm.z),
      visibility: lm.visibility,
    };
  }
  return out;
}

// ─── Inline geometry (same as poseAnalysis.js) ───
const LM = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
};

function calcAngle(a, b, c) {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);
  if (magBA === 0 || magBC === 0) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot / (magBA * magBC)))) * 180) / Math.PI;
}

function extractAngles(L) {
  if (!L || L.length < 33) return null;
  const vis = (a, b, c) => Math.min(L[a].visibility || 0, L[b].visibility || 0, L[c].visibility || 0);
  const midShoulder = {
    x: (L[LM.LEFT_SHOULDER].x + L[LM.RIGHT_SHOULDER].x) / 2,
    y: (L[LM.LEFT_SHOULDER].y + L[LM.RIGHT_SHOULDER].y) / 2,
    z: ((L[LM.LEFT_SHOULDER].z || 0) + (L[LM.RIGHT_SHOULDER].z || 0)) / 2,
  };
  const midHip = {
    x: (L[LM.LEFT_HIP].x + L[LM.RIGHT_HIP].x) / 2,
    y: (L[LM.LEFT_HIP].y + L[LM.RIGHT_HIP].y) / 2,
    z: ((L[LM.LEFT_HIP].z || 0) + (L[LM.RIGHT_HIP].z || 0)) / 2,
  };
  const vertRef = { ...midHip, y: midHip.y - 1 };

  return {
    leftKnee: calcAngle(L[LM.LEFT_HIP], L[LM.LEFT_KNEE], L[LM.LEFT_ANKLE]),
    rightKnee: calcAngle(L[LM.RIGHT_HIP], L[LM.RIGHT_KNEE], L[LM.RIGHT_ANKLE]),
    leftHip: calcAngle(L[LM.LEFT_SHOULDER], L[LM.LEFT_HIP], L[LM.LEFT_KNEE]),
    rightHip: calcAngle(L[LM.RIGHT_SHOULDER], L[LM.RIGHT_HIP], L[LM.RIGHT_KNEE]),
    leftElbow: calcAngle(L[LM.LEFT_SHOULDER], L[LM.LEFT_ELBOW], L[LM.LEFT_WRIST]),
    rightElbow: calcAngle(L[LM.RIGHT_SHOULDER], L[LM.RIGHT_ELBOW], L[LM.RIGHT_WRIST]),
    leftShoulder: calcAngle(L[LM.LEFT_HIP], L[LM.LEFT_SHOULDER], L[LM.LEFT_ELBOW]),
    rightShoulder: calcAngle(L[LM.RIGHT_HIP], L[LM.RIGHT_SHOULDER], L[LM.RIGHT_ELBOW]),
    trunk: calcAngle(midShoulder, midHip, vertRef),
    _visLeftElbow: vis(LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST),
    _visRightElbow: vis(LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST),
    _visLeftKnee: vis(LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE),
    _visRightKnee: vis(LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE),
    _visLeftHip: vis(LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE),
    _visRightHip: vis(LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_KNEE),
    _visLeftShoulder: vis(LM.LEFT_HIP, LM.LEFT_SHOULDER, LM.LEFT_ELBOW),
    _visRightShoulder: vis(LM.RIGHT_HIP, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW),
  };
}

// ─── Anatomical plausibility ───
function isImplausible(landmarks) {
  if (!landmarks || landmarks.length < 33) return false;
  const L = landmarks;
  const checks = [
    { val: calcAngle(L[LM.LEFT_HIP], L[LM.LEFT_KNEE], L[LM.LEFT_ANKLE]), max: 185 },
    { val: calcAngle(L[LM.RIGHT_HIP], L[LM.RIGHT_KNEE], L[LM.RIGHT_ANKLE]), max: 185 },
    { val: calcAngle(L[LM.LEFT_SHOULDER], L[LM.LEFT_ELBOW], L[LM.LEFT_WRIST]), max: 180 },
    { val: calcAngle(L[LM.RIGHT_SHOULDER], L[LM.RIGHT_ELBOW], L[LM.RIGHT_WRIST]), max: 180 },
    { val: calcAngle(L[LM.LEFT_SHOULDER], L[LM.LEFT_HIP], L[LM.LEFT_KNEE]), max: 200 },
    { val: calcAngle(L[LM.RIGHT_SHOULDER], L[LM.RIGHT_HIP], L[LM.RIGHT_KNEE]), max: 200 },
  ];
  return checks.some(a => a.val > a.max);
}

// ─── Subject selection (largest + most centered pose) ───
function selectSubject(landmarksArray) {
  if (!landmarksArray || landmarksArray.length === 0) return null;
  if (landmarksArray.length === 1) return landmarksArray[0];
  let best = landmarksArray[0], bestScore = -Infinity;
  for (const pose of landmarksArray) {
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const lm of pose) {
      if ((lm.visibility || 0) < 0.3) continue;
      minX = Math.min(minX, lm.x); maxX = Math.max(maxX, lm.x);
      minY = Math.min(minY, lm.y); maxY = Math.max(maxY, lm.y);
    }
    const area = (maxX - minX) * (maxY - minY);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const dist = Math.sqrt((cx - 0.5) ** 2 + (cy - 0.5) ** 2);
    const score = area * 1000 - dist * 0.5;
    if (score > bestScore) { bestScore = score; best = pose; }
  }
  return best;
}

// ─── Worker state ───
let landmarker = null;
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
  }
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
        : selectSubject(result.landmarks);

      if (raw) {
        // Kalman filter
        let filtered = kalmanFilter(raw, kalmanStates) || raw;
        // Anatomical plausibility
        if (isImplausible(filtered)) {
          filtered = lastValidLandmarks || filtered;
        } else {
          lastValidLandmarks = filtered;
        }
        landmarks = filtered;
        angles = extractAngles(filtered);
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
