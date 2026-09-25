// Use the harness's exact CPU/IMAGE inference and image filtering in a worker.
import { getImageLandmarker, detectPoseImage } from './poseAnalysis';
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
    if (!canvas || canvas.width !== width || canvas.height !== height) canvas = new OffscreenCanvas(width, height);
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
    const result = detectPoseImage(model, canvas, timestamp);
    self.postMessage({ id: data.id, image: result?.landmarks?.[0] || null, world: result?.worldLandmarks?.[0] || null });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
