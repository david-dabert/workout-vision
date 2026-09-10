import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * React hook that manages a Web Worker running the full MediaPipe inference pipeline.
 *
 * The worker handles: model load → inference → Kalman filtering → angle extraction.
 * Main thread stays free for UI rendering at 60fps.
 *
 * Usage:
 *   const { isReady, initWorker, detectFrame, resetWorker, disposeWorker } = usePoseWorker();
 *   await initWorker();
 *   const { landmarks, angles } = await detectFrame(canvas, timestamp, frameIndex);
 *
 * Falls back to null (caller should use main-thread detection) when:
 *   - OffscreenCanvas not supported
 *   - Worker fails to load
 *   - Module workers not supported
 */

// Feature detection: can we use the worker path?
const WORKER_SUPPORTED = (() => {
  try {
    return typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined';
  } catch { return false; }
})();

export default function usePoseWorker() {
  const workerRef = useRef(null);
  const pendingRef = useRef(new Map()); // frameIndex → { resolve, reject }
  const timeoutsRef = useRef(new Set()); // track all active timeouts for cleanup
  const [isReady, setIsReady] = useState(false);
  const [isSupported] = useState(WORKER_SUPPORTED);
  const initPromiseRef = useRef(null);

  // Helper: setTimeout with automatic tracking for cleanup on unmount
  const trackedTimeout = (fn, ms) => {
    const id = setTimeout(() => {
      timeoutsRef.current.delete(id);
      fn();
    }, ms);
    timeoutsRef.current.add(id);
    return id;
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'dispose' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
      pendingRef.current.clear();
      // Clear all tracked timeouts to prevent firing into dead refs
      for (const id of timeoutsRef.current) clearTimeout(id);
      timeoutsRef.current.clear();
    };
  }, []);

  const handleMessage = useCallback((e) => {
    const msg = e.data;

    if (msg.type === 'ready') {
      setIsReady(true);
      if (initPromiseRef.current) {
        initPromiseRef.current.resolve(true);
        initPromiseRef.current = null;
      }
      return;
    }

    if (msg.type === 'error') {
      console.error('[PoseWorker]', msg.message);
      if (initPromiseRef.current) {
        initPromiseRef.current.reject(new Error(msg.message));
        initPromiseRef.current = null;
      }
      return;
    }

    if (msg.type === 'result') {
      const pending = pendingRef.current.get(msg.frameIndex);
      if (pending) {
        pendingRef.current.delete(msg.frameIndex);
        pending.resolve({
          landmarks: msg.landmarks,
          angles: msg.angles,
          inferenceMs: msg.inferenceMs,
        });
      }
      return;
    }

    if (msg.type === 'resetDone' || msg.type === 'disposed') {
      return;
    }
  }, []);

  /**
   * Initialize the worker and load the MediaPipe model.
   * Returns a promise that resolves when the model is ready.
   */
  const initWorker = useCallback(async () => {
    if (!WORKER_SUPPORTED) return false;
    if (workerRef.current && isReady) return true;

    // Already initializing
    if (initPromiseRef.current) {
      return initPromiseRef.current.promise;
    }

    try {
      // Terminate any stale worker from a previous failed init
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        pendingRef.current.clear();
      }
      const worker = new Worker(
        new URL('./poseWorker.js', import.meta.url),
        { type: 'module' }
      );
      worker.onmessage = handleMessage;
      worker.onerror = (err) => {
        console.error('[PoseWorker] Worker error:', err);
        setIsReady(false);
        if (initPromiseRef.current) {
          initPromiseRef.current.reject(new Error('Worker crashed'));
          initPromiseRef.current = null;
        }
      };
      workerRef.current = worker;

      const promise = new Promise((resolve, reject) => {
        initPromiseRef.current = { resolve, reject };
        // Timeout after 45s
        trackedTimeout(() => {
          if (initPromiseRef.current) {
            initPromiseRef.current.reject(new Error('Worker init timeout'));
            initPromiseRef.current = null;
          }
        }, 45000);
      });

      worker.postMessage({ type: 'init' });
      return promise;
    } catch (err) {
      console.error('[PoseWorker] Failed to create worker:', err);
      return false;
    }
  }, [isReady, handleMessage]);

  /**
   * Send a frame to the worker for detection.
   * @param {HTMLCanvasElement|ImageBitmap} source - Canvas or pre-created ImageBitmap
   * @param {number} timestamp - Deterministic timestamp for MediaPipe VIDEO mode
   * @param {number} frameIndex - Unique frame index for response matching
   * @returns {Promise<{landmarks, angles, inferenceMs}>}
   */
  const detectFrame = useCallback(async (source, timestamp, frameIndex) => {
    if (!workerRef.current || !isReady) return null;

    try {
      // Accept pre-created ImageBitmap (pipeline mode) or canvas
      const bitmap = source instanceof ImageBitmap ? source : await createImageBitmap(source);
      const promise = new Promise((resolve, reject) => {
        pendingRef.current.set(frameIndex, { resolve, reject });
        // Safety timeout per frame (5s)
        trackedTimeout(() => {
          if (pendingRef.current.has(frameIndex)) {
            pendingRef.current.delete(frameIndex);
            resolve(null); // Don't crash, just skip
          }
        }, 5000);
      });
      workerRef.current.postMessage(
        { type: 'detect', bitmap, timestamp, frameIndex },
        [bitmap] // Transfer ownership
      );
      return promise;
    } catch {
      // Fallback: raw pixel transfer if createImageBitmap fails
      try {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const buffer = imageData.data.buffer;
        const promise = new Promise((resolve) => {
          pendingRef.current.set(frameIndex, { resolve, reject: () => resolve(null) });
          trackedTimeout(() => {
            if (pendingRef.current.has(frameIndex)) {
              pendingRef.current.delete(frameIndex);
              resolve(null);
            }
          }, 5000);
        });
        workerRef.current.postMessage(
          { type: 'detectPixels', frameData: buffer, width: canvas.width, height: canvas.height, timestamp, frameIndex },
          [buffer]
        );
        return promise;
      } catch {
        return null;
      }
    }
  }, [isReady]);

  /**
   * Reset Kalman filter state in the worker (between videos).
   */
  const resetWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'reset' });
    }
    pendingRef.current.clear();
  }, []);

  /**
   * Dispose the worker entirely.
   */
  const disposeWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'dispose' });
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setIsReady(false);
    pendingRef.current.clear();
  }, []);

  return {
    isReady,
    isSupported,
    initWorker,
    detectFrame,
    resetWorker,
    disposeWorker,
  };
}
