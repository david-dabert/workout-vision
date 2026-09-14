/**
 * oneEuroFilter.js — One Euro Filter for landmark smoothing.
 *
 * Adaptive low-pass filter designed for interactive human motion tracking.
 * Unlike a fixed-cutoff Kalman filter, the One Euro Filter dynamically adjusts
 * its cutoff frequency based on movement speed:
 *   - Low speed  → low cutoff  → strong smoothing (jitter reduction)
 *   - High speed → high cutoff → weak smoothing (lag reduction)
 *
 * Reference: Casiez, Roussel, Vogel, "1€ Filter: A Simple Speed-based
 * Low-pass Filter for Noisy Input in Interactive Systems", CHI 2012.
 *
 * This module has zero dependencies so it can be imported from a Worker
 * loaded with { type: 'module' }.
 */

const TWO_PI = 2 * Math.PI;

// ─── Low-pass filter (first-order exponential smoothing) ───

export class LowPassFilter {
  constructor() {
    this._y = 0;
    this._initialized = false;
  }

  /**
   * Filter a value with a given smoothing factor alpha.
   * @param {number} value - raw measurement
   * @param {number} alpha - smoothing factor in (0, 1]. 1 = no smoothing.
   * @returns {number} filtered value
   */
  filter(value, alpha) {
    if (!this._initialized) {
      this._y = value;
      this._initialized = true;
      return value;
    }
    this._y = alpha * value + (1 - alpha) * this._y;
    return this._y;
  }

  /** Return the last filtered value without advancing state. */
  lastValue() {
    return this._y;
  }

  /** Whether the filter has received at least one sample. */
  get initialized() {
    return this._initialized;
  }

  /** Reset filter state. */
  reset() {
    this._y = 0;
    this._initialized = false;
  }
}

// ─── One Euro Filter (single axis) ───

export class OneEuroFilter {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.minCutoff=1.0]  - Minimum cutoff frequency (Hz). Controls jitter.
   * @param {number} [opts.beta=0.007]     - Speed coefficient. Controls lag.
   * @param {number} [opts.dCutoff=1.0]    - Derivative cutoff frequency (Hz).
   */
  constructor(opts = {}) {
    this.minCutoff = opts.minCutoff ?? 1.7;
    this.beta = opts.beta ?? 0.01;
    this.dCutoff = opts.dCutoff ?? 1.0;

    this._xFilter = new LowPassFilter();
    this._dxFilter = new LowPassFilter();
    this._lastTime = -1;
  }

  /**
   * Compute the smoothing factor alpha from cutoff frequency and sampling period.
   * alpha = 1 / (1 + tau / Te) where tau = 1 / (2 * PI * fc), Te = 1 / rate
   * @param {number} te - sampling period (seconds)
   * @param {number} cutoff - cutoff frequency (Hz)
   * @returns {number} alpha in (0, 1]
   */
  static alpha(te, cutoff) {
    const tau = 1.0 / (TWO_PI * cutoff);
    return 1.0 / (1.0 + tau / te);
  }

  /**
   * Filter a single value.
   * @param {number} value - raw measurement
   * @param {number} timestamp - time in seconds
   * @param {number} [minCutoffOverride] - optional per-call minCutoff override
   * @returns {number} filtered value
   */
  filter(value, timestamp, minCutoffOverride) {
    const effectiveMinCutoff = minCutoffOverride ?? this.minCutoff;

    if (this._lastTime < 0) {
      // First sample: initialize both filters
      this._lastTime = timestamp;
      this._dxFilter.filter(0, 1.0); // derivative starts at 0
      return this._xFilter.filter(value, 1.0); // no smoothing on first sample
    }

    // Sampling period (guard against zero/negative dt)
    let te = timestamp - this._lastTime;
    if (te <= 0) te = 1.0 / 12; // fallback: assume ~12 fps
    this._lastTime = timestamp;

    // Estimate derivative (speed)
    const dx = (value - this._xFilter.lastValue()) / te;
    const edx = this._dxFilter.filter(dx, OneEuroFilter.alpha(te, this.dCutoff));

    // Adaptive cutoff: fc = minCutoff + beta * |filtered derivative|
    const fc = effectiveMinCutoff + this.beta * Math.abs(edx);

    // Filter the value
    return this._xFilter.filter(value, OneEuroFilter.alpha(te, fc));
  }

  /** Reset filter state. */
  reset() {
    this._xFilter.reset();
    this._dxFilter.reset();
    this._lastTime = -1;
  }
}

// ─── One Euro Landmark Filter (wraps 33 landmarks × 3 axes = 99 filters) ───

const VISIBILITY_THRESHOLD_LOW = 0.3;
const VISIBILITY_THRESHOLD_HIGH = 0.7;
const LOW_VIS_CUTOFF_MULTIPLIER = 2.0; // increase minCutoff when visibility is low

/** Minimum visibility to apply filtering at all (below this, pass through raw). */
const FILTER_VIS_THRESHOLD = 0.1;

export class OneEuroLandmarkFilter {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.minCutoff=1.0]
   * @param {number} [opts.beta=0.007]
   * @param {number} [opts.dCutoff=1.0]
   * @param {number} [opts.numLandmarks=33]
   */
  constructor(opts = {}) {
    this.minCutoff = opts.minCutoff ?? 1.7;
    this.beta = opts.beta ?? 0.01;
    this.dCutoff = opts.dCutoff ?? 1.0;
    this.numLandmarks = opts.numLandmarks ?? 33;
    this._fps = opts.fps ?? 15; // actual analysis fps (10 on iOS, 15 on desktop)

    this._filters = null;
    this._frameCount = 0;
    this.reset();
  }

  /** Clear all filter state. Next call to filter() re-initializes from measurement. */
  reset() {
    const filterOpts = {
      minCutoff: this.minCutoff,
      beta: this.beta,
      dCutoff: this.dCutoff,
    };
    this._filters = Array.from({ length: this.numLandmarks }, () => [
      new OneEuroFilter(filterOpts),
      new OneEuroFilter(filterOpts),
      new OneEuroFilter(filterOpts),
    ]);
    this._frameCount = 0;
  }

  /**
   * Filter a full set of pose landmarks.
   *
   * @param {Array|null|undefined} landmarks - 33-element array from MediaPipe.
   * @returns {Array|null} Filtered landmarks with smoothed x, y, z. Visibility passed through.
   */
  filter(landmarks) {
    if (!landmarks) return null;

    // Use frame count to generate a monotonic timestamp in seconds.
    const timestamp = this._frameCount / this._fps;
    this._frameCount++;

    const out = new Array(landmarks.length);

    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];

      if (!lm) {
        out[i] = null;
        continue;
      }

      // Low-visibility landmarks are too noisy to filter; pass through raw.
      if (lm.visibility < FILTER_VIS_THRESHOLD) {
        out[i] = { x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility };
        continue;
      }

      // Visibility-adaptive minCutoff:
      // Low visibility → increase minCutoff (trust measurement less, smooth more)
      // High visibility → use normal parameters
      let minCutoffOverride;
      const vis = lm.visibility || 0;
      if (vis < VISIBILITY_THRESHOLD_LOW) {
        minCutoffOverride = this.minCutoff * LOW_VIS_CUTOFF_MULTIPLIER;
      } else if (vis < VISIBILITY_THRESHOLD_HIGH) {
        // Linearly interpolate between high and normal cutoff
        const t = (vis - VISIBILITY_THRESHOLD_LOW) / (VISIBILITY_THRESHOLD_HIGH - VISIBILITY_THRESHOLD_LOW);
        minCutoffOverride = this.minCutoff * (LOW_VIS_CUTOFF_MULTIPLIER + t * (1 - LOW_VIS_CUTOFF_MULTIPLIER));
      } else {
        minCutoffOverride = undefined; // use default
      }

      const filters = this._filters[i];
      const sx = filters[0].filter(lm.x, timestamp, minCutoffOverride);
      const sy = filters[1].filter(lm.y, timestamp, minCutoffOverride);
      const sz = filters[2].filter(lm.z, timestamp, minCutoffOverride);

      out[i] = { x: sx, y: sy, z: sz, visibility: lm.visibility };
    }

    return out;
  }
}
