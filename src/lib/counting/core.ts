/**
 * Counting core — pure function, no DOM, no detection.
 *
 * In:  timestamped world landmarks (from MediaPipe PoseLandmarker) and a lift name.
 * Out: rep count, per-rep detail (start/end time, ROM, durations), arm used, confidence.
 *
 * Joint angles (world-landmark 3D vectors):
 *   curl, bench_press, overhead_press, lat_pulldown → elbow angle
 *   lateral_raise → shoulder abduction (hip–shoulder–elbow)
 *
 * Arm selection: the arm whose shoulder (11/12), elbow (13/14) and wrist (15/16)
 * have the highest average visibility across the set. Short dropouts (< bridgeGap)
 * are filled with the last valid angle; the arm never alternates frame-by-frame.
 *
 * Signal conditioning pipeline: outlier removal → bridge dropouts → Savitzky–Golay.
 * Outlier removal nulls samples that deviate from their local median by more
 * than OUTLIER_DEVIATION_DEG (rejects pose-estimation glitches without
 * attenuating shallow reps). SG smoothing then operates on clean data.
 * All windows are defined in seconds and converted to samples at runtime.
 *
 * Rep detection: smoothed angle crosses a low threshold (from extended/abducted)
 * and a high threshold (from flexed/adducted) derived from the set's own
 * 10th/90th percentile range. A rep is one full cycle whose duration falls
 * within [minRepSec, maxRepSec].
 *
 * Every parameter is in seconds or degrees, never frames.
 *
 * References (fixed parameters only):
 *   Rep duration bounds: 0.5–8.0 s covers controlled eccentrics through
 *     explosive concentrics across standard resistance exercises (Schoenfeld,
 *     Ogborn & Krieger, "Effect of Repetition Duration During Resistance
 *     Training on Muscle Hypertrophy", Sports Medicine 2015; 45(4):577-85).
 *   Savitzky–Golay window and outlier parameters: unvalidated starting values.
 *     Not derived from a specific published recommendation.
 */

// ─── Types ───

export interface WorldLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export type WorldLandmarkFrame = WorldLandmark[] | null;

export interface RepDetail {
  index: number;        // 1-based rep number
  startTime: number;    // seconds into video
  endTime: number;      // seconds into video
  romDegrees: number;   // range of motion in degrees (peak-to-trough within this rep)
  concentricSec: number;
  eccentricSec: number;
}

export interface CountResult {
  count: number;
  reps: RepDetail[];
  arm: 'left' | 'right';
  confidence: number;   // 0–1
  angles: (number | null)[];          // raw angle per sample
  smoothedAngles: (number | null)[];  // after SG + bridge
  lowThreshold: number;
  highThreshold: number;
}

export type Lift = 'bicep_curl' | 'bench_press' | 'overhead_press' | 'lat_pulldown' | 'lateral_raise';

// ─── Constants ───

// Landmark indices (MediaPipe Pose, 33-point model)
const L_SHOULDER = 11, R_SHOULDER = 12;
const L_ELBOW = 13, R_ELBOW = 14;
const L_WRIST = 15, R_WRIST = 16;
const L_HIP = 23, R_HIP = 24;

// Savitzky–Golay quadratic kernels (symmetric, preserves peaks)
// Selected at runtime from SG_WINDOW_SEC and actual sample rate.
const SG_KERNELS: Record<number, number[]> = {
  3: [1, 1, 1].map(v => v / 3),
  5: [-3, 12, 17, 12, -3].map(v => v / 35),
  7: [-2, 3, 6, 7, 6, 3, -2].map(v => v / 21),
  9: [-21, 14, 39, 54, 59, 54, 39, 14, -21].map(v => v / 231),
  11: [-36, 9, 44, 69, 84, 89, 84, 69, 44, 9, -36].map(v => v / 429),
};

// Unvalidated starting values — recorded per PLAN.md rule
const BRIDGE_GAP_SEC = 0.5;       // max dropout to bridge
const OUTLIER_WINDOW_SEC = 0.5;   // window for local median in outlier removal
const OUTLIER_DEVIATION_DEG = 40; // max deviation from local median before nulling
const SG_WINDOW_SEC = 0.333;      // Savitzky–Golay window in seconds
const MIN_REP_SEC = 0.5;          // shortest plausible rep (Schoenfeld et al. 2015)
const MAX_REP_SEC = 8.0;          // longest plausible rep
const PERCENTILE_LOW = 10;        // for threshold from set's own range
const PERCENTILE_HIGH = 90;
const THRESHOLD_MARGIN = 0.20;    // fraction of range added as hysteresis band
const MIN_ROM_DEGREES = 20;       // minimum ROM to accept a rep
const VIS_THRESHOLD = 0.5;        // per-joint visibility floor

// ─── Public API ───

export function countReps(
  worldLandmarks: WorldLandmarkFrame[],
  timestamps: number[],
  lift: Lift,
): CountResult {
  // 1. Select arm
  const arm = selectArm(worldLandmarks, lift);

  // 2. Extract raw angle per sample
  const rawAngles = worldLandmarks.map(wl => {
    if (!wl) return null;
    return extractAngle(wl, lift, arm);
  });

  // 3. Estimate sample rate from timestamps
  const sampleRate = estimateSampleRate(timestamps);

  // 4. Remove outliers (before bridging, so spikes don't propagate)
  const outlierSize = secToOddSamples(OUTLIER_WINDOW_SEC, sampleRate);
  const cleaned = removeOutliers(rawAngles, outlierSize, OUTLIER_DEVIATION_DEG);

  // 5. Bridge short dropouts
  const bridged = bridgeDropouts(cleaned, timestamps, BRIDGE_GAP_SEC);

  // 6. Smooth with Savitzky–Golay (window in seconds)
  const sgSize = secToOddSamples(SG_WINDOW_SEC, sampleRate);
  const smoothed = savitzkyGolay(bridged, sgSize);

  // 7. Compute thresholds from the set's own range
  const validAngles = smoothed.filter((a): a is number => a !== null);
  if (validAngles.length < 3) {
    return { count: 0, reps: [], arm, confidence: 0, angles: rawAngles, smoothedAngles: smoothed, lowThreshold: 0, highThreshold: 0 };
  }
  const sorted = [...validAngles].sort((a, b) => a - b);
  const p = (pct: number) => sorted[Math.floor(sorted.length * pct / 100)];
  const pLow = p(PERCENTILE_LOW);
  const pHigh = p(PERCENTILE_HIGH);
  const range = pHigh - pLow;

  if (range < MIN_ROM_DEGREES) {
    return { count: 0, reps: [], arm, confidence: 0, angles: rawAngles, smoothedAngles: smoothed, lowThreshold: pLow, highThreshold: pHigh };
  }

  const margin = range * THRESHOLD_MARGIN;
  const lowThreshold = pLow + margin;
  const highThreshold = pHigh - margin;

  // 8. Detect reps via threshold crossings
  const reps = detectReps(smoothed, timestamps, lowThreshold, highThreshold, lift);

  // 9. Confidence: fraction of samples with a detected pose on the tracked arm
  const totalSamples = worldLandmarks.length;
  const detectedSamples = rawAngles.filter(a => a !== null).length;
  const confidence = totalSamples > 0 ? detectedSamples / totalSamples : 0;

  return { count: reps.length, reps, arm, confidence, angles: rawAngles, smoothedAngles: smoothed, lowThreshold, highThreshold };
}

// ─── Arm selection ───

function selectArm(worldLandmarks: WorldLandmarkFrame[], lift: Lift): 'left' | 'right' {
  let lVis = 0, rVis = 0, count = 0;
  for (const wl of worldLandmarks) {
    if (!wl) continue;
    count++;
    if (lift === 'lateral_raise') {
      lVis += vis(wl[L_HIP]) + vis(wl[L_SHOULDER]) + vis(wl[L_ELBOW]);
      rVis += vis(wl[R_HIP]) + vis(wl[R_SHOULDER]) + vis(wl[R_ELBOW]);
    } else {
      lVis += vis(wl[L_SHOULDER]) + vis(wl[L_ELBOW]) + vis(wl[L_WRIST]);
      rVis += vis(wl[R_SHOULDER]) + vis(wl[R_ELBOW]) + vis(wl[R_WRIST]);
    }
  }
  if (count === 0) return 'left';
  return lVis >= rVis ? 'left' : 'right';
}

function vis(p: WorldLandmark): number {
  return p?.visibility ?? 0;
}

// ─── Angle extraction ───

function extractAngle(wl: WorldLandmark[], lift: Lift, arm: 'left' | 'right'): number | null {
  let a: WorldLandmark, b: WorldLandmark, c: WorldLandmark;
  if (lift === 'lateral_raise') {
    const hip = arm === 'left' ? wl[L_HIP] : wl[R_HIP];
    const shoulder = arm === 'left' ? wl[L_SHOULDER] : wl[R_SHOULDER];
    const elbow = arm === 'left' ? wl[L_ELBOW] : wl[R_ELBOW];
    a = hip; b = shoulder; c = elbow;
  } else {
    const shoulder = arm === 'left' ? wl[L_SHOULDER] : wl[R_SHOULDER];
    const elbow = arm === 'left' ? wl[L_ELBOW] : wl[R_ELBOW];
    const wrist = arm === 'left' ? wl[L_WRIST] : wl[R_WRIST];
    a = shoulder; b = elbow; c = wrist;
  }

  if (vis(a) < VIS_THRESHOLD || vis(b) < VIS_THRESHOLD || vis(c) < VIS_THRESHOLD) {
    return null;
  }

  return angleDeg(a, b, c);
}

function angleDeg(a: WorldLandmark, vertex: WorldLandmark, c: WorldLandmark): number {
  const v1x = a.x - vertex.x, v1y = a.y - vertex.y, v1z = a.z - vertex.z;
  const v2x = c.x - vertex.x, v2y = c.y - vertex.y, v2z = c.z - vertex.z;
  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const m1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
  const m2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);
  if (m1 < 1e-9 || m2 < 1e-9) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2)))) * (180 / Math.PI);
}

// ─── Sample rate helpers ───

function estimateSampleRate(timestamps: number[]): number {
  if (timestamps.length < 2) return 15;
  const duration = timestamps[timestamps.length - 1] - timestamps[0];
  if (duration <= 0) return 15;
  return (timestamps.length - 1) / duration;
}

function secToOddSamples(sec: number, sampleRate: number): number {
  let n = Math.round(sec * sampleRate);
  if (n < 3) n = 3;
  if (n % 2 === 0) n += 1;
  return n;
}

// ─── Outlier removal ───

/**
 * Nulls samples that deviate from their local median by more than maxDev degrees.
 * Requires at least 2 non-null neighbors (excluding self) to judge; otherwise
 * keeps the sample. Run before bridging so spikes don't propagate.
 */
function removeOutliers(
  angles: (number | null)[],
  windowSize: number,
  maxDev: number,
): (number | null)[] {
  const result: (number | null)[] = [...angles];
  const half = Math.floor(windowSize / 2);

  for (let i = 0; i < angles.length; i++) {
    if (angles[i] === null) continue;
    const neighbors: number[] = [];
    const lo = Math.max(0, i - half);
    const hi = Math.min(angles.length - 1, i + half);
    for (let j = lo; j <= hi; j++) {
      if (j === i) continue;
      const v = angles[j];
      if (v !== null) neighbors.push(v);
    }
    if (neighbors.length < 2) continue;
    neighbors.sort((a, b) => a - b);
    const median = neighbors[Math.floor(neighbors.length / 2)];
    if (Math.abs(angles[i]! - median) > maxDev) {
      result[i] = null;
    }
  }
  return result;
}

// ─── Bridging ───

function bridgeDropouts(
  angles: (number | null)[],
  timestamps: number[],
  maxGapSec: number,
): (number | null)[] {
  const result = [...angles];
  let lastValid: number | null = null;
  let lastValidTime = -Infinity;

  for (let i = 0; i < result.length; i++) {
    if (result[i] !== null) {
      lastValid = result[i];
      lastValidTime = timestamps[i];
    } else if (lastValid !== null && (timestamps[i] - lastValidTime) <= maxGapSec) {
      result[i] = lastValid;
    }
  }
  return result;
}

// ─── Smoothing ───

function savitzkyGolay(angles: (number | null)[], windowSize: number): (number | null)[] {
  const kernel = SG_KERNELS[windowSize] ?? SG_KERNELS[5];
  const result: (number | null)[] = [...angles];
  const half = Math.floor(kernel.length / 2);

  for (let i = half; i < angles.length - half; i++) {
    let sum = 0;
    let allValid = true;
    for (let j = 0; j < kernel.length; j++) {
      const v = angles[i - half + j];
      if (v === null) { allValid = false; break; }
      sum += kernel[j] * v;
    }
    if (allValid) result[i] = sum;
  }
  return result;
}

// ─── Rep detection ───

/**
 * For elbow-angle lifts (curl, bench, overhead, pulldown), a rep cycle is:
 *   extended (high angle) → flexed (low angle) → extended (high angle)
 *
 * For lateral raise (shoulder abduction), a rep cycle is:
 *   adducted (low angle) → abducted (high angle) → adducted
 */
function detectReps(
  smoothed: (number | null)[],
  timestamps: number[],
  lowThreshold: number,
  highThreshold: number,
  lift: Lift,
): RepDetail[] {
  const isAbduction = lift === 'lateral_raise';
  const reps: RepDetail[] = [];
  let state: 'waiting' | 'inRep' = 'waiting';
  let repStartIdx = -1;
  let peakAngle = -Infinity;
  let troughAngle = Infinity;
  let crossIdx = -1;

  for (let i = 0; i < smoothed.length; i++) {
    const angle = smoothed[i];
    if (angle === null) continue;

    if (isAbduction) {
      if (state === 'waiting') {
        if (angle > lowThreshold) {
          state = 'inRep';
          repStartIdx = i;
          peakAngle = angle;
          troughAngle = angle;
          crossIdx = -1;
        }
      } else {
        peakAngle = Math.max(peakAngle, angle);
        troughAngle = Math.min(troughAngle, angle);
        if (angle >= highThreshold) crossIdx = i;
        if (angle < lowThreshold && crossIdx > -1) {
          const rom = peakAngle - troughAngle;
          const duration = timestamps[i] - timestamps[repStartIdx];
          if (duration >= MIN_REP_SEC && duration <= MAX_REP_SEC && rom >= MIN_ROM_DEGREES) {
            reps.push({
              index: reps.length + 1,
              startTime: timestamps[repStartIdx],
              endTime: timestamps[i],
              romDegrees: rom,
              concentricSec: timestamps[crossIdx] - timestamps[repStartIdx],
              eccentricSec: timestamps[i] - timestamps[crossIdx],
            });
          }
          state = 'waiting';
        }
      }
    } else {
      if (state === 'waiting') {
        if (angle < highThreshold) {
          state = 'inRep';
          repStartIdx = i;
          peakAngle = angle;
          troughAngle = angle;
          crossIdx = -1;
        }
      } else {
        peakAngle = Math.max(peakAngle, angle);
        troughAngle = Math.min(troughAngle, angle);
        if (angle <= lowThreshold) crossIdx = i;
        if (angle > highThreshold && crossIdx > -1) {
          const rom = peakAngle - troughAngle;
          const duration = timestamps[i] - timestamps[repStartIdx];
          if (duration >= MIN_REP_SEC && duration <= MAX_REP_SEC && rom >= MIN_ROM_DEGREES) {
            reps.push({
              index: reps.length + 1,
              startTime: timestamps[repStartIdx],
              endTime: timestamps[i],
              romDegrees: rom,
              concentricSec: timestamps[crossIdx] - timestamps[repStartIdx],
              eccentricSec: timestamps[i] - timestamps[crossIdx],
            });
          }
          state = 'waiting';
        }
      }
    }
  }

  return reps;
}
