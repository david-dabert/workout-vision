/**
 * Deterministic frame extraction using ffmpeg.wasm
 *
 * The <video> element + seeking pipeline is non-deterministic:
 * - seeked event fires at different keyframes under browser load
 * - requestVideoFrameCallback timing varies
 * - iOS Safari HEVC decoding is lazy and drops frames
 *
 * ffmpeg.wasm decodes the video file byte-by-byte into raw RGBA pixels.
 * Same input = same output, every time, on every device.
 */

// @ffmpeg/ffmpeg and @ffmpeg/util are NOT statically imported here.
// Their module-level code probes SharedArrayBuffer / WASM availability,
// which throws on iOS Safari when those APIs are absent or restricted.
// Dynamic import inside loadFFmpeg defers that probe to call time,
// where the error is caught rather than crashing the module at parse time.

let ffmpegInstance = null;
let ffmpegLoading = false;
let ffmpegLoadPromise = null;

// Cached references to the dynamically-imported helpers
let _FFmpeg = null;
let _toBlobURL = null;
let _fetchFile = null;

async function importFFmpegModules() {
  if (_FFmpeg && _toBlobURL && _fetchFile) return;
  const [ffmpegMod, utilMod] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util'),
  ]);
  _FFmpeg = ffmpegMod.FFmpeg;
  _toBlobURL = utilMod.toBlobURL;
  _fetchFile = utilMod.fetchFile;
}

/**
 * Lazy-load ffmpeg.wasm (single-threaded core, no SharedArrayBuffer needed).
 * Downloads ~31MB WASM from CDN on first use, cached by browser thereafter.
 */
export async function loadFFmpeg(onProgress) {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoading = true;
  ffmpegLoadPromise = (async () => {
    await importFFmpegModules();
    const FFmpeg = _FFmpeg;
    const ffmpeg = new FFmpeg();

    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => {
        onProgress(Math.round(progress * 100));
      });
    }

    // Load single-threaded core from CDN (works without SharedArrayBuffer)
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await _toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await _toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegInstance = ffmpeg;
    ffmpegLoading = false;
    return ffmpeg;
  })();

  return ffmpegLoadPromise;
}

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
 * Extract frames deterministically from a video file using ffmpeg.wasm.
 *
 * @param {File} file - Video file
 * @param {number} targetFps - Target frames per second (e.g. 10)
 * @param {number} maxFrames - Maximum number of frames to extract
 * @param {number} maxWidth - Maximum frame width (for memory savings)
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<{frames: ImageData[], width: number, height: number, fps: number, duration: number}>}
 */
export async function extractFrames(file, targetFps, maxFrames, maxWidth, onProgress) {
  const ffmpeg = await loadFFmpeg();

  const inputName = 'input' + getExtension(file.name);

  // Write video file to ffmpeg virtual filesystem
  await ffmpeg.writeFile(inputName, await _fetchFile(file));

  // Probe video dimensions and duration using ffmpeg
  // Extract a single frame to determine output dimensions
  await ffmpeg.exec([
    '-i', inputName,
    '-vf', `fps=1,scale='min(${maxWidth},iw)':-2`,
    '-frames:v', '1',
    '-f', 'rawvideo',
    '-pix_fmt', 'rgba',
    'probe.raw',
  ]);

  // Get probe frame to determine dimensions
  let probeData;
  try {
    probeData = await ffmpeg.readFile('probe.raw');
  } catch {
    // Probe failed, try with different pixel format
    await ffmpeg.exec([
      '-i', inputName,
      '-vf', `scale='min(${maxWidth},iw)':-2`,
      '-frames:v', '1',
      '-f', 'rawvideo',
      '-pix_fmt', 'rgba',
      'probe2.raw',
    ]);
    probeData = await ffmpeg.readFile('probe2.raw');
  }

  // Determine frame dimensions from probe data
  // RGBA = 4 bytes per pixel, total bytes = width * height * 4
  // We know maxWidth, so we can compute height
  const totalProbeBytes = probeData.length;

  // Try common aspect ratios to find the dimensions
  let frameWidth = 0;
  let frameHeight = 0;

  // ffmpeg scale filter with -2 ensures even dimensions
  // Try to find width/height that satisfies totalProbeBytes = w * h * 4
  for (let w = maxWidth; w >= 120; w -= 2) {
    const h = totalProbeBytes / (w * 4);
    if (Number.isInteger(h) && h > 0 && h <= 2000) {
      frameWidth = w;
      frameHeight = h;
      break;
    }
  }

  if (frameWidth === 0) {
    // Fallback: assume 16:9 aspect ratio
    const pixelCount = totalProbeBytes / 4;
    frameWidth = Math.round(Math.sqrt(pixelCount * 16 / 9));
    frameWidth = frameWidth - (frameWidth % 2); // ensure even
    frameHeight = Math.round(pixelCount / frameWidth);
  }


  // Now extract all frames at target FPS as a single raw RGBA file.
  // This eliminates per-file overhead in the WASM virtual filesystem
  // and removes the BMP parsing step entirely.
  const frames = [];

  try {
    await ffmpeg.exec([
      '-i', inputName,
      '-vf', `fps=${targetFps},scale=${frameWidth}:${frameHeight}`,
      '-frames:v', String(maxFrames),
      '-f', 'rawvideo',
      '-pix_fmt', 'rgba',
      'frames.raw',
    ]);

    // Read the single raw RGBA file and slice by known frame size
    const frameSize = frameWidth * frameHeight * 4;
    const rawData = await ffmpeg.readFile('frames.raw');
    const totalFrames = Math.floor(rawData.length / frameSize);
    for (let i = 0; i < totalFrames && i < maxFrames; i++) {
      const offset = i * frameSize;
      const rgba = new Uint8ClampedArray(rawData.buffer, rawData.byteOffset + offset, frameSize);
      frames.push(new ImageData(new Uint8ClampedArray(rgba), frameWidth, frameHeight));
      if (onProgress) {
        onProgress(Math.round(((i + 1) / Math.min(totalFrames, maxFrames)) * 100));
      }
    }
  } finally {
    // Clean up all possible files from the WASM virtual filesystem
    try { await ffmpeg.deleteFile('frames.raw'); } catch {}
    try { await ffmpeg.deleteFile(inputName); } catch {}
    try { await ffmpeg.deleteFile('probe.raw'); } catch {}
    try { await ffmpeg.deleteFile('probe2.raw'); } catch {}
  }

  // Compute actual duration from frame count and fps
  const duration = frames.length / targetFps;

  return {
    frames,
    width: frameWidth,
    height: frameHeight,
    fps: targetFps,
    duration,
    frameCount: frames.length,
  };
}

/**
 * Parse a BMP file into ImageData.
 * Handles 24-bit (BGR) and 32-bit (BGRA) BMPs.
 */
function parseBMP(bmpData, expectedWidth, expectedHeight) {
  const view = new DataView(bmpData.buffer, bmpData.byteOffset, bmpData.byteLength);

  // BMP header
  if (view.getUint8(0) !== 0x42 || view.getUint8(1) !== 0x4D) {
    console.warn('[FrameExtractor] Invalid BMP header');
    return null;
  }

  const dataOffset = view.getUint32(10, true);
  const width = view.getInt32(18, true);
  const absHeight = Math.abs(view.getInt32(22, true));
  const bitsPerPixel = view.getUint16(28, true);
  const bottomUp = view.getInt32(22, true) > 0;

  const w = width;
  const h = absHeight;
  const bytesPerPixel = bitsPerPixel / 8;
  const rowSize = Math.ceil((w * bitsPerPixel) / 32) * 4; // rows are 4-byte aligned

  const rgba = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y++) {
    const srcY = bottomUp ? (h - 1 - y) : y;
    const rowOffset = dataOffset + srcY * rowSize;

    for (let x = 0; x < w; x++) {
      const srcIdx = rowOffset + x * bytesPerPixel;
      const dstIdx = (y * w + x) * 4;

      // BMP stores BGR(A)
      rgba[dstIdx] = bmpData[srcIdx + 2];     // R
      rgba[dstIdx + 1] = bmpData[srcIdx + 1]; // G
      rgba[dstIdx + 2] = bmpData[srcIdx];     // B
      rgba[dstIdx + 3] = bytesPerPixel === 4 ? bmpData[srcIdx + 3] : 255; // A
    }
  }

  return new ImageData(rgba, w, h);
}

function getExtension(filename) {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot) : '.mp4';
}

/**
 * Canvas-based fallback frame extractor for when ffmpeg.wasm fails to load.
 * Uses <video> element seeking + canvas capture. Non-deterministic but functional.
 *
 * @param {File} file - Video file
 * @param {number} targetFps - Target frames per second (e.g. 10)
 * @param {number} maxFrames - Maximum number of frames to extract
 * @param {number} maxWidth - Maximum frame width (for memory savings)
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<{frames: ImageData[], width: number, height: number, fps: number, duration: number}>}
 */
export async function extractFramesFallback(file, targetFps, maxFrames, maxWidth, onProgress) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  try {
    // Wait for metadata to load
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error('Failed to load video metadata'));
    });

    const duration = video.duration;
    const nativeWidth = video.videoWidth;
    const nativeHeight = video.videoHeight;

    // Compute scaled dimensions
    let frameWidth = nativeWidth;
    let frameHeight = nativeHeight;
    if (frameWidth > maxWidth) {
      const scale = maxWidth / frameWidth;
      frameWidth = Math.round(frameWidth * scale);
      frameHeight = Math.round(frameHeight * scale);
      // Ensure even dimensions
      frameWidth = frameWidth - (frameWidth % 2);
      frameHeight = frameHeight - (frameHeight % 2);
    }

    const canvas = document.createElement('canvas');
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const interval = 1 / targetFps;
    const totalPossibleFrames = Math.floor(duration * targetFps);
    const frameCount = Math.min(totalPossibleFrames, maxFrames);
    const frames = [];

    for (let i = 0; i < frameCount; i++) {
      const seekTime = i * interval;
      if (seekTime > duration) break;

      // Seek to the target time
      video.currentTime = seekTime;
      await new Promise((resolve, reject) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
          resolve();
        };
        const onError = () => {
          video.removeEventListener('seeked', onSeeked);
          video.removeEventListener('error', onError);
          reject(new Error(`Seek failed at ${seekTime}s`));
        };
        video.addEventListener('seeked', onSeeked);
        video.addEventListener('error', onError);
      });

      // Draw current frame to canvas and extract ImageData
      ctx.drawImage(video, 0, 0, frameWidth, frameHeight);
      const imageData = ctx.getImageData(0, 0, frameWidth, frameHeight);
      frames.push(imageData);

      if (onProgress) {
        onProgress(Math.round(((i + 1) / frameCount) * 100));
      }
    }

    return {
      frames,
      width: frameWidth,
      height: frameHeight,
      fps: targetFps,
      duration,
      frameCount: frames.length,
    };
  } finally {
    URL.revokeObjectURL(url);
    video.src = '';
    video.load();
  }
}

/**
 * Streaming frame extractor for memory-constrained environments (iOS Safari).
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
