// Pose detection Web Worker scaffold
// TODO: Full migration of MediaPipe detection to this worker
// This will eliminate UI jank on budget Android devices
//
// Architecture:
// Main thread: sends video frames via OffscreenCanvas
// Worker: runs MediaPipe detection, Kalman filtering, plausibility checks
// Worker: posts back filtered landmarks to main thread
//
// Prerequisites for full migration:
// 1. MediaPipe tasks-vision must support OffscreenCanvas (check version compatibility)
// 2. Kalman filter state must be serializable
// 3. Form check functions need to run in worker context

self.addEventListener('message', (e) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'init':
      // Will initialize MediaPipe in worker context
      self.postMessage({ type: 'ready' });
      break;
    case 'detect':
      // Will receive ImageBitmap and run detection
      // For now, echo back to confirm worker communication
      self.postMessage({ type: 'result', payload: { landmarks: null, timestamp: payload.timestamp } });
      break;
    case 'destroy':
      self.close();
      break;
  }
});
