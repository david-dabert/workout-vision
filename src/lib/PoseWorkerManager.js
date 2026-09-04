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
    this._pendingFrames = new Map(); // frameIndex → { resolve, reject, timeoutId }
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
            clearTimeout(pending.timeoutId);
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

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        if (this._pendingFrames.has(frameIndex)) {
          this._pendingFrames.delete(frameIndex);
          console.warn(`[PoseWorkerManager] Frame ${frameIndex} timed out after 10s`);
          resolve(null);
        }
      }, 10_000);

      this._pendingFrames.set(frameIndex, { resolve, reject: () => {}, timeoutId });

      // Transfer the buffer directly (zero-copy); the imageData is not reused after this call
      const buffer = imageData.data.buffer;
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
    for (const pending of this._pendingFrames.values()) {
      clearTimeout(pending.timeoutId);
    }
    this._pendingFrames.clear();
  }

  get isReady() {
    return this._ready;
  }
}

// ---------------------------------------------------------------------------
// Adaptive frame-rate inference (motion-gated)
// ---------------------------------------------------------------------------
// During rest periods or stillness, skip frames to save CPU/battery.
// Detects motion by comparing landmark positions between frames.
// Returns true if the frame should be processed, false to skip.
// ---------------------------------------------------------------------------

export class MotionGate {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.motionThreshold=0.005] - Minimum mean landmark displacement to count as motion (normalized coords)
   * @param {number} [opts.stillnessFrames=10] - Frames of no motion before entering low-rate mode
   * @param {number} [opts.skipRatio=3] - In low-rate mode, process every Nth frame
   */
  constructor(opts = {}) {
    this._motionThreshold = opts.motionThreshold ?? 0.005;
    this._stillnessFrames = opts.stillnessFrames ?? 10;
    this._skipRatio = opts.skipRatio ?? 3;
    this._prevLandmarks = null;
    this._stillCount = 0;
    this._framesSinceProcess = 0;
  }

  /**
   * Determine whether this frame should be processed.
   * Call AFTER processing to update state with the result landmarks.
   *
   * @param {number} frameIndex - Current frame index
   * @param {Array|null} landmarks - Landmarks from the PREVIOUS processed frame (null if first)
   * @returns {boolean} true = process this frame, false = skip
   */
  shouldProcess(frameIndex, landmarks) {
    // Always process first few frames
    if (!this._prevLandmarks || frameIndex < 5) {
      if (landmarks) this._prevLandmarks = landmarks;
      return true;
    }

    // Compute mean displacement from previous landmarks
    const motion = this._computeMotion(landmarks || this._prevLandmarks);
    if (landmarks) this._prevLandmarks = landmarks;

    if (motion < this._motionThreshold) {
      this._stillCount++;
    } else {
      this._stillCount = 0;
      this._framesSinceProcess = 0;
      return true;
    }

    // In stillness mode: process every Nth frame
    if (this._stillCount >= this._stillnessFrames) {
      this._framesSinceProcess++;
      if (this._framesSinceProcess >= this._skipRatio) {
        this._framesSinceProcess = 0;
        return true;
      }
      return false;
    }

    return true;
  }

  _computeMotion(currentLandmarks) {
    if (!currentLandmarks || !this._prevLandmarks) return Infinity;
    const prev = this._prevLandmarks;
    const curr = currentLandmarks;
    // Compare first pose only
    const p = Array.isArray(prev[0]) ? prev[0] : prev;
    const c = Array.isArray(curr[0]) ? curr[0] : curr;
    if (!p || !c || p.length === 0 || c.length === 0) return Infinity;

    let totalDisp = 0;
    let count = 0;
    const len = Math.min(p.length, c.length);
    for (let i = 0; i < len; i++) {
      if (!p[i] || !c[i]) continue;
      const dx = (c[i].x || 0) - (p[i].x || 0);
      const dy = (c[i].y || 0) - (p[i].y || 0);
      totalDisp += Math.sqrt(dx * dx + dy * dy);
      count++;
    }
    return count > 0 ? totalDisp / count : 0;
  }

  reset() {
    this._prevLandmarks = null;
    this._stillCount = 0;
    this._framesSinceProcess = 0;
  }
}
