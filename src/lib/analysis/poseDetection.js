/**
 * MediaPipe pose landmarker orchestration — model loading and worker initialization.
 */

import { getImageLandmarker, resetKalmanFilters, disposeAllLandmarkers } from '../poseAnalysis';

/**
 * Initialize pose detection: reset filters, set up worker or main-thread landmarker.
 *
 * @returns {{ useWorker: boolean, landmarker: object|null, error: object|null }}
 *   - useWorker: true if worker-based inference is available
 *   - landmarker: the main-thread landmarker instance (null when using worker)
 *   - error: an error result object if initialization failed entirely, null otherwise
 */
export async function initPoseDetection({ worker }) {
  resetKalmanFilters();
  let useWorker = false;
  let workerInitError = null;

  if (worker.ready) {
    useWorker = true;
  } else if (worker.supported) {
    try {
      useWorker = await worker.init({ forceCPU: true, useImageMode: true });
    } catch (e) {
      workerInitError = e;
      console.warn('[analyzeVideo] Worker init failed, falling back to main thread:', e.message);
      useWorker = false;
    }
  }

  if (useWorker) {
    if (worker.reinit) {
      try {
        await worker.reinit({ forceCPU: true, useImageMode: true });
      } catch (e) {
        console.warn('[analyzeVideo] Worker reinit failed, trying reset:', e.message);
        worker.reset();
      }
    } else {
      worker.reset();
    }
  }

  let landmarker = null;
  if (!useWorker) {
    disposeAllLandmarkers();
    try {
      landmarker = await getImageLandmarker();
    } catch (e) {
      console.error('[analyzeVideo] Model loading failed:', e.message);
      return {
        useWorker: false,
        landmarker: null,
        error: { error: true, errorReason: `Model failed to load: ${e.message}${workerInitError ? ` (worker also failed: ${workerInitError.message})` : ''}` },
      };
    }
    if (!landmarker) {
      return {
        useWorker: false,
        landmarker: null,
        error: { error: true, errorReason: `Pose model unavailable${workerInitError ? ` (worker failed: ${workerInitError.message})` : ''}` },
      };
    }
  }

  return { useWorker, landmarker, error: null };
}
