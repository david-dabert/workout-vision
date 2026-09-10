/**
 * Frame extraction and hashing utilities for video analysis.
 *
 * Two extraction methods:
 * 1. extractFramesRVFC — requestVideoFrameCallback with accelerated playback (primary).
 *    Plays video at 2-4x speed and captures frames via rVFC. No seeking, no timeouts,
 *    GPU-accelerated decode. Chrome 83+, Safari 15.4+.
 * 2. extractFramesSeek — legacy seek-based extraction (fallback).
 *    Seeks one frame at a time. Works on all platforms including older iOS Safari.
 *
 * Both methods stream one frame at a time via callback, keeping memory constant.
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
 * RVFC-based frame extractor (primary path).
 *
 * Plays the video at an accelerated playback rate and uses
 * requestVideoFrameCallback to capture frames at the target FPS interval.
 * Much faster than seeking because:
 * - No per-frame seek overhead (continuous decode pipeline)
 * - GPU-accelerated video decode
 * - Frame-accurate timing from the callback metadata
 *
 * @param {File} file - Video file
 * @param {number} targetFps - Target frames per second
 * @param {number} maxFrames - Maximum frames to extract
 * @param {number} maxWidth - Maximum frame width
 * @param {function} onFrame - Called with (canvas, frameIndex, timestamp)
 * @param {function} onProgress - Progress callback (0-100)
 * @param {Object} [options] - Additional options
 * @param {AbortSignal} [options.signal] - AbortSignal for cancellation
 * @param {number} [options.startFrame] - Frame index to start from (for resume)
 * @returns {Promise<{width, height, fps, duration, frameCount}>}
 */
async function extractFramesRVFC(file, targetFps, maxFrames, maxWidth, onFrame, onProgress, options = {}) {
  const { signal, startFrame = 0 } = options;
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  try {
    // Check for early abort
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // Wait for decoder readiness
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Video load timeout')), 15000);

      const onAbort = () => {
        clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (signal) signal.addEventListener('abort', onAbort, { once: true });

      video.onloadeddata = () => {
        clearTimeout(timeout);
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timeout);
        if (signal) signal.removeEventListener('abort', onAbort);
        reject(new Error('Failed to load video'));
      };
      video.src = url;
      video.load();
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

    // If resuming, seek to the start position
    const startTime = startFrame * interval;
    if (startFrame > 0 && startTime < duration) {
      video.currentTime = startTime;
      await new Promise((resolve) => {
        const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
        video.addEventListener('seeked', onSeeked);
        setTimeout(resolve, 3000); // timeout fallback
      });
    }

    // Play at accelerated rate for faster extraction
    // 3x is a good balance: fast extraction without overloading the decoder
    video.playbackRate = 3.0;

    let extractedCount = startFrame;
    let nextCaptureTime = startTime;
    let lastCapturedTime = -1;

    return await new Promise((resolve, reject) => {
      let resolved = false;

      const cleanup = () => {
        video.pause();
      };

      const onAbort = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(new DOMException('Aborted', 'AbortError'));
        }
      };
      if (signal) signal.addEventListener('abort', onAbort, { once: true });

      const onVideoFrame = async (now, metadata) => {
        if (resolved) return;

        // Check abort
        if (signal?.aborted) {
          onAbort();
          return;
        }

        const mediaTime = metadata.mediaTime;

        // Check if we've reached the end or frame limit
        if (mediaTime >= duration || extractedCount >= frameCount) {
          if (!resolved) {
            resolved = true;
            cleanup();
            if (signal) signal.removeEventListener('abort', onAbort);
            resolve({
              width: frameWidth,
              height: frameHeight,
              fps: targetFps,
              duration,
              frameCount: extractedCount,
            });
          }
          return;
        }

        // Capture frame if we've passed the next capture time threshold
        if (mediaTime >= nextCaptureTime - 0.001) {
          // Skip duplicate frames (same media time as last capture)
          if (Math.abs(mediaTime - lastCapturedTime) >= 0.01) {
            try {
              ctx.drawImage(video, 0, 0, frameWidth, frameHeight);
              await onFrame(canvas, extractedCount, mediaTime);
              extractedCount++;
              lastCapturedTime = mediaTime;

              if (onProgress) {
                onProgress(Math.round((extractedCount / frameCount) * 100));
              }
            } catch {
              // canvas draw failure, skip frame
            }
          }

          // Advance to next capture point
          nextCaptureTime = (extractedCount) * interval;
        }

        // Register next callback
        video.requestVideoFrameCallback(onVideoFrame);
      };

      // Handle video ending
      video.onended = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          if (signal) signal.removeEventListener('abort', onAbort);
          resolve({
            width: frameWidth,
            height: frameHeight,
            fps: targetFps,
            duration,
            frameCount: extractedCount,
          });
        }
      };

      video.onerror = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          if (signal) signal.removeEventListener('abort', onAbort);
          reject(new Error('Video playback error during extraction'));
        }
      };

      // Start frame capture loop and play
      video.requestVideoFrameCallback(onVideoFrame);
      video.play().catch((err) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          if (signal) signal.removeEventListener('abort', onAbort);
          reject(err);
        }
      });
    });
  } finally {
    URL.revokeObjectURL(url);
    video.pause();
    video.src = '';
    video.load();
  }
}

/**
 * Seek-based frame extractor (fallback path).
 *
 * Seeks one frame at a time via <video>.currentTime. Works on all platforms
 * including older iOS Safari that lacks requestVideoFrameCallback.
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
 * @param {Object} [options] - Additional options
 * @param {AbortSignal} [options.signal] - AbortSignal for cancellation
 * @param {number} [options.startFrame] - Frame index to start from (for resume)
 * @returns {Promise<{width: number, height: number, fps: number, duration: number, frameCount: number}>}
 */
async function extractFramesSeek(file, targetFps, maxFrames, maxWidth, onFrame, onProgress, options = {}) {
  const { signal, startFrame = 0 } = options;
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  try {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // Wait for decoder readiness, not just metadata.
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Video load timeout')), 15000);

      const onAbort = () => {
        clearTimeout(timeout);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (signal) signal.addEventListener('abort', onAbort, { once: true });

      video.onloadeddata = () => {
        clearTimeout(timeout);
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timeout);
        if (signal) signal.removeEventListener('abort', onAbort);
        reject(new Error('Failed to load video'));
      };
      video.src = url;
      video.load();
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

    let prevCurrentTime = -1;
    let extractedCount = startFrame;

    for (let i = startFrame; i < frameCount; i++) {
      // Check abort between frames
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const seekTime = i * interval;
      if (seekTime > duration) break;

      // Seek with 5-second timeout
      video.currentTime = seekTime;
      let seekOk = true;
      try {
        seekOk = await new Promise((resolve) => {
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
        });
      } catch {
        seekOk = false;
      }
      if (!seekOk) {
        if (onProgress) onProgress(Math.round(((i + 1) / frameCount) * 100));
        continue;
      }

      // Duplicate detection via currentTime comparison (keyframe snapping)
      const actualTime = video.currentTime;
      if (Math.abs(actualTime - prevCurrentTime) < 0.01) {
        if (onProgress) onProgress(Math.round(((i + 1) / frameCount) * 100));
        continue;
      }
      prevCurrentTime = actualTime;

      // Draw frame to canvas
      try {
        ctx.drawImage(video, 0, 0, frameWidth, frameHeight);
      } catch {
        continue;
      }

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

/**
 * Streaming frame extractor with automatic method selection.
 *
 * Uses requestVideoFrameCallback when available (2-4x faster),
 * falls back to seek-based extraction otherwise.
 *
 * @param {File} file - Video file
 * @param {number} targetFps - Target frames per second
 * @param {number} maxFrames - Maximum frames to extract
 * @param {number} maxWidth - Maximum frame width
 * @param {function} onFrame - Called with (canvas, frameIndex, timestamp)
 * @param {function} onProgress - Progress callback (0-100)
 * @param {Object} [options] - Additional options
 * @param {AbortSignal} [options.signal] - AbortSignal for cancellation
 * @param {number} [options.startFrame] - Frame index to start from (for resume)
 * @returns {Promise<{width, height, fps, duration, frameCount, method: string}>}
 */
export async function extractFramesStreaming(file, targetFps, maxFrames, maxWidth, onFrame, onProgress, options = {}) {
  const useRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

  if (useRVFC) {
    try {
      const result = await extractFramesRVFC(file, targetFps, maxFrames, maxWidth, onFrame, onProgress, options);
      return { ...result, method: 'rvfc' };
    } catch (err) {
      // If aborted, re-throw immediately
      if (err.name === 'AbortError') throw err;
      // RVFC failed for other reasons, fall back to seek
      console.warn('[frameExtractor] RVFC extraction failed, falling back to seek:', err.message);
    }
  }

  const result = await extractFramesSeek(file, targetFps, maxFrames, maxWidth, onFrame, onProgress, options);
  return { ...result, method: 'seek' };
}
