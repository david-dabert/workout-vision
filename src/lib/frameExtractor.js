/**
 * Frame extraction and hashing utilities for video analysis.
 *
 * Two extraction methods (tried in order):
 * 1. extractFramesWebCodecs — WebCodecs VideoDecoder with web-demuxer.
 *    Decodes video frames directly via hardware decoder, bypassing <video> + canvas.
 *    Sequential, deterministic, handles rotation metadata. Safari 16.4+, Chrome 94+.
 * 2. extractFramesRVFC — requestVideoFrameCallback with accelerated playback (fallback).
 *    Plays video at 2-4x speed and captures frames via rVFC. Chrome 83+, Safari 15.4+.
 *
 * No seek path. If both fail, extraction refuses with a reason.
 * All methods stream one frame at a time via callback, keeping memory constant.
 */

const IS_IOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

/**
 * Hash a file for cache keying. Returns first 16 hex chars of SHA-256.
 *
 * On iOS, the photo library transcodes video files (HEVC → H.264) on every
 * file pick, producing slightly different binary content each time. A pure
 * content hash therefore misses the cache on every run, defeating determinism.
 *
 * Strategy: hash file metadata (name + lastModified + size rounded to nearest
 * MB) on iOS. On other platforms, hash the first 2MB of binary content.
 * The metadata hash has a negligible collision risk for a personal video library.
 */
export async function hashFile(file) {
  // Metadata-based hash on all platforms: no file reads, instant.
  // Round size to nearest MB to absorb iOS photo library transcoding variance (~0.1%).
  const sizeMB = Math.round(file.size / (1024 * 1024));
  const metaString = `${file.name}|${file.lastModified}|${sizeMB}MB`;
  const buffer = new TextEncoder().encode(metaString);
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

    // Scale by long side, not just width
    let frameWidth = nativeWidth;
    let frameHeight = nativeHeight;
    const longSide = Math.max(frameWidth, frameHeight);
    if (longSide > maxWidth) {
      const scale = maxWidth / longSide;
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

  const wasmUrl = new URL('web-demuxer.wasm', new URL(import.meta.env.BASE_URL || '/', location.origin)).href;
  const demuxer = new WebDemuxer({ wasmFilePath: wasmUrl });

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
    const swapDims = (Math.abs(rotation) === 90 || Math.abs(rotation) === 270);
    let displayWidth = swapDims ? srcHeight : srcWidth;
    let displayHeight = swapDims ? srcWidth : srcHeight;

    // Scale by long side, not just width
    let frameWidth = displayWidth;
    let frameHeight = displayHeight;
    const longSide = Math.max(frameWidth, frameHeight);
    if (longSide > maxWidth) {
      const scale = maxWidth / longSide;
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
    // Bounded: close frames that will never be sampled, cap queue at 2
    const frameQueue = [];
    let decodeComplete = false;
    let decodeError = null;
    let wakeMain = null;
    let peakOpenFrames = 0;

    const decoder = new VideoDecoder({
      output: (frame) => {
        const timestamp = frame.timestamp / 1_000_000;
        // Close frames that arrive before the next capture time (they won't be sampled)
        if (timestamp < nextCaptureTime - 0.001 && frameQueue.length > 0) {
          frame.close();
          return;
        }
        frameQueue.push(frame);
        if (frameQueue.length > peakOpenFrames) peakOpenFrames = frameQueue.length;
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
          // Back-pressure: pause feeding if frame queue or decoder queue is deep
          while ((frameQueue.length > 2 || decoder.decodeQueueSize > 8) && !signal?.aborted) {
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

    // Drawing helper with runtime rotation detection.
    // Chromium's drawImage auto-applies VideoFrame rotation; WebKit does not.
    // We detect on the first frame: draw at coded aspect, check if the result
    // matches display aspect ratio (auto-rotated) or coded aspect (needs manual).
    let needsManualRotation = null;
    let rotationDecision = '';

    function probeAutoRotation(frame) {
      if (!swapDims) return false;
      // The VideoFrame carries its own rotation metadata when the browser's
      // VideoDecoder processes the container's rotation. Chrome sets
      // frame.rotation (e.g. 90) and swaps display dimensions to portrait;
      // its drawImage auto-applies the rotation. WebKit ignores container
      // rotation: frame.rotation is absent, display dimensions stay at
      // coded (landscape), and drawImage draws coded pixels as-is.
      //
      // Decision: if frame.rotation is a non-zero number, the decoder
      // embedded the rotation and drawImage will handle it. Otherwise,
      // we rotate by hand using the container rotation from web-demuxer.
      const frameRotation = frame.rotation;
      const frameCarriesRotation = (typeof frameRotation === 'number' && frameRotation !== 0);
      rotationDecision = frameCarriesRotation
        ? `frame carries rotation=${frameRotation}, drawImage handles it`
        : `frame has no rotation (rotation=${frameRotation}), manual rotation=${rotation}° from container`;
      console.log(`[frameExtractor] Rotation decision: ${rotationDecision}`);
      return !frameCarriesRotation;
    }

    const drawFrame = (frame) => {
      if (rotation === 0) {
        ctx.drawImage(frame, 0, 0, frameWidth, frameHeight);
        return;
      }
      if (needsManualRotation === null) {
        needsManualRotation = probeAutoRotation(frame);
        console.log(`[frameExtractor] Rotation ${rotation}°, manual rotation: ${needsManualRotation}`);
      }
      if (!needsManualRotation) {
        ctx.drawImage(frame, 0, 0, frameWidth, frameHeight);
      } else {
        ctx.save();
        ctx.translate(frameWidth / 2, frameHeight / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        const dw = swapDims ? frameHeight : frameWidth;
        const dh = swapDims ? frameWidth : frameHeight;
        ctx.drawImage(frame, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
      }
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
          drawFrame(frame);
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

    return { width: frameWidth, height: frameHeight, fps: targetFps, duration, frameCount: extractedCount, peakOpenFrames, rotationDecision };
  } finally {
    demuxer.destroy();
  }
}

/**
 * Inspect a video file to determine its codec without decoding.
 * Reads container metadata via web-demuxer (fast, no frame decode).
 * Returns null if inspection fails (non-video file, unsupported container).
 */
async function inspectVideo(file) {
  try {
    const { WebDemuxer } = await import('web-demuxer');
    const wasmUrl = new URL('web-demuxer.wasm', new URL(import.meta.env.BASE_URL || '/', location.origin)).href;
    const demuxer = new WebDemuxer({ wasmFilePath: wasmUrl });
    try {
      await demuxer.load(file);
      const info = await demuxer.getMediaInfo();
      const video = info.streams.find(s => s.codec_type_string === 'video');
      if (!video) return null;
      return {
        codec: video.codec_name,
        codecString: video.codec_string,
        width: video.width,
        height: video.height,
        rotation: video.rotation || 0,
        duration: info.duration,
      };
    } finally {
      demuxer.destroy();
    }
  } catch (e) {
    console.error('[frameExtractor] inspectVideo failed:', e?.message || String(e));
    return null;
  }
}

/**
 * Is this codec HEVC? (multiple naming conventions)
 */
function isHEVC(codec) {
  if (!codec) return false;
  const c = codec.toLowerCase();
  return c === 'hevc' || c === 'h265' || c === 'hev1' || c === 'hvc1' || c.startsWith('hev1.') || c.startsWith('hvc1.');
}

/**
 * Streaming frame extractor — inspect first, then use the right decoder.
 *
 * Approach: read the file's codec from container metadata, then route
 * to the correct extraction method. No cascading try/catch fallbacks.
 *
 * - HEVC (iPhone default) → WebCodecs VideoDecoder (hardware-accelerated,
 *   bypasses <video> element, no canvas taint)
 * - H.264 / other → RVFC playback (fastest) or seek (legacy fallback)
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
 * @param {boolean} [options.deterministic] - Hint for logging; does not change decoder selection
 * @returns {Promise<{width, height, fps, duration, frameCount, method: string, peakOpenFrames?: number}>}
 */
export async function extractFramesStreaming(file, targetFps, maxFrames, maxWidth, onFrame, onProgress, options = {}) {
  const errors = [];

  // Step 1: Try WebCodecs (sequential, deterministic, handles rotation)
  if (typeof VideoDecoder !== 'undefined') {
    try {
      const result = await extractFramesWebCodecs(file, targetFps, maxFrames, maxWidth, onFrame, onProgress, options);
      return { ...result, method: 'webcodecs' };
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.error('[frameExtractor] WebCodecs failed:', err?.message || String(err));
      errors.push(`WebCodecs: ${err?.message || String(err)}`);
    }
  } else {
    errors.push('WebCodecs: VideoDecoder API not available');
  }

  // Step 2: Try RVFC (playback-based, works on older browsers)
  if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
    try {
      const result = await extractFramesRVFC(file, targetFps, maxFrames, maxWidth, onFrame, onProgress, options);
      return { ...result, method: 'rvfc' };
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      console.error('[frameExtractor] RVFC failed:', err?.message || String(err));
      errors.push(`RVFC: ${err?.message || String(err)}`);
    }
  } else {
    errors.push('RVFC: requestVideoFrameCallback not available');
  }

  // No fallback to seek. Fail with reasons.
  throw new Error(
    `Video extraction failed. No decoder could process this file.\n` +
    errors.map(e => `  - ${e}`).join('\n')
  );
}
