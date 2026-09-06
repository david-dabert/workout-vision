import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook to communicate with the pose detection Web Worker.
 * Currently a scaffold — full implementation pending MediaPipe
 * OffscreenCanvas support validation.
 */
export default function usePoseWorker() {
  const workerRef = useRef(null);

  useEffect(() => {
    // Worker creation deferred until full migration
    return () => {
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'destroy' });
        workerRef.current = null;
      }
    };
  }, []);

  const detect = useCallback((imageBitmap, timestamp) => {
    // Placeholder — currently detection still runs on main thread
    return null;
  }, []);

  return { detect, isReady: false };
}
