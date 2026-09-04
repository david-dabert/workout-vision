/**
 * poseWorker.js — Web Worker for offloading MediaPipe pose detection.
 *
 * Must be loaded as a module worker:
 *   new Worker(new URL('./poseWorker.js', import.meta.url), { type: 'module' })
 *
 * Messages accepted:
 *   { type: 'init' }
 *   { type: 'processFrame', frameData: ArrayBuffer, width, height, timestamp, frameIndex }
 *   { type: 'reset' }
 *   { type: 'dispose' }
 */

const MEDIAPIPE_VERSION = '0.10.8';
const CDN_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const WASM_URL = `${CDN_BASE}/wasm`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

let landmarker = null;
let offscreenCanvas = null;
let offscreenCtx = null;
let currentWidth = 0;
let currentHeight = 0;

/**
 * Lazily import the MediaPipe ESM bundle from CDN.
 */
async function loadMediaPipe() {
  const mp = await import(`${CDN_BASE}/+esm`);
  return mp;
}

/**
 * Ensure the OffscreenCanvas matches the requested dimensions.
 */
function ensureCanvas(width, height) {
  if (offscreenCanvas && currentWidth === width && currentHeight === height) {
    return;
  }
  offscreenCanvas = new OffscreenCanvas(width, height);
  offscreenCtx = offscreenCanvas.getContext('2d');
  currentWidth = width;
  currentHeight = height;
}

/**
 * Handle incoming messages from the main thread.
 */
self.onmessage = async (e) => {
  const msg = e.data;

  switch (msg.type) {
    case 'init':
      await handleInit();
      break;

    case 'processFrame':
      handleProcessFrame(msg);
      break;

    case 'reset':
      handleReset();
      break;

    case 'dispose':
      handleDispose();
      break;

    default:
      self.postMessage({ type: 'error', message: `Unknown message type: ${msg.type}` });
  }
};

async function handleInit() {
  // Prevent leaking the old landmarker if init is called twice
  if (landmarker) {
    landmarker.close();
    landmarker = null;
  }

  try {
    const mp = await loadMediaPipe();

    // Fetch model from CDN (no IndexedDB caching; main thread handles that)
    const modelResponse = await fetch(MODEL_URL);
    if (!modelResponse.ok) {
      throw new Error(`Failed to fetch model: ${modelResponse.status} ${modelResponse.statusText}`);
    }
    const modelBuffer = await modelResponse.arrayBuffer();

    const vision = await mp.FilesetResolver.forVisionTasks(WASM_URL);

    const commonOptions = {
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.35,
      minPosePresenceConfidence: 0.4,
      minTrackingConfidence: 0.5,
    };

    // Try GPU delegate first (OffscreenCanvas supports WebGL in Chromium),
    // then fall back to CPU if GPU fails.
    try {
      landmarker = await mp.PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetBuffer: new Uint8Array(modelBuffer),
          delegate: 'GPU',
        },
        ...commonOptions,
      });
    } catch (gpuErr) {
      console.warn(`GPU delegate failed, falling back to CPU: ${gpuErr.message}`);
      landmarker = await mp.PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetBuffer: new Uint8Array(modelBuffer),
          delegate: 'CPU',
        },
        ...commonOptions,
      });
    }

    self.postMessage({ type: 'ready' });
  } catch (err) {
    self.postMessage({ type: 'error', message: `Init failed: ${err.message}` });
  }
}

function handleProcessFrame({ frameData, width, height, timestamp, frameIndex }) {
  if (!landmarker) {
    self.postMessage({
      type: 'frameResult',
      landmarks: null,
      frameIndex,
      error: 'Landmarker not initialized. Call init first.',
    });
    return;
  }

  try {
    ensureCanvas(width, height);

    // Reconstruct ImageData from the transferred RGBA buffer
    const pixels = new Uint8ClampedArray(frameData);
    const imageData = new ImageData(pixels, width, height);
    offscreenCtx.putImageData(imageData, 0, 0);

    // Run detection
    const result = landmarker.detectForVideo(offscreenCanvas, timestamp);

    // Extract landmarks (array of pose landmark arrays, or null if none found)
    const landmarks =
      result.landmarks && result.landmarks.length > 0
        ? result.landmarks.map((poseLandmarks) =>
            poseLandmarks.map((lm) => ({
              x: lm.x,
              y: lm.y,
              z: lm.z,
              visibility: lm.visibility,
            }))
          )
        : null;

    self.postMessage({ type: 'frameResult', landmarks, frameIndex });
  } catch (err) {
    self.postMessage({
      type: 'frameResult',
      landmarks: null,
      frameIndex,
      error: err.message,
    });
  }
}

function handleReset() {
  // Disposing and re-creating is the only reliable way to reset timestamp state.
  // However, for a lightweight reset we just acknowledge; the caller can re-init
  // if a full reset is needed. MediaPipe VIDEO mode handles non-monotonic timestamps
  // by throwing, so the main thread must ensure monotonic ordering.
  self.postMessage({ type: 'resetDone' });
}

function handleDispose() {
  if (landmarker) {
    landmarker.close();
    landmarker = null;
  }
  offscreenCanvas = null;
  offscreenCtx = null;
  currentWidth = 0;
  currentHeight = 0;
  self.postMessage({ type: 'disposed' });
}
