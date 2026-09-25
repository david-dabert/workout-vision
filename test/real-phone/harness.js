/**
 * Decode harness — one extraction path for the app and every test.
 *
 * Loads a video file, decodes via extractFramesStreaming
 * (WebCodecs first, RVFC fallback), runs MediaPipe pose
 * detection on each frame, and outputs timestamped landmarks.
 *
 * Uses the same shared config (TARGET_FPS, MAX_LONG_SIDE, MAX_FRAMES)
 * as the app. No harness-specific values.
 *
 * Served by Vite dev server so it uses the exact same modules as the app.
 */

import { extractFramesStreaming } from '../../src/lib/frameExtractor.js';
import { TARGET_FPS, MAX_LONG_SIDE, MAX_FRAMES } from '../../src/lib/extractionConfig.js';
import { getImageLandmarker, detectPoseImage, disposeAllLandmarkers, selectSubjectPose } from '../../src/lib/poseAnalysis.js';

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
  let lockedSubjectIdx = null;
  let sampleCount = 0;
  let midFrameDataURL = null;
  let midFrameIndex = -1;
  let midW = 0, midH = 0;

  // t0 includes model load — David's correction: time to result includes model loading
  const t0 = performance.now();

  const streamResult = await extractFramesStreaming(
    file,
    TARGET_FPS,
    MAX_FRAMES,
    MAX_LONG_SIDE,
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
    },
    (pct) => {
      if (pct % 10 === 0) appendLog(`  Extraction: ${pct}%`);
    },
    { deterministic: true },
  );

  const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
  const totalSamples = imageLandmarks.length;
  appendLog(`Extraction done: ${totalSamples} samples in ${elapsed}s (method: ${streamResult.method})`);

  // Capture middle frame by re-running extraction for just that one frame,
  // so the saved PNG comes from the same canvas the pose model sees.
  midFrameIndex = Math.floor(totalSamples / 2);
  const midTimestamp = midFrameIndex / TARGET_FPS;
  try {
    await extractFramesStreaming(
      file,
      TARGET_FPS,
      midFrameIndex + 1, // extract up to and including the mid frame
      MAX_LONG_SIDE,
      async (canvas, frameIndex) => {
        if (frameIndex === midFrameIndex) {
          midFrameDataURL = canvas.toDataURL('image/png');
          midW = canvas.width;
          midH = canvas.height;
          appendLog(`Middle frame: index ${midFrameIndex}, ${midW}x${midH} (from extraction canvas)`);
        }
      },
      null,
      { deterministic: true },
    );
  } catch (e) {
    appendLog(`Middle frame re-extraction failed: ${e.message}`);
  }

  // Pose coverage: share of samples with at least one landmark detected
  const detectedCount = imageLandmarks.filter(lm => lm !== null).length;
  const poseCoverage = totalSamples > 0 ? detectedCount / totalSamples : 0;

  // Nose above hips: for upright exercises, nose.y < hip.y in normalised coords
  // (y increases downward in MediaPipe normalised landmarks)
  // Nose = landmark 0, Left hip = 23, Right hip = 24
  let noseAboveHipsCount = 0;
  for (const lm of imageLandmarks) {
    if (!lm) continue;
    const nose = lm[0];
    const lHip = lm[23];
    const rHip = lm[24];
    if (nose && lHip && rHip) {
      const hipY = (lHip.y + rHip.y) / 2;
      if (nose.y < hipY) noseAboveHipsCount++;
    }
  }
  const noseAboveHips = detectedCount > 0 ? noseAboveHipsCount / detectedCount : 0;

  const metadata = {
    fileName: file.name,
    fileSize: file.size,
    extractionMethod: streamResult.method,
    extractedWidth: streamResult.width,
    extractedHeight: streamResult.height,
    duration: streamResult.duration,
    sampleCount: totalSamples,
    targetFps: TARGET_FPS,
    maxLongSide: MAX_LONG_SIDE,
    elapsedSeconds: parseFloat(elapsed),
    modelLoadSeconds: parseFloat(modelLoadTime),
    midFrameIndex,
    midFrameWidth: midW,
    midFrameHeight: midH,
    peakOpenFrames: streamResult.peakOpenFrames || 0,
    rotationDecision: streamResult.rotationDecision || 'none',
    poseCoverage,
    noseAboveHips,
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
