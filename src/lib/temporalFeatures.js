/**
 * Temporal feature extractor — 2-second sliding window over joint angles.
 *
 * Extracts per-channel statistics that the hierarchical detector and future
 * ML classifier consume:
 *   - range (max - min)
 *   - mean
 *   - dwell at each extreme (fraction of window spent near min / max)
 *   - cycle count (zero-crossing count on de-meaned signal, halved)
 *   - cross-channel correlation (elbow-shoulder, knee-hip)
 *
 * Window is time-based (2 seconds) not frame-count-based, so it works
 * at any FPS without recalibration.
 */

import { bestSide } from './exercises';

const WINDOW_MS = 2000;
const DWELL_FRACTION = 0.15; // within 15% of range from extreme = "dwelling"

const CHANNELS = [
  { name: 'knee',     left: 'leftKnee',     right: 'rightKnee',     visL: '_visLeftKnee',     visR: '_visRightKnee' },
  { name: 'hip',      left: 'leftHip',      right: 'rightHip',      visL: '_visLeftHip',      visR: '_visRightHip' },
  { name: 'elbow',    left: 'leftElbow',     right: 'rightElbow',    visL: '_visLeftElbow',    visR: '_visRightElbow' },
  { name: 'shoulder', left: 'leftShoulder',  right: 'rightShoulder', visL: '_visLeftShoulder', visR: '_visRightShoulder' },
  { name: 'trunk',    direct: 'trunk' },
];

/**
 * Lightweight ring buffer for timestamped angle frames.
 */
class TimeWindow {
  constructor() {
    this._frames = [];
  }

  push(angles, timestampMs) {
    this._frames.push({ angles, t: timestampMs });
    // Evict frames older than window
    const cutoff = timestampMs - WINDOW_MS;
    while (this._frames.length > 0 && this._frames[0].t < cutoff) {
      this._frames.shift();
    }
  }

  get length() { return this._frames.length; }
  get frames() { return this._frames; }
  get durationMs() {
    if (this._frames.length < 2) return 0;
    return this._frames[this._frames.length - 1].t - this._frames[0].t;
  }

  reset() { this._frames = []; }
}

/**
 * Extract a channel value from an angles object.
 */
function channelValue(angles, ch) {
  if (ch.direct) return angles[ch.direct];
  return bestSide(angles, ch.left, ch.right, ch.visL, ch.visR);
}

/**
 * Compute statistics for a single channel over the window.
 */
function channelStats(frames, ch) {
  const vals = [];
  for (const f of frames) {
    const v = channelValue(f.angles, ch);
    if (v != null && !isNaN(v)) vals.push(v);
  }
  if (vals.length < 3) {
    return { range: 0, mean: 0, dwellLow: 0, dwellHigh: 0, cycles: 0, values: vals };
  }

  let min = Infinity, max = -Infinity, sum = 0;
  for (const v of vals) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  const range = max - min;
  const mean = sum / vals.length;
  const threshold = range * DWELL_FRACTION;

  // Dwell: fraction of samples near min or max
  let nearMin = 0, nearMax = 0;
  for (const v of vals) {
    if (v - min < threshold) nearMin++;
    if (max - v < threshold) nearMax++;
  }
  const dwellLow = nearMin / vals.length;
  const dwellHigh = nearMax / vals.length;

  // Cycle count: zero-crossings on de-meaned signal, divided by 2
  let crossings = 0;
  let prev = vals[0] - mean;
  for (let i = 1; i < vals.length; i++) {
    const cur = vals[i] - mean;
    if ((prev > 0 && cur <= 0) || (prev < 0 && cur >= 0)) crossings++;
    prev = cur;
  }
  const cycles = crossings / 2;

  return { range, mean, min, max, dwellLow, dwellHigh, cycles, values: vals };
}

/**
 * Pearson correlation between two arrays (same length assumed).
 */
function pearsonCorr(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  let sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) { sumA += a[i]; sumB += b[i]; }
  const meanA = sumA / n, meanB = sumB / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
}

// ---------------------------------------------------------------------------
// TemporalFeatureExtractor
// ---------------------------------------------------------------------------

export class TemporalFeatureExtractor {
  constructor() {
    this._window = new TimeWindow();
  }

  /**
   * Push a frame of joint angles with timestamp.
   * @param {object} angles - from extractJointAngles
   * @param {number} timestampMs - monotonic timestamp in milliseconds
   */
  push(angles, timestampMs) {
    if (!angles) return;
    this._window.push(angles, timestampMs);
  }

  /**
   * Extract all temporal features from the current window.
   * Returns null if window has insufficient data.
   * @returns {object|null}
   */
  extract() {
    if (this._window.length < 3 || this._window.durationMs < 500) return null;

    const frames = this._window.frames;
    const features = {};

    // Per-channel stats
    for (const ch of CHANNELS) {
      features[ch.name] = channelStats(frames, ch);
    }

    // Cross-channel correlations
    features.corr_elbow_shoulder = pearsonCorr(
      features.elbow.values || [],
      features.shoulder.values || [],
    );
    features.corr_knee_hip = pearsonCorr(
      features.knee.values || [],
      features.hip.values || [],
    );
    features.corr_elbow_knee = pearsonCorr(
      features.elbow.values || [],
      features.knee.values || [],
    );

    features.windowMs = this._window.durationMs;
    features.frameCount = this._window.length;

    return features;
  }

  reset() {
    this._window.reset();
  }
}
