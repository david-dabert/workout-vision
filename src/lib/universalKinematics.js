/**
 * Universal Kinematic Engine
 * Biomechanical analysis for all human movements beyond canonical lifts:
 * - Isometric holds (TUT, postural stability, fatigue breakdown, tremor)
 * - Dynamic planar articulations (ankle/calves, horizontal flyes/adduction, scapular shrugs, core)
 * - Auto-dominant joint detection for unmapped exercises
 */

import { extractFramesStreaming } from './frameExtractor.js';
import { TARGET_FPS, MAX_LONG_SIDE, MAX_FRAMES } from './extractionConfig.js';
import { sgKernel } from './counting/core';

export const ISOMETRIC_HOLDS = new Set([
  'plank',
  'side_plank',
  'wall_sit',
  'dead_hang',
  'active_hang',
  'cable_pallof_hold',
  'superman_hold',
  'hollow_body_hold',
  'bear_plank',
  'l_sit_hold',
  'copenhagen_plank',
]);

export const KINEMATIC_MAPPINGS = {
  // Ankle plantarflexion / dorsiflexion
  standing_calf_raise: { channel: 'ankle', rest: 'low', first: 'concentric' },
  seated_calf_raise: { channel: 'ankle', rest: 'low', first: 'concentric' },
  donkey_calf_raise: { channel: 'ankle', rest: 'low', first: 'concentric' },
  leg_press_calf_raise: { channel: 'ankle', rest: 'low', first: 'concentric' },
  calf_raise: { channel: 'ankle', rest: 'low', first: 'concentric' },
  single_leg_calf_raise: { channel: 'ankle', rest: 'low', first: 'concentric' },

  // Horizontal shoulder adduction / chest aperture
  pec_deck: { channel: 'chest_aperture', rest: 'high', first: 'concentric' },
  cable_fly: { channel: 'chest_aperture', rest: 'high', first: 'concentric' },
  dumbbell_fly: { channel: 'chest_aperture', rest: 'high', first: 'concentric' },
  incline_cable_fly: { channel: 'chest_aperture', rest: 'high', first: 'concentric' },
  band_pull_apart: { channel: 'chest_aperture', rest: 'low', first: 'concentric' },
  rear_delt_fly: { channel: 'chest_aperture', rest: 'low', first: 'concentric' },
  reverse_pec_deck: { channel: 'chest_aperture', rest: 'low', first: 'concentric' },
  bent_over_rear_delt_raise: { channel: 'chest_aperture', rest: 'low', first: 'concentric' },
  cable_rear_delt_fly: { channel: 'chest_aperture', rest: 'low', first: 'concentric' },

  // Scapular elevation / Shrugs
  shrug: { channel: 'shrug', rest: 'low', first: 'concentric' },
  dumbbell_shrug: { channel: 'shrug', rest: 'low', first: 'concentric' },
  scapular_pull_up: { channel: 'shrug', rest: 'low', first: 'concentric' },
  scapular_push_up: { channel: 'shrug', rest: 'low', first: 'concentric' },

  // Trunk / Core flexion
  crunch: { channel: 'torso', rest: 'high', first: 'concentric' },
  reverse_crunch: { channel: 'torso', rest: 'high', first: 'concentric' },
  cable_crunch: { channel: 'torso', rest: 'high', first: 'concentric' },
  weighted_crunch: { channel: 'torso', rest: 'high', first: 'concentric' },
  dragon_flag: { channel: 'torso', rest: 'low', first: 'concentric' },
  hanging_leg_raise: { channel: 'hip', rest: 'high', first: 'concentric' },
};

// 3D vector math
function dist3D(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function angle3D(a, vertex, c) {
  if (!a || !vertex || !c) return null;
  const v1x = a.x - vertex.x, v1y = a.y - vertex.y, v1z = a.z - vertex.z;
  const v2x = c.x - vertex.x, v2y = c.y - vertex.y, v2z = c.z - vertex.z;
  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const m1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
  const m2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);
  if (m1 < 1e-7 || m2 < 1e-7) return null;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return Math.acos(cos) * (180 / Math.PI);
}

/**
 * Extracts kinematic angles and metrics across all channels for a single landmark frame
 */
export function extractFrameKinematics(wl) {
  if (!wl || wl.length < 33) return null;

  // Key landmarks
  const lShoulder = wl[11], rShoulder = wl[12];
  const lElbow = wl[13], rElbow = wl[14];
  const lWrist = wl[15], rWrist = wl[16];
  const lHip = wl[23], rHip = wl[24];
  const lKnee = wl[25], rKnee = wl[26];
  const lAnkle = wl[27], rAnkle = wl[28];
  const lFoot = wl[31], rFoot = wl[32];
  const lEar = wl[7], rEar = wl[8];

  // Primary joint angles (degrees)
  const leftElbow = angle3D(lShoulder, lElbow, lWrist);
  const rightElbow = angle3D(rShoulder, rElbow, rWrist);
  const leftShoulder = angle3D(lHip, lShoulder, lElbow);
  const rightShoulder = angle3D(rHip, rShoulder, rElbow);
  const leftHip = angle3D(lShoulder, lHip, lKnee);
  const rightHip = angle3D(rShoulder, rHip, rKnee);
  const leftKnee = angle3D(lHip, lKnee, lAnkle);
  const rightKnee = angle3D(rHip, rKnee, rAnkle);

  // Ankle angle (knee - ankle - toe)
  const leftAnkle = angle3D(lKnee, lAnkle, lFoot);
  const rightAnkle = angle3D(rKnee, rAnkle, rFoot);

  // Chest aperture (wrist-to-wrist distance normalized by shoulder width)
  const shoulderWidth = dist3D(lShoulder, rShoulder);
  const wristDist = dist3D(lWrist, rWrist);
  // Scale ratio (typically 0.3 to 2.5) into pseudo-degrees (30 to 170)
  const chestAperture = shoulderWidth > 0.05
    ? Math.min(180, Math.max(20, (wristDist / shoulderWidth) * 70))
    : null;

  // Scapular elevation (shoulder height relative to ears)
  const earY = (lEar.y + rEar.y) / 2;
  const shoulderY = (lShoulder.y + rShoulder.y) / 2;
  const hipY = (lHip.y + rHip.y) / 2;
  const torsoH = Math.abs(hipY - shoulderY);
  // Higher shoulder = smaller delta (earY - shoulderY)
  const shrugMetric = torsoH > 0.1
    ? Math.max(30, Math.min(150, 90 + ((shoulderY - earY) / torsoH) * 120))
    : null;

  // Torso / Trunk angle (mid-shoulder to mid-hip relative to vertical axis)
  const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2, z: (lShoulder.z + rShoulder.z) / 2 };
  const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2, z: (lHip.z + rHip.z) / 2 };
  const midKnee = { x: (lKnee.x + rKnee.x) / 2, y: (lKnee.y + rKnee.y) / 2, z: (lKnee.z + rKnee.z) / 2 };
  const torso = angle3D(midShoulder, midHip, midKnee);

  return {
    leftElbow, rightElbow,
    leftShoulder, rightShoulder,
    leftHip, rightHip,
    leftKnee, rightKnee,
    leftAnkle, rightAnkle,
    chestAperture,
    shrug: shrugMetric,
    torso,
  };
}

/**
 * Applies Savitzky-Golay smoothing with NaN / null interpolation
 */
export function smoothSeries(values, windowSize = 7) {
  const n = values.length;
  if (n === 0) return [];
  const valid = values.map((v, i) => (v != null && Number.isFinite(v) ? v : null));

  // Linear interpolation for missing gaps up to 5 samples
  const filled = [...valid];
  for (let i = 0; i < n; i++) {
    if (filled[i] === null) {
      let nextIdx = -1;
      for (let j = i + 1; j < Math.min(n, i + 6); j++) {
        if (filled[j] !== null) { nextIdx = j; break; }
      }
      if (nextIdx !== -1 && i > 0 && filled[i - 1] !== null) {
        const startVal = filled[i - 1];
        const endVal = filled[nextIdx];
        const step = (endVal - startVal) / (nextIdx - i + 1);
        for (let k = i; k < nextIdx; k++) filled[k] = startVal + step * (k - i + 1);
      }
    }
  }

  const kernel = sgKernel(windowSize);
  const half = Math.floor(kernel.length / 2);
  const out = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    if (filled[i] === null) continue;
    let sum = 0, weightSum = 0;
    for (let k = -half; k <= half; k++) {
      const idx = i + k;
      if (idx >= 0 && idx < n && filled[idx] !== null) {
        const w = kernel[k + half];
        sum += filled[idx] * w;
        weightSum += w;
      }
    }
    out[i] = weightSum > 0.001 ? sum / weightSum : filled[i];
  }

  return out;
}

/**
 * Calculates Spectral Arc Length (SPARC) motor smoothness
 */
export function calculateSPARC(speedProfile, dt = 1 / 15) {
  if (!speedProfile || speedProfile.length < 8) return 70;
  const n = speedProfile.length;
  // Compute discrete Fourier transform magnitude spectrum
  const maxFreqIdx = Math.min(Math.floor(n / 2), 16);
  const mags = [];
  let maxMag = 1e-6;

  for (let k = 0; k < maxFreqIdx; k++) {
    let re = 0, im = 0;
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n;
      re += speedProfile[t] * Math.cos(angle);
      im -= speedProfile[t] * Math.sin(angle);
    }
    const mag = Math.sqrt(re * re + im * im);
    mags.push(mag);
    if (mag > maxMag) maxMag = mag;
  }

  // Normalize spectrum
  const normMags = mags.map(m => m / maxMag);
  let arcLength = 0;
  for (let k = 1; k < normMags.length; k++) {
    const df = 1 / (n * dt);
    const dVal = normMags[k] - normMags[k - 1];
    arcLength += Math.sqrt(df * df + dVal * dVal);
  }

  // Map to 0-100 score: smooth bell-shaped velocity profiles have low arc length (~1-3)
  const sparcScore = Math.max(20, Math.min(98, 100 - arcLength * 3.5));
  return Math.round(sparcScore);
}

/**
 * Analyzes an Isometric Hold (plank, wall sit, dead hang, etc.)
 */
export function analyzeIsometricHold(worldLandmarks, timestamps, lift) {
  const duration = timestamps.length > 1 ? timestamps[timestamps.length - 1] - timestamps[0] : 0;
  const frameMetrics = worldLandmarks.map(extractFrameKinematics).filter(Boolean);

  // Pick primary postural angle
  const channel = lift.includes('plank') ? 'torso' : lift.includes('wall_sit') ? 'leftKnee' : 'leftShoulder';
  const rawAngles = frameMetrics.map(m => m[channel] ?? m.torso ?? 180);
  const smoothed = smoothSeries(rawAngles, 9);
  const validAngles = smoothed.filter(v => v !== null);

  if (validAngles.length === 0) {
    return {
      count: 0,
      tut: 0,
      isIsometric: true,
      stabilityDeg: 0,
      breakdownSec: null,
      reps: [],
      angles: [],
      smoothedAngles: [],
      confidence: 0,
      refused: false,
    };
  }

  const meanAngle = validAngles.reduce((a, b) => a + b, 0) / validAngles.length;
  const variance = validAngles.reduce((a, b) => a + (b - meanAngle) ** 2, 0) / validAngles.length;
  const stabilityDeg = Math.round(Math.sqrt(variance) * 10) / 10;

  // Form breakdown detection: angle deviating > 15 deg from baseline hold
  let breakdownSec = null;
  const baselineHold = validAngles.slice(0, Math.min(20, validAngles.length)).reduce((a, b) => a + b, 0) / Math.min(20, validAngles.length);
  for (let i = 0; i < smoothed.length; i++) {
    if (smoothed[i] !== null && Math.abs(smoothed[i] - baselineHold) > 15) {
      breakdownSec = Math.round((timestamps[i] - timestamps[0]) * 10) / 10;
      break;
    }
  }

  const tut = Math.round(duration * 10) / 10;

  return {
    count: Math.round(tut), // For isometric holds, the primary count is Time Under Tension in seconds!
    tut,
    isIsometric: true,
    stabilityDeg,
    breakdownSec,
    angles: rawAngles,
    smoothedAngles: smoothed,
    lowThreshold: Math.round(meanAngle - 10),
    highThreshold: Math.round(meanAngle + 10),
    confidence: validAngles.length / worldLandmarks.length,
    refused: false,
    reps: [
      {
        index: 1,
        startTime: timestamps[0] || 0,
        endTime: timestamps[timestamps.length - 1] || duration,
        romDegrees: stabilityDeg,
        concentricSec: 0,
        eccentricSec: 0,
        peakSpeed: 0,
        meanSpeed: 0,
      },
    ],
  };
}

/**
 * Universal Kinematic Analysis for ANY dynamic movement
 */
export function analyzeDynamicKinematics(worldLandmarks, timestamps, lift) {
  const n = worldLandmarks.length;
  if (n < 5) {
    return { count: 0, reps: [], confidence: 0, refused: true, angles: [], smoothedAngles: [], lowThreshold: 0, highThreshold: 0 };
  }

  // 1. Extract all kinematic channels
  const frames = worldLandmarks.map(extractFrameKinematics);
  const channels = ['leftElbow', 'rightElbow', 'leftKnee', 'rightKnee', 'leftHip', 'rightHip', 'leftAnkle', 'rightAnkle', 'chestAperture', 'shrug', 'torso'];

  // Check if mapped channel exists
  const explicitMapping = KINEMATIC_MAPPINGS[lift];
  let targetChannel = explicitMapping ? (explicitMapping.channel === 'ankle' ? 'leftAnkle' : explicitMapping.channel === 'chest_aperture' ? 'chestAperture' : explicitMapping.channel) : null;

  // Auto-detect dominant channel if unmapped
  if (!targetChannel || targetChannel === 'ankle') {
    let bestChannel = 'leftElbow';
    let maxRom = 0;

    for (const ch of channels) {
      const vals = frames.map(f => (f ? f[ch] : null)).filter(v => v !== null);
      if (vals.length < n * 0.3) continue;
      vals.sort((a, b) => a - b);
      const p10 = vals[Math.floor(vals.length * 0.1)];
      const p90 = vals[Math.floor(vals.length * 0.9)];
      const rom = p90 - p10;
      if (rom > maxRom) {
        maxRom = rom;
        bestChannel = ch;
      }
    }
    if (!targetChannel) targetChannel = bestChannel;
  }

  // 2. Extract and smooth dominant signal
  const rawSignal = frames.map(f => (f && f[targetChannel] !== undefined ? f[targetChannel] : null));
  const smoothed = smoothSeries(rawSignal, 7);

  const validVals = smoothed.filter(v => v !== null).sort((a, b) => a - b);
  if (validVals.length < 5) {
    return { count: 0, reps: [], confidence: 0, refused: false, angles: rawSignal, smoothedAngles: smoothed, lowThreshold: 0, highThreshold: 0 };
  }

  const p10 = validVals[Math.floor(validVals.length * 0.1)];
  const p90 = validVals[Math.floor(validVals.length * 0.9)];
  const rom = p90 - p10;

  if (rom < 12) {
    // Insufficient ROM
    return { count: 0, reps: [], confidence: validVals.length / n, refused: false, angles: rawSignal, smoothedAngles: smoothed, lowThreshold: p10, highThreshold: p90 };
  }

  const lowThreshold = p10 + rom * 0.22;
  const highThreshold = p90 - rom * 0.22;

  // 3. Peak/valley rep cycle detection
  const reps = [];
  let state = 'rest';
  let repStart = timestamps[0];
  let repMin = Infinity;
  let repMax = -Infinity;
  let repMinTime = repStart;
  let speeds = [];

  for (let i = 1; i < smoothed.length; i++) {
    const val = smoothed[i];
    const prev = smoothed[i - 1];
    const t = timestamps[i];
    if (val === null || prev === null) continue;

    const dt = Math.max(0.01, t - timestamps[i - 1]);
    const speed = Math.abs(val - prev) / dt;
    speeds.push(speed);

    if (val < repMin) { repMin = val; repMinTime = t; }
    if (val > repMax) repMax = val;

    if (state === 'rest' && val < lowThreshold) {
      state = 'working';
      repMin = val;
      repMax = val;
    } else if (state === 'working' && val > highThreshold) {
      state = 'rest';
      const repDuration = t - repStart;
      if (repDuration >= 0.6 && repDuration <= 9.0 && (repMax - repMin) >= 12) {
        const repSpeeds = speeds.slice(-Math.floor(repDuration * 15));
        const peakSpeed = repSpeeds.length ? Math.max(...repSpeeds) : 0;
        const meanSpeed = repSpeeds.length ? repSpeeds.reduce((a, b) => a + b, 0) / repSpeeds.length : 0;

        reps.push({
          index: reps.length + 1,
          startTime: Math.round(repStart * 10) / 10,
          endTime: Math.round(t * 10) / 10,
          romDegrees: Math.round(repMax - repMin),
          concentricSec: Math.round(Math.abs(t - repMinTime) * 10) / 10,
          eccentricSec: Math.round(Math.abs(repMinTime - repStart) * 10) / 10,
          peakSpeed: Math.round(peakSpeed),
          meanSpeed: Math.round(meanSpeed),
        });
      }
      repStart = t;
      repMin = val;
      repMax = val;
    }
  }

  // Bilateral symmetry calculation
  let symmetry = null;
  const leftChannel = targetChannel.replace('right', 'left');
  const rightChannel = targetChannel.replace('left', 'right');
  if (leftChannel !== rightChannel) {
    const lVals = frames.map(f => (f ? f[leftChannel] : null)).filter(v => v !== null);
    const rVals = frames.map(f => (f ? f[rightChannel] : null)).filter(v => v !== null);
    if (lVals.length > 5 && rVals.length > 5) {
      const lRom = Math.max(...lVals) - Math.min(...lVals);
      const rRom = Math.max(...rVals) - Math.min(...rVals);
      const ratio = Math.min(lRom, rRom) / Math.max(lRom, rRom, 1);
      const diff = Math.round(Math.abs(lRom - rRom));
      symmetry = {
        symmetryScore: Math.round(ratio * 100),
        status: ratio >= 0.9 ? 'balanced' : 'asymmetric',
        dominantSide: lRom >= rRom ? 'left' : 'right',
        romDiffDeg: diff,
      };
    }
  }

  // SPARC motor smoothness
  const smoothnessScore = calculateSPARC(speeds);

  return {
    count: reps.length,
    reps,
    confidence: validVals.length / n,
    refused: false,
    angles: rawSignal,
    smoothedAngles: smoothed,
    lowThreshold: Math.round(lowThreshold),
    highThreshold: Math.round(highThreshold),
    dominantJoint: targetChannel,
    symmetry,
    smoothness: { avgSparc: smoothnessScore, quality: smoothnessScore >= 80 ? 'very_smooth' : smoothnessScore >= 65 ? 'smooth' : 'moderate' },
  };
}

/**
 * Universal Landmark Analysis: Routes to isometric or dynamic engine
 */
export function analyzeUniversalLandmarks(worldLandmarks, timestamps, lift) {
  if (ISOMETRIC_HOLDS.has(lift)) {
    return analyzeIsometricHold(worldLandmarks, timestamps, lift);
  }
  return analyzeDynamicKinematics(worldLandmarks, timestamps, lift);
}

/**
 * Streaming video analysis for any catalog movement
 */
export async function analyzeUniversalVideo(file, lift, { signal, onProgress = () => {}, onPhase = () => {}, onLandmarks = () => {} } = {}) {
  let worker;
  try {
    worker = new Worker(new URL('./corePoseWorker.js', import.meta.url));
  } catch (err) {
    throw err;
  }

  let ended = false;
  const endWorker = () => {
    if (ended) return;
    ended = true;
    worker.terminate();
  };

  let id = 0;
  const pending = new Map();
  worker.onmessage = ({ data }) => {
    const req = pending.get(data.id);
    if (!req) return;
    pending.delete(data.id);
    if (data.error) req.reject(new Error(data.error));
    else req.resolve(data);
  };
  worker.onerror = err => {
    for (const r of pending.values()) r.reject(new Error(err.message || 'Worker error'));
    pending.clear();
  };

  const send = (msg, transfer = []) => new Promise((resolve, reject) => {
    const reqId = id++;
    pending.set(reqId, { resolve, reject });
    worker.postMessage({ ...msg, id: reqId }, transfer);
  });

  try {
    onPhase('model');
    await send({ type: 'init', videoMode: false });

    onPhase('extracting');
    const imageLandmarks = [], worldLandmarks = [], timestamps = [];

    const metadata = await extractFramesStreaming(file, TARGET_FPS, MAX_FRAMES, MAX_LONG_SIDE, async (canvas, index, timestamp, read) => {
      signal?.throwIfAborted();
      const pixels = (read ?? canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)).data.buffer;
      const sent = index * 1000 / TARGET_FPS;
      const { width, height } = canvas;
      const res = await send({ pixels, width, height, timestamp: sent }, [pixels]);
      imageLandmarks.push(res.image);
      worldLandmarks.push(res.world);
      timestamps.push(timestamp);
      onLandmarks(res.image, width, height);
    }, onProgress, { deterministic: true, signal });

    onPhase('calculating');
    const summary = analyzeUniversalLandmarks(worldLandmarks, timestamps, lift);

    const result = {
      ...summary,
      exercise: lift,
      metadata,
      imageLandmarks,
      worldLandmarks,
      timestamps,
    };

    window.dispatchEvent(new CustomEvent('wv:universal-result', { detail: result }));
    return result;
  } finally {
    endWorker();
  }
}
