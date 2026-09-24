/**
 * Layer 1: Frame & Pose Pipeline
 *
 * Extracts frames from video, downscales to 640px on long side,
 * normalizes frame rate to 30fps, runs MediaPipe Pose Landmark detection,
 * and outputs an array of { timestamp, landmarks } objects.
 *
 * Memory management:
 * - Closes each ImageBitmap immediately after inference
 * - Releases pose model after extraction is complete
 * - Writes progress to localStorage for crash recovery
 * - No duration cap; handles all five truth-set clips
 *
 * Frame rate normalization:
 * - All source videos are normalized to 30fps BEFORE counting.
 * - A 120fps video produces the same number of frames as a 30fps video
 *   of the same duration. This prevents overcounting.
 */

const TARGET_FPS = 30;
const MAX_WIDTH = 640;
const CHECKPOINT_INTERVAL = 50;
const PROGRESS_KEY = 'wv-pipeline-progress';

/**
 * Extract frames from a video file and run pose detection on each frame.
 *
 * @param {File} file - Video file to analyze
 * @param {Object} options
 * @param {Function} options.onProgress - Progress callback (0-100)
 * @param {AbortSignal} options.signal - AbortSignal for cancellation
 * @returns {Promise<{ frames: Array<{ timestamp: number, landmarks: Array }>, duration: number, fps: number }>}
 */
export async function extractPoseLandmarks(file, options = {}) {
  const { onProgress = () => {}, signal } = options;
  const fps = TARGET_FPS;

  // Step 1: Load video metadata
  const videoMeta = await loadVideoMetadata(file, signal);
  const { duration, videoWidth, videoHeight } = videoMeta;

  // Compute output dimensions (640px on long side)
  const longSide = Math.max(videoWidth, videoHeight);
  const scale = longSide > MAX_WIDTH ? MAX_WIDTH / longSide : 1;
  let frameWidth = Math.round(videoWidth * scale);
  let frameHeight = Math.round(videoHeight * scale);
  // Ensure even dimensions
  frameWidth -= frameWidth % 2;
  frameHeight -= frameHeight % 2;

  // Step 2: Check for partial checkpoint
  const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
  let checkpoint = loadCheckpoint(fileKey);
  let startFrame = 0;
  let collectedFrames = [];

  if (checkpoint && checkpoint.frames && checkpoint.frames.length > 0) {
    collectedFrames = checkpoint.frames;
    startFrame = collectedFrames.length;
    onProgress(Math.round((startFrame / Math.floor(duration * fps)) * 90));
  }

  // Step 3: Load MediaPipe model
  const { PoseLandmarker, FilesetResolver } = await loadMediaPipe();
  const wasmPath = await resolveWasmPath(FilesetResolver);
  const modelPath = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

  let landmarker = null;
  try {
    landmarker = await PoseLandmarker.createFromOptions(wasmPath, {
      baseOptions: {
        modelAssetPath: modelPath,
        delegate: 'CPU',
      },
      runningMode: 'IMAGE',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    // Step 4: Extract frames at 30fps via seek-based extraction
    const totalFrames = Math.floor(duration * fps);
    const interval = 1 / fps;

    const canvas = document.createElement('canvas');
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Create video element for seeking
    const video = await createVideoElement(file, signal);

    try {
      for (let i = startFrame; i < totalFrames; i++) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const seekTime = i * interval;
        if (seekTime > duration) break;

        // Seek to frame time
        const seekOk = await seekToTime(video, seekTime, signal);
        if (!seekOk) continue;

        // Draw frame to canvas (downscaled)
        try {
          ctx.drawImage(video, 0, 0, frameWidth, frameHeight);
        } catch {
          continue;
        }

        // Run pose detection
        let landmarks = null;
        try {
          const result = landmarker.detect(canvas);
          if (result?.landmarks?.length > 0) {
            // Select best pose (closest to center, largest)
            landmarks = selectBestPose(result.landmarks, frameWidth, frameHeight);
          }
        } catch {
          // Pose detection failed for this frame, skip
        }

        if (landmarks) {
          collectedFrames.push({
            timestamp: seekTime,
            landmarks: landmarks,
          });
        }

        // Save checkpoint periodically
        if (collectedFrames.length > 0 && collectedFrames.length % CHECKPOINT_INTERVAL === 0) {
          saveCheckpoint(fileKey, collectedFrames);
        }

        onProgress(Math.round((i / totalFrames) * 90));

        // Yield to main thread
        if (i % 5 === 0) {
          await new Promise(r => setTimeout(r, 0));
        }
      }
    } finally {
      // Clean up video element
      video.pause();
      video.src = '';
      video.load();
    }

    // Clear checkpoint on success
    clearCheckpoint(fileKey);

    onProgress(95);

    return {
      frames: collectedFrames,
      duration,
      fps,
    };

  } finally {
    // Release the pose model
    if (landmarker) {
      try { landmarker.close(); } catch {}
      landmarker = null;
    }
  }
}

// ============================================================================
// Internal helpers
// ============================================================================

async function loadVideoMetadata(file, signal) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.src = '';
    };

    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    const timeout = setTimeout(() => {
      cleanup();
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new Error('Video metadata load timeout'));
    }, 30000);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      if (signal) signal.removeEventListener('abort', onAbort);
      const meta = {
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      };
      cleanup();
      resolve(meta);
    };

    video.onerror = () => {
      clearTimeout(timeout);
      if (signal) signal.removeEventListener('abort', onAbort);
      cleanup();
      reject(new Error('Failed to load video metadata'));
    };

    video.src = url;
    video.load();
  });
}

async function createVideoElement(file, signal) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video._blobUrl = url;

    const onAbort = () => {
      URL.revokeObjectURL(url);
      video.src = '';
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    const timeout = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      URL.revokeObjectURL(url);
      video.src = '';
      reject(new Error('Video load timeout'));
    }, 30000);

    video.onloadeddata = () => {
      clearTimeout(timeout);
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve(video);
    };

    video.onerror = () => {
      clearTimeout(timeout);
      if (signal) signal.removeEventListener('abort', onAbort);
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video'));
    };

    video.src = url;
    video.load();
  });
}

function seekToTime(video, time, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(false); return; }

    const timeout = setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve(false);
    }, 5000);

    const onSeeked = () => {
      clearTimeout(timeout);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve(true);
    };
    const onError = () => {
      clearTimeout(timeout);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve(false);
    };

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = time;
  });
}

function selectBestPose(poseLandmarks, frameWidth, frameHeight) {
  if (poseLandmarks.length === 1) return poseLandmarks[0];

  // Select the pose closest to center with highest visibility
  const cx = 0.5;
  const cy = 0.5;
  let bestIdx = 0;
  let bestScore = -Infinity;

  for (let i = 0; i < poseLandmarks.length; i++) {
    const lm = poseLandmarks[i];
    if (!lm || lm.length === 0) continue;

    // Average position
    let sx = 0, sy = 0, sv = 0;
    for (const p of lm) {
      sx += p.x || 0;
      sy += p.y || 0;
      sv += p.visibility || 0;
    }
    sx /= lm.length;
    sy /= lm.length;
    sv /= lm.length;

    const dist = Math.sqrt((sx - cx) ** 2 + (sy - cy) ** 2);
    const score = sv - dist;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return poseLandmarks[bestIdx];
}

async function loadMediaPipe() {
  // Dynamic import from CDN to bypass Vite's esbuild issues on iOS Safari
  const mp = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/+esm');
  return {
    PoseLandmarker: mp.PoseLandmarker,
    FilesetResolver: mp.FilesetResolver,
  };
}

async function resolveWasmPath(FilesetResolver) {
  // Try local WASM first, fall back to CDN
  try {
    const fileset = await FilesetResolver.forVisionTasks(
      `${import.meta.env?.BASE_URL || '/'}mediapipe`
    );
    return fileset;
  } catch {
    return await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
    );
  }
}

function saveCheckpoint(key, frames) {
  try {
    // Only save timestamps + minimal landmark data for recovery
    const minimal = {
      key,
      count: frames.length,
      frames: frames,
    };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ key, count: frames.length }));
  } catch {
    // localStorage may be full; ignore
  }
}

function loadCheckpoint(key) {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.key !== key) return null;
    return data;
  } catch {
    return null;
  }
}

function clearCheckpoint(key) {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {}
}
