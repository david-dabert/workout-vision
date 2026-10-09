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
import { OneEuroLandmarkFilter } from './oneEuroFilter';
import { detectCapabilities, isSimdSupported } from './gpuBenchmark';
import {
  GHOST_DECAY_START,
  GHOST_DECAY_RATE,
  GHOST_MAX_FRAMES,
} from './analysisConfig';
// Shared geometry — single source of truth for both main thread and Worker
import {
  LANDMARKS as _LANDMARKS,
  calculateAngle as _calculateAngle,
  extractJointAngles as _extractJointAngles,
  calculateTrunkAngle as _calculateTrunkAngle,
  isAnatomicallyImplausible as _isAnatomicallyImplausible,
  selectSubjectPose as _selectSubjectPose,
} from './poseGeometry';

// Import from the installed package (0.10.35) — same version as the WASM in public/mediapipe.
// Previous CDN import loaded 0.10.8 which returned landmarks without visibility scores.
import * as mpVision from '@mediapipe/tasks-vision';
import { isTheModel, MODEL_SHA256 } from './model-hash';
import { cropAround, mapFromCrop, keepLost, fillBackward, CROP_PX, CROP_SEED_MS, BACK_PASS, BACK_KEEP_MS, BACK_MAX_FRAMES } from './poseCrop';
import { LIFTER_LOCK, LIFTER_POSES, pickLifter, nextReference } from './lifterLock';
import { JUMP_GATE, newGate, holdsBack, accept as gateAccept, heldBack } from './jumpGate';
function getMediaPipeVision() {
  return mpVision;
}

const modelCache = localforage.createInstance({ name: 'wv-model-cache' });
const MODEL_CACHE_KEY = 'pose-landmarker-full-v2-0.10.35'; // includes version so model updates don't serve stale cache

let poseLandmarker = null;
let modelLoadPromise = null;
let lastVideoTime = -1;
let lastResult = null;
// MediaPipe's detectForVideo() requires monotonically increasing timestamps.
// When analyzing multiple videos, caller timestamps reset to 0.
// We offset them so the landmarker always sees increasing values.
let _imageTimestampOffset = 0;
let _imageMaxTimestamp = 0;

// Shared Kalman filter instances (one per detection path to avoid cross-contamination)
let _kalmanImage = new OneEuroLandmarkFilter();
let _kalmanVideo = new OneEuroLandmarkFilter();

// Last valid landmarks for anatomical plausibility fallback
let _lastValidLandmarksImage = null;
let _lastValidLandmarksVideo = null;

// Ghost pose tracking: counts consecutive frames where detection fails
// and we return the stale lastResult instead.
let _ghostFrameCount = 0;
let _totalGhostFrames = 0;
// Tracks whether the current landmarker was created in IMAGE mode
let _landmarkerIsImageMode = false;

// Re-export from shared geometry module so existing imports keep working
export const LANDMARKS = _LANDMARKS;

const MODEL_URL = `${import.meta.env.BASE_URL}mediapipe/pose_landmarker_full.task`;
// Local WASM files copied by vite build plugin (scripts/copy-models.js) from the installed
// @mediapipe/tasks-vision@0.10.35. No CDN fallback — one version, served by the app.
const VISION_WASM_LOCAL = `${import.meta.env.BASE_URL}mediapipe`;
const VIS = 0.3; // minimum landmark visibility to draw/use (below 0.3 landmarks are hallucinated)

// ─── Core: single model instance with IndexedDB cache ───

// Progress callback set by loadModelWithRetry, read by fetchModelBuffer
let _downloadProgressCb = null;

// Minimum valid model size: pose_landmarker_full.task is ~9.4MB (float16).
// A cached buffer smaller than this was a partial download or corruption.
const MIN_MODEL_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * True when the service worker's store already keeps this model offline. public/sw.js puts the verified
 * download in 'wv-model-<sha>' before it answers, so after a fetch this is already settled. A second copy in
 * IndexedDB would then only double the 9.4 MB footprint on the phone (third audit, C49). Without a service
 * worker (first visit before it controls the page, a refused store, the harness) the answer is false and the
 * IndexedDB copy stays the offline fallback.
 */
async function heldByServiceWorker() {
  try {
    if (typeof caches === 'undefined') return false;
    const name = `wv-model-${MODEL_SHA256}`;
    if (!(await caches.has(name))) return false;
    return !!(await (await caches.open(name)).match(MODEL_URL));
  } catch { return false; }
}

/** The model's bytes: the IndexedDB copy if it is the right file, else a verified download. */
export async function fetchModelBuffer() {
  // A copy kept under an older key (another model or library version) is never read again: drop it, so a
  // model change does not leave 9.4 MB behind for good (third audit, C49).
  modelCache.keys().then(keys => Promise.all(keys.filter(k => k !== MODEL_CACHE_KEY).map(k => modelCache.removeItem(k)))).catch(() => {});

  // Try IndexedDB cache first (instant on repeat visits, works offline)
  try {
    const cached = await modelCache.getItem(MODEL_CACHE_KEY);
    // The kept copy is used only if it is exactly the model the app was built with (audit FINDING-018).
    if (cached && cached.byteLength >= MIN_MODEL_BYTES && await isTheModel(cached)) {
      // The service worker keeps it too: one copy is enough, the next analysis reads the worker's (C49).
      if (await heldByServiceWorker()) modelCache.removeItem(MODEL_CACHE_KEY).catch(() => {});
      return cached;
    }
    if (cached) {
      console.warn('[PoseAnalysis] Cached model is not the expected file, re-downloading');
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

    if (!await isTheModel(buffer)) throw new Error('Pose model integrity mismatch');
    if (!await heldByServiceWorker()) modelCache.setItem(MODEL_CACHE_KEY, buffer).catch(() => {});
    return buffer;
  }

  // Fallback: no Content-Length or no streaming body (older browsers)
  const buffer = await response.arrayBuffer();
  if (!await isTheModel(buffer)) throw new Error('Pose model integrity mismatch');
  if (!await heldByServiceWorker()) modelCache.setItem(MODEL_CACHE_KEY, buffer).catch(() => {});
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

async function createLandmarker({ forceCPU = false, useImageMode = false } = {}) {
  const mp = getMediaPipeVision();

  const vision = await mp.FilesetResolver.forVisionTasks(VISION_WASM_LOCAL);

  // Test benches only (test/real-phone/synth): a page may hand over another pose model's bytes, to measure it against
  // the one the app ships (David's order of 4 October: make the pose model excellent). The app never sets it.
  const benchModel = globalThis.__WV_BENCH_POSE_MODEL__;
  const modelBuffer = benchModel instanceof ArrayBuffer ? benchModel : await fetchModelBuffer();

  // Detect device capabilities to select optimal delegate order. A CPU-only landmarker (the app's
  // pose worker, the harness, synth) never reads the answer, so it skips the WebGPU/WebNN probe that
  // would otherwise delay every analysis before the model loads (third audit, C48).
  const caps = forceCPU ? null : await getDeviceCapabilities();
  const simd = isSimdSupported();

  if (caps) {
    console.info(
      `[PoseAnalysis] Device: SIMD=${simd}, WebGL2=${caps.webgl2}, ` +
      `GPU=${caps.unmaskedRenderer || caps.webgl2Renderer || 'unknown'}, ` +
      `recommendedDelegate=${caps.recommendedDelegate}`
    );
    if (caps.gpuBlockedReason) {
      console.warn(`[PoseAnalysis] ${caps.gpuBlockedReason}`);
    }
  }

  // Force CPU delegate for deterministic results in video upload mode.
  // GPU floating-point operations are non-deterministic: the same video
  // produces different landmark coordinates on different runs.
  const runningMode = useImageMode ? 'IMAGE' : 'VIDEO';
  _landmarkerIsImageMode = useImageMode;
  const delegates = forceCPU
    ? ['CPU']
    : caps.recommendedDelegate === 'CPU'
      ? ['CPU']
      : ['GPU', 'CPU'];

  for (const delegate of delegates) {
    try {
      const landmarker = await mp.PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetBuffer: new Uint8Array(modelBuffer), delegate },
        runningMode,
        // Lifter lock (lifterLock.js): two poses asked in IMAGE mode, so a bystander ranked first no longer hides
        // the lifter; detectPoseImage keeps one. Off unless LIFTER_LOCK or the bench hook (__WV_BENCH_LOCK__).
        numPoses: useImageMode && _lockOn() ? LIFTER_POSES : 1,
        // Detection 0.35 and presence 0.4: below MediaPipe's defaults of 0.5, UNSOURCED, experimental. Tracking 0.5:
        // MediaPipe's default, convention; it acts in VIDEO mode only (IMAGE mode runs the person detector on every
        // image), so since VIDEO mode (9 October 2026) it decides whether a half-hidden body is followed or searched
        // for again, and with it which samples count as seen. Not measured alone (TRIED.md, VIDEO mode).
        minPoseDetectionConfidence: 0.35,
        minPosePresenceConfidence: 0.4,
        minTrackingConfidence: 0.5,
      });
      console.info(`[PoseAnalysis] Landmarker created with ${delegate} delegate (SIMD=${simd}, runningMode=${runningMode}${forceCPU ? ', deterministic mode' : ''})`);
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

function getPoseLandmarker(opts) {
  if (poseLandmarker) return Promise.resolve(poseLandmarker);
  if (modelLoadPromise) return modelLoadPromise;
  modelLoadPromise = (async () => {
    poseLandmarker = await withTimeout(createLandmarker(opts), 30000, 'Model load');
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
 * Get landmarker instance for image/video upload analysis.
 * Forces CPU delegate for deterministic results: GPU floating-point
 * operations produce different landmark coordinates between runs.
 */
export async function getImageLandmarker() {
  return getPoseLandmarker({ forceCPU: true, useImageMode: true });
}

/**
 * The same model on the CPU in VIDEO mode: MediaPipe tracks the body from the previous frame and runs its person
 * detector only when it loses it, where IMAGE mode runs the detector on every sample (the minute an analysis takes,
 * TRIED.md 7 October). The app's video analysis since 9 October (coreAnalysis.js, analyzeCoreVideo); the collector
 * and the live counter keep IMAGE mode. detectPoseImage reads VIDEO mode with the worker's deterministic timestamps
 * (a new pass continues above the last one's, resetKalmanFilters); the crop retry is IMAGE mode only.
 */
export async function getVideoModeLandmarker() {
  return getPoseLandmarker({ forceCPU: true, useImageMode: false });
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
  _landmarkerIsImageMode = false;
  _kalmanImage = new OneEuroLandmarkFilter();
  _kalmanVideo = new OneEuroLandmarkFilter();
  _lastValidLandmarksImage = null;
  _lastValidLandmarksVideo = null;
  _cropSeed = null;
  _lifterRef = null;
  _dropLost();
  _gate = newGate();
  _gatedFrames = 0;
}

// isAnatomicallyImplausible — delegated to poseGeometry.js

/**
 * Filter anatomically implausible landmarks, returning previous valid ones if current fail.
 * Inert today: isAnatomicallyImplausible can never return true (its limits are above the 180 degrees
 * an acos angle can reach; see poseGeometry.ts), so no frame is ever replaced (third audit, C48).
 */
function filterAnatomicallyImplausible(landmarks, lastValid) {
  if (!landmarks) return lastValid;
  if (_isAnatomicallyImplausible(landmarks)) {
    return lastValid || landmarks;
  }
  return landmarks;
}

// Re-export geometry functions for downstream consumers
export const calculateAngle = _calculateAngle;
export const extractJointAngles = _extractJointAngles;
export const selectSubjectPose = _selectSubjectPose;

// Crop pass on lost frames (poseCrop.js): the last accepted pose's raw image landmarks, the frame size and time.
// Test benches may turn it off to measure it (globalThis.__WV_BENCH_NO_CROP__); the app never sets it.
let _cropSeed = null;
let _cropCanvas = null;
// Lifter lock (lifterLock.js, LIFTER_LOCK): the lifter's last torso { x, y, len, t, width, height } in frame pixels.
// Test benches turn it on (globalThis.__WV_BENCH_LOCK__) or off (globalThis.__WV_BENCH_NO_LOCK__); the app sets neither.
let _lifterRef = null;
// Continuity gate (jumpGate.js, JUMP_GATE): the last accepted pose's torso and any jump under way. Test benches turn it
// on (globalThis.__WV_BENCH_GATE__) or off (globalThis.__WV_BENCH_NO_GATE__); the app sets neither.
let _gate = newGate();
// Frames whose pose the gate held back since the last reset (read by the benches).
let _gatedFrames = 0;
export const gatedFrames = () => _gatedFrames;
function _gateOn() { return (JUMP_GATE || globalThis.__WV_BENCH_GATE__ === true) && !globalThis.__WV_BENCH_NO_GATE__; }
function _lockOn() { return (LIFTER_LOCK || globalThis.__WV_BENCH_LOCK__ === true) && !globalThis.__WV_BENCH_NO_LOCK__; }
// A result with several poses reduced to the lifter's (pickLifter), so every caller reads landmarks[0] as before; a
// result with one pose is returned as it is. Updates the reference from the pose kept.
function _keepLifter(result, source, now) {
  const n = result?.landmarks?.length || 0;
  if (!n) return result;
  const { width, height } = _sourceSize(source);
  if (n === 1) { _lifterRef = nextReference(_lifterRef, result.landmarks[0], width, height, now); return result; }
  const i = pickLifter(result.landmarks, _lifterRef, width, height);
  _lifterRef = nextReference(_lifterRef, result.landmarks[i], width, height, now, true);
  return { ...result, landmarks: [result.landmarks[i]], worldLandmarks: result.worldLandmarks?.[i] ? [result.worldLandmarks[i]] : [] };
}
const _sourceSize = (source) => ({ width: source?.videoWidth || source?.width || 0, height: source?.videoHeight || source?.height || 0 });

function _seedCrop(rawLandmarks, source, now) {
  const { width, height } = _sourceSize(source);
  const box = cropAround(rawLandmarks, width, height);
  _cropSeed = box ? { ...box, width, height, t: now } : null;
}

const _newCanvas = (w, h) => {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};

// One detect on a square crop of `source` (box { sx, sy, side } in frame pixels): the pose found, mapped back to the
// whole frame, or null. World landmarks are hip-centred metres, the same whatever the crop: passed through as found.
function _readCrop(landmarker, source, box, width, height) {
  if (!_cropCanvas) _cropCanvas = _newCanvas(CROP_PX, CROP_PX);
  const ctx = _cropCanvas.getContext('2d');
  const { sx, sy, side } = box;
  ctx.clearRect(0, 0, CROP_PX, CROP_PX);
  ctx.drawImage(source, sx, sy, side, side, 0, 0, CROP_PX, CROP_PX);
  const found = landmarker.detect(_cropCanvas);
  if (!found?.landmarks?.length) return null;
  // Lifter lock: of several poses in the crop, the one nearest the lifter (in whole-frame pixels).
  const mapped = found.landmarks.map(lm => mapFromCrop(lm, box, width, height));
  const i = mapped.length > 1 ? pickLifter(mapped, _lifterRef, width, height) : 0;
  return { landmarks: mapped[i], worldLandmarks: found.worldLandmarks?.[i] ?? null };
}

function _detectInCrop(landmarker, source, now) {
  if (globalThis.__WV_BENCH_NO_CROP__ || !_cropSeed) return null;
  const { width, height } = _sourceSize(source);
  // A seed from another frame size, or from before this time (a new pass), or older than CROP_SEED_MS, is not used.
  if (width !== _cropSeed.width || height !== _cropSeed.height || now < _cropSeed.t || now - _cropSeed.t > CROP_SEED_MS) return null;
  const found = _readCrop(landmarker, source, _cropSeed, width, height);
  if (!found) return null;
  // Continuity gate: a pose the crop finds far from the lifter is not accepted either.
  if (_gateOn() && holdsBack(_gate, found.landmarks, width, height, now)) return null;
  _seedCrop(found.landmarks, source, now);
  if (_lockOn()) _lifterRef = nextReference(_lifterRef, found.landmarks, width, height, now);
  return { landmarks: [found.landmarks], worldLandmarks: found.worldLandmarks ? [found.worldLandmarks] : [], source: 'crop' };
}

// Backward pass (poseCrop.js, BACK_PASS): copies of the lost frames of the last BACK_KEEP_MS, { t, canvas, width,
// height }, in time order, and a pool of spare canvases so a long gap does not allocate a canvas per frame.
// Only a caller that asks for it ({ backfill: true }) and applies result.backfill gets it: the app's pose worker,
// the harness and synth. BACK_PASS is off (poseCrop.js): test benches turn it on (globalThis.__WV_BENCH_BACK__) or off
// (globalThis.__WV_BENCH_NO_BACK__) and may change how long lost frames are kept (globalThis.__WV_BENCH_BACK_KEEP_MS__,
// the frame cap scaled with it); the app sets none of them, so it neither keeps lost frames nor reads them back.
let _lost = [];
const _lostPool = [];
function _dropLost(frames = _lost) {
  for (const f of frames) _lostPool.push(f.canvas);
  if (frames === _lost) _lost = [];
}
const _backKeep = () => {
  const ms = globalThis.__WV_BENCH_BACK_KEEP_MS__;
  return ms > 0 ? { keepMs: ms, max: Math.ceil((BACK_MAX_FRAMES * ms) / BACK_KEEP_MS) } : { keepMs: BACK_KEEP_MS, max: BACK_MAX_FRAMES };
};
const _backOn = () => (BACK_PASS || globalThis.__WV_BENCH_BACK__ === true) && !globalThis.__WV_BENCH_NO_BACK__;

function _keepLostFrame(source, now) {
  const { width, height } = _sourceSize(source);
  if (!(width > 0) || !(height > 0)) return;
  // A frame from before the last one kept (a new pass) or of another size: the frames kept so far are dropped.
  if (_lost.length && (now <= _lost.at(-1).t || _lost.at(-1).width !== width || _lost.at(-1).height !== height)) _dropLost();
  const { keepMs, max } = _backKeep();
  const { kept, dropped } = keepLost(_lost, now, keepMs, max - 1);
  _dropLost(dropped);
  _lost = kept;
  let canvas = _lostPool.pop();
  if (!canvas) canvas = _newCanvas(width, height);
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  canvas.getContext('2d').drawImage(source, 0, 0);
  _lost.push({ t: now, canvas, width, height });
}

// A pose accepted at `now` (raw image landmarks): the kept lost frames read back on crops seeded from it.
function _fillLost(landmarker, source, rawLandmarks, now) {
  if (!_lost.length) return null;
  const { width, height } = _sourceSize(source);
  const { keepMs, max } = _backKeep();
  const usable = _lost.filter(f => f.width === width && f.height === height);
  const { kept } = keepLost(usable, now, keepMs, max);
  const filled = fillBackward(kept.filter(f => f.t < now), { landmarks: rawLandmarks, t: now }, (f, seed) => {
    const box = cropAround(seed, width, height);
    return box ? _readCrop(landmarker, f.canvas, box, width, height) : null;
  });
  _dropLost();
  if (!filled.length) return null;
  return filled.reverse().map(({ frame, result }) => ({
    timestamp: frame.t, landmarks: [result.landmarks], worldLandmarks: result.worldLandmarks ? [result.worldLandmarks] : [], source: 'back',
  }));
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
 * @param {{ rethrow?: boolean }} [options] - rethrow: a detection error is thrown instead of read as
 *   "no person in this frame". The app's and the collector's pose worker set it, so a model failure
 *   ends the run as an error (third audit, C07); the harness, synth and Validate keep the null.
 */
export function detectPoseImage(landmarker, source, timestamp, { rethrow = false, backfill = false } = {}) {
  try {
    // IMAGE mode: no timestamp, no temporal state (deterministic per-frame).
    // VIDEO mode: timestamps must be monotonically increasing.
    let result;
    let back = null;
    if (_landmarkerIsImageMode) {
      result = landmarker.detect(source);
      const now = timestamp != null ? timestamp : performance.now();
      if (_lockOn()) result = _keepLifter(result, source, now);
      const backOn = backfill && _backOn();
      const gateOn = _gateOn();
      let gated = false;
      // Continuity gate (jumpGate.js): a pose that jumped far from the last accepted one is held back, and the frame
      // is read as lost, so the crop retry below looks again around the lifter.
      if (gateOn && result?.landmarks?.length) {
        const { width, height } = _sourceSize(source);
        if (holdsBack(_gate, result.landmarks[0], width, height, now)) {
          gated = true;
          _gatedFrames++;
          _gate = heldBack(_gate, now);
          result = { ...result, landmarks: [], worldLandmarks: [] };
        }
      }
      if (result?.landmarks?.length) {
        if (gateOn) { const { width, height } = _sourceSize(source); _gate = gateAccept(_gate, result.landmarks[0], width, height, now); }
        _seedCrop(result.landmarks[0], source, now);
        // Backward pass: the lost frames just before this pose, read on crops seeded from it (raw landmarks, before
        // the image smoothing). It touches neither the forward seed nor the smoothing.
        if (backOn) back = _fillLost(landmarker, source, result.landmarks[0], now);
      } else {
        // No pose on the whole frame: a second look on a crop around the last accepted pose (poseCrop.js). The
        // crop's pose skips the image smoothing, so every frame the whole-frame pass reads is unchanged.
        const cropped = _detectInCrop(landmarker, source, now);
        if (cropped && gateOn) { const { width, height } = _sourceSize(source); _gate = gateAccept(_gate, cropped.landmarks[0], width, height, now); }
        if (cropped && gated) cropped.gated = true;
        if (cropped) {
          if (backOn) { const b = _fillLost(landmarker, source, cropped.landmarks[0], now); if (b) cropped.backfill = b; }
          return cropped;
        }
        if (backOn) _keepLostFrame(source, now);
        if (gated) result.gated = true;
      }
    } else {
      const ts = timestamp != null ? (timestamp + _imageTimestampOffset) : performance.now();
      if (ts > _imageMaxTimestamp) _imageMaxTimestamp = ts;
      result = landmarker.detectForVideo(source, ts);
    }
    // Log raw landmark point keys once (before any filtering)
    if (result && result.landmarks && result.landmarks.length > 0 && !detectPoseImage._loggedKeys) {
      detectPoseImage._loggedKeys = true;
      const rawPt = result.landmarks[0][0];
      const rawWPt = result.worldLandmarks?.[0]?.[0];
      console.log('[PoseAnalysis] Raw image landmark point keys:', rawPt ? Object.keys(rawPt) : 'null');
      console.log('[PoseAnalysis] Raw image landmark point 0:', rawPt ? JSON.stringify(rawPt) : 'null');
      console.log('[PoseAnalysis] Raw world landmark point keys:', rawWPt ? Object.keys(rawWPt) : 'null');
      console.log('[PoseAnalysis] Raw world landmark point 0:', rawWPt ? JSON.stringify(rawWPt) : 'null');
    }
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
    // The app adds no filter to these; Kalman and plausibility checks apply only to normalized landmarks used for
    // rendering. In VIDEO mode MediaPipe itself follows the body from the sample before (and its graph may smooth
    // the landmarks across samples; not measured by us).
    // worldLandmarks are used downstream for accurate velocity/ROM calculations.
    // result.backfill: [{ timestamp, landmarks, worldLandmarks, source: 'back' }], earlier frames that were returned
    // without a pose and now have one; the caller puts them in place of those frames.
    if (back && result) result.backfill = back;
    return result;
  } catch (e) {
    console.warn('[PoseAnalysis] Detection error (image):', e);
    if (rethrow) throw e;
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
  _kalmanVideo = new OneEuroLandmarkFilter();
  _lastValidLandmarksVideo = null;
  _ghostFrameCount = 0;
  _totalGhostFrames = 0;
}

export function resetKalmanFilters() {
  _kalmanImage = new OneEuroLandmarkFilter();
  _kalmanVideo = new OneEuroLandmarkFilter();
  _lastValidLandmarksImage = null;
  _lastValidLandmarksVideo = null;
  _cropSeed = null;
  _lifterRef = null;
  _dropLost();
  _gate = newGate();
  _gatedFrames = 0;
  // Bump timestamp offset so next video's deterministic timestamps
  // continue above the previous peak (MediaPipe requires monotonic increase).
  _imageTimestampOffset = _imageMaxTimestamp + 1000;
}

// ─── Person lock: select the subject (largest + most centered) ───

// selectSubjectPose — delegated to poseGeometry.js (re-exported above)

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
// calculateAngle, extractJointAngles, calculateTrunkAngle — delegated to poseGeometry.js (re-exported above)

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
 * @param {Object|null} coachingHighlights - { segments: Map<string, color>, pulseAlpha: number }
 *   segments maps "i-j" connection keys to override colors for coaching detections
 */
export function drawPose(ctx, landmarks, width, height, alpha = 1.0, formFeedback = null, coachingHighlights = null) {
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

  // Bright skeleton lines (color-coded by form feedback or coaching highlights)
  ctx.lineWidth = lw;
  const highlightedJoints = new Set();
  for (const [i, j] of connections) {
    if (!ok(landmarks[i]) || !ok(landmarks[j])) continue;
    const segKey = `${Math.min(i, j)}-${Math.max(i, j)}`;
    const coachColor = coachingHighlights?.segments?.get(segKey);
    if (coachColor) {
      // Coaching highlight: thicker line with glow
      ctx.save();
      ctx.lineWidth = lw + 2;
      ctx.strokeStyle = coachColor;
      ctx.shadowColor = coachColor;
      ctx.shadowBlur = 8 * (coachingHighlights.pulseAlpha || 1);
      ctx.beginPath();
      ctx.moveTo(landmarks[i].x * width, landmarks[i].y * height);
      ctx.lineTo(landmarks[j].x * width, landmarks[j].y * height);
      ctx.stroke();
      ctx.restore();
      highlightedJoints.add(i);
      highlightedJoints.add(j);
    } else {
      ctx.strokeStyle = getSegmentColor(i, j, formFeedback);
      ctx.beginPath();
      ctx.moveTo(landmarks[i].x * width, landmarks[i].y * height);
      ctx.lineTo(landmarks[j].x * width, landmarks[j].y * height);
      ctx.stroke();
    }
  }

  // Joint dots — body landmarks only (11-32), skip face (0-10)
  // Color-coded by quality: cyan (perfect) → yellow → red (failing)
  const dotR = Math.max(4, Math.round(width / 80));
  for (let k = 11; k < Math.min(landmarks.length, 33); k++) {
    if (!ok(landmarks[k])) continue;
    const coachJointColor = highlightedJoints.has(k)
      ? [...(coachingHighlights?.segments?.entries() || [])].find(([key]) => {
          const [a, b] = key.split('-').map(Number);
          return a === k || b === k;
        })?.[1]
      : null;
    ctx.fillStyle = coachJointColor || (formFeedback ? getSegmentColor(k, k, formFeedback) : '#00f5d4');
    ctx.beginPath();
    ctx.arc(landmarks[k].x * width, landmarks[k].y * height, coachJointColor ? dotR + 2 : dotR, 0, 2 * Math.PI);
    ctx.fill();
  }

  // ═══ Telemetry angle arcs at key joints ═══
  // Draw live angle values with small arcs at knee, hip, elbow, shoulder joints.
  // Color shifts when bilateral asymmetry exceeds 15% (Kiesel 2007 threshold).
  const jointDefs = [
    // [vertexIdx, armAIdx, armBIdx, label]
    [25, 23, 27], // left knee
    [26, 24, 28], // right knee
    [23, 11, 25], // left hip
    [24, 12, 26], // right hip
    [13, 11, 15], // left elbow
    [14, 12, 16], // right elbow
  ];

  // Bilateral pairs for asymmetry detection: [leftIdx, rightIdx] in jointDefs
  const bilateralPairs = [[0, 1], [2, 3], [4, 5]];

  const angles = jointDefs.map(([v, a, b]) => {
    if (!ok(landmarks[v]) || !ok(landmarks[a]) || !ok(landmarks[b])) return null;
    return Math.round(_calculateAngle(landmarks[a], landmarks[v], landmarks[b]));
  });

  // Compute asymmetry flags
  const asymFlags = new Array(jointDefs.length).fill(false);
  for (const [li, ri] of bilateralPairs) {
    if (angles[li] != null && angles[ri] != null) {
      const avg = (angles[li] + angles[ri]) / 2;
      if (avg > 0 && Math.abs(angles[li] - angles[ri]) / avg > 0.15) {
        asymFlags[li] = true;
        asymFlags[ri] = true;
      }
    }
  }

  const arcR = Math.max(14, Math.round(width / 28));
  const fontSize = Math.max(9, Math.round(width / 40));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < jointDefs.length; i++) {
    if (angles[i] == null) continue;
    const [v, a, b] = jointDefs[i];
    const vx = landmarks[v].x * width;
    const vy = landmarks[v].y * height;
    const ax = landmarks[a].x * width;
    const ay = landmarks[a].y * height;
    const bx = landmarks[b].x * width;
    const by = landmarks[b].y * height;

    // Angles of the two arms relative to vertex
    const angA = Math.atan2(ay - vy, ax - vx);
    const angB = Math.atan2(by - vy, bx - vx);

    // Draw arc
    const color = asymFlags[i] ? 'rgba(255, 100, 80, 0.85)' : 'rgba(0, 245, 212, 0.65)';
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, width / 250);
    ctx.beginPath();
    ctx.arc(vx, vy, arcR, angA, angB, false);
    ctx.stroke();

    // Draw degree label offset from joint
    const midAng = (angA + angB) / 2;
    // Disambiguate: if the arc wraps the wrong way, flip
    const labelDist = arcR + fontSize * 0.8;
    const lx = vx + Math.cos(midAng) * labelDist;
    const ly = vy + Math.sin(midAng) * labelDist;

    ctx.font = `bold ${fontSize}px sans-serif`;
    // Shadow for readability
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(`${angles[i]}°`, lx + 1, ly + 1);
    ctx.fillStyle = asymFlags[i] ? '#ff6450' : '#00f5d4';
    ctx.fillText(`${angles[i]}°`, lx, ly);
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
