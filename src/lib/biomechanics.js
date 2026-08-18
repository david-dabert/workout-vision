/**
 * Biomechanical analysis engine.
 *
 * Analyzes landmark frames from a set to produce velocity, time under tension,
 * range of motion, asymmetry, fatigue, and movement quality metrics.
 *
 * Accepts raw landmark arrays (as passed by VideoUpload) and does its own
 * rep detection from joint angle data.
 *
 * References:
 *   - Gonzalez-Badillo JJ, 2017, Int J Sports Med (velocity zones)
 *   - Schoenfeld BJ, 2015, J Strength Cond Res (time under tension)
 *   - Kiesel K et al, 2007, N Am J Sports Phys Ther (asymmetry >15%)
 *   - Pareja-Blanco F et al, 2017, Int J Sports Physiol Perform (velocity loss)
 */

import { extractJointAngles, LANDMARKS } from './poseAnalysis';
import { EXERCISES } from './exercises';

const NORM_TO_METERS = 1.7;

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

  // Get tracking values
  const trackingValues = anglesPerFrame.map(a => a ? exercise.getValue(a) : null);

  // Use external rep boundaries from RepCounter if available and non-empty;
  // otherwise fall back to internal peak-valley detection.
  let reps;
  if (externalReps && externalReps.length > 0) {
    reps = externalReps.map(r => ({
      start: Math.min(r.startFrame, rawFrames.length - 1),
      bottom: Math.min(r.bottomFrame, rawFrames.length - 1),
      end: Math.min(r.endFrame, rawFrames.length - 1),
    })).filter(r => r.start >= 0 && r.bottom >= 0 && r.end >= 0 && r.end > r.start);
  } else {
    reps = detectReps(trackingValues);
  }

  // Analyze each metric
  // For pulling exercises (rows, pulldowns, curls), the angle decreases during
  // concentric (pulling) and increases during eccentric (releasing).
  // This is opposite to pushing/squatting exercises.
  const isPulling = ['chest_supported_row', 'seated_row', 'lat_pulldown', 'bent_over_row',
    'pull_up', 'bicep_curl', 'leg_curl'].includes(exerciseKey);

  const velocity = analyzeVelocity(rawFrames, fps, reps, exercise);
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
    velocity: { avg: 0, perRep: [], trend: 'insufficient data' },
    timeUnderTension: { total: 0, eccentric: 0, concentric: 0, perRep: [] },
    rangeOfMotion: { avgDegrees: 0, perRep: [], consistency: 100 },
    asymmetry: { score: 0, details: {}, risk: 'low' },
    fatigue: { index: 0, velocityDropoff: 0, curve: [], recommendation: 'Need more data.' },
    movementQuality: 0,
  };
}

/**
 * Detect rep boundaries from tracking values using threshold crossings
 * with a simple state machine.
 */
/**
 * Detect reps using peak-valley detection on the angle signal.
 * No fixed thresholds needed — finds oscillation patterns by detecting
 * local maxima and minima with sufficient prominence.
 *
 * Works for any exercise regardless of absolute angle values.
 */
function detectReps(values) {
  // Fill nulls with linear interpolation
  const filled = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== null) {
      filled.push(values[i]);
    } else if (filled.length > 0) {
      filled.push(filled[filled.length - 1]);
    }
  }
  if (filled.length < 6) return [];

  // At low frame counts (< 30 frames, i.e. ~10s at 3fps), skip smoothing
  // because a 3-point average spans 1 second and flattens the signal
  const smooth = [];
  if (filled.length < 30) {
    smooth.push(...filled);
  } else {
    for (let i = 0; i < filled.length; i++) {
      if (i === 0 || i === filled.length - 1) {
        smooth.push(filled[i]);
      } else {
        smooth.push((filled[i - 1] + filled[i] + filled[i + 1]) / 3);
      }
    }
  }

  // Find all peaks (local maxima) and valleys (local minima)
  const peaks = [];
  const valleys = [];
  for (let i = 1; i < smooth.length - 1; i++) {
    if (smooth[i] >= smooth[i - 1] && smooth[i] >= smooth[i + 1] && smooth[i] > smooth[i - 1]) {
      peaks.push({ idx: i, val: smooth[i] });
    }
    if (smooth[i] <= smooth[i - 1] && smooth[i] <= smooth[i + 1] && smooth[i] < smooth[i - 1]) {
      valleys.push({ idx: i, val: smooth[i] });
    }
  }

  // Merge peaks and valleys into alternating sequence
  const extrema = [
    ...peaks.map(p => ({ ...p, type: 'peak' })),
    ...valleys.map(v => ({ ...v, type: 'valley' })),
  ].sort((a, b) => a.idx - b.idx);

  // Remove consecutive same-type extrema (keep most extreme)
  const alternating = [];
  for (const e of extrema) {
    if (alternating.length === 0 || alternating[alternating.length - 1].type !== e.type) {
      alternating.push(e);
    } else {
      const prev = alternating[alternating.length - 1];
      if (e.type === 'peak' && e.val > prev.val) alternating[alternating.length - 1] = e;
      if (e.type === 'valley' && e.val < prev.val) alternating[alternating.length - 1] = e;
    }
  }

  // Compute minimum prominence: 30% of total signal range, minimum 12 degrees
  const globalMin = Math.min(...smooth);
  const globalMax = Math.max(...smooth);
  const globalRange = globalMax - globalMin;
  const minProminence = Math.max(12, globalRange * 0.3);

  // Minimum frames between extrema (~1 second)
  const minFrameGap = 3;

  // Filter: only keep extrema pairs with sufficient prominence AND time gap
  const significant = [];
  for (let i = 0; i < alternating.length; i++) {
    if (significant.length === 0) {
      significant.push(alternating[i]);
      continue;
    }
    const prev = significant[significant.length - 1];
    const diff = Math.abs(alternating[i].val - prev.val);
    const gap = alternating[i].idx - prev.idx;

    if (diff >= minProminence && gap >= minFrameGap) {
      significant.push(alternating[i]);
    } else if (alternating[i].type === prev.type) {
      // Same type: keep the more extreme one
      if ((alternating[i].type === 'peak' && alternating[i].val > prev.val) ||
          (alternating[i].type === 'valley' && alternating[i].val < prev.val)) {
        significant[significant.length - 1] = alternating[i];
      }
    }
  }

  // Build reps from full cycles: peak-valley-peak or valley-peak-valley
  const reps = [];
  for (let i = 0; i < significant.length - 2; i++) {
    const a = significant[i];
    const b = significant[i + 1];
    const c = significant[i + 2];

    if (a.type === c.type && a.type !== b.type) {
      reps.push({
        start: a.idx,
        bottom: b.idx,
        end: c.idx,
      });
      i++; // skip one, next rep starts from c
    }
  }

  console.log(`[detectReps] signal range: ${globalMin.toFixed(0)}-${globalMax.toFixed(0)} (${globalRange.toFixed(0)}°), minProm=${minProminence.toFixed(0)}, significant=${significant.length}, reps=${reps.length}`);
  return reps;
}

/**
 * Velocity analysis using wrist/hip displacement during concentric phase.
 */
function analyzeVelocity(rawFrames, fps, reps, exercise) {
  if (reps.length === 0) {
    return { avg: 0, perRep: [], trend: 'insufficient data' };
  }

  const isLower = ['knee', 'hip'].includes(exercise.joint);
  const timeDelta = 1 / fps;

  const perRep = reps.map(rep => {
    if (rep.bottom >= rep.end || rep.end >= rawFrames.length) return 0;

    const lm1 = rawFrames[rep.bottom];
    const lm2 = rawFrames[rep.end];
    if (!lm1 || !lm2) return 0;

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
    const displacement = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const duration = (rep.end - rep.bottom) * timeDelta;

    return duration > 0 ? round(displacement / duration, 3) : 0;
  });

  const valid = perRep.filter(v => v > 0);
  const avg = valid.length > 0 ? valid.reduce((s, v) => s + v, 0) / valid.length : 0;

  let trend = 'stable';
  if (valid.length >= 3) {
    const firstHalf = valid.slice(0, Math.floor(valid.length / 2));
    const secondHalf = valid.slice(Math.floor(valid.length / 2));
    const f = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const l = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
    const change = ((l - f) / (f || 1)) * 100;
    if (change < -15) trend = 'declining (fatigue)';
    else if (change < -5) trend = 'slightly declining';
    else if (change > 10) trend = 'increasing (warm-up)';
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
    const top = Math.max(values[rep.start] || 0, values[rep.end] || 0);
    const bottom = values[rep.bottom] || 0;
    return round(Math.abs(top - bottom), 1);
  });

  const valid = perRep.filter(v => v > 0);
  const avg = valid.length > 0 ? valid.reduce((s, v) => s + v, 0) / valid.length : 0;

  let consistency = 100;
  if (valid.length >= 2 && avg > 0) {
    const variance = valid.reduce((s, v) => s + (v - avg) ** 2, 0) / valid.length;
    const cv = (Math.sqrt(variance) / avg) * 100;
    consistency = Math.max(0, Math.round(100 - cv * 2));
  }

  return { avgDegrees: round(avg, 1), perRep, consistency };
}

/**
 * Bilateral asymmetry from angle data.
 * Kiesel 2007: >15% indicates elevated injury risk.
 */
function analyzeAsymmetry(anglesArray) {
  const pairs = [
    ['leftKnee', 'rightKnee', 'Knee'],
    ['leftHip', 'rightHip', 'Hip'],
    ['leftElbow', 'rightElbow', 'Elbow'],
    ['leftShoulder', 'rightShoulder', 'Shoulder'],
  ];

  const details = {};
  let total = 0;
  let count = 0;

  for (const [left, right, name] of pairs) {
    const diffs = anglesArray
      .filter(a => a !== null)
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
 */
function analyzeFatigue(velocity, reps) {
  if (!velocity.perRep || velocity.perRep.length < 2) {
    return { index: 0, velocityDropoff: 0, curve: [], recommendation: 'Need more reps.' };
  }

  const vels = velocity.perRep;
  const peak = Math.max(...vels);
  const last = vels[vels.length - 1];
  const dropoff = peak > 0 ? round(((peak - last) / peak) * 100, 0) : 0;
  const index = Math.min(100, Math.max(0, dropoff));
  const curve = vels.map(v => peak > 0 ? Math.round((v / peak) * 100) : 0);

  let recommendation = '';
  if (dropoff > 30) recommendation = 'Significant fatigue. Consider reducing volume or increasing rest.';
  else if (dropoff > 20) recommendation = 'Moderate fatigue. Good for hypertrophy (Pareja-Blanco 2017).';
  else if (dropoff > 10) recommendation = 'Low fatigue. Good for strength without excessive fatigue.';
  else recommendation = 'Minimal fatigue. Could increase intensity or volume.';

  return { index, velocityDropoff: dropoff, curve, recommendation };
}

/**
 * Composite movement quality score 0-100.
 */
function scoreQuality(velocity, tut, rom, asymmetry, fatigue) {
  let score = 70;

  // ROM consistency (30% weight)
  score += (rom.consistency - 70) * 0.3;

  // Asymmetry penalty
  if (asymmetry.score < 5) score += 10;
  else if (asymmetry.score < 10) score += 5;
  else if (asymmetry.score > 20) score -= 15;
  else if (asymmetry.score > 15) score -= 10;

  // TUT ratio bonus (controlled eccentric)
  if (tut.perRep.length > 0) {
    const avgRatio = tut.eccentric / (tut.concentric || 1);
    if (avgRatio >= 1.2 && avgRatio <= 3) score += 5;
  }

  // Velocity consistency
  if (velocity.perRep && velocity.perRep.length >= 2) {
    const mean = velocity.perRep.reduce((s, v) => s + v, 0) / velocity.perRep.length;
    if (mean > 0) {
      const variance = velocity.perRep.reduce((s, v) => s + (v - mean) ** 2, 0) / velocity.perRep.length;
      const cv = (Math.sqrt(variance) / mean) * 100;
      if (cv < 10) score += 5;
      else if (cv > 30) score -= 10;
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
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

