/**
 * Frame extraction and hashing utilities for video analysis.
 *
 * Three extraction methods (tried in order):
 * 1. extractFramesRVFC — requestVideoFrameCallback with accelerated playback (primary).
 *    Plays video at 2-4x speed and captures frames via rVFC. Chrome 83+, Safari 15.4+.
 * 2. extractFramesWebCodecs — WebCodecs VideoDecoder with web-demuxer (HEVC fix).
 *    Decodes video frames directly via hardware decoder, bypassing <video> + canvas.
 *    Solves HEVC canvas taint on iOS Safari. Safari 16.4+.
 * 3. extractFramesSeek — legacy seek-based extraction (fallback).
 *    Seeks one frame at a time. Works on all platforms including older iOS Safari.
 *
 * All methods stream one frame at a time via callback, keeping memory constant.
 */

const IS_IOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

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
      const timeout = setTimeout(() => reject(new Error('Video load timeout (30s)')), 30000);

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

    // Play at accelerated rate for faster extraction.
    // iOS HEVC hardware decoder can't sustain 3x on large files -- frames drop
    // and rVFC callbacks fire without new decoded frames, causing stalls.
    // 1.5x is the safe ceiling on iOS; 3x works on desktop Chrome/Firefox.
    video.playbackRate = IS_IOS ? 1.5 : 3.0;

    let extractedCount = startFrame;
    let nextCaptureTime = startTime;
    let lastCapturedTime = -1;

    return await new Promise((resolve, reject) => {
      let resolved = false;

      const cleanup = () => {
        video.pause();
        clearTimeout(stallTimeout);
      };

      // Safety timeout: if no frames arrive within 20 seconds of play(),
      // the video is likely stalled (common on iOS with large files)
      let stallTimeout;
      const resetStallTimeout = () => {
        clearTimeout(stallTimeout);
        stallTimeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            cleanup();
            if (signal) signal.removeEventListener('abort', onAbort);
            if (extractedCount > 0) {
              resolve({
                width: frameWidth, height: frameHeight,
                fps: targetFps, duration, frameCount: extractedCount,
              });
            } else {
              reject(new Error('Video playback stalled — no frames received'));
            }
          }
        }, 20000);
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
        resetStallTimeout();

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

              // On the first frame, validate the canvas isn't blank (HEVC canvas taint
              // on some iOS versions produces all-black frames silently)
              if (extractedCount === 0) {
                try {
                  const sample = ctx.getImageData(
                    Math.floor(frameWidth / 4), Math.floor(frameHeight / 4),
                    Math.min(32, frameWidth), Math.min(32, frameHeight)
                  );
                  let nonZero = 0;
                  for (let p = 0; p < sample.data.length; p += 4) {
                    if (sample.data[p] > 0 || sample.data[p + 1] > 0 || sample.data[p + 2] > 0) {
                      nonZero++;
                      if (nonZero >= 3) break; // enough to confirm non-blank
                    }
                  }
                  if (nonZero < 3) {
                    // HEVC canvas taint: drawImage renders black pixels.
                    // Stop immediately — processing hundreds of blank frames is pointless.
                    if (!resolved) {
                      resolved = true;
                      cleanup();
                      if (signal) signal.removeEventListener('abort', onAbort);
                      reject(new Error('BLANK_FRAMES: Video frames are blank (canvas cannot render this codec)'));
                    }
                    return;
                  }
                } catch (e) {
                  // getImageData threw — canvas IS tainted (CORS or codec security)
                  console.error('[frameExtractor] Canvas tainted:', e.message);
                  if (!resolved) {
                    resolved = true;
                    cleanup();
                    if (signal) signal.removeEventListener('abort', onAbort);
                    reject(new Error(`Canvas tainted by video codec (${e.message}). Try converting the video to H.264 MP4.`));
                  }
                  return;
                }
              }

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
      resetStallTimeout(); // Start the stall watchdog
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
      const timeout = setTimeout(() => reject(new Error('Video load timeout (30s)')), 30000);

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
      } catch (drawErr) {
        // On first frame, canvas taint is fatal — no point continuing
        if (extractedCount === 0) {
          throw new Error(`Canvas draw failed on first frame: ${drawErr.message}. Video codec may not be supported for canvas rendering.`);
        }
        continue;
      }

      // Validate first frame isn't blank (HEVC canvas taint produces all-black)
      if (extractedCount === 0) {
        try {
          const sample = ctx.getImageData(
            Math.floor(frameWidth / 4), Math.floor(frameHeight / 4),
            Math.min(32, frameWidth), Math.min(32, frameHeight)
          );
          let nonZero = 0;
          for (let p = 0; p < sample.data.length; p += 4) {
            if (sample.data[p] > 0 || sample.data[p + 1] > 0 || sample.data[p + 2] > 0) {
              nonZero++;
              if (nonZero >= 3) break;
            }
          }
          if (nonZero < 3) {
            throw new Error('BLANK_FRAMES: Video frames are blank (canvas cannot render this codec)');
          }
        } catch (e) {
          throw new Error(`Canvas tainted by video codec (${e.message}). Try converting the video to H.264 MP4.`);
        }
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
 * WebCodecs-based frame extractor.
 *
 * Decodes video frames directly via the browser's hardware VideoDecoder,
 * completely bypassing the <video> element and canvas.drawImage() pipeline.
 * This eliminates HEVC canvas taint on iOS Safari — the root cause of
 * all-black frames when drawing HEVC video to canvas.
 *
 * Pipeline: File → web-demuxer (WASM) → VideoDecoder (hardware) → VideoFrame → canvas
 *
 * Requires: Safari 16.4+ or Chrome 94+ (VideoDecoder API)
 * WASM: web-demuxer-mini.wasm (~500KB, supports MOV/MP4/MKV/WebM)
 */
async function extractFramesWebCodecs(file, targetFps, maxFrames, maxWidth, onFrame, onProgress, options = {}) {
  const { signal, startFrame = 0 } = options;
  const { WebDemuxer } = await import('web-demuxer');

  // Use local WASM (copied to public/), CDN fallback
  let demuxer;
  try {
    demuxer = new WebDemuxer({ wasmFilePath: 'web-demuxer.wasm' });
  } catch {
    demuxer = new WebDemuxer({
      wasmFilePath: 'https://cdn.jsdelivr.net/npm/web-demuxer@4.0.0/dist/wasm-files/web-demuxer-mini.wasm',
    });
  }

  try {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    await demuxer.load(file);
    const mediaInfo = await demuxer.getMediaInfo();
    const videoStream = mediaInfo.streams.find(s => s.codec_type_string === 'video');
    if (!videoStream) throw new Error('No video track found in file');

    const duration = mediaInfo.duration;
    const rotation = videoStream.rotation || 0;
    let srcWidth = videoStream.width;
    let srcHeight = videoStream.height;

    // Apply rotation to get display dimensions
    const swapDims = (rotation === 90 || rotation === -90 || rotation === 270 || rotation === -270);
    let displayWidth = swapDims ? srcHeight : srcWidth;
    let displayHeight = swapDims ? srcWidth : srcHeight;

    // Scale to maxWidth
    let frameWidth = displayWidth;
    let frameHeight = displayHeight;
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
    const ctx = canvas.getContext('2d');

    // Get decoder config from demuxer
    const decoderConfig = await demuxer.getDecoderConfig('video');
    const support = await VideoDecoder.isConfigSupported(decoderConfig);
    if (!support.supported) {
      throw new Error(`Codec not supported by WebCodecs: ${decoderConfig.codec}`);
    }

    const interval = 1 / targetFps;
    const totalPossibleFrames = Math.floor(duration * targetFps);
    const frameCount = Math.min(totalPossibleFrames, maxFrames);
    let extractedCount = startFrame;
    let nextCaptureTime = startFrame * interval;

    // Frame queue: decoder output pushes, main loop pulls
    const frameQueue = [];
    let decodeComplete = false;
    let decodeError = null;
    let wakeMain = null;

    const decoder = new VideoDecoder({
      output: (frame) => {
        frameQueue.push(frame);
        if (wakeMain) { wakeMain(); wakeMain = null; }
      },
      error: (e) => {
        decodeError = e;
        if (wakeMain) { wakeMain(); wakeMain = null; }
      },
    });
    decoder.configure(decoderConfig);

    // Feed encoded chunks from demuxer stream (runs concurrently)
    const feedPromise = (async () => {
      const stream = demuxer.read('video', startFrame * interval);
      const reader = stream.getReader();
      try {
        while (true) {
          if (signal?.aborted || extractedCount >= frameCount) break;
          const { done, value } = await reader.read();
          if (done) break;
          decoder.decode(value);
          // Back-pressure: pause feeding if decoder queue is deep
          while (decoder.decodeQueueSize > 8 && !signal?.aborted) {
            await new Promise(r => setTimeout(r, 0));
          }
        }
        await decoder.flush();
      } catch (e) {
        if (!decodeError) decodeError = e;
      } finally {
        decodeComplete = true;
        if (wakeMain) { wakeMain(); wakeMain = null; }
        try { reader.releaseLock(); } catch {}
      }
    })();

    // Process decoded frames in main loop
    const waitForFrame = () => new Promise(r => { wakeMain = r; });

    // Rotation transform helper
    const drawWithRotation = (frame) => {
      if (rotation === 0) {
        ctx.drawImage(frame, 0, 0, frameWidth, frameHeight);
        return;
      }
      ctx.save();
      ctx.translate(frameWidth / 2, frameHeight / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      const dw = swapDims ? frameHeight : frameWidth;
      const dh = swapDims ? frameWidth : frameHeight;
      ctx.drawImage(frame, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    };

    while (extractedCount < frameCount) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (decodeError) throw new Error(`Video decode failed: ${decodeError.message}`);

      // Wait for frames if queue is empty
      while (frameQueue.length === 0 && !decodeComplete && !decodeError) {
        await waitForFrame();
      }
      if (frameQueue.length === 0) break;

      // Drain queued frames
      while (frameQueue.length > 0 && extractedCount < frameCount) {
        const frame = frameQueue.shift();
        const timestamp = frame.timestamp / 1_000_000; // microseconds → seconds

        if (timestamp >= nextCaptureTime - 0.001) {
          drawWithRotation(frame);
          frame.close();
          await onFrame(canvas, extractedCount, timestamp);
          extractedCount++;
          nextCaptureTime = extractedCount * interval;
          if (onProgress) onProgress(Math.round((extractedCount / frameCount) * 100));
        } else {
          frame.close();
        }
      }
    }

    // Discard any remaining queued frames
    while (frameQueue.length > 0) frameQueue.shift().close();
    try { decoder.close(); } catch {}
    await feedPromise;

    return { width: frameWidth, height: frameHeight, fps: targetFps, duration, frameCount: extractedCount };
  } finally {
    demuxer.destroy();
  }
}

/**
 * Check if WebCodecs VideoDecoder is available and likely to work.
 */
function hasWebCodecs() {
  return typeof VideoDecoder !== 'undefined' && typeof VideoDecoder.isConfigSupported === 'function';
}

/**
 * Streaming frame extractor with automatic method selection and fallback chain.
 *
 * Priority:
 * 1. RVFC (fastest, works for H.264)
 * 2. WebCodecs (handles HEVC without canvas taint, Safari 16.4+)
 * 3. Seek-based (universal fallback)
 *
 * When RVFC detects blank frames (HEVC canvas taint), it automatically
 * falls through to WebCodecs which decodes directly via hardware decoder.
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
  let rvfcBlankFrames = false;

  if (useRVFC) {
    try {
      const result = await extractFramesRVFC(file, targetFps, maxFrames, maxWidth, onFrame, onProgress, options);
      if (result.frameCount > 0) {
        return { ...result, method: 'rvfc' };
      }
      console.warn('[frameExtractor] RVFC produced 0 frames, trying WebCodecs');
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      if (err.message?.includes('BLANK_FRAMES')) {
        rvfcBlankFrames = true;
        console.warn('[frameExtractor] HEVC canvas taint detected, falling back to WebCodecs');
      } else {
        console.warn('[frameExtractor] RVFC failed, trying WebCodecs:', err.message);
      }
    }
  }

  // WebCodecs path: bypasses <video> element entirely, no canvas taint
  if (hasWebCodecs()) {
    try {
      const result = await extractFramesWebCodecs(file, targetFps, maxFrames, maxWidth, onFrame, onProgress, options);
      if (result.frameCount > 0) {
        return { ...result, method: 'webcodecs' };
      }
      console.warn('[frameExtractor] WebCodecs produced 0 frames, trying seek');
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.warn('[frameExtractor] WebCodecs failed, trying seek:', err.message);
    }
  } else if (rvfcBlankFrames) {
    // WebCodecs unavailable and RVFC gave blank frames — no recovery possible.
    // Give actionable error instead of processing hundreds of blank frames via seek.
    throw new Error(
      'This video uses a codec that cannot be processed on this device. ' +
      'To fix: open iPhone Settings → Camera → Formats → select "Most Compatible", then re-record.'
    );
  }

  const result = await extractFramesSeek(file, targetFps, maxFrames, maxWidth, onFrame, onProgress, options);
  return { ...result, method: 'seek' };
}
