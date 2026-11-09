/**
 * Device motion and orientation hardware sensors for mobile athlete capture.
 *
 * Capabilities:
 * 1. Stability detector: detects whether phone is resting on a tripod/surface vs handheld,
 *    enabling zero-touch, hands-free automated session arming.
 * 2. Pedaling cadence detector: estimates bike pedaling cadence (RPM) from harmonic
 *    accelerometer oscillations (30-150 RPM / 0.5-2.5 Hz).
 * 3. Gravity tilt estimation: extracts pitch/tilt angle from gravity vector to auto-calibrate
 *    camera angle relative to the ground.
 *
 * 100% on-device, zero telemetry.
 */

export interface MotionSample {
  timestamp: number;
  accelX: number;
  accelY: number;
  accelZ: number;
  rotAlpha?: number;
  rotBeta?: number;
  rotGamma?: number;
}

export interface StabilityState {
  isStable: boolean;
  stabilityDurationSec: number;
  variance: number;
}

/**
 * Evaluates phone stability over a sliding window of acceleration magnitudes.
 * When variance drops below threshold for the required duration, phone is classified as stable.
 */
export class DeviceStabilityDetector {
  private window: { t: number; mag: number }[] = [];
  private windowDurationMs: number;
  private varianceThreshold: number;
  private stableStartTime: number | null = null;

  constructor(windowDurationMs: number = 1500, varianceThreshold: number = 0.02) {
    this.windowDurationMs = windowDurationMs;
    this.varianceThreshold = varianceThreshold;
  }

  push(sample: MotionSample): StabilityState {
    const mag = Math.sqrt(
      sample.accelX * sample.accelX +
      sample.accelY * sample.accelY +
      sample.accelZ * sample.accelZ
    );

    this.window.push({ t: sample.timestamp, mag });
    const cutoff = sample.timestamp - this.windowDurationMs;
    this.window = this.window.filter(s => s.t >= cutoff);

    if (this.window.length < 5) {
      this.stableStartTime = null;
      return { isStable: false, stabilityDurationSec: 0, variance: 1.0 };
    }

    const mean = this.window.reduce((sum, s) => sum + s.mag, 0) / this.window.length;
    const variance =
      this.window.reduce((sum, s) => sum + Math.pow(s.mag - mean, 2), 0) /
      this.window.length;

    const isCurrentlyStill = variance < this.varianceThreshold;

    if (isCurrentlyStill) {
      if (this.stableStartTime === null) {
        this.stableStartTime = sample.timestamp;
      }
    } else {
      this.stableStartTime = null;
    }

    const durationSec = this.stableStartTime !== null
      ? Math.max(0, (sample.timestamp - this.stableStartTime) / 1000)
      : 0;

    return {
      isStable: durationSec >= this.windowDurationMs / 1000,
      stabilityDurationSec: durationSec,
      variance,
    };
  }

  reset(): void {
    this.window = [];
    this.stableStartTime = null;
  }
}

/**
 * Estimates pedaling cadence (RPM) from cyclic acceleration peaks on a bike.
 * Normal human pedaling falls between 30 and 140 RPM (0.5 to 2.33 Hz).
 */
export function estimatePedalingCadence(samples: MotionSample[]): { rpm: number | null; confidence: number } {
  if (samples.length < 30) {
    return { rpm: null, confidence: 0 };
  }

  // Compute normalized magnitudes
  const times = samples.map(s => s.timestamp);
  const mags = samples.map(s =>
    Math.sqrt(s.accelX * s.accelX + s.accelY * s.accelY + s.accelZ * s.accelZ)
  );

  const meanMag = mags.reduce((a, b) => a + b, 0) / mags.length;
  const centered = mags.map(m => m - meanMag);

  // Peak detection with minimal interval (300ms = 200 RPM max limit)
  const minIntervalMs = 300;
  const peaks: number[] = [];

  for (let i = 1; i < centered.length - 1; i++) {
    if (centered[i] > 0.15 && centered[i] > centered[i - 1] && centered[i] > centered[i + 1]) {
      const lastPeakTime = peaks.length > 0 ? times[peaks[peaks.length - 1]] : -Infinity;
      if (times[i] - lastPeakTime >= minIntervalMs) {
        peaks.push(i);
      }
    }
  }

  if (peaks.length < 3) {
    return { rpm: null, confidence: 0 };
  }

  // Calculate inter-peak intervals in seconds
  const intervalsSec: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervalsSec.push((times[peaks[i]] - times[peaks[i - 1]]) / 1000);
  }

  const avgInterval = intervalsSec.reduce((a, b) => a + b, 0) / intervalsSec.length;
  if (avgInterval <= 0) return { rpm: null, confidence: 0 };

  const rawRpm = 60 / avgInterval;

  // Filter within plausible cycling bounds (30 - 150 RPM)
  if (rawRpm < 30 || rawRpm > 150) {
    return { rpm: null, confidence: 0.1 };
  }

  // Consistency check
  const intervalVariance =
    intervalsSec.reduce((sum, intv) => sum + Math.pow(intv - avgInterval, 2), 0) /
    intervalsSec.length;
  const confidence = Math.max(0, Math.min(1, 1 - intervalVariance / 0.25));

  return {
    rpm: Math.round(rawRpm),
    confidence: Number(confidence.toFixed(2)),
  };
}

/**
 * Calculates device pitch tilt angle from gravity acceleration vector [gx, gy, gz].
 * Returns angle in degrees relative to vertical (0° = vertical upright phone, 90° = flat on table).
 */
export function estimatePhoneTiltDegrees(gx: number, gy: number, gz: number): number {
  const norm = Math.sqrt(gx * gx + gy * gy + gz * gz);
  if (norm < 1e-4) return 0;

  // Pitch with respect to vertical Y axis
  const cosTheta = Math.abs(gy) / norm;
  const clamped = Math.max(-1, Math.min(1, cosTheta));
  const tiltRad = Math.acos(clamped);
  return Number(((tiltRad * 180) / Math.PI).toFixed(1));
}
