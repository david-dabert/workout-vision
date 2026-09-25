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
 * Rep detection: Savitzky–Golay smoothed angle crosses a low threshold (from
 * extended/abducted) and a high threshold (from flexed/adducted) derived from
 * the set's own 10th/90th percentile range. A rep is one full cycle
 * (cross low → cross high → cross low) whose duration falls within [minRepSec, maxRepSec].
 *
 * Every parameter is in seconds or degrees, never frames.
 *
 * References (fixed parameters only):
 *   Savitzky–Golay window: 5 points at 15 fps ≈ 333 ms, standard for
 *     biomechanical signal smoothing (Winter, "Biomechanics and Motor Control
 *     of Human Movement", 4th ed., ch. 2).
 *   Rep duration bounds: 0.4–8.0 s covers controlled eccentrics through
 *     explosive concentrics across standard resistance exercises (Schoenfeld
 *     et al., "Resistance Training Recommendations", ACSM, 2009).
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

// Savitzky–Golay quadratic, 5-point kernel (symmetric, preserves peaks)
const SG5 = [-3, 12, 17, 12, -3].map(v => v / 35);

// Unvalidated starting values — recorded per PLAN.md rule
const BRIDGE_GAP_SEC = 0.5;      // max dropout to bridge
const MIN_REP_SEC = 0.4;         // shortest plausible rep
const MAX_REP_SEC = 8.0;         // longest plausible rep
const PERCENTILE_LOW = 10;       // for threshold from set's own range
const PERCENTILE_HIGH = 90;
const THRESHOLD_MARGIN = 0.20;   // fraction of range added as hysteresis band
const MIN_ROM_DEGREES = 20;      // minimum ROM to accept a rep
const VIS_THRESHOLD = 0.5;       // per-joint visibility floor

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

  // 3. Bridge short dropouts
  const bridged = bridgeDropouts(rawAngles, timestamps, BRIDGE_GAP_SEC);

  // 4. Smooth with Savitzky–Golay
  const smoothed = savitzkyGolay(bridged);

  // 5. Compute thresholds from the set's own range
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

  // 6. Detect reps via threshold crossings
  const reps = detectReps(smoothed, timestamps, lowThreshold, highThreshold, lift);

  // 7. Confidence: fraction of samples with a detected pose on the tracked arm
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
      // For lateral raise, we need hip + shoulder + elbow
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
    // Shoulder abduction: hip–shoulder–elbow
    const hip = arm === 'left' ? wl[L_HIP] : wl[R_HIP];
    const shoulder = arm === 'left' ? wl[L_SHOULDER] : wl[R_SHOULDER];
    const elbow = arm === 'left' ? wl[L_ELBOW] : wl[R_ELBOW];
    a = hip; b = shoulder; c = elbow;
  } else {
    // Elbow angle: shoulder–elbow–wrist
    const shoulder = arm === 'left' ? wl[L_SHOULDER] : wl[R_SHOULDER];
    const elbow = arm === 'left' ? wl[L_ELBOW] : wl[R_ELBOW];
    const wrist = arm === 'left' ? wl[L_WRIST] : wl[R_WRIST];
    a = shoulder; b = elbow; c = wrist;
  }

  // Check visibility of all three joints
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

function savitzkyGolay(angles: (number | null)[]): (number | null)[] {
  const result: (number | null)[] = [...angles];
  const half = Math.floor(SG5.length / 2);

  for (let i = half; i < angles.length - half; i++) {
    let sum = 0;
    let allValid = true;
    for (let j = 0; j < SG5.length; j++) {
      const v = angles[i - half + j];
      if (v === null) { allValid = false; break; }
      sum += SG5[j] * v;
    }
    if (allValid) result[i] = sum;
  }
  return result;
}

// ─── Rep detection ───

/**
 * For elbow-angle lifts (curl, bench, overhead, pulldown), a rep cycle is:
 *   extended (high angle) → flexed (low angle) → extended (high angle)
 * The "low" crossing marks peak flexion, the return to "high" completes the rep.
 *
 * For lateral raise (shoulder abduction), a rep cycle is:
 *   adducted (low angle, arms at sides) → abducted (high angle, arms raised) → adducted
 *
 * We unify by tracking: cross below lowThreshold, then cross above highThreshold.
 * For elbow lifts this is natural (extended → flexed → extended).
 * For lateral raise, we invert: the signal goes low→high→low, so we
 * swap thresholds to detect abduction reps correctly.
 */
function detectReps(
  smoothed: (number | null)[],
  timestamps: number[],
  lowThreshold: number,
  highThreshold: number,
  lift: Lift,
): RepDetail[] {
  // For lateral raise, reps go from low (arms down) → high (arms up) → low.
  // For elbow lifts, reps go from high (extended) → low (flexed) → high.
  // We normalise: "phase A" is the first half, "phase B" is the return.
  const isAbduction = lift === 'lateral_raise';

  // In both cases we detect: cross threshold A → cross threshold B → that's one rep.
  // Elbow lifts: A = drop below high, B = rise above high after touching low
  // Lateral raise: A = rise above low, B = drop below low after touching high

  const reps: RepDetail[] = [];
  let state: 'waiting' | 'inRep' = 'waiting';
  let repStartIdx = -1;
  let peakAngle = -Infinity;
  let troughAngle = Infinity;
  let crossIdx = -1; // index where the mid-rep extremum was reached

  for (let i = 0; i < smoothed.length; i++) {
    const angle = smoothed[i];
    if (angle === null) continue;

    if (isAbduction) {
      // Lateral raise: arms start down (low angle ~15°), rise to ~90-110°, return.
      // Rep starts when angle rises above lowThreshold, ends when it drops back below lowThreshold
      // after having been above highThreshold.
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
          // Rep complete
          const rom = peakAngle - troughAngle;
          const duration = timestamps[i] - timestamps[repStartIdx];
          if (duration >= MIN_REP_SEC && duration <= MAX_REP_SEC && rom >= MIN_ROM_DEGREES) {
            const concentricEnd = timestamps[crossIdx];
            reps.push({
              index: reps.length + 1,
              startTime: timestamps[repStartIdx],
              endTime: timestamps[i],
              romDegrees: rom,
              concentricSec: concentricEnd - timestamps[repStartIdx],
              eccentricSec: timestamps[i] - concentricEnd,
            });
          }
          state = 'waiting';
        }
      }
    } else {
      // Elbow lifts: arms start extended (high angle ~170°), flex to ~50°, return.
      // Rep starts when angle drops below highThreshold, ends when it rises back above highThreshold
      // after having been below lowThreshold.
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
          // Rep complete
          const rom = peakAngle - troughAngle;
          const duration = timestamps[i] - timestamps[repStartIdx];
          if (duration >= MIN_REP_SEC && duration <= MAX_REP_SEC && rom >= MIN_ROM_DEGREES) {
            const eccentricEnd = timestamps[crossIdx];
            reps.push({
              index: reps.length + 1,
              startTime: timestamps[repStartIdx],
              endTime: timestamps[i],
              romDegrees: rom,
              concentricSec: eccentricEnd - timestamps[repStartIdx],
              eccentricSec: timestamps[i] - eccentricEnd,
            });
          }
          state = 'waiting';
        }
      }
    }
  }

  return reps;
}
