/**
 * Adaptive 1€ (One-Euro) Filter for Biomechanical Kinematics
 * 
 * Reference:
 *   Casiez, G., Roussel, N., & Vogel, D. (2012).
 *   "1€ Filter: A Simple Speed-based Low-pass Filter for Angular and Position Jitter Reduction in Human-Computer Interaction"
 *   Proceedings of ACM CHI 2012, pp. 2527-2530.
 * 
 * Solves the speed vs. jitter trade-off in wild gym camera environments:
 * - When movement is slow or holding a stretch pause, cutoff frequency drops to minCutoff (e.g. 1.0 Hz),
 *   completely dampening landmark jitter and false inflection triggers.
 * - When movement accelerates (explosive concentric reversal), cutoff frequency scales linearly
 *   with derivative speed (f_c = minCutoff + beta * |dx/dt|), eliminating phase lag.
 * 
 * Strict Invariants:
 * - 100% Client-side purity (zero server latency or dependency).
 * - Deterministic mathematical execution.
 */

export interface OneEuroConfig {
  minCutoff?: number; // Minimum cutoff frequency in Hz (default: 1.0 Hz)
  beta?: number; // Speed coefficient scaling cutoff with velocity (default: 0.007)
  dCutoff?: number; // Cutoff frequency for derivative filtering (default: 1.0 Hz)
}

function calculateAlpha(rate: number, cutoff: number): number {
  const tau = 1.0 / (2.0 * Math.PI * cutoff);
  const te = 1.0 / rate;
  return 1.0 / (1.0 + tau / te);
}

/**
 * 1D Adaptive 1€ Low-Pass Filter
 */
export class OneEuroFilter1D {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;

  private xHatPrev: number | null = null;
  private dxHatPrev: number | null = null;
  private lastTimestampSec: number | null = null;

  constructor(config: OneEuroConfig = {}) {
    this.minCutoff = config.minCutoff ?? 1.0;
    this.beta = config.beta ?? 0.007;
    this.dCutoff = config.dCutoff ?? 1.0;
  }

  /**
   * Filters a scalar value given its arrival timestamp in seconds.
   */
  public filter(x: number, timestampSec: number): number {
    if (this.lastTimestampSec === null || this.xHatPrev === null) {
      this.xHatPrev = x;
      this.dxHatPrev = 0;
      this.lastTimestampSec = timestampSec;
      return x;
    }

    const dt = timestampSec - this.lastTimestampSec;
    if (dt <= 1e-6) {
      // Sub-microsecond identical frame timestamp, return cached state
      return this.xHatPrev;
    }

    const rate = 1.0 / dt;

    // 1. Estimate current raw derivative
    const dx = (x - this.xHatPrev) / dt;

    // 2. Filter derivative with fixed cutoff dCutoff
    const alphaD = calculateAlpha(rate, this.dCutoff);
    const dxHat = alphaD * dx + (1.0 - alphaD) * (this.dxHatPrev ?? 0);

    // 3. Adapt cutoff frequency based on filtered speed magnitude
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);

    // 4. Filter signal value with dynamic cutoff
    const alpha = calculateAlpha(rate, cutoff);
    const xHat = alpha * x + (1.0 - alpha) * this.xHatPrev;

    // 5. Update state
    this.xHatPrev = xHat;
    this.dxHatPrev = dxHat;
    this.lastTimestampSec = timestampSec;

    return xHat;
  }

  public reset(): void {
    this.xHatPrev = null;
    this.dxHatPrev = null;
    this.lastTimestampSec = null;
  }
}

export interface Landmark3D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/**
 * 3D Vector Adaptive 1€ Filter for spatial landmarks (x, y, z)
 */
export class OneEuroFilter3D {
  private filterX: OneEuroFilter1D;
  private filterY: OneEuroFilter1D;
  private filterZ: OneEuroFilter1D;

  constructor(config: OneEuroConfig = {}) {
    this.filterX = new OneEuroFilter1D(config);
    this.filterY = new OneEuroFilter1D(config);
    this.filterZ = new OneEuroFilter1D(config);
  }

  public filter(point: Landmark3D, timestampSec: number): Landmark3D {
    const fx = this.filterX.filter(point.x, timestampSec);
    const fy = this.filterY.filter(point.y, timestampSec);
    const fz = point.z !== undefined ? this.filterZ.filter(point.z, timestampSec) : undefined;

    return {
      x: fx,
      y: fy,
      z: fz,
      visibility: point.visibility,
    };
  }

  public reset(): void {
    this.filterX.reset();
    this.filterY.reset();
    this.filterZ.reset();
  }
}

/**
 * Full Skeleton 33-Pose Landmark Adaptive 1€ Filter
 */
export class OneEuroPoseFilter {
  private filters: OneEuroFilter3D[];

  constructor(config: OneEuroConfig = {}) {
    this.filters = Array.from({ length: 33 }, () => new OneEuroFilter3D(config));
  }

  public filter(landmarks: Landmark3D[], timestampSec: number): Landmark3D[] {
    if (!landmarks || landmarks.length !== 33) return landmarks;
    return landmarks.map((lm, idx) => {
      if (!lm) return lm;
      return this.filters[idx].filter(lm, timestampSec);
    });
  }

  public reset(): void {
    this.filters.forEach(f => f.reset());
  }
}
