import { countReps } from './counting/core';
import { extractFramesStreaming } from './frameExtractor';
import { TARGET_FPS, MAX_LONG_SIDE, MAX_FRAMES } from './extractionConfig';

export const APPROVED_LIFTS = ['bicep_curl', 'lateral_raise', 'lat_pulldown'];

export function summarizeCount(worldLandmarks, timestamps, lift) {
  const core = countReps(worldLandmarks, timestamps, lift);
  // A strict majority of unavailable joint angles is the only counting refusal.
  // Use the core's own raw-angle validity (before outlier removal/bridging).
  const visible = core.angles.filter(angle => angle !== null).length;
  return { ...core, refused: visible < worldLandmarks.length / 2 || worldLandmarks.length === 0 };
}

export async function analyzeCoreVideo(file, lift, { signal, onProgress = () => {}, onPhase = () => {} } = {}) {
  if (!APPROVED_LIFTS.includes(lift)) throw new Error('Choose an approved lift');
  const worker = new Worker(new URL('./corePoseWorker.js', import.meta.url));
  let id = 0;
  const pending = new Map();
  const failAll = (error) => {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error); }
    pending.clear();
  };
  worker.onmessage = ({ data }) => {
    const request = pending.get(data.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(data.id);
    if (data.error) request.reject(new Error(data.error));
    else request.resolve(data);
  };
  worker.onerror = (event) => failAll(new Error(event.message || 'Pose worker failed'));
  const abort = () => { worker.terminate(); failAll(new DOMException('Cancelled', 'AbortError')); };
  const send = (message, transfer = []) => new Promise((resolve, reject) => {
    const requestId = id++;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Pose worker timed out')); }, 60000);
    pending.set(requestId, { resolve, reject, timer });
    worker.postMessage({ ...message, id: requestId }, transfer);
  });
  signal?.addEventListener('abort', abort, { once: true });
  try {
    signal?.throwIfAborted();
    onPhase('model');
    await send({ type: 'init' });
    onPhase('extracting');
    const imageLandmarks = [], worldLandmarks = [], timestamps = [];
    const metadata = await extractFramesStreaming(file, TARGET_FPS, MAX_FRAMES, MAX_LONG_SIDE, async (canvas, index, timestamp) => {
      signal?.throwIfAborted();
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer;
      const result = await send({ pixels, width: canvas.width, height: canvas.height, timestamp: index * 1000 / TARGET_FPS }, [pixels]);
      imageLandmarks.push(result.image);
      worldLandmarks.push(result.world);
      timestamps.push(timestamp);
    }, onProgress, { deterministic: true, signal });
    signal?.throwIfAborted();
    const result = { ...summarizeCount(worldLandmarks, timestamps, lift), exercise: lift, metadata, imageLandmarks, worldLandmarks, timestamps };
    // Local diagnostic event: tests observe actual app output, never inject landmarks.
    window.dispatchEvent(new CustomEvent('wv:core-result', { detail: result }));
    return result;
  } finally {
    signal?.removeEventListener('abort', abort);
    worker.terminate();
    failAll(new Error('Analysis finished'));
  }
}
