/**
 * Counting core — pure function, no DOM, no detection.
 *
 * In:  timestamped world landmarks (from MediaPipe PoseLandmarker) and a lift name.
 * Out: rep count, per-rep detail (start/end time, ROM, durations), side used, confidence.
 *
 * One joint angle per lift, from world-landmark 3D vectors (LIFTS below):
 *   elbow    shoulder–elbow–wrist   curl, rows, triceps pushdown, bench and overhead press, lat pulldown
 *   shoulder hip–shoulder–elbow     lateral raise
 *   knee     hip–knee–ankle         squat, leg press, leg extension, leg curl, lunge
 *   hip      shoulder–hip–knee      Romanian deadlift, hip thrust
 * Which joint moves each lift, and which phase lifts the load (concentric) or
 * yields to it (eccentric), is standard kinesiology (Neumann, Kinesiology of the
 * Musculoskeletal System, 3rd ed., 2017). No per-lift parameter is set.
 *
 * Side selection: the side whose three joint landmarks have the highest average
 * visibility across the set. Short dropouts (< bridgeGap) are filled with the last
 * valid angle; the side never alternates frame by frame. The alternating curl
 * counts both arms and joins them (countBothSides).
 *
 * Signal conditioning pipeline: outlier removal → bridge dropouts → Savitzky–Golay.
 * Outlier removal nulls samples that deviate from their local median by more
 * than OUTLIER_DEVIATION_DEG (rejects pose-estimation glitches without
 * attenuating shallow reps). SG smoothing then operates on clean data.
 * All windows are defined in seconds and converted to samples at runtime.
 *
 * Rep detection: smoothed angle crosses a low and a high threshold derived from the
 * set's own 10th/90th percentile range, leaving the rest end and coming back to it.
 * A rep is one full cycle whose duration falls within [minRepSec, maxRepSec].
 * Its reported start and end are then placed where the angle leaves and regains
 * its rest level (placeBoundaries), so a rest that hovers near a threshold does
 * not move them; its range and phases are measured between them.
 *
 * Every parameter is in seconds or degrees, never frames.
 *
 * References (fixed parameters only):
 *   Rep duration bounds: 0.5–8.0 s covers controlled eccentrics through
 *     explosive concentrics across standard resistance exercises (Schoenfeld,
 *     Ogborn & Krieger, "Effect of Repetition Duration During Resistance
 *     Training on Muscle Hypertrophy", Sports Medicine 2015; 45(4):577-85).
 *   Savitzky–Golay window, outlier parameters, the rest band and the overlap
 *     that joins two arms: unvalidated starting values. Not derived from a
 *     specific published recommendation.
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
  peakSpeed: number;    // highest frame-to-frame angular speed within the rep, degrees/second
  meanSpeed: number;    // average frame-to-frame angular speed within the rep, degrees/second
  side?: 'left' | 'right' | 'both'; // alternating curl only: the arm that did it
  clipped?: boolean;    // the video starts or ends inside this rep: counted, but its times are not whole
}

export interface CountResult {
  count: number;
  reps: RepDetail[];
  arm: 'left' | 'right' | 'both'; // the side tracked; 'both' for the alternating curl
  confidence: number;   // 0–1
  angles: (number | null)[];          // raw angle per sample
  smoothedAngles: (number | null)[];  // after SG + bridge
  lowThreshold: number;
  highThreshold: number;
  sides?: { left: CountResult; right: CountResult }; // alternating curl only
}

export type Joint = 'elbow' | 'shoulder' | 'knee' | 'hip';

export interface LiftDefinition {
  joint: Joint;
  /** Where the angle rests between reps: at the high end (extended) or the low end. */
  rest: 'high' | 'low';
  /** The phase that leaves the rest: lifting the load (concentric) or yielding to it (eccentric). */
  first: 'concentric' | 'eccentric';
  /** Both sides counted and joined, one rep per arm (the alternating curl). */
  bothSides?: boolean;
}

export const LIFTS = {
  bicep_curl: { joint: 'elbow', rest: 'high', first: 'concentric' },
  bicep_curl_alternating: { joint: 'elbow', rest: 'high', first: 'concentric', bothSides: true },
  lat_pulldown: { joint: 'elbow', rest: 'high', first: 'concentric' },
  seated_row: { joint: 'elbow', rest: 'high', first: 'concentric' },
  dumbbell_row: { joint: 'elbow', rest: 'high', first: 'concentric' },
  triceps_pushdown: { joint: 'elbow', rest: 'low', first: 'concentric' },
  // Presses rest at lockout, so the bar comes down first. To be confirmed on their build sets.
  bench_press: { joint: 'elbow', rest: 'high', first: 'eccentric' },
  overhead_press: { joint: 'elbow', rest: 'high', first: 'eccentric' },
  lateral_raise: { joint: 'shoulder', rest: 'low', first: 'concentric' },
  squat: { joint: 'knee', rest: 'high', first: 'eccentric' },
  leg_press: { joint: 'knee', rest: 'high', first: 'eccentric' },
  leg_extension: { joint: 'knee', rest: 'low', first: 'concentric' },
  leg_curl: { joint: 'knee', rest: 'high', first: 'concentric' },
  lunge: { joint: 'knee', rest: 'high', first: 'eccentric' },
  romanian_deadlift: { joint: 'hip', rest: 'high', first: 'eccentric' },
  hip_thrust: { joint: 'hip', rest: 'low', first: 'concentric' },
} as const satisfies Record<string, LiftDefinition>;

export type Lift = keyof typeof LIFTS;

// ─── Constants ───

// Landmark indices (MediaPipe Pose, 33-point model)
const L_SHOULDER = 11, R_SHOULDER = 12;
const L_ELBOW = 13, R_ELBOW = 14;
const L_WRIST = 15, R_WRIST = 16;
const L_HIP = 23, R_HIP = 24;
const L_KNEE = 25, R_KNEE = 26;
const L_ANKLE = 27, R_ANKLE = 28;

// Each joint's three landmarks (first point, vertex, last point), per side.
// The replay draws the same three, so what it lights is what was measured.
export const JOINT_POINTS: Record<Joint, { left: [number, number, number]; right: [number, number, number] }> = {
  elbow: { left: [L_SHOULDER, L_ELBOW, L_WRIST], right: [R_SHOULDER, R_ELBOW, R_WRIST] },
  shoulder: { left: [L_HIP, L_SHOULDER, L_ELBOW], right: [R_HIP, R_SHOULDER, R_ELBOW] },
  knee: { left: [L_HIP, L_KNEE, L_ANKLE], right: [R_HIP, R_KNEE, R_ANKLE] },
  hip: { left: [L_SHOULDER, L_HIP, L_KNEE], right: [R_SHOULDER, R_HIP, R_KNEE] },
};

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
const REST_BAND_FRACTION = 0.10;  // a rep leaves its rest when the angle is this share of the set's range away from it
const REST_BAND_MIN_DEG = 3;      // … and never less than this many degrees
const REST_LEVEL_MIN_SEC = 0.3;   // shortest stay at rest whose median gives the rest level; below it, the extreme is used
const RETURN_WINDOW_SEC = 2;     // how long after its working half a rep's fullest return is looked for
const EXTREME_HOLD_SEC = 1 / 3;   // each end of a rep's range is the mean of its most extreme third of a second, not one sample
const TOGETHER_OVERLAP = 0.75;    // two arms' reps overlapping by this share of the shorter one are one rep, both arms together

// ─── Public API ───

export function countReps(
  worldLandmarks: WorldLandmarkFrame[],
  timestamps: number[],
  lift: Lift,
): CountResult {
  const def: LiftDefinition = LIFTS[lift] ?? LIFTS.bicep_curl;
  if (def.bothSides) return countBothSides(worldLandmarks, timestamps, def);
  return countSide(worldLandmarks, timestamps, def, selectSide(worldLandmarks, def.joint));
}

function countSide(
  worldLandmarks: WorldLandmarkFrame[],
  timestamps: number[],
  def: LiftDefinition,
  arm: 'left' | 'right',
): CountResult {
  // 1. Extract raw angle per sample
  const rawAngles = worldLandmarks.map(wl => {
    if (!wl) return null;
    return extractAngle(wl, def.joint, arm);
  });

  // 2. Estimate sample rate from timestamps
  const sampleRate = estimateSampleRate(timestamps);

  // 3. Remove outliers (before bridging, so spikes don't propagate)
  const outlierSize = secToOddSamples(OUTLIER_WINDOW_SEC, sampleRate);
  const cleaned = removeOutliers(rawAngles, outlierSize, OUTLIER_DEVIATION_DEG);

  // 4. Bridge short dropouts
  const bridged = bridgeDropouts(cleaned, timestamps, BRIDGE_GAP_SEC);

  // 5. Smooth with Savitzky–Golay (window in seconds)
  const sgSize = secToOddSamples(SG_WINDOW_SEC, sampleRate);
  const smoothed = savitzkyGolay(bridged, sgSize);

  // 6. Compute thresholds from the set's own range
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

  // 7. Detect reps via threshold crossings, then place their boundaries at the rest
  const cycles = detectReps(smoothed, timestamps, lowThreshold, highThreshold, def.rest);
  const band = Math.max(REST_BAND_MIN_DEG, range * REST_BAND_FRACTION);
  const reps = placeBoundaries(cycles, smoothed, timestamps, lowThreshold, highThreshold, band, def);

  // 8. Confidence: fraction of samples with a detected pose on the tracked side
  const totalSamples = worldLandmarks.length;
  const detectedSamples = rawAngles.filter(a => a !== null).length;
  const confidence = totalSamples > 0 ? detectedSamples / totalSamples : 0;

  return { count: reps.length, reps, arm, confidence, angles: rawAngles, smoothedAngles: smoothed, lowThreshold, highThreshold };
}

// ─── Both arms: the alternating curl ───

/**
 * Each arm is counted on its own, then the two lists are joined in time order:
 * a rep of one arm that overlaps a rep of the other by more than TOGETHER_OVERLAP
 * of the shorter is the same rep done with both arms together and counts once;
 * every other rep counts for its arm (David, 27 September: one rep per arm).
 * The count needs both arms in view, so the confidence is the lower of the two.
 */
function countBothSides(worldLandmarks: WorldLandmarkFrame[], timestamps: number[], def: LiftDefinition): CountResult {
  const left = countSide(worldLandmarks, timestamps, def, 'left');
  const right = countSide(worldLandmarks, timestamps, def, 'right');
  const all = [
    ...left.reps.map(r => ({ ...r, side: 'left' as const })),
    ...right.reps.map(r => ({ ...r, side: 'right' as const })),
  ].sort((a, b) => a.startTime - b.startTime);
  const joined: RepDetail[] = [];
  for (const r of all) {
    const last = joined[joined.length - 1];
    if (last && last.side !== 'both' && last.side !== r.side) {
      const overlap = Math.min(last.endTime, r.endTime) - Math.max(last.startTime, r.startTime);
      const shorter = Math.min(last.endTime - last.startTime, r.endTime - r.startTime);
      if (overlap > TOGETHER_OVERLAP * shorter) {
        last.side = 'both';
        last.startTime = Math.min(last.startTime, r.startTime);
        last.endTime = Math.max(last.endTime, r.endTime);
        last.romDegrees = Math.max(last.romDegrees, r.romDegrees);
        last.peakSpeed = Math.max(last.peakSpeed, r.peakSpeed);
        last.meanSpeed = Math.max(last.meanSpeed, r.meanSpeed);
        continue;
      }
    }
    joined.push({ ...r });
  }
  joined.forEach((r, i) => { r.index = i + 1; });
  const primary = left.reps.length >= right.reps.length ? left : right;
  return {
    count: joined.length,
    reps: joined,
    arm: 'both',
    confidence: Math.min(left.confidence, right.confidence),
    angles: primary.angles,
    smoothedAngles: primary.smoothedAngles,
    lowThreshold: primary.lowThreshold,
    highThreshold: primary.highThreshold,
    sides: { left, right },
  };
}

// ─── Side selection ───

function selectSide(worldLandmarks: WorldLandmarkFrame[], joint: Joint): 'left' | 'right' {
  const [la, lb, lc] = JOINT_POINTS[joint].left;
  const [ra, rb, rc] = JOINT_POINTS[joint].right;
  let lVis = 0, rVis = 0, count = 0;
  for (const wl of worldLandmarks) {
    if (!wl) continue;
    count++;
    lVis += vis(wl[la]) + vis(wl[lb]) + vis(wl[lc]);
    rVis += vis(wl[ra]) + vis(wl[rb]) + vis(wl[rc]);
  }
  if (count === 0) return 'left';
  return lVis >= rVis ? 'left' : 'right';
}

function vis(p: WorldLandmark): number {
  return p?.visibility ?? 0;
}

// ─── Angle extraction ───

function extractAngle(wl: WorldLandmark[], joint: Joint, arm: 'left' | 'right'): number | null {
  const [ia, ib, ic] = JOINT_POINTS[joint][arm];
  const a = wl[ia], b = wl[ib], c = wl[ic];
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
 * A rep leaves the rest end and comes back to it, crossing both thresholds:
 *   rest high (curl, rows, presses, pulldown, squat…): high → low → high
 *   rest low (lateral raise, triceps pushdown, leg extension, hip thrust): low → high → low
 * Returns each accepted cycle as sample indices: where the state machine entered
 * the rep, and where it completed it. Which cycles count is decided here alone.
 */
interface Cycle { enter: number; complete: number }

function detectReps(
  smoothed: (number | null)[],
  timestamps: number[],
  lowThreshold: number,
  highThreshold: number,
  rest: 'high' | 'low',
): Cycle[] {
  const restsLow = rest === 'low';
  const cycles: Cycle[] = [];
  let state: 'waiting' | 'inRep' = 'waiting';
  let repStartIdx = -1;
  let peakAngle = -Infinity;
  let troughAngle = Infinity;
  let crossIdx = -1;

  for (let i = 0; i < smoothed.length; i++) {
    const angle = smoothed[i];
    if (angle === null) continue;

    if (restsLow) {
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
            cycles.push({ enter: repStartIdx, complete: i });
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
            cycles.push({ enter: repStartIdx, complete: i });
          }
          state = 'waiting';
        }
      }
    }
  }

  return cycles;
}

// ─── Rep boundaries (step 3c) ───

/**
 * Where a counted rep starts and ends, and what it measured. The state machine
 * enters a rep where the angle first crosses a threshold, which a rest hovering
 * near that threshold moves with every flicker of noise. Here each rep is anchored
 * on its working half instead: the samples past the midpoint of the two thresholds.
 * - Start: walking back from the first of them, the last sample still within
 *   `band` of the rest level before it (the median of the rest-side samples since
 *   the previous rep, or their extreme when the set barely pauses).
 * - End: walking on from the last of them, the first sample back within `band`
 *   of the rest level after it (looked for over at most RETURN_WINDOW_SEC).
 * - Range: from the working extreme to the furthest rest-side level of the rep,
 *   the level it left or the fullest return it reached, so no boundary sample
 *   decides it.
 * - Clipped: a rep with no rest before it or after it inside the video (the
 *   recording started or stopped during it) is counted, but its times are marked
 *   as not whole.
 * - Phases: the first runs from the start to the moment the angle comes within
 *   `band` of the working extreme, the second from the moment it leaves that band
 *   to the end; a pause at the working end belongs to neither. Which phase is
 *   concentric depends on the lift.
 */
function placeBoundaries(
  cycles: Cycle[],
  smoothed: (number | null)[],
  timestamps: number[],
  lowThreshold: number,
  highThreshold: number,
  band: number,
  def: LiftDefinition,
): RepDetail[] {
  const restsLow = def.rest === 'low';
  const mid = (lowThreshold + highThreshold) / 2;
  const working = (a: number) => (restsLow ? a > mid : a < mid);
  const near = (a: number, level: number) => (restsLow ? a <= level + band : a >= level - band);
  const furtherOut = (a: number, b: number) => (restsLow ? Math.min(a, b) : Math.max(a, b));
  const sampleRate = estimateSampleRate(timestamps);
  const returnWindow = Math.max(1, Math.round(RETURN_WINDOW_SEC * sampleRate));
  // One sample is the least stable point of the curve; two browsers decoding the same video
  // disagree most there. An end of the range is the mean of the most extreme third of a second.
  const hold = Math.max(1, Math.round(EXTREME_HOLD_SEC * sampleRate));
  const heldExtreme = (values: number[], lowest: boolean): number => {
    const most = [...values].sort((x, y) => (lowest ? x - y : y - x)).slice(0, hold);
    return most.reduce((sum, v) => sum + v, 0) / most.length;
  };

  // The working half of each cycle: its first and last samples past the midpoint.
  const halves = cycles.map(c => {
    let first = -1, last = -1;
    for (let i = c.enter; i <= c.complete; i++) {
      const a = smoothed[i];
      if (a === null || !working(a)) continue;
      if (first < 0) first = i;
      last = i;
    }
    return first < 0 ? { first: c.enter, last: c.complete } : { first, last };
  });

  const restLevel = (from: number, to: number): number | null => {
    const side: number[] = [];
    for (let i = Math.max(0, from); i < Math.min(smoothed.length, to); i++) {
      const a = smoothed[i];
      if (a !== null && !working(a)) side.push(a);
    }
    if (!side.length) return null;
    side.sort((x, y) => x - y);
    if (side.length >= REST_LEVEL_MIN_SEC * sampleRate) return side[Math.floor(side.length / 2)];
    return restsLow ? side[0] : side[side.length - 1];
  };

  let firstValid = 0, lastValid = smoothed.length - 1;
  while (firstValid < smoothed.length && smoothed[firstValid] === null) firstValid++;
  while (lastValid > 0 && smoothed[lastValid] === null) lastValid--;

  const reps: RepDetail[] = [];
  let previousEnd = 0;
  cycles.forEach((c, k) => {
    const { first, last } = halves[k];
    const nextFirst = k + 1 < halves.length ? halves[k + 1].first : smoothed.length;

    // The working extreme, held
    const workValues: number[] = [];
    for (let i = first; i <= last; i++) {
      const a = smoothed[i];
      if (a !== null) workValues.push(a);
    }
    const work = workValues.length ? heldExtreme(workValues, !restsLow) : smoothed[first] ?? 0;

    // Start: leaving the rest level
    let start = c.enter;
    const left = restLevel(previousEnd, first);
    if (left !== null) {
      for (let i = first - 1; i >= previousEnd; i--) {
        const a = smoothed[i];
        if (a !== null && near(a, left)) { start = i; break; }
      }
    }

    // End: back at the rest level; the fullest return reached on the way
    const windowEnd = Math.min(nextFirst, last + 1 + returnWindow);
    let end = c.complete;
    const after = restLevel(last + 1, windowEnd);
    const returned: number[] = [];
    for (let i = last + 1; i < windowEnd; i++) {
      const a = smoothed[i];
      if (a !== null && !working(a)) returned.push(a);
    }
    const reached = returned.length ? heldExtreme(returned, restsLow) : null;
    if (after !== null) {
      for (let i = last + 1; i < windowEnd; i++) {
        const a = smoothed[i];
        if (a !== null && near(a, after)) { end = i; break; }
      }
    }
    if (end <= start) { start = c.enter; end = c.complete; }

    // The working end: from first reaching the band around the extreme to leaving it
    let workFrom = -1, workTo = -1;
    for (let i = start; i <= end; i++) {
      const a = smoothed[i];
      if (a === null || (restsLow ? a < work - band : a > work + band)) continue;
      if (workFrom < 0) workFrom = i;
      workTo = i;
    }
    if (workFrom < 0) { workFrom = first; workTo = last; }

    const outer = [left, reached].filter((v): v is number => v !== null).reduce(furtherOut, restsLow ? Infinity : -Infinity);
    const rom = Number.isFinite(outer) ? Math.abs(outer - work) : Math.abs((smoothed[start] ?? work) - work);
    const firstSec = timestamps[workFrom] - timestamps[start];
    const secondSec = timestamps[end] - timestamps[workTo];
    const clipped = left === null || after === null || start <= firstValid || end >= lastValid;
    // Angular speed from the smoothed angle, frame to frame.
    let peak = 0, speedSum = 0, speedN = 0;
    for (let i = start; i < end; i++) {
      const a0 = smoothed[i], a1 = smoothed[i + 1];
      if (a0 === null || a1 === null) continue;
      const dt = timestamps[i + 1] - timestamps[i];
      if (dt <= 0) continue;
      const s = Math.abs(a1 - a0) / dt;
      if (s > peak) peak = s;
      speedSum += s;
      speedN++;
    }
    reps.push({
      index: reps.length + 1,
      startTime: timestamps[start],
      endTime: timestamps[end],
      romDegrees: rom,
      concentricSec: def.first === 'concentric' ? firstSec : secondSec,
      eccentricSec: def.first === 'concentric' ? secondSec : firstSec,
      peakSpeed: peak,
      meanSpeed: speedN > 0 ? speedSum / speedN : 0,
      ...(clipped ? { clipped: true } : {}),
    });
    previousEnd = end;
  });
  return reps;
}
