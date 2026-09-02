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

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

let ffmpegInstance = null;
let ffmpegLoading = false;
let ffmpegLoadPromise = null;

/**
 * Lazy-load ffmpeg.wasm (single-threaded core, no SharedArrayBuffer needed).
 * Downloads ~31MB WASM from CDN on first use, cached by browser thereafter.
 */
export async function loadFFmpeg(onProgress) {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoading = true;
  ffmpegLoadPromise = (async () => {
    const ffmpeg = new FFmpeg();

    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => {
        onProgress(Math.round(progress * 100));
      });
    }

    // Load single-threaded core from CDN (works without SharedArrayBuffer)
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
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
  await ffmpeg.writeFile(inputName, await fetchFile(file));

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


  // Now extract all frames at target FPS
  // Compute how many frames we'll get. We need the duration.
  // Use ffmpeg to extract frames as individual BMP files for reliability
  // (raw RGBA concatenation is fragile if dimensions are wrong)
  const outputPattern = 'frame_%05d.bmp';

  // Calculate FPS to not exceed maxFrames
  // We don't know duration yet, so extract with target FPS and cap
  await ffmpeg.exec([
    '-i', inputName,
    '-vf', `fps=${targetFps},scale=${frameWidth}:${frameHeight}`,
    '-frames:v', String(maxFrames),
    '-f', 'image2',
    outputPattern,
  ]);

  // Read all extracted frame files
  const frames = [];
  for (let i = 1; i <= maxFrames; i++) {
    const fileName = `frame_${String(i).padStart(5, '0')}.bmp`;
    let data;
    try {
      data = await ffmpeg.readFile(fileName);
    } catch {
      break; // No more frames
    }

    // Parse BMP to get raw RGBA pixel data
    const imageData = parseBMP(data, frameWidth, frameHeight);
    if (imageData) {
      frames.push(imageData);
    }

    // Clean up the file from virtual FS
    try { await ffmpeg.deleteFile(fileName); } catch {}

    if (onProgress) {
      onProgress(Math.round((i / maxFrames) * 100));
    }
  }

  // Clean up input file
  try { await ffmpeg.deleteFile(inputName); } catch {}
  try { await ffmpeg.deleteFile('probe.raw'); } catch {}
  try { await ffmpeg.deleteFile('probe2.raw'); } catch {}

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
