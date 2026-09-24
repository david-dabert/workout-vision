/**
 * Decode harness — one extraction path for the app and every test.
 *
 * Loads a video file, decodes sequentially via extractFramesStreaming
 * (WebCodecs where available, otherwise rVFC), runs MediaPipe pose
 * detection on each frame, and outputs timestamped landmarks.
 *
 * Served by Vite dev server so it uses the exact same modules as the app.
 */

import { extractFramesStreaming } from '../../src/lib/frameExtractor.js';
import { getImageLandmarker, detectPoseImage, disposeAllLandmarkers, selectSubjectPose } from '../../src/lib/poseAnalysis.js';

const TARGET_FPS = 15;
const MAX_WIDTH = 640;
const MAX_FRAMES = 9999; // no artificial limit; duration is the limit

const log = document.getElementById('log');
function appendLog(msg) {
  log.textContent += '\n' + msg;
  console.log('[harness] ' + msg);
}

/**
 * Fetch a clip from the dev server and wrap it as a File.
 */
async function fetchClipAsFile(clipPath) {
  appendLog(`Fetching ${clipPath}…`);
  const resp = await fetch(clipPath);
  if (!resp.ok) throw new Error(`Fetch failed: ${resp.status} ${resp.statusText}`);
  const blob = await resp.blob();
  const fileName = clipPath.split('/').pop();
  appendLog(`Fetched ${fileName} (${(blob.size / 1e6).toFixed(1)} MB)`);
  return new File([blob], fileName, { type: blob.type || 'video/quicktime' });
}

/**
 * Run extraction + inference on a File object.
 * Returns { metadata, imageLandmarks, worldLandmarks, timestamps, midFrameDataURL }.
 */
async function processFile(file) {
  appendLog(`Processing: ${file.name} (${(file.size / 1e6).toFixed(1)} MB)`);

  // Load MediaPipe model (IMAGE mode, CPU delegate for determinism)
  appendLog('Loading MediaPipe model…');
  const modelT0 = performance.now();
  disposeAllLandmarkers();
  const landmarker = await getImageLandmarker();
  if (!landmarker) throw new Error('Model failed to load');
  const modelLoadTime = ((performance.now() - modelT0) / 1000).toFixed(2);
  appendLog(`Model ready (${modelLoadTime}s).`);

  const imageLandmarks = [];   // per-sample: array of 33 landmarks (normalised) or null
  const worldLandmarksArr = []; // per-sample: array of 33 world landmarks (metres) or null
  const timestamps = [];
  let midCanvas = null;
  let lockedSubjectIdx = null;
  let sampleCount = 0;
  let totalSamples = 0; // estimated, updated after extraction

  // t0 starts AFTER model load — measures decode+inference only
  const t0 = performance.now();

  const streamResult = await extractFramesStreaming(
    file,
    TARGET_FPS,
    MAX_FRAMES,
    MAX_WIDTH,
    async (canvas, frameIndex, timestamp) => {
      // Run MediaPipe detection
      const deterministicTs = frameIndex * (1000 / TARGET_FPS);
      const result = detectPoseImage(landmarker, canvas, deterministicTs);

      let lm = null;
      let wlm = null;
      if (result?.landmarks?.length) {
        if (result.landmarks.length === 1) {
          lm = result.landmarks[0];
          wlm = result.worldLandmarks?.[0] || null;
        } else {
          if (lockedSubjectIdx === null) {
            lm = selectSubjectPose(result.landmarks);
            lockedSubjectIdx = result.landmarks.indexOf(lm);
          } else {
            lm = result.landmarks[lockedSubjectIdx] || selectSubjectPose(result.landmarks);
          }
          wlm = result.worldLandmarks?.[lockedSubjectIdx] || null;
        }
      }

      imageLandmarks.push(lm);
      worldLandmarksArr.push(wlm);
      timestamps.push(timestamp);
      sampleCount++;

      // Capture mid-frame canvas snapshot (we'll determine the exact middle after)
      // For now, keep overwriting until we pass the middle
      // We'll capture it properly after we know totalSamples
    },
    (pct) => {
      if (pct % 10 === 0) appendLog(`  Extraction: ${pct}%`);
    },
    { deterministic: true },
  );

  const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
  totalSamples = imageLandmarks.length;
  appendLog(`Extraction done: ${totalSamples} samples in ${elapsed}s (method: ${streamResult.method})`);

  // Capture middle frame by seeking the video to the middle timestamp
  const midFrameIndex = Math.floor(totalSamples / 2);
  const midTimestamp = midFrameIndex / TARGET_FPS;
  let midFrameDataURL = null;
  let midW = 0, midH = 0;

  const tempVideo = document.createElement('video');
  tempVideo.muted = true;
  tempVideo.playsInline = true;
  tempVideo.preload = 'auto';
  const url = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Video load timeout')), 15000);
      tempVideo.onloadeddata = () => { clearTimeout(timeout); resolve(); };
      tempVideo.onerror = () => { clearTimeout(timeout); reject(new Error('Video load error')); };
      tempVideo.src = url;
      tempVideo.load();
    });

    tempVideo.currentTime = midTimestamp;
    await new Promise((resolve) => {
      tempVideo.onseeked = resolve;
      setTimeout(resolve, 5000);
    });

    // videoWidth/videoHeight are post-rotation (browser applies rotation metadata)
    const vw = tempVideo.videoWidth;
    const vh = tempVideo.videoHeight;
    let fw = vw, fh = vh;
    const longSide = Math.max(fw, fh);
    if (longSide > MAX_WIDTH) {
      const scale = MAX_WIDTH / longSide;
      fw = Math.round(fw * scale);
      fh = Math.round(fh * scale);
      fw -= fw % 2;
      fh -= fh % 2;
    }
    midCanvas = document.createElement('canvas');
    midCanvas.width = fw;
    midCanvas.height = fh;
    midCanvas.getContext('2d').drawImage(tempVideo, 0, 0, fw, fh);
    midFrameDataURL = midCanvas.toDataURL('image/png');
    midW = fw;
    midH = fh;
    appendLog(`Middle frame: index ${midFrameIndex}, ${fw}x${fh}`);
  } catch (e) {
    appendLog(`Middle frame capture failed: ${e.message}`);
  } finally {
    URL.revokeObjectURL(url);
    tempVideo.src = '';
  }

  const metadata = {
    fileName: file.name,
    fileSize: file.size,
    extractionMethod: streamResult.method,
    extractedWidth: streamResult.width,
    extractedHeight: streamResult.height,
    duration: streamResult.duration,
    sampleCount: totalSamples,
    targetFps: TARGET_FPS,
    maxWidth: MAX_WIDTH,
    elapsedSeconds: parseFloat(elapsed),
    modelLoadSeconds: parseFloat(modelLoadTime),
    midFrameIndex,
    midFrameWidth: midW,
    midFrameHeight: midH,
  };

  disposeAllLandmarkers();

  return { metadata, imageLandmarks, worldLandmarks: worldLandmarksArr, timestamps, midFrameDataURL };
}

// Expose to Playwright
window._fetchAndProcess = async (clipUrl) => {
  const file = await fetchClipAsFile(clipUrl);
  return processFile(file);
};
window._harnessReady = true;
appendLog('Harness ready. Waiting for file…');
