/**
 * KalmanLandmarkFilter
 *
 * Smooths MediaPipe pose landmarks (33 points, each with x, y, z) at the
 * coordinate level, before any angle computation. Each coordinate gets its
 * own independent 1D Kalman filter (constant-position model), for a total
 * of 99 independent filters.
 */

/**
 * Internal 1D Kalman filter state for a single coordinate.
 * @typedef {Object} KalmanState1D
 * @property {number} x - Estimated value.
 * @property {number} p - Estimated error covariance.
 * @property {boolean} initialized - Whether the filter has seen its first observation.
 */

/**
 * @typedef {Object} LandmarkPoint
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} visibility
 */

const VISIBILITY_THRESHOLD = 0.1;

export class KalmanLandmarkFilter {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.processNoise=0.001]    - Q: how much we expect the true position to drift per frame.
   * @param {number} [opts.measurementNoise=0.05]  - R: how noisy the camera measurement is.
   * @param {number} [opts.numLandmarks=33]        - Number of pose landmarks.
   */
  constructor(opts = {}) {
    this.processNoise = opts.processNoise ?? 0.001;
    this.measurementNoise = opts.measurementNoise ?? 0.05;
    this.numLandmarks = opts.numLandmarks ?? 33;

    /** @type {KalmanState1D[][]} One [x, y, z] state triple per landmark. */
    this._states = null;
    this.reset();
  }

  /** Clear all filter state. Next call to filter() re-initializes from measurement. */
  reset() {
    this._states = Array.from({ length: this.numLandmarks }, () => [
      { x: 0, p: 1, initialized: false },
      { x: 0, p: 1, initialized: false },
      { x: 0, p: 1, initialized: false },
    ]);
  }

  /**
   * Filter a full set of pose landmarks.
   *
   * @param {LandmarkPoint[]|null|undefined} landmarks - 33-element array from MediaPipe.
   * @returns {LandmarkPoint[]|null} Filtered landmarks with smoothed x, y, z. Visibility passed through.
   */
  filter(landmarks) {
    if (!landmarks) return null;

    const out = new Array(landmarks.length);

    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];

      if (!lm) {
        out[i] = null;
        continue;
      }

      // Low-visibility landmarks are too noisy to filter; pass through raw.
      if (lm.visibility < VISIBILITY_THRESHOLD) {
        out[i] = { x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility };
        continue;
      }

      const states = this._states[i];
      const sx = this._update1D(states[0], lm.x);
      const sy = this._update1D(states[1], lm.y);
      const sz = this._update1D(states[2], lm.z);

      out[i] = { x: sx, y: sy, z: sz, visibility: lm.visibility };
    }

    return out;
  }

  /**
   * Run one predict-update cycle on a 1D Kalman state.
   *
   * @param {KalmanState1D} state - Mutated in place.
   * @param {number} measurement - Raw coordinate value from MediaPipe.
   * @returns {number} Filtered coordinate value.
   * @private
   */
  _update1D(state, measurement) {
    // First observation: initialize directly.
    if (!state.initialized) {
      state.x = measurement;
      state.p = this.measurementNoise;
      state.initialized = true;
      return state.x;
    }

    // Predict (constant-position model: value unchanged, covariance grows).
    state.p += this.processNoise;

    // Update.
    const k = state.p / (state.p + this.measurementNoise);
    state.x += k * (measurement - state.x);
    state.p *= 1 - k;

    return state.x;
  }

  /**
   * Get confidence intervals for all landmarks based on current Kalman covariance.
   * The covariance (p) represents the estimated error variance; sqrt(p) is the
   * standard deviation. A 95% confidence interval is approximately ±1.96σ.
   *
   * @returns {Array<{x: number, y: number, z: number}|null>} Per-landmark ±95% CI widths, or null if uninitialized.
   */
  getConfidenceIntervals() {
    return this._states.map(triple => {
      if (!triple[0].initialized) return null;
      return {
        x: 1.96 * Math.sqrt(triple[0].p),
        y: 1.96 * Math.sqrt(triple[1].p),
        z: 1.96 * Math.sqrt(triple[2].p),
      };
    });
  }
}
