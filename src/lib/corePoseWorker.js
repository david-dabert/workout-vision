// Use the harness's exact CPU/IMAGE inference and image filtering in a worker.
import { getImageLandmarker, detectPoseImage, resetKalmanFilters } from './poseAnalysis';
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
    if (data.type === 'init') {
      model = await getImageLandmarker();
      if (!model) throw new Error('Pose model could not load');
      self.postMessage({ id: data.id });
      return;
    }
    const { width, height, pixels, timestamp } = data;
    // Sample 0 starts a decoding pass. When a pass fails part-way and the fallback starts again,
    // the caller drops the earlier samples, so the image smoothing must forget them too: otherwise the
    // new pass's first skeletons (Watch, Replay, contributions) are pulled toward the abandoned pass's
    // last pose. World landmarks, which the count reads, are not smoothed (third audit, C48).
    if (timestamp === 0) resetKalmanFilters();
    if (!canvas || canvas.width !== width || canvas.height !== height) canvas = new OffscreenCanvas(width, height);
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
    // A detection error is posted as an error, not as an empty frame (third audit, C07).
    const result = detectPoseImage(model, canvas, timestamp, { rethrow: true });
    // source 'crop': the pose was found on the second look around the last pose (poseCrop.js), not on the whole frame.
    self.postMessage({ id: data.id, image: result?.landmarks?.[0] || null, world: result?.worldLandmarks?.[0] || null, source: result?.landmarks?.[0] ? (result.source ?? 'full') : null });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
