// Use the harness's exact CPU/IMAGE inference and image filtering in a worker.
import { getImageLandmarker, getImageLandmarkerOn, getVideoModeLandmarker, detectPoseImage, resetKalmanFilters, landmarkerDelegate } from './poseAnalysis';

// The GPU this worker would draw with, as WebGL names it (WEBGL_debug_renderer_info), or null: printed by the check page
// beside a measurement, so a software renderer is never read as a phone's GPU (pillar 4, 9 October 2026).
function rendererName() {
  try {
    const gl = new OffscreenCanvas(1, 1).getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return gl ? String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : null;
  } catch { return null; }
}
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
      // videoMode: VIDEO mode, sent only by the check page's ?posemode=video, to measure (coreAnalysis.js: withdrawn
      // from the app on 9 October 2026); the app, the collector and the live counter read in IMAGE mode.
      // benchModel: another pose model's bytes, from the check page only (?posemodel=), to measure it (poseAnalysis.js
      // reads __WV_BENCH_POSE_MODEL__); the app never sends it.
      if (data.benchModel instanceof ArrayBuffer) globalThis.__WV_BENCH_POSE_MODEL__ = data.benchModel;
      // delegate: 'GPU' from the check page only (?delegate=gpu, pillar 4: measured, never the app's); IMAGE mode.
      model = data.videoMode ? await getVideoModeLandmarker() : data.delegate === 'GPU' ? await getImageLandmarkerOn('GPU') : await getImageLandmarker();
      if (!model) throw new Error('Pose model could not load');
      const delegate = landmarkerDelegate?.() ?? null, renderer = data.delegate === 'GPU' ? rendererName() : null;
      self.postMessage({ id: data.id, ...(delegate ? { delegate } : {}), ...(renderer ? { renderer } : {}) });
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
    // ms: the model's time on this sample, crop retry included (the check page's speed line; pillar 4). Not read by
    // any count.
    const began = performance.now();
    const result = detectPoseImage(model, canvas, timestamp, { rethrow: true, backfill: true });
    const ms = performance.now() - began;
    // source 'crop': the pose was found on the second look around the last pose (poseCrop.js), not on the whole frame.
    // back: earlier samples (by the timestamp they were sent with) that had no pose and now have one, read on a crop
    // around this pose (the backward pass, poseCrop.js BACK_PASS); the caller puts them in place.
    const back = (result?.backfill || []).map(b => ({ timestamp: b.timestamp, image: b.landmarks[0] || null, world: b.worldLandmarks[0] || null, source: 'back' }));
    self.postMessage({ id: data.id, image: result?.landmarks?.[0] || null, world: result?.worldLandmarks?.[0] || null, source: result?.landmarks?.[0] ? (result.source ?? 'full') : null, back, ms });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
