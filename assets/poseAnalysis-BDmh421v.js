import { _ as __vitePreload, l as localforage } from "./index-z2b3-hEl.js";
let _mpVision = null;
async function getMediaPipeVision() {
  if (_mpVision) return _mpVision;
  _mpVision = await __vitePreload(() => import(
    /* @vite-ignore */
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/+esm"
  ), true ? [] : void 0);
  return _mpVision;
}
const modelCache = localforage.createInstance({ name: "wv-model-cache" });
const MODEL_CACHE_KEY = "pose-landmarker-full-v1";
let poseLandmarker = null;
let modelLoadPromise = null;
let lastVideoTime = -1;
let lastResult = null;
const LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32
};
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
const VISION_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
let _downloadProgressCb = null;
async function fetchModelBuffer() {
  try {
    const cached = await modelCache.getItem(MODEL_CACHE_KEY);
    if (cached) {
      console.log("[PoseAnalysis] Model loaded from IndexedDB cache");
      return cached;
    }
  } catch (_) {
  }
  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error(`Model fetch failed: ${response.status}`);
  const contentLength = parseInt(response.headers.get("Content-Length") || "0", 10);
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
        const percent = Math.round(received / contentLength * 100);
        _downloadProgressCb(percent);
      }
    }
    const buffer2 = new ArrayBuffer(received);
    const view = new Uint8Array(buffer2);
    let offset = 0;
    for (const chunk of chunks) {
      view.set(chunk, offset);
      offset += chunk.length;
    }
    modelCache.setItem(MODEL_CACHE_KEY, buffer2).catch(() => {
    });
    console.log("[PoseAnalysis] Model fetched from CDN (progressive) and cached");
    return buffer2;
  }
  const buffer = await response.arrayBuffer();
  modelCache.setItem(MODEL_CACHE_KEY, buffer).catch(() => {
  });
  console.log("[PoseAnalysis] Model fetched from CDN (fallback) and cached");
  return buffer;
}
async function createLandmarker() {
  const mp = await getMediaPipeVision();
  const vision = await mp.FilesetResolver.forVisionTasks(VISION_WASM);
  const modelBuffer = await fetchModelBuffer();
  for (const delegate of ["GPU", "CPU"]) {
    try {
      const landmarker = await mp.PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetBuffer: new Uint8Array(modelBuffer), delegate },
        runningMode: "VIDEO",
        numPoses: 3,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      console.log(`[PoseAnalysis] Created with ${delegate} delegate`);
      return landmarker;
    } catch (e) {
      console.warn(`[PoseAnalysis] ${delegate} delegate failed:`, e.message);
      if (delegate === "CPU") throw e;
    }
  }
}
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise(
      (_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    )
  ]);
}
function getPoseLandmarker() {
  if (poseLandmarker) return Promise.resolve(poseLandmarker);
  if (modelLoadPromise) return modelLoadPromise;
  modelLoadPromise = (async () => {
    poseLandmarker = await withTimeout(createLandmarker(), 12e4, "Model load");
    return poseLandmarker;
  })();
  return modelLoadPromise;
}
function preloadModel() {
  return getPoseLandmarker().then(() => true).catch((e) => {
    console.error("[PoseAnalysis] Preload failed:", e);
    modelLoadPromise = null;
    return false;
  });
}
async function loadModelWithRetry(onProgress, attempt = 1) {
  const MAX_ATTEMPTS = 3;
  onProgress?.(10 + (attempt - 1) * 30, `Loading AI engine... Attempt ${attempt}/${MAX_ATTEMPTS}`);
  _downloadProgressCb = (percent) => {
    const mapped = 10 + Math.round(percent * 0.75);
    onProgress?.(mapped, `Downloading model: ${percent}%`);
  };
  try {
    const landmarker = await getPoseLandmarker();
    _downloadProgressCb = null;
    onProgress?.(100, "AI Engine Ready");
    return landmarker;
  } catch (err) {
    _downloadProgressCb = null;
    modelLoadPromise = null;
    poseLandmarker = null;
    if (attempt < MAX_ATTEMPTS) {
      const delay = Math.pow(2, attempt) * 1e3;
      onProgress?.(10 + attempt * 30, `Retrying in ${delay / 1e3}s... (${err.message})`);
      await new Promise((r) => setTimeout(r, delay));
      return loadModelWithRetry(onProgress, attempt + 1);
    }
    throw new Error(`Failed to load AI model after ${MAX_ATTEMPTS} attempts. Check your connection.`);
  }
}
async function getVideoLandmarker() {
  return getPoseLandmarker();
}
async function getImageLandmarker() {
  return getPoseLandmarker();
}
function disposeAllLandmarkers() {
  if (poseLandmarker) {
    try {
      poseLandmarker.close();
    } catch (_) {
    }
    poseLandmarker = null;
  }
  modelLoadPromise = null;
  lastVideoTime = -1;
  lastResult = null;
}
function detectPoseImage(landmarker, source) {
  try {
    const ts = performance.now();
    return landmarker.detectForVideo(source, ts);
  } catch (e) {
    console.warn("[PoseAnalysis] Detection error (image):", e);
    return null;
  }
}
function detectPoseVideo(landmarker, videoElement, timestamp) {
  const EPSILON = 1e-3;
  if (Math.abs(timestamp - lastVideoTime) < EPSILON) {
    return lastResult;
  }
  lastVideoTime = timestamp;
  try {
    const result = landmarker.detectForVideo(videoElement, timestamp);
    if (result && result.segmentationMasks) {
      result.segmentationMasks.forEach((m) => {
        try {
          m.close();
        } catch (_) {
        }
      });
    }
    if (result && result.landmarks && result.landmarks.length > 0) {
      lastResult = result;
    }
    return result;
  } catch (e) {
    console.warn("[PoseAnalysis] Detection error (video):", e);
    return lastResult;
  }
}
function resetTimestamp() {
  lastVideoTime = -1;
  lastResult = null;
}
function selectSubjectPose(landmarksArray) {
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
    const dist = Math.sqrt((cx - 0.5) ** 2 + (cy - 0.5) ** 2);
    const score = area * 1e3 - dist * 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestPose = pose;
    }
  }
  return bestPose;
}
function calculateAngle(a, b, c) {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);
  if (magBA === 0 || magBC === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cosAngle) * 180 / Math.PI;
}
function extractJointAngles(landmarks) {
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
    _visRightShoulder: vis(LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW)
  };
}
function calculateTrunkAngle(landmarks) {
  const midShoulder = {
    x: (landmarks[LANDMARKS.LEFT_SHOULDER].x + landmarks[LANDMARKS.RIGHT_SHOULDER].x) / 2,
    y: (landmarks[LANDMARKS.LEFT_SHOULDER].y + landmarks[LANDMARKS.RIGHT_SHOULDER].y) / 2,
    z: ((landmarks[LANDMARKS.LEFT_SHOULDER].z || 0) + (landmarks[LANDMARKS.RIGHT_SHOULDER].z || 0)) / 2
  };
  const midHip = {
    x: (landmarks[LANDMARKS.LEFT_HIP].x + landmarks[LANDMARKS.RIGHT_HIP].x) / 2,
    y: (landmarks[LANDMARKS.LEFT_HIP].y + landmarks[LANDMARKS.RIGHT_HIP].y) / 2,
    z: ((landmarks[LANDMARKS.LEFT_HIP].z || 0) + (landmarks[LANDMARKS.RIGHT_HIP].z || 0)) / 2
  };
  const verticalRef = { ...midHip, y: midHip.y - 1 };
  return calculateAngle(midShoulder, midHip, verticalRef);
}
const FORM_CHECK_LANDMARKS = {
  "Knee valgus": [23, 24, 25, 26, 27, 28],
  "Hip depth": [11, 12, 23, 24, 25, 26],
  "Trunk angle": [11, 12, 23, 24],
  "Bar path": [13, 14, 15, 16],
  "Elbow flare": [11, 12, 13, 14, 15, 16],
  "Wrist position": [13, 14, 15, 16],
  "Scapular retraction": [11, 12],
  "Lumbar flexion": [11, 12, 23, 24],
  "Hip hinge": [23, 24, 25, 26, 27, 28],
  "Knee position": [23, 24, 25, 26, 27, 28],
  "Shoulder protraction": [11, 12, 13, 14],
  "Tempo": []
};
function getSegmentColor(i, j, formFeedback) {
  if (!formFeedback || formFeedback.length === 0) return "#00FF88";
  let hasMajor = false, hasMinor = false;
  for (const f of formFeedback) {
    if (f.passed) continue;
    const affected = FORM_CHECK_LANDMARKS[f.name] || [];
    const hit = affected.includes(i) || affected.includes(j);
    if (hit && f.severity === "major") hasMajor = true;
    if (hit && f.severity === "minor") hasMinor = true;
  }
  if (hasMajor) return "#FF3355";
  if (hasMinor) return "#FFCC00";
  return "#00FF88";
}
function drawPose(ctx, landmarks, width, height, alpha = 1, formFeedback = null) {
  if (!landmarks || landmarks.length === 0) return;
  const connections = [
    [11, 12],
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16],
    [11, 23],
    [12, 24],
    [23, 24],
    [23, 25],
    [25, 27],
    [24, 26],
    [26, 28],
    [27, 29],
    [29, 31],
    [28, 30],
    [30, 32]
  ];
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(5, width / 80) + 2;
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  for (const [i, j] of connections) {
    if (landmarks[i] && landmarks[j] && (landmarks[i].visibility || 0) > 0.3 && (landmarks[j].visibility || 0) > 0.3) {
      ctx.beginPath();
      ctx.moveTo(landmarks[i].x * width, landmarks[i].y * height);
      ctx.lineTo(landmarks[j].x * width, landmarks[j].y * height);
      ctx.stroke();
    }
  }
  ctx.lineWidth = Math.max(5, width / 80);
  for (const [i, j] of connections) {
    if (landmarks[i] && landmarks[j] && (landmarks[i].visibility || 0) > 0.3 && (landmarks[j].visibility || 0) > 0.3) {
      ctx.strokeStyle = getSegmentColor(i, j, formFeedback);
      ctx.beginPath();
      ctx.moveTo(landmarks[i].x * width, landmarks[i].y * height);
      ctx.lineTo(landmarks[j].x * width, landmarks[j].y * height);
      ctx.stroke();
    }
  }
  const dotSize = Math.max(5, width / 80);
  ctx.fillStyle = "#FF3355";
  for (const lm of landmarks) {
    if ((lm.visibility || 0) < 0.3) continue;
    ctx.beginPath();
    ctx.arc(lm.x * width, lm.y * height, dotSize, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawOverlayMessage(ctx, line1, line2) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(line1, ctx.canvas.width / 2, ctx.canvas.height / 2 - 15);
  ctx.font = "16px sans-serif";
  ctx.fillText(line2, ctx.canvas.width / 2, ctx.canvas.height / 2 + 15);
}
export {
  LANDMARKS,
  calculateAngle,
  detectPoseImage,
  detectPoseVideo,
  disposeAllLandmarkers,
  drawOverlayMessage,
  drawPose,
  extractJointAngles,
  getImageLandmarker,
  getVideoLandmarker,
  loadModelWithRetry,
  preloadModel,
  resetTimestamp,
  selectSubjectPose
};
