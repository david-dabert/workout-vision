/**
 * coachingEngine.js — Biomechanical coaching intelligence.
 *
 * Takes raw landmark frames and rep boundaries from the analysis pipeline,
 * computes metrics that no browser-based tool currently ships together:
 *   - SPARC movement smoothness (Balasubramanian et al., 2015)
 *   - DTW rep-to-rep consistency
 *   - Per-rep velocity profiles with fatigue detection
 *   - Specific form detections: squat depth, knee valgus, lockout,
 *     trunk lean, bar path drift, elbow flare
 *   - Center of mass trajectory
 *   - Prioritized natural-language coaching feedback
 *
 * All metrics computed from 33 MediaPipe landmarks. No additional models.
 * Pure signal processing on data that already exists in the pipeline.
 *
 * References:
 *   - Balasubramanian S et al., 2015, J NeuroEngineering Rehab (SPARC)
 *   - Kiesel K et al., 2007, N Am J Sports Phys Ther (asymmetry >15%)
 *   - Baker D, 2001, J Strength Cond Res (20% velocity loss = fatigue)
 *   - de Leva P, 1996, J Biomech (anthropometric segment parameters)
 */

import { LANDMARKS } from './poseGeometry';

// ─── Utility ───

function dist3D(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function angle3D(a, b, c) {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);
  if (magBA === 0 || magBC === 0) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (magBA * magBC)))) * 180 / Math.PI;
}

function midpoint(a, b) {
  if (!a || !b) return a || b || { x: 0, y: 0, z: 0 };
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z || 0) + (b.z || 0)) / 2 };
}

function round(v, d) { const f = 10 ** d; return Math.round(v * f) / f; }

// ─── SPARC: Spectral Arc Length (movement smoothness) ───
// Balasubramanian et al., 2015. The most robust smoothness metric.
// Computed from the normalized magnitude spectrum of the speed profile.
// More negative = less smooth. Range: roughly -1.5 (very smooth) to -7 (jerky).

function computeSPARC(speedProfile, fps) {
  const N = speedProfile.length;
  if (N < 8) return null;

  // Zero-pad to next power of 2
  let fftSize = 1;
  while (fftSize < N) fftSize *= 2;
  const padded = new Array(fftSize).fill(0);
  for (let i = 0; i < N; i++) padded[i] = speedProfile[i];

  // Real FFT via DFT (no external library needed for this size)
  const mag = new Array(fftSize / 2).fill(0);
  for (let k = 0; k < fftSize / 2; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < fftSize; n++) {
      const angle = -2 * Math.PI * k * n / fftSize;
      re += padded[n] * Math.cos(angle);
      im += padded[n] * Math.sin(angle);
    }
    mag[k] = Math.sqrt(re * re + im * im);
  }

  // Normalize magnitude spectrum
  const maxMag = Math.max(...mag);
  if (maxMag === 0) return null;
  const norm = mag.map(m => m / maxMag);

  // Frequency resolution
  const df = fps / fftSize;

  // Cut at 20 Hz (above is noise for human movement)
  const maxBin = Math.min(norm.length, Math.ceil(20 / df));

  // Arc length of the normalized magnitude spectrum
  let arcLength = 0;
  for (let k = 1; k < maxBin; k++) {
    const dMag = norm[k] - norm[k - 1];
    const dFreq = df; // uniform frequency spacing
    arcLength += Math.sqrt(dMag * dMag + (dFreq / 20) ** 2);
  }

  // SPARC is negative arc length (more negative = less smooth)
  return round(-arcLength, 3);
}

// ─── DTW: Dynamic Time Warping for rep consistency ───
// Measures how similar each rep's trajectory is to the template (median rep).
// Lower DTW distance = more consistent form across reps.

function dtwDistance(a, b) {
  const n = a.length, m = b.length;
  if (n === 0 || m === 0) return Infinity;

  // Downsample long signals for performance (DTW is O(n*m))
  const maxLen = 100;
  const sa = n > maxLen ? downsample(a, maxLen) : a;
  const sb = m > maxLen ? downsample(b, maxLen) : b;
  const N = sa.length, M = sb.length;

  const dtw = new Array(N + 1);
  for (let i = 0; i <= N; i++) {
    dtw[i] = new Array(M + 1).fill(Infinity);
  }
  dtw[0][0] = 0;

  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      const cost = Math.abs(sa[i - 1] - sb[j - 1]);
      dtw[i][j] = cost + Math.min(dtw[i - 1][j], dtw[i][j - 1], dtw[i - 1][j - 1]);
    }
  }

  // Normalize by path length
  return dtw[N][M] / (N + M);
}

function downsample(arr, targetLen) {
  const result = new Array(targetLen);
  const ratio = arr.length / targetLen;
  for (let i = 0; i < targetLen; i++) {
    result[i] = arr[Math.floor(i * ratio)];
  }
  return result;
}

// ─── Per-rep signal extraction ───

function extractRepSignal(landmarks, startFrame, endFrame, jointFn) {
  const signal = [];
  for (let i = startFrame; i <= endFrame && i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (!lm) { signal.push(null); continue; }
    signal.push(jointFn(lm));
  }
  return signal.filter(v => v !== null);
}

// ─── Form detections ───

function detectSquatDepth(landmarks, repBoundaries) {
  if (!repBoundaries || repBoundaries.length === 0) return null;

  const perRep = repBoundaries.map(rep => {
    const lm = landmarks[rep.bottomFrame];
    if (!lm) return null;
    const hipMid = midpoint(lm[LANDMARKS.LEFT_HIP], lm[LANDMARKS.RIGHT_HIP]);
    const kneeMid = midpoint(lm[LANDMARKS.LEFT_KNEE], lm[LANDMARKS.RIGHT_KNEE]);
    // In MediaPipe normalized coords, Y increases downward
    // Hip below knee = hipMid.y > kneeMid.y
    const belowParallel = hipMid.y > kneeMid.y;
    const depthRatio = round((hipMid.y - kneeMid.y) / Math.max(0.001, Math.abs(kneeMid.y - midpoint(lm[LANDMARKS.LEFT_ANKLE], lm[LANDMARKS.RIGHT_ANKLE]).y)), 2);
    return { belowParallel, depthRatio };
  }).filter(v => v !== null);

  if (perRep.length === 0) return null;
  const belowCount = perRep.filter(r => r.belowParallel).length;
  return {
    perRep,
    avgBelowParallel: belowCount / perRep.length,
    allBelowParallel: belowCount === perRep.length,
  };
}

function detectKneeValgus(landmarks, repBoundaries) {
  if (!repBoundaries || repBoundaries.length === 0) return null;

  const perRep = repBoundaries.map(rep => {
    const lm = landmarks[rep.bottomFrame];
    if (!lm) return null;
    const kneeDistance = Math.abs(lm[LANDMARKS.LEFT_KNEE].x - lm[LANDMARKS.RIGHT_KNEE].x);
    const ankleDistance = Math.abs(lm[LANDMARKS.LEFT_ANKLE].x - lm[LANDMARKS.RIGHT_ANKLE].x);
    if (ankleDistance < 0.001) return null;
    const ratio = round(kneeDistance / ankleDistance, 2);
    // Kiesel: ratio < 0.8 indicates valgus
    return { ratio, valgusDetected: ratio < 0.8 };
  }).filter(v => v !== null);

  if (perRep.length === 0) return null;
  const valgusCount = perRep.filter(r => r.valgusDetected).length;
  return {
    perRep,
    valgusRate: round(valgusCount / perRep.length, 2),
    detected: valgusCount > perRep.length * 0.3,
  };
}

function detectLockout(landmarks, repBoundaries, exerciseKey) {
  if (!repBoundaries || repBoundaries.length === 0) return null;

  const isLower = exerciseKey.includes('squat') || exerciseKey.includes('deadlift') ||
                  exerciseKey.includes('lunge') || exerciseKey.includes('leg') ||
                  exerciseKey.includes('hip_thrust') || exerciseKey.includes('glute');
  const isUpper = !isLower;

  const perRep = repBoundaries.map(rep => {
    const lm = landmarks[rep.endFrame];
    if (!lm) return null;

    let angle;
    if (isUpper) {
      // Check elbow extension at top of rep
      const left = angle3D(lm[LANDMARKS.LEFT_SHOULDER], lm[LANDMARKS.LEFT_ELBOW], lm[LANDMARKS.LEFT_WRIST]);
      const right = angle3D(lm[LANDMARKS.RIGHT_SHOULDER], lm[LANDMARKS.RIGHT_ELBOW], lm[LANDMARKS.RIGHT_WRIST]);
      angle = Math.max(left, right);
    } else {
      // Check knee extension at top of rep
      const left = angle3D(lm[LANDMARKS.LEFT_HIP], lm[LANDMARKS.LEFT_KNEE], lm[LANDMARKS.LEFT_ANKLE]);
      const right = angle3D(lm[LANDMARKS.RIGHT_HIP], lm[LANDMARKS.RIGHT_KNEE], lm[LANDMARKS.RIGHT_ANKLE]);
      angle = Math.max(left, right);
    }

    const fullLockout = angle >= 170;
    return { angle: round(angle, 1), fullLockout };
  }).filter(v => v !== null);

  if (perRep.length === 0) return null;
  const lockoutCount = perRep.filter(r => r.fullLockout).length;
  return {
    perRep,
    lockoutRate: round(lockoutCount / perRep.length, 2),
    consistent: lockoutCount === perRep.length || lockoutCount === 0,
  };
}

function detectTrunkLean(landmarks, repBoundaries) {
  if (!repBoundaries || repBoundaries.length === 0) return null;

  const perRep = repBoundaries.map(rep => {
    const lm = landmarks[rep.bottomFrame];
    if (!lm) return null;
    const midS = midpoint(lm[LANDMARKS.LEFT_SHOULDER], lm[LANDMARKS.RIGHT_SHOULDER]);
    const midH = midpoint(lm[LANDMARKS.LEFT_HIP], lm[LANDMARKS.RIGHT_HIP]);
    const vertRef = { x: midH.x, y: midH.y - 1, z: midH.z };
    const lean = angle3D(midS, midH, vertRef);
    return { angle: round(lean, 1), excessive: lean > 45 };
  }).filter(v => v !== null);

  if (perRep.length === 0) return null;
  const excessiveCount = perRep.filter(r => r.excessive).length;
  return {
    perRep,
    avgLean: round(perRep.reduce((s, r) => s + r.angle, 0) / perRep.length, 1),
    excessiveRate: round(excessiveCount / perRep.length, 2),
  };
}

function detectBarPath(landmarks, repBoundaries) {
  if (!repBoundaries || repBoundaries.length === 0) return null;

  const perRep = repBoundaries.map(rep => {
    const path = [];
    for (let i = rep.startFrame; i <= rep.endFrame && i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (!lm) continue;
      const wristMid = midpoint(lm[LANDMARKS.LEFT_WRIST], lm[LANDMARKS.RIGHT_WRIST]);
      path.push({ x: wristMid.x, y: wristMid.y, z: wristMid.z || 0 });
    }
    if (path.length < 3) return null;

    // Measure lateral (X) deviation from vertical line
    const startX = path[0].x;
    let maxDeviation = 0;
    let totalDeviation = 0;
    for (const p of path) {
      const dev = Math.abs(p.x - startX);
      if (dev > maxDeviation) maxDeviation = dev;
      totalDeviation += dev;
    }

    return {
      maxLateralDrift: round(maxDeviation * 100, 1), // as percentage of frame width
      avgLateralDrift: round((totalDeviation / path.length) * 100, 1),
      pathLength: path.length,
    };
  }).filter(v => v !== null);

  if (perRep.length === 0) return null;
  return {
    perRep,
    avgMaxDrift: round(perRep.reduce((s, r) => s + r.maxLateralDrift, 0) / perRep.length, 1),
  };
}

function detectElbowFlare(landmarks, repBoundaries) {
  if (!repBoundaries || repBoundaries.length === 0) return null;

  const perRep = repBoundaries.map(rep => {
    const lm = landmarks[rep.bottomFrame];
    if (!lm) return null;

    // Elbow flare: angle between upper arm (shoulder-elbow) and torso (shoulder-hip) projected in transverse plane
    // Simplified: use the X-distance between elbow and shoulder relative to shoulder width
    const shoulderWidth = Math.abs(lm[LANDMARKS.LEFT_SHOULDER].x - lm[LANDMARKS.RIGHT_SHOULDER].x);
    if (shoulderWidth < 0.01) return null;

    const leftElbowSpread = Math.abs(lm[LANDMARKS.LEFT_ELBOW].x - lm[LANDMARKS.LEFT_SHOULDER].x) / shoulderWidth;
    const rightElbowSpread = Math.abs(lm[LANDMARKS.RIGHT_ELBOW].x - lm[LANDMARKS.RIGHT_SHOULDER].x) / shoulderWidth;
    const avgSpread = (leftElbowSpread + rightElbowSpread) / 2;

    // flare > 0.7 = elbows wide (roughly > 75 degrees)
    return { spread: round(avgSpread, 2), excessive: avgSpread > 0.7 };
  }).filter(v => v !== null);

  if (perRep.length === 0) return null;
  const excessiveCount = perRep.filter(r => r.excessive).length;
  return {
    perRep,
    avgSpread: round(perRep.reduce((s, r) => s + r.spread, 0) / perRep.length, 2),
    excessiveRate: round(excessiveCount / perRep.length, 2),
  };
}

// ─── Fatigue detection ───

function detectFatigue(landmarks, repBoundaries, fps, exerciseKey) {
  if (!repBoundaries || repBoundaries.length < 3) return null;

  // ROM per rep
  const romPerRep = repBoundaries.map(rep => {
    const isLower = exerciseKey.includes('squat') || exerciseKey.includes('deadlift') ||
                    exerciseKey.includes('lunge') || exerciseKey.includes('leg');
    const jointFn = isLower
      ? (lm) => angle3D(lm[LANDMARKS.LEFT_HIP], lm[LANDMARKS.LEFT_KNEE], lm[LANDMARKS.LEFT_ANKLE])
      : (lm) => angle3D(lm[LANDMARKS.LEFT_SHOULDER], lm[LANDMARKS.LEFT_ELBOW], lm[LANDMARKS.LEFT_WRIST]);

    let max = -Infinity, min = Infinity;
    for (let i = rep.startFrame; i <= rep.endFrame && i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (!lm) continue;
      const v = jointFn(lm);
      if (v > max) max = v;
      if (v < min) min = v;
    }
    return max > min ? max - min : 0;
  });

  // Velocity per rep (concentric time as proxy)
  const velocityPerRep = repBoundaries.map(rep => {
    const concentricFrames = rep.endFrame - rep.bottomFrame;
    const concentricTime = concentricFrames / fps;
    return concentricTime > 0 ? 1 / concentricTime : 0; // higher = faster
  });

  // Linear regression slope
  function slope(vals) {
    const n = vals.length;
    if (n < 3) return 0;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i; sumY += vals[i]; sumXY += i * vals[i]; sumX2 += i * i;
    }
    const denom = n * sumX2 - sumX * sumX;
    return denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  }

  const romSlope = slope(romPerRep);
  const velSlope = slope(velocityPerRep);

  const firstHalfRom = romPerRep.slice(0, Math.ceil(romPerRep.length / 2));
  const secondHalfRom = romPerRep.slice(Math.ceil(romPerRep.length / 2));
  const avgFirst = firstHalfRom.reduce((a, b) => a + b, 0) / firstHalfRom.length;
  const avgSecond = secondHalfRom.reduce((a, b) => a + b, 0) / secondHalfRom.length;
  const romDecayPercent = avgFirst > 0 ? round(((avgFirst - avgSecond) / avgFirst) * 100, 1) : 0;

  return {
    romPerRep: romPerRep.map(v => round(v, 1)),
    velocityPerRep: velocityPerRep.map(v => round(v, 3)),
    romDecayPercent,
    romSlope: round(romSlope, 4),
    velSlope: round(velSlope, 4),
    fatigueDetected: romDecayPercent > 15 || velSlope < -0.05,
    severity: romDecayPercent > 25 ? 'significant' : romDecayPercent > 15 ? 'moderate' : 'minimal',
  };
}

// ─── Center of Mass (de Leva 1996 simplified) ───

const SEGMENT_PARAMS = [
  // [proximal landmark, distal landmark, mass fraction, CoM position from proximal]
  { prox: LANDMARKS.LEFT_SHOULDER, dist: LANDMARKS.LEFT_HIP, mass: 0.1610, com: 0.4486 }, // trunk left
  { prox: LANDMARKS.RIGHT_SHOULDER, dist: LANDMARKS.RIGHT_HIP, mass: 0.1610, com: 0.4486 }, // trunk right
  { prox: LANDMARKS.LEFT_SHOULDER, dist: LANDMARKS.LEFT_ELBOW, mass: 0.0271, com: 0.5754 }, // upper arm
  { prox: LANDMARKS.RIGHT_SHOULDER, dist: LANDMARKS.RIGHT_ELBOW, mass: 0.0271, com: 0.5754 },
  { prox: LANDMARKS.LEFT_ELBOW, dist: LANDMARKS.LEFT_WRIST, mass: 0.0162, com: 0.4559 }, // forearm
  { prox: LANDMARKS.RIGHT_ELBOW, dist: LANDMARKS.RIGHT_WRIST, mass: 0.0162, com: 0.4559 },
  { prox: LANDMARKS.LEFT_HIP, dist: LANDMARKS.LEFT_KNEE, mass: 0.1416, com: 0.4095 }, // thigh
  { prox: LANDMARKS.RIGHT_HIP, dist: LANDMARKS.RIGHT_KNEE, mass: 0.1416, com: 0.4095 },
  { prox: LANDMARKS.LEFT_KNEE, dist: LANDMARKS.LEFT_ANKLE, mass: 0.0433, com: 0.4459 }, // shank
  { prox: LANDMARKS.RIGHT_KNEE, dist: LANDMARKS.RIGHT_ANKLE, mass: 0.0433, com: 0.4459 },
];

function computeCenterOfMass(lm) {
  if (!lm || lm.length < 33) return null;
  let totalMass = 0;
  let cx = 0, cy = 0, cz = 0;

  for (const seg of SEGMENT_PARAMS) {
    const p = lm[seg.prox], d = lm[seg.dist];
    if (!p || !d) continue;
    const x = p.x + seg.com * (d.x - p.x);
    const y = p.y + seg.com * (d.y - p.y);
    const z = (p.z || 0) + seg.com * ((d.z || 0) - (p.z || 0));
    cx += seg.mass * x;
    cy += seg.mass * y;
    cz += seg.mass * z;
    totalMass += seg.mass;
  }

  if (totalMass === 0) return null;
  return { x: cx / totalMass, y: cy / totalMass, z: cz / totalMass };
}

function analyzeCenterOfMass(landmarks, repBoundaries) {
  if (!repBoundaries || repBoundaries.length === 0) return null;

  const perRep = repBoundaries.map(rep => {
    const comPath = [];
    for (let i = rep.startFrame; i <= rep.endFrame && i < landmarks.length; i++) {
      const com = computeCenterOfMass(landmarks[i]);
      if (com) comPath.push(com);
    }
    if (comPath.length < 3) return null;

    // Lateral sway: max X deviation from mean X
    const meanX = comPath.reduce((s, c) => s + c.x, 0) / comPath.length;
    const maxSway = Math.max(...comPath.map(c => Math.abs(c.x - meanX)));

    // Vertical displacement
    const minY = Math.min(...comPath.map(c => c.y));
    const maxY = Math.max(...comPath.map(c => c.y));

    return {
      lateralSway: round(maxSway * 100, 1), // % of frame width
      verticalDisplacement: round((maxY - minY) * 100, 1),
    };
  }).filter(v => v !== null);

  if (perRep.length === 0) return null;
  return {
    perRep,
    avgLateralSway: round(perRep.reduce((s, r) => s + r.lateralSway, 0) / perRep.length, 1),
    avgVerticalDisplacement: round(perRep.reduce((s, r) => s + r.verticalDisplacement, 0) / perRep.length, 1),
  };
}

// ─── Rep consistency via DTW ───

function analyzeRepConsistency(landmarks, repBoundaries, exerciseKey) {
  if (!repBoundaries || repBoundaries.length < 2) return null;

  const isLower = exerciseKey.includes('squat') || exerciseKey.includes('deadlift') ||
                  exerciseKey.includes('lunge') || exerciseKey.includes('leg');
  const jointFn = isLower
    ? (lm) => angle3D(lm[LANDMARKS.LEFT_HIP], lm[LANDMARKS.LEFT_KNEE], lm[LANDMARKS.LEFT_ANKLE])
    : (lm) => angle3D(lm[LANDMARKS.LEFT_SHOULDER], lm[LANDMARKS.LEFT_ELBOW], lm[LANDMARKS.LEFT_WRIST]);

  // Extract angle trajectory per rep
  const repSignals = repBoundaries.map(rep => {
    return extractRepSignal(landmarks, rep.startFrame, rep.endFrame, jointFn);
  }).filter(s => s.length >= 3);

  if (repSignals.length < 2) return null;

  // Use the median-length rep as template
  const lengths = repSignals.map(s => s.length).sort((a, b) => a - b);
  const medianLen = lengths[Math.floor(lengths.length / 2)];
  const templateIdx = repSignals.findIndex(s => s.length === medianLen);
  const template = repSignals[templateIdx >= 0 ? templateIdx : 0];

  // DTW distance of each rep from template
  const distances = repSignals.map(s => dtwDistance(s, template));
  const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;

  // Normalize to 0-100 score (lower distance = higher consistency)
  // Typical DTW distances for angle signals: 0.5-5 degrees
  const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - avgDistance * 10)));

  return {
    perRepDistance: distances.map(d => round(d, 2)),
    avgDistance: round(avgDistance, 2),
    consistencyScore,
    mostInconsistentRep: distances.indexOf(Math.max(...distances)),
  };
}

// ─── Movement smoothness per rep ───

function analyzeSmoothnessPerRep(landmarks, repBoundaries, fps, exerciseKey) {
  if (!repBoundaries || repBoundaries.length === 0) return null;

  const isLower = exerciseKey.includes('squat') || exerciseKey.includes('deadlift') ||
                  exerciseKey.includes('lunge') || exerciseKey.includes('leg');

  const perRep = repBoundaries.map(rep => {
    // Compute speed profile from primary landmark displacement
    const speeds = [];
    for (let i = rep.startFrame + 1; i <= rep.endFrame && i < landmarks.length; i++) {
      const prev = landmarks[i - 1];
      const curr = landmarks[i];
      if (!prev || !curr) continue;

      const trackIdx = isLower
        ? [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP]
        : [LANDMARKS.LEFT_WRIST, LANDMARKS.RIGHT_WRIST];

      const p1 = midpoint(prev[trackIdx[0]], prev[trackIdx[1]]);
      const p2 = midpoint(curr[trackIdx[0]], curr[trackIdx[1]]);
      speeds.push(dist3D(p1, p2) * fps); // displacement per second
    }

    if (speeds.length < 5) return null;
    const sparc = computeSPARC(speeds, fps);
    return sparc !== null ? { sparc } : null;
  }).filter(v => v !== null);

  if (perRep.length === 0) return null;
  const avgSparc = perRep.reduce((s, r) => s + r.sparc, 0) / perRep.length;

  return {
    perRep,
    avgSparc: round(avgSparc, 3),
    // SPARC interpretation: > -1.5 = very smooth, -1.5 to -3 = normal, < -3 = jerky
    quality: avgSparc > -1.5 ? 'very_smooth' : avgSparc > -3 ? 'normal' : 'jerky',
  };
}

// ─── Coaching feedback generator ───

function generateCoachingFeedback(metrics, exerciseKey) {
  const feedback = [];
  const ex = exerciseKey.toLowerCase();
  const isSquat = ex.includes('squat');
  const isBench = ex.includes('bench') || ex.includes('press');
  const isDeadlift = ex.includes('deadlift');
  const isPull = ex.includes('pull') || ex.includes('row') || ex.includes('curl');

  // 1. Fatigue
  if (metrics.fatigue?.fatigueDetected) {
    const decay = metrics.fatigue.romDecayPercent;
    if (metrics.fatigue.severity === 'significant') {
      feedback.push({
        priority: 1,
        category: 'fatigue',
        message: `Your range of motion dropped ${decay}% from the first half of your set to the second. This level of fatigue suggests reducing weight by 5-10% or adding 30 seconds of rest between sets.`,
        severity: 'warning',
      });
    } else {
      feedback.push({
        priority: 3,
        category: 'fatigue',
        message: `Mild fatigue detected: ${decay}% ROM decrease across the set. Form is still safe but watch for further degradation.`,
        severity: 'info',
      });
    }
  }

  // 2. Squat depth
  if (isSquat && metrics.squatDepth) {
    if (!metrics.squatDepth.allBelowParallel) {
      const rate = Math.round(metrics.squatDepth.avgBelowParallel * 100);
      feedback.push({
        priority: 2,
        category: 'depth',
        message: rate === 0
          ? 'None of your reps reached below parallel. For full muscle activation, aim to bring your hips below your knees at the bottom.'
          : `Only ${rate}% of reps reached below parallel. Focus on consistent depth — partial reps reduce quadriceps and glute activation.`,
        severity: 'correction',
      });
    } else {
      feedback.push({
        priority: 8,
        category: 'depth',
        message: 'All reps reached below parallel. Excellent depth consistency.',
        severity: 'positive',
      });
    }
  }

  // 3. Knee valgus
  if (metrics.kneeValgus?.detected) {
    feedback.push({
      priority: 1,
      category: 'knee_valgus',
      message: `Knee valgus detected in ${Math.round(metrics.kneeValgus.valgusRate * 100)}% of reps — your knees are collapsing inward at the bottom position. This increases ACL stress. Cue: "push knees out over toes." Consider glute activation warmup.`,
      severity: 'warning',
    });
  }

  // 4. Elbow flare
  if (isBench && metrics.elbowFlare?.excessiveRate > 0.3) {
    feedback.push({
      priority: 2,
      category: 'elbow_flare',
      message: `Excessive elbow flare detected in ${Math.round(metrics.elbowFlare.excessiveRate * 100)}% of reps. Wide elbows increase shoulder impingement risk. Aim for a 45-degree angle between your upper arm and torso.`,
      severity: 'correction',
    });
  }

  // 5. Trunk lean
  if ((isSquat || isDeadlift) && metrics.trunkLean?.excessiveRate > 0.3) {
    feedback.push({
      priority: 2,
      category: 'trunk_lean',
      message: `Excessive forward lean (avg ${metrics.trunkLean.avgLean}°) detected. This shifts load from legs to lower back. Cue: "chest up, break at the hips and knees simultaneously."`,
      severity: 'correction',
    });
  }

  // 6. Lockout consistency
  if (metrics.lockout && !metrics.lockout.consistent && metrics.lockout.lockoutRate < 0.5) {
    feedback.push({
      priority: 4,
      category: 'lockout',
      message: `Only ${Math.round(metrics.lockout.lockoutRate * 100)}% of reps reached full lockout. Completing the top of the movement ensures full muscle contraction. Focus on extending fully at the top.`,
      severity: 'correction',
    });
  }

  // 7. Rep consistency (DTW)
  if (metrics.repConsistency) {
    if (metrics.repConsistency.consistencyScore < 60) {
      feedback.push({
        priority: 3,
        category: 'consistency',
        message: `Your reps are inconsistent (consistency score: ${metrics.repConsistency.consistencyScore}/100). Rep ${metrics.repConsistency.mostInconsistentRep + 1} deviated the most. A consistent rep pattern means each rep trains the same muscles through the same range.`,
        severity: 'correction',
      });
    } else if (metrics.repConsistency.consistencyScore >= 85) {
      feedback.push({
        priority: 9,
        category: 'consistency',
        message: `Excellent rep consistency (${metrics.repConsistency.consistencyScore}/100). Each rep follows the same controlled path — this is how you build reliable strength.`,
        severity: 'positive',
      });
    }
  }

  // 8. Smoothness
  if (metrics.smoothness?.quality === 'jerky') {
    feedback.push({
      priority: 3,
      category: 'smoothness',
      message: 'Your movement appears jerky with abrupt speed changes. Smooth, controlled reps reduce injury risk and improve muscle time under tension. Slow down the eccentric (lowering) phase.',
      severity: 'correction',
    });
  }

  // 9. Bar path
  if ((isBench || isPull) && metrics.barPath?.avgMaxDrift > 3) {
    feedback.push({
      priority: 4,
      category: 'bar_path',
      message: `Significant lateral drift (${metrics.barPath.avgMaxDrift}%) detected in your bar path. A straighter path means more efficient force transfer. Check your grip width and ensure even loading.`,
      severity: 'info',
    });
  }

  // 10. Center of mass
  if (metrics.centerOfMass?.avgLateralSway > 2) {
    feedback.push({
      priority: 5,
      category: 'balance',
      message: `Your center of mass shifts laterally during reps (${metrics.centerOfMass.avgLateralSway}% sway). This suggests one side is compensating. Focus on even weight distribution through both feet.`,
      severity: 'info',
    });
  }

  // Sort by priority (lower number = more important)
  feedback.sort((a, b) => a.priority - b.priority);

  // Return top 5 most actionable
  return feedback.slice(0, 5);
}

// ─── Main entry point ───

/**
 * Run full coaching analysis on a completed set.
 *
 * @param {Array} landmarkFrames - array of 33-landmark arrays, one per frame
 * @param {Array} repBoundaries - array of { startFrame, bottomFrame, endFrame }
 * @param {string} exerciseKey - exercise identifier
 * @param {number} fps - analysis frames per second
 * @returns {Object} CoachingReport with metrics and feedback
 */
export function analyzeCoaching(landmarkFrames, repBoundaries, exerciseKey, fps) {
  if (!landmarkFrames || landmarkFrames.length < 5 || !repBoundaries || repBoundaries.length === 0) {
    return null;
  }

  const ex = exerciseKey.toLowerCase();
  const isSquat = ex.includes('squat');
  const isBench = ex.includes('bench') || ex.includes('press');
  const isDeadlift = ex.includes('deadlift');

  // Compute all metrics
  const metrics = {};

  // Smoothness (SPARC per rep)
  metrics.smoothness = analyzeSmoothnessPerRep(landmarkFrames, repBoundaries, fps, exerciseKey);

  // Rep consistency (DTW)
  metrics.repConsistency = analyzeRepConsistency(landmarkFrames, repBoundaries, exerciseKey);

  // Fatigue (ROM decay + velocity decay)
  metrics.fatigue = detectFatigue(landmarkFrames, repBoundaries, fps, exerciseKey);

  // Center of mass
  metrics.centerOfMass = analyzeCenterOfMass(landmarkFrames, repBoundaries);

  // Exercise-specific form detections
  if (isSquat || ex.includes('lunge')) {
    metrics.squatDepth = detectSquatDepth(landmarkFrames, repBoundaries);
    metrics.kneeValgus = detectKneeValgus(landmarkFrames, repBoundaries);
  }

  if (isSquat || isDeadlift) {
    metrics.trunkLean = detectTrunkLean(landmarkFrames, repBoundaries);
  }

  if (isBench) {
    metrics.elbowFlare = detectElbowFlare(landmarkFrames, repBoundaries);
  }

  metrics.lockout = detectLockout(landmarkFrames, repBoundaries, exerciseKey);
  metrics.barPath = detectBarPath(landmarkFrames, repBoundaries);

  // Generate coaching feedback
  const feedback = generateCoachingFeedback(metrics, exerciseKey);

  return {
    metrics,
    feedback,
    feedbackCount: feedback.length,
    hasWarnings: feedback.some(f => f.severity === 'warning'),
    hasCorrections: feedback.some(f => f.severity === 'correction'),
    timestamp: Date.now(),
  };
}
