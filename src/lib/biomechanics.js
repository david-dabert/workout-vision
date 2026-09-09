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

import { extractJointAngles } from './poseAnalysis';
import { EXERCISES } from './exercises';

/**
 * Analyze a complete set.
 *
 * @param {Array} landmarkFrames - array of raw landmark arrays OR {landmarks} objects
 * @param {number} fps - capture frame rate
 * @param {string} exerciseKey - key into EXERCISES
 * @param {Array} [externalReps] - optional rep boundaries from RepCounter
 *   Each entry: { startFrame, bottomFrame, endFrame }
 * @returns {Object} analysis results
 */
export function analyzeSet(landmarkFrames, fps, exerciseKey, externalReps) {
  if (!landmarkFrames || landmarkFrames.length < 2) return emptyResult();

  const exercise = EXERCISES[exerciseKey];
  if (!exercise) return emptyResult();

  // Normalize: accept both raw landmark arrays and {landmarks} objects
  const rawFrames = landmarkFrames.map(f => Array.isArray(f) ? f : (f.landmarks || f));

  // Extract angles for every frame
  const anglesPerFrame = rawFrames.map(lm => extractJointAngles(lm));
  const validAngles = anglesPerFrame.filter(a => a !== null);
  if (validAngles.length < 2) return emptyResult();

  // Get tracking values (some exercises like calf_raise need landmarks too)
  const trackingValues = anglesPerFrame.map((a, i) => a ? exercise.getValue(a, rawFrames[i]) : null);

  // Rep boundaries come from RepCounter (single source of truth).
  // If RepCounter found 0 reps, biomechanics returns empty — no rescue algo.
  if (!externalReps || externalReps.length === 0) return emptyResult();
  const reps = externalReps.map(r => ({
    start: Math.min(r.startFrame, rawFrames.length - 1),
    bottom: Math.min(r.bottomFrame, rawFrames.length - 1),
    end: Math.min(r.endFrame, rawFrames.length - 1),
  })).filter(r => r.start >= 0 && r.bottom >= 0 && r.end >= 0 && r.end > r.start);
  if (reps.length === 0) return emptyResult();

  // Analyze each metric
  // For pulling exercises (rows, pulldowns, curls), the angle decreases during
  // concentric (pulling) and increases during eccentric (releasing).
  // This is opposite to pushing/squatting exercises.
  const isPulling = ['chest_supported_row', 'seated_row', 'lat_pulldown', 'bent_over_row',
    'pull_up', 'bicep_curl', 'leg_curl'].includes(exerciseKey);

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

function emptyResult() {
  return {
    timeUnderTension: { total: 0, eccentric: 0, concentric: 0, perRep: [] },
    rangeOfMotion: { avgDegrees: 0, perRep: [], consistency: 100 },
    asymmetry: { score: 0, details: {}, risk: 'low' },
    movementQuality: 0,
  };
}


/**
 * Time under tension per rep.
 */
function analyzeTUT(reps, fps, isPulling = false) {
  if (reps.length === 0) {
    return { total: 0, eccentric: 0, concentric: 0, perRep: [] };
  }

  const perRep = reps.map(rep => {
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
function analyzeROM(values, reps) {
  if (reps.length === 0) {
    return { avgDegrees: 0, perRep: [], consistency: 100 };
  }

  const perRep = reps.map(rep => {
    // Search a small window around each boundary for the best non-null value
    const getVal = (idx, searchUp) => {
      if (values[idx] != null) return values[idx];
      // Search up to 3 frames in each direction for a valid value
      for (let d = 1; d <= 3; d++) {
        if (searchUp && idx + d < values.length && values[idx + d] != null) return values[idx + d];
        if (!searchUp && idx - d >= 0 && values[idx - d] != null) return values[idx - d];
        if (idx + d < values.length && values[idx + d] != null) return values[idx + d];
        if (idx - d >= 0 && values[idx - d] != null) return values[idx - d];
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
function analyzeAsymmetry(anglesArray) {
  // Visibility keys matching the _vis* fields from extractJointAngles
  const pairs = [
    ['leftKnee', 'rightKnee', '_visLeftKnee', '_visRightKnee', 'Knee'],
    ['leftHip', 'rightHip', '_visLeftHip', '_visRightHip', 'Hip'],
    ['leftElbow', 'rightElbow', '_visLeftElbow', '_visRightElbow', 'Elbow'],
    ['leftShoulder', 'rightShoulder', '_visLeftShoulder', '_visRightShoulder', 'Shoulder'],
  ];

  const VIS_MIN = 0.25; // lowered from 0.5: many exercises have partial occlusion on one side

  const details = {};
  let total = 0;
  let count = 0;

  for (const [left, right, visLeft, visRight, name] of pairs) {
    const valid = anglesArray.filter(a => a !== null);
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
    risk: score > 15 ? 'elevated' : score > 10 ? 'moderate' : 'low',
  };
}


/**
 * Composite movement quality score 0-100.
 * Weighted components: ROM consistency (45%), symmetry (30%),
 * tempo control (25%). Only uses data derivable from joint angles
 * and frame timing; no pixel-velocity components.
 */
function scoreQuality(tut, rom, asymmetry) {
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

function round(val, decimals) {
  const f = 10 ** decimals;
  return Math.round(val * f) / f;
}

