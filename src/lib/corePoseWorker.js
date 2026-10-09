// Use the harness's exact CPU/IMAGE inference and image filtering in a worker.
import { getImageLandmarker, getVideoModeLandmarker, detectPoseImage, resetKalmanFilters } from './poseAnalysis';
// TFLite emits this informational startup line on stderr. Keep it visible as info.
const originalError = console.error.bind(console);
console.error = (...args) => {
  if (args.length === 1 && args[0] === 'INFO: Created TensorFlow Lite XNNPACK delegate for CPU.') console.info(...args);
  else originalError(...args);
};
let model;
let canvas;
self.onmessage = async ({ data }) => {
  try {
    // The analysis is over: the model is closed before the page terminates this worker (coreAnalysis.js, endWorker).
    if (data.type === 'close') {
      try { model?.close(); } catch {}
      model = null; canvas = null;
      self.postMessage({ id: data.id });
      return;
    }
    if (data.type === 'init') {
      // videoMode: the app's video analysis (coreAnalysis.js, since 9 October); the collector and the live counter send
      // no videoMode and keep IMAGE mode.
      // benchModel: another pose model's bytes, from the check page only (?posemodel=), to measure it (poseAnalysis.js
      // reads __WV_BENCH_POSE_MODEL__); the app never sends it.
      if (data.benchModel instanceof ArrayBuffer) globalThis.__WV_BENCH_POSE_MODEL__ = data.benchModel;
      model = data.videoMode ? await getVideoModeLandmarker() : await getImageLandmarker();
      if (!model) throw new Error('Pose model could not load');
      self.postMessage({ id: data.id });
      return;
    }
    const { width, height, pixels, timestamp } = data;
    // Sample 0 starts a decoding pass. When a pass fails part-way and the fallback starts again,
    // the caller drops the earlier samples, so the image smoothing must forget them too: otherwise the
    // new pass's first skeletons (Watch, Replay, contributions) are pulled toward the abandoned pass's
    // last pose. World landmarks, which the count reads, get no filter of the app's (third audit, C48); in VIDEO mode
    // MediaPipe follows the body from the sample before (poseAnalysis.js).
    if (timestamp === 0) resetKalmanFilters();
    if (!canvas || canvas.width !== width || canvas.height !== height) canvas = new OffscreenCanvas(width, height);
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
    // A detection error is posted as an error, not as an empty frame (third audit, C07).
    const result = detectPoseImage(model, canvas, timestamp, { rethrow: true, backfill: true });
    // source 'crop': the pose was found on the second look around the last pose (poseCrop.js), not on the whole frame.
    // back: earlier samples (by the timestamp they were sent with) that had no pose and now have one, read on a crop
    // around this pose (the backward pass, poseCrop.js BACK_PASS); the caller puts them in place.
    const back = (result?.backfill || []).map(b => ({ timestamp: b.timestamp, image: b.landmarks[0] || null, world: b.worldLandmarks[0] || null, source: 'back' }));
    self.postMessage({ id: data.id, image: result?.landmarks?.[0] || null, world: result?.worldLandmarks?.[0] || null, source: result?.landmarks?.[0] ? (result.source ?? 'full') : null, back });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
