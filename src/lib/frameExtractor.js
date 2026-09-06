/**
 * Frame extraction and hashing utilities for video analysis.
 *
 * Primary extraction method: extractFramesStreaming (native <video> seeking).
 * Processes one frame at a time via callback, keeping memory usage constant
 * regardless of video length. Works on all platforms including iOS Safari.
 */

/**
 * Hash the first 2MB of a file using SHA-256.
 * 2MB is enough to uniquely identify any video file while staying fast.
 * Returns first 16 hex chars.
 */
export async function hashFile(file) {
  const chunkSize = 2 * 1024 * 1024;
  const slice = file.slice(0, Math.min(file.size, chunkSize));
  const buffer = await slice.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/**
 * Hash an array of landmark objects for determinism verification.
 * Converts landmarks to a string and hashes with SHA-256.
 * Returns first 16 hex chars.
 */
export async function hashLandmarks(landmarks) {
  // Extract just the x,y,z values (truncated to 6 decimals for stability)
  const data = landmarks.map(frame => {
    if (!frame) return '';
    return frame.map(lm => {
      if (!lm) return '0,0,0';
      return `${(lm.x || 0).toFixed(6)},${(lm.y || 0).toFixed(6)},${(lm.z || 0).toFixed(6)}`;
    }).join(';');
  }).join('|');

  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/**
 * Streaming frame extractor. Primary extraction method for all platforms.
 *
 * Unlike extractFramesFallback which stores ALL frames in memory at once,
 * this function seeks one frame at a time and passes it to a callback.
 * Only one ImageData exists in memory at any moment.
 *
 * Fixes from expert panel review:
 * - Waits for 'loadeddata' not just 'loadedmetadata' (decoder readiness)
 * - 5-second seek timeout (prevents infinite hang on corrupted segments)
 * - Duplicate frame detection (iOS keyframe-snapping produces duplicates)
 * - try/catch on getImageData (HEVC canvas taint on some iOS versions)
 * - Yields to main thread every frame (prevents UI freeze)
 *
 * @param {File} file - Video file
 * @param {number} targetFps - Target frames per second
 * @param {number} maxFrames - Maximum frames to extract
 * @param {number} maxWidth - Maximum frame width
 * @param {function} onFrame - Called with (canvas, frameIndex, timestamp). Process the frame here.
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<{width: number, height: number, fps: number, duration: number, frameCount: number}>}
 */
export async function extractFramesStreaming(file, targetFps, maxFrames, maxWidth, onFrame, onProgress) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  try {
    // Wait for decoder readiness, not just metadata
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Video load timeout')), 15000);
      video.onloadeddata = () => { clearTimeout(timeout); resolve(); };
      video.onerror = () => { clearTimeout(timeout); reject(new Error('Failed to load video')); };
    });

    const duration = video.duration;
    const nativeWidth = video.videoWidth;
    const nativeHeight = video.videoHeight;

    let frameWidth = nativeWidth;
    let frameHeight = nativeHeight;
    if (frameWidth > maxWidth) {
      const scale = maxWidth / frameWidth;
      frameWidth = Math.round(frameWidth * scale);
      frameHeight = Math.round(frameHeight * scale);
      frameWidth -= frameWidth % 2;
      frameHeight -= frameHeight % 2;
    }

    const canvas = document.createElement('canvas');
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const interval = 1 / targetFps;
    const totalPossibleFrames = Math.floor(duration * targetFps);
    const frameCount = Math.min(totalPossibleFrames, maxFrames);

    // For duplicate detection: compare actual video.currentTime after seek.
    // iOS Safari snaps to keyframes, so multiple seek requests may land on
    // the same decoded frame. Comparing currentTime is reliable; comparing
    // pixel data from the top row is not (gym ceiling doesn't change).
    let prevCurrentTime = -1;
    let extractedCount = 0;

    for (let i = 0; i < frameCount; i++) {
      const seekTime = i * interval;
      if (seekTime > duration) break;

      // Seek with 5-second timeout
      video.currentTime = seekTime;
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('error', onError);
            resolve(); // skip frame rather than crash
          }, 5000);
          const onSeeked = () => {
            clearTimeout(timeout);
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('error', onError);
            resolve();
          };
          const onError = () => {
            clearTimeout(timeout);
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('error', onError);
            resolve(); // skip frame rather than crash
          };
          video.addEventListener('seeked', onSeeked);
          video.addEventListener('error', onError);
        });
      } catch {
        continue; // skip this frame
      }

      // Duplicate detection via currentTime comparison (keyframe snapping)
      const actualTime = video.currentTime;
      if (Math.abs(actualTime - prevCurrentTime) < 0.01) {
        // Seek landed on the same keyframe as last time, skip
        if (onProgress) onProgress(Math.round(((i + 1) / frameCount) * 100));
        continue;
      }
      prevCurrentTime = actualTime;

      // Draw frame to canvas
      try {
        ctx.drawImage(video, 0, 0, frameWidth, frameHeight);
      } catch {
        continue; // canvas taint or draw failure, skip frame
      }

      // Pass the canvas directly to the callback (no ImageData allocation needed
      // if the callback can work with canvas — MediaPipe's detectForVideo takes canvas)
      await onFrame(canvas, extractedCount, seekTime);
      extractedCount++;

      if (onProgress) {
        onProgress(Math.round(((i + 1) / frameCount) * 100));
      }

      // Yield to main thread to prevent UI freeze
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    return {
      width: frameWidth,
      height: frameHeight,
      fps: targetFps,
      duration,
      frameCount: extractedCount,
    };
  } finally {
    URL.revokeObjectURL(url);
    video.src = '';
    video.load();
  }
}
