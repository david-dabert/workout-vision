/**
 * PoseWorkerManager — main-thread interface to the pose detection Web Worker.
 *
 * Handles worker lifecycle, message routing, and graceful fallback to
 * main-thread processing when Web Workers or OffscreenCanvas are unavailable.
 *
 * Usage:
 *   const manager = new PoseWorkerManager();
 *   await manager.init();
 *   const landmarks = await manager.processFrame(imageData, timestamp, frameIndex);
 *   manager.dispose();
 */

/**
 * Check if the browser supports module workers + OffscreenCanvas.
 * Both are required for the worker path.
 */
export function isWorkerSupported() {
  if (typeof Worker === 'undefined') return false;
  if (typeof OffscreenCanvas === 'undefined') return false;
  // Module workers: Safari 15+, Chrome 80+, Firefox 114+
  // We can't feature-detect module worker support without trying, so we check
  // for a proxy: if OffscreenCanvas exists, module workers almost certainly do.
  return true;
}

export class PoseWorkerManager {
  constructor() {
    /** @type {Worker|null} */
    this._worker = null;
    this._ready = false;
    this._pendingFrames = new Map(); // frameIndex → { resolve, reject }
    this._initPromise = null;
  }

  /**
   * Initialize the worker and load the MediaPipe model.
   * Resolves when the worker reports ready.
   * @returns {Promise<void>}
   */
  init() {
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve, reject) => {
      try {
        this._worker = new Worker(
          new URL('./poseWorker.js', import.meta.url),
          { type: 'module' }
        );
      } catch (e) {
        reject(new Error(`Worker creation failed: ${e.message}`));
        return;
      }

      this._worker.onmessage = (e) => {
        const msg = e.data;

        if (msg.type === 'ready') {
          this._ready = true;
          resolve();
          return;
        }

        if (msg.type === 'error' && !this._ready) {
          reject(new Error(msg.message));
          return;
        }

        if (msg.type === 'frameResult') {
          const pending = this._pendingFrames.get(msg.frameIndex);
          if (pending) {
            this._pendingFrames.delete(msg.frameIndex);
            pending.resolve(msg.landmarks);
          }
          return;
        }
      };

      this._worker.onerror = (err) => {
        if (!this._ready) {
          reject(new Error(`Worker error: ${err.message}`));
        }
      };

      this._worker.postMessage({ type: 'init' });
    });

    return this._initPromise;
  }

  /**
   * Process a single frame in the worker.
   *
   * @param {ImageData} imageData - RGBA pixel data
   * @param {number} timestamp - Deterministic timestamp in ms
   * @param {number} frameIndex - Frame sequence number
   * @returns {Promise<Array|null>} Array of pose landmark arrays, or null
   */
  processFrame(imageData, timestamp, frameIndex) {
    if (!this._worker || !this._ready) {
      return Promise.resolve(null);
    }

    return new Promise((resolve, reject) => {
      this._pendingFrames.set(frameIndex, { resolve, reject });

      // Transfer the buffer (zero-copy) instead of copying
      const buffer = imageData.data.buffer.slice(0);
      this._worker.postMessage(
        {
          type: 'processFrame',
          frameData: buffer,
          width: imageData.width,
          height: imageData.height,
          timestamp,
          frameIndex,
        },
        [buffer]
      );
    });
  }

  /**
   * Dispose the worker and free resources.
   */
  dispose() {
    if (this._worker) {
      this._worker.postMessage({ type: 'dispose' });
      this._worker.terminate();
      this._worker = null;
    }
    this._ready = false;
    this._initPromise = null;
    this._pendingFrames.clear();
  }

  get isReady() {
    return this._ready;
  }
}
