/**
 * Biomechanical analysis engine.
 *
 * Analyzes landmark frames from a set to produce time under tension,
 * range of motion, asymmetry, and movement quality metrics.
 * All metrics derived from joint angles and frame timing only;
 * no pixel-displacement velocity (monocular 2D pose cannot produce it).
 *
 * Accepts raw landmark arrays (as passed by VideoUpload) and rep boundaries
 * from RepCounter (single source of truth for rep detection).
 *
 * References:
 *   - Schoenfeld BJ, 2015, J Strength Cond Res (time under tension)
 *   - Kiesel K et al, 2007, N Am J Sports Phys Ther (asymmetry >15%)
 */

import type {
  Landmark,
  LandmarkArray,
  JointAngles,
  RepBoundary,
  BiomechanicalAnalysis,
  TimeUnderTensionResult,
  TUTPerRep,
  RangeOfMotionResult,
  AsymmetryResult,
  AsymmetryRisk,
  VelocityResult,
  CompiledExercise,
} from './types';
import { extractJointAngles, LANDMARKS } from './poseAnalysis';
import { EXERCISES } from './exercises';
import { lookupExercise } from './exerciseOntology';
import {
  NORM_TO_METERS_DEFAULT,
  ASYMMETRY_VIS_MIN,
} from './analysisConfig';

// ─── Internal types ───

interface NormalizedRep {
  start: number;
  bottom: number;
  end: number;
}

// Default height in meters for velocity normalization.
// Overridden by user's actual height when available.
let NORM_TO_METERS = NORM_TO_METERS_DEFAULT;

/**
 * Set the user's height for accurate velocity calculations.
 * Called once from the analysis pipeline when profile is available.
 */
export function setUserHeight(heightCm: number): void {
  if (heightCm && heightCm > 100 && heightCm < 250) {
    NORM_TO_METERS = heightCm / 100;
  }
}

/**
 * Compute midpoint of two landmarks.
 */
function midpoint(a: Landmark | null | undefined, b: Landmark | null | undefined): Landmark {
  if (!a || !b) return (a || b || { x: 0, y: 0, z: 0 }) as Landmark;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z || 0) + (b.z || 0)) / 2,
  };
}

/**
 * Analyze a complete set.
 *
 * @param landmarkFrames - array of raw landmark arrays OR {landmarks} objects
 * @param fps - capture frame rate
 * @param exerciseKey - key into EXERCISES
 * @param externalReps - optional rep boundaries from RepCounter
 *   Each entry: { startFrame, bottomFrame, endFrame }
 * @returns analysis results
 */
export function analyzeSet(
  landmarkFrames: Array<LandmarkArray | { landmarks: LandmarkArray }>,
  fps: number,
  exerciseKey: string,
  externalReps?: RepBoundary[],
): BiomechanicalAnalysis {
  if (!landmarkFrames || landmarkFrames.length < 2) return emptyResult();

  const exercise = (EXERCISES as Record<string, CompiledExercise>)[exerciseKey] as CompiledExercise | undefined;
  if (!exercise) return emptyResult();

  // Normalize: accept both raw landmark arrays and {landmarks} objects
  const rawFrames: LandmarkArray[] = landmarkFrames.map(f =>
    Array.isArray(f) ? f : ((f as { landmarks: LandmarkArray }).landmarks || f) as LandmarkArray,
  );

  // Extract angles for every frame
  const anglesPerFrame: (JointAngles | null)[] = rawFrames.map(lm => extractJointAngles(lm));
  const validAngles = anglesPerFrame.filter((a): a is JointAngles => a !== null);
  if (validAngles.length < 2) return emptyResult();

  // Get tracking values (some exercises like calf_raise need landmarks too)
  const trackingValues: (number | null)[] = anglesPerFrame.map((a, i) =>
    a ? exercise.getValue(a, rawFrames[i]) : null,
  );

  // Rep boundaries come from RepCounter (single source of truth).
  // If RepCounter found 0 reps, biomechanics returns empty — no rescue algo.
  if (!externalReps || externalReps.length === 0) return emptyResult();
  const reps: NormalizedRep[] = externalReps.map(r => ({
    start: Math.min(r.startFrame, rawFrames.length - 1),
    bottom: Math.min(r.bottomFrame, rawFrames.length - 1),
    end: Math.min(r.endFrame, rawFrames.length - 1),
  })).filter(r => r.start >= 0 && r.bottom >= 0 && r.end >= 0 && r.end > r.start);
  if (reps.length === 0) return emptyResult();

  // Analyze each metric
  // For pulling exercises (rows, pulldowns, curls), the angle decreases during
  // concentric (pulling) and increases during eccentric (releasing).
  // This is opposite to pushing/squatting exercises.
  // Derive from ontology movementClass + exercise key name.
  // Classes named *_pull are pulling. Mixed classes (upper_vertical has
  // pulldown + press; upper_isolation has curl + pushdown; upper_horizontal
  // has row + press) require checking the exercise key name.
  const info = lookupExercise(exerciseKey);
  const mc: string = info?.movementClass || '';
  const keyLC = exerciseKey.toLowerCase();
  const isPulling = mc.includes('pull')
    || mc === 'upper_pull_supine'
    || keyLC.includes('curl')
    || keyLC.includes('pulldown')
    || keyLC.includes('pull_up') || keyLC.includes('chin_up')
    || keyLC.includes('row')
    || keyLC.includes('pullover');

  const timeUnderTension = analyzeTUT(reps, fps, isPulling);
  const rangeOfMotion = analyzeROM(trackingValues, reps);
  const asymmetry = analyzeAsymmetry(anglesPerFrame);
  const movementQuality = scoreQuality(timeUnderTension, rangeOfMotion, asymmetry);

  return {
    timeUnderTension,
    rangeOfMotion,
    asymmetry,
    movementQuality,
  };
}

function emptyResult(): BiomechanicalAnalysis {
  return {
    timeUnderTension: { total: 0, eccentric: 0, concentric: 0, perRep: [] },
    rangeOfMotion: { avgDegrees: 0, perRep: [], consistency: 100 },
    asymmetry: { score: 0, details: {}, risk: 'low' },
    movementQuality: 0,
  };
}

/**
 * Velocity analysis using wrist/hip displacement during concentric phase.
 * Uses worldLandmarks (metric-scale, in meters) when available for accurate
 * displacement. Falls back to normalized landmarks * NORM_TO_METERS if not.
 *
 * @param rawFrames - raw landmark arrays per frame
 * @param fps - frames per second
 * @param reps - rep boundaries
 * @param exercise - exercise definition
 * @param isPulling - true for pulling exercises
 * @param worldFrames - optional worldLandmarks per frame (metric-scale)
 */
function analyzeVelocity(
  rawFrames: LandmarkArray[],
  fps: number,
  reps: NormalizedRep[],
  exercise: CompiledExercise,
  isPulling = false,
  worldFrames: LandmarkArray[] | null = null,
): VelocityResult {
  if (reps.length === 0) {
    return { avg: 0, perRep: [], trend: 'trend_insufficient' };
  }

  const isLower = ['knee', 'hip'].includes((exercise as { joint?: string }).joint || '');
  const timeDelta = 1 / fps;
  const hasWorld = worldFrames && worldFrames.length === rawFrames.length;

  const perRep: number[] = reps.map(rep => {
    // For pushing exercises: concentric = bottom->end (angle increasing)
    // For pulling exercises: concentric = start->bottom (angle decreasing)
    const concentricStart = isPulling ? rep.start : rep.bottom;
    const concentricEnd = isPulling ? rep.bottom : rep.end;
    if (concentricStart >= concentricEnd || concentricEnd >= rawFrames.length) return 0;

    // Sum frame-to-frame displacements across the entire concentric phase
    // instead of just measuring endpoint displacement. This captures the
    // actual path traveled and is more accurate at low FPS.
    let totalDisplacement = 0;
    for (let i = concentricStart; i < concentricEnd; i++) {
      // Prefer worldLandmarks (already in meters) over normalized + scale factor
      const useWorld = hasWorld && worldFrames![i] && worldFrames![i + 1];
      const lm1 = useWorld ? worldFrames![i] : rawFrames[i];
      const lm2 = useWorld ? worldFrames![i + 1] : rawFrames[i + 1];
      if (!lm1 || !lm2) continue;
      // worldLandmarks are already in meters; normalized need scaling
      const scale = useWorld ? 1 : NORM_TO_METERS;

      let p1: Landmark, p2: Landmark;
      if (isLower) {
        p1 = midpoint(lm1[LANDMARKS.LEFT_HIP], lm1[LANDMARKS.RIGHT_HIP]);
        p2 = midpoint(lm2[LANDMARKS.LEFT_HIP], lm2[LANDMARKS.RIGHT_HIP]);
      } else {
        p1 = midpoint(lm1[LANDMARKS.LEFT_WRIST], lm1[LANDMARKS.RIGHT_WRIST]);
        p2 = midpoint(lm2[LANDMARKS.LEFT_WRIST], lm2[LANDMARKS.RIGHT_WRIST]);
      }

      const dx = (p2.x - p1.x) * scale;
      const dy = (p2.y - p1.y) * scale;
      const dz = ((p2.z || 0) - (p1.z || 0)) * scale;
      totalDisplacement += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    const duration = (concentricEnd - concentricStart) * timeDelta;
    return duration > 0 ? round(totalDisplacement / duration, 3) : 0;
  });

  const valid = perRep.filter(v => v > 0);
  const avg = valid.length > 0 ? valid.reduce((s, v) => s + v, 0) / valid.length : 0;

  let trend = 'trend_stable';
  if (valid.length >= 3) {
    const firstHalf = valid.slice(0, Math.floor(valid.length / 2));
    const secondHalf = valid.slice(Math.floor(valid.length / 2));
    const f = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const l = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
    const change = ((l - f) / (f || 1)) * 100;
    if (change < -15) trend = 'trend_fatigue';
    else if (change < -5) trend = 'trend_declining';
    else if (change > 10) trend = 'trend_warmup';
  }

  return { avg: round(avg, 3), perRep, trend };
}

/**
 * Time under tension per rep.
 */
function analyzeTUT(reps: NormalizedRep[], fps: number, isPulling = false): TimeUnderTensionResult {
  if (reps.length === 0) {
    return { total: 0, eccentric: 0, concentric: 0, perRep: [] };
  }

  const perRep: TUTPerRep[] = reps.map(rep => {
    // start→bottom = angle decreasing; bottom→end = angle increasing
    // For pushing/squat: decreasing = eccentric, increasing = concentric
    // For pulling/row: decreasing = concentric, increasing = eccentric
    const phaseA = (rep.bottom - rep.start) / fps;
    const phaseB = (rep.end - rep.bottom) / fps;
    const eccentric = isPulling ? round(phaseB, 2) : round(phaseA, 2);
    const concentric = isPulling ? round(phaseA, 2) : round(phaseB, 2);
    return {
      eccentric,
      concentric,
      total: round(phaseA + phaseB, 2),
    };
  });

  const totalEcc = perRep.reduce((s, r) => s + r.eccentric, 0);
  const totalCon = perRep.reduce((s, r) => s + r.concentric, 0);

  return {
    total: round(totalEcc + totalCon, 2),
    eccentric: round(totalEcc, 2),
    concentric: round(totalCon, 2),
    perRep,
  };
}

/**
 * Range of motion per rep in degrees.
 */
function analyzeROM(values: (number | null)[], reps: NormalizedRep[]): RangeOfMotionResult {
  if (reps.length === 0) {
    return { avgDegrees: 0, perRep: [], consistency: 100 };
  }

  const perRep: number[] = reps.map(rep => {
    // Search a small window around each boundary for the best non-null value
    const getVal = (idx: number, searchUp: boolean): number => {
      if (values[idx] != null) return values[idx]!;
      // Search up to 3 frames in each direction for a valid value
      for (let d = 1; d <= 3; d++) {
        if (searchUp && idx + d < values.length && values[idx + d] != null) return values[idx + d]!;
        if (!searchUp && idx - d >= 0 && values[idx - d] != null) return values[idx - d]!;
        if (idx + d < values.length && values[idx + d] != null) return values[idx + d]!;
        if (idx - d >= 0 && values[idx - d] != null) return values[idx - d]!;
      }
      return 0;
    };
    const topStart = getVal(rep.start, true);
    const topEnd = getVal(rep.end, false);
    const top = Math.max(topStart, topEnd);
    const bottom = getVal(rep.bottom, false);
    return round(Math.abs(top - bottom), 1);
  });

  const valid = perRep.filter(v => v > 0);
  const avg = valid.length > 0 ? valid.reduce((s, v) => s + v, 0) / valid.length : 0;

  let consistency = 100;
  if (valid.length >= 2 && avg > 0) {
    const variance = valid.reduce((s, v) => s + (v - avg) ** 2, 0) / valid.length;
    const cv = (Math.sqrt(variance) / avg) * 100;
    // CV under 15% is excellent form consistency; scale gently
    consistency = Math.max(0, Math.round(100 - cv));
  }

  return { avgDegrees: round(avg, 1), perRep, consistency };
}

/**
 * Bilateral asymmetry from angle data.
 * Kiesel 2007: >15% indicates elevated injury risk.
 */
function analyzeAsymmetry(anglesArray: (JointAngles | null)[]): AsymmetryResult {
  // Visibility keys matching the _vis* fields from extractJointAngles
  const pairs: [string, string, string, string, string][] = [
    ['leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee', 'Knee'],
    ['leftHip', 'rightHip', '_visLeftHip', '_visRightHip', 'Hip'],
    ['leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow', 'Elbow'],
    ['leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder', 'Shoulder'],
  ];

  const VIS_MIN = ASYMMETRY_VIS_MIN; // only compare sides when both are well-tracked

  const details: Record<string, number> = {};
  let total = 0;
  let count = 0;

  for (const [left, right, visLeft, visRight, name] of pairs) {
    const valid = anglesArray.filter((a): a is JointAngles => a !== null);
    let filtered = valid.filter(a => {
      const lv = a[visLeft] || 0;
      const rv = a[visRight] || 0;
      return lv >= VIS_MIN && rv >= VIS_MIN;
    });
    // Fallback: if threshold rejects everything, use all non-null frames
    if (filtered.length === 0) filtered = valid;
    const diffs = filtered.map(a => {
        const dominant = Math.max(a[left], a[right]);
        return dominant > 5 ? (Math.abs(a[left] - a[right]) / dominant) * 100 : 0;
      });
    const avg = diffs.length > 0 ? diffs.reduce((s, v) => s + v, 0) / diffs.length : 0;
    details[name] = round(avg, 1);
    total += avg;
    count++;
  }

  const score = count > 0 ? round(total / count, 1) : 0;
  return {
    score,
    details,
    risk: (score > 15 ? 'elevated' : score > 10 ? 'moderate' : 'low') as AsymmetryRisk,
  };
}


/**
 * Composite movement quality score 0-100.
 * Weighted components: ROM consistency (45%), symmetry (30%),
 * tempo control (25%). Only uses data derivable from joint angles
 * and frame timing; no pixel-velocity components.
 */
function scoreQuality(
  tut: TimeUnderTensionResult,
  rom: RangeOfMotionResult,
  asymmetry: AsymmetryResult,
): number {
  // ROM consistency: 0-45 points
  const romScore = Math.min(45, Math.max(0, (rom.consistency || 0) * 0.45));

  // Symmetry: 0-30 points
  let symScore = 30;
  if (asymmetry.score > 25) symScore = 6;
  else if (asymmetry.score > 20) symScore = 12;
  else if (asymmetry.score > 15) symScore = 18;
  else if (asymmetry.score > 10) symScore = 24;

  // Tempo control: 0-25 points (controlled eccentric = better)
  let tempoScore = 12;
  if (tut.perRep.length > 0) {
    const avgRatio = tut.eccentric / (tut.concentric || 1);
    if (avgRatio >= 1.5 && avgRatio <= 3) tempoScore = 25;
    else if (avgRatio >= 1.0 && avgRatio <= 4) tempoScore = 18;
    else if (avgRatio < 0.5 || avgRatio > 5) tempoScore = 6;
  }

  const total = romScore + symScore + tempoScore;
  return Math.max(0, Math.min(100, Math.round(total)));
}

function round(val: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(val * f) / f;
}
