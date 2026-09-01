/**
 * Biomechanical analysis engine.
 *
 * Analyzes landmark frames from a set to produce velocity, time under tension,
 * range of motion, asymmetry, fatigue, and movement quality metrics.
 *
 * Accepts raw landmark arrays (as passed by VideoUpload) and rep boundaries
 * from RepCounter (single source of truth for rep detection).
 *
 * References:
 *   - Gonzalez-Badillo JJ, 2017, Int J Sports Med (velocity zones)
 *   - Schoenfeld BJ, 2015, J Strength Cond Res (time under tension)
 *   - Kiesel K et al, 2007, N Am J Sports Phys Ther (asymmetry >15%)
 *   - Pareja-Blanco F et al, 2017, Int J Sports Physiol Perform (velocity loss)
 */

import { extractJointAngles, LANDMARKS } from './poseAnalysis';
import { EXERCISES } from './exercises';

// Default height in meters for velocity normalization.
// Overridden by user's actual height when available.
let NORM_TO_METERS = 1.7;

/**
 * Set the user's height for accurate velocity calculations.
 * Called once from the analysis pipeline when profile is available.
 */
export function setUserHeight(heightCm) {
  if (heightCm && heightCm > 100 && heightCm < 250) {
    NORM_TO_METERS = heightCm / 100;
  }
}

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
export function analyzeSet(landmarkFrames, fps, exerciseKey, externalReps, userHeightCm) {
  // Use passed height if available, otherwise fall back to module-level value
  if (userHeightCm && userHeightCm > 100 && userHeightCm < 250) {
    NORM_TO_METERS = userHeightCm / 100;
  }
  if (!landmarkFrames || landmarkFrames.length < 2) return emptyResult();

  const exercise = EXERCISES[exerciseKey];
  if (!exercise) return emptyResult();

  // Normalize: accept both raw landmark arrays and {landmarks} objects
  const rawFrames = landmarkFrames.map(f => Array.isArray(f) ? f : (f.landmarks || f));

  // Extract angles for every frame
  const anglesPerFrame = rawFrames.map(lm => extractJointAngles(lm));
  const validAngles = anglesPerFrame.filter(a => a !== null);
  if (validAngles.length < 2) return emptyResult();

  // Get tracking values
  const trackingValues = anglesPerFrame.map(a => a ? exercise.getValue(a) : null);

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

  const velocity = analyzeVelocity(rawFrames, fps, reps, exercise, isPulling);
  const timeUnderTension = analyzeTUT(reps, fps, isPulling);
  const rangeOfMotion = analyzeROM(trackingValues, reps);
  const asymmetry = analyzeAsymmetry(anglesPerFrame);
  const fatigue = analyzeFatigue(velocity, reps);
  const movementQuality = scoreQuality(velocity, timeUnderTension, rangeOfMotion, asymmetry, fatigue);

  return {
    velocity,
    timeUnderTension,
    rangeOfMotion,
    asymmetry,
    fatigue,
    movementQuality,
  };
}

function emptyResult() {
  return {
    velocity: { avg: 0, perRep: [], trend: 'trend_insufficient' },
    timeUnderTension: { total: 0, eccentric: 0, concentric: 0, perRep: [] },
    rangeOfMotion: { avgDegrees: 0, perRep: [], consistency: 100 },
    asymmetry: { score: 0, details: {}, risk: 'low' },
    fatigue: { index: 0, velocityDropoff: 0, curve: [], recommendation: 'fatigue_no_data' },
    movementQuality: 0,
  };
}

/**
 * Velocity analysis using wrist/hip displacement during concentric phase.
 */
function analyzeVelocity(rawFrames, fps, reps, exercise, isPulling = false) {
  if (reps.length === 0) {
    return { avg: 0, perRep: [], trend: 'trend_insufficient' };
  }

  const isLower = ['knee', 'hip'].includes(exercise.joint);
  const timeDelta = 1 / fps;

  const perRep = reps.map(rep => {
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
      const lm1 = rawFrames[i];
      const lm2 = rawFrames[i + 1];
      if (!lm1 || !lm2) continue;

      let p1, p2;
      if (isLower) {
        p1 = midpoint(lm1[LANDMARKS.LEFT_HIP], lm1[LANDMARKS.RIGHT_HIP]);
        p2 = midpoint(lm2[LANDMARKS.LEFT_HIP], lm2[LANDMARKS.RIGHT_HIP]);
      } else {
        p1 = midpoint(lm1[LANDMARKS.LEFT_WRIST], lm1[LANDMARKS.RIGHT_WRIST]);
        p2 = midpoint(lm2[LANDMARKS.LEFT_WRIST], lm2[LANDMARKS.RIGHT_WRIST]);
      }

      const dx = (p2.x - p1.x) * NORM_TO_METERS;
      const dy = (p2.y - p1.y) * NORM_TO_METERS;
      const dz = ((p2.z || 0) - (p1.z || 0)) * NORM_TO_METERS;
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

  const VIS_MIN = 0.5; // only compare sides when both are well-tracked

  const details = {};
  let total = 0;
  let count = 0;

  for (const [left, right, visLeft, visRight, name] of pairs) {
    const diffs = anglesArray
      .filter(a => a !== null)
      .filter(a => {
        // Only include frames where BOTH sides are visible
        const lv = a[visLeft] || 0;
        const rv = a[visRight] || 0;
        return lv >= VIS_MIN && rv >= VIS_MIN;
      })
      .map(a => {
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
 * Fatigue detection from velocity profile.
 * Pareja-Blanco 2017: >20% velocity loss = meaningful fatigue.
 *
 * Uses median of first 2-3 reps as baseline (not peak) to avoid
 * warm-up effect and single-frame tracking spikes corrupting the metric.
 * Compares against median of last 2-3 reps for the dropoff.
 */
function analyzeFatigue(velocity, reps) {
  if (!velocity.perRep || velocity.perRep.length < 2) {
    return { index: 0, velocityDropoff: 0, curve: [], recommendation: 'need_more_reps' };
  }

  const vels = velocity.perRep.filter(v => v > 0);
  if (vels.length < 2) {
    return { index: 0, velocityDropoff: 0, curve: [], recommendation: 'need_more_reps' };
  }

  // Use median of first N and last N reps to resist outliers
  const n = Math.min(3, Math.ceil(vels.length / 3));
  const sortedFirst = vels.slice(0, n).sort((a, b) => a - b);
  const sortedLast = vels.slice(-n).sort((a, b) => a - b);
  const medianFirst = sortedFirst[Math.floor(sortedFirst.length / 2)];
  const medianLast = sortedLast[Math.floor(sortedLast.length / 2)];

  // Skip first rep if it's significantly slower (warm-up effect)
  const baseline = (vels.length >= 4 && vels[0] < medianFirst * 0.8)
    ? vels.slice(1, n + 1).sort((a, b) => a - b)[Math.floor(n / 2)]
    : medianFirst;

  const dropoff = baseline > 0 ? round(((baseline - medianLast) / baseline) * 100, 0) : 0;
  const clampedDropoff = Math.max(0, dropoff); // negative = got faster, not fatigue
  const index = Math.min(100, clampedDropoff);
  const normPeak = Math.max(...vels);
  const curve = vels.map(v => normPeak > 0 ? Math.round((v / normPeak) * 100) : 0);

  let recommendation = 'fatigue_minimal';
  if (clampedDropoff > 30) recommendation = 'fatigue_significant';
  else if (clampedDropoff > 20) recommendation = 'fatigue_moderate';
  else if (clampedDropoff > 10) recommendation = 'fatigue_low';
  else if (dropoff < 0) recommendation = 'fatigue_warmup_effect';

  return { index, velocityDropoff: clampedDropoff, curve, recommendation };
}

/**
 * Composite movement quality score 0-100.
 * Weighted components: ROM consistency (35%), symmetry (25%),
 * tempo control (20%), velocity consistency (10%), fatigue management (10%).
 */
function scoreQuality(velocity, tut, rom, asymmetry, fatigue) {
  // ROM consistency: 0-35 points
  const romScore = Math.min(35, Math.max(0, (rom.consistency || 0) * 0.35));

  // Symmetry: 0-25 points
  let symScore = 25;
  if (asymmetry.score > 25) symScore = 5;
  else if (asymmetry.score > 20) symScore = 10;
  else if (asymmetry.score > 15) symScore = 15;
  else if (asymmetry.score > 10) symScore = 20;

  // Tempo control: 0-20 points (controlled eccentric = better)
  let tempoScore = 10;
  if (tut.perRep.length > 0) {
    const avgRatio = tut.eccentric / (tut.concentric || 1);
    if (avgRatio >= 1.5 && avgRatio <= 3) tempoScore = 20;
    else if (avgRatio >= 1.0 && avgRatio <= 4) tempoScore = 15;
    else if (avgRatio < 0.5 || avgRatio > 5) tempoScore = 5;
  }

  // Velocity consistency: 0-10 points
  let velScore = 5;
  if (velocity.perRep && velocity.perRep.length >= 2) {
    const mean = velocity.perRep.reduce((s, v) => s + v, 0) / velocity.perRep.length;
    if (mean > 0) {
      const variance = velocity.perRep.reduce((s, v) => s + (v - mean) ** 2, 0) / velocity.perRep.length;
      const cv = (Math.sqrt(variance) / mean) * 100;
      if (cv < 10) velScore = 10;
      else if (cv < 20) velScore = 7;
      else if (cv > 40) velScore = 2;
    }
  }

  // Fatigue management: 0-10 points
  let fatigueScore = 5;
  if (fatigue && fatigue.velocityDropoff != null) {
    if (fatigue.velocityDropoff < 10) fatigueScore = 10;
    else if (fatigue.velocityDropoff < 20) fatigueScore = 7;
    else if (fatigue.velocityDropoff > 35) fatigueScore = 2;
  }

  const total = romScore + symScore + tempoScore + velScore + fatigueScore;
  return Math.max(0, Math.min(100, Math.round(total)));
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z || 0) + (b.z || 0)) / 2,
  };
}

function round(val, decimals) {
  const f = 10 ** decimals;
  return Math.round(val * f) / f;
}

