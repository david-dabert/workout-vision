/**
 * SignalExtractor3D — The Root Cause Fix
 *
 * MediaPipe outputs landmark.z for every joint. The previous pipeline
 * only used x,y positions and 2D distances, discarding the depth axis.
 * Bench press from front, pull-ups from front — the bar/body moves in Z,
 * not X or Y. This module extracts 3D signals that capture that motion.
 *
 * Convergence item #1: 3D pose lifting from existing MediaPipe data.
 * Convergence item #3: Anthropometric normalization via 3D distances.
 */

import { LANDMARKS } from './poseAnalysis';

// ---------------------------------------------------------------------------
// 3D angle: uses all three coordinates (x, y, z)
// ---------------------------------------------------------------------------

function angle3D(a, b, c) {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y + ba.z * ba.z);
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y + bc.z * bc.z);
  if (magBA < 1e-6 || magBC < 1e-6) return null;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

// ---------------------------------------------------------------------------
// 3D Euclidean distance
// ---------------------------------------------------------------------------

function dist3D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// ---------------------------------------------------------------------------
// Depth dominance: detects if primary motion is in Z axis
// Returns ratio of Z variance to total XYZ variance for a landmark
// ---------------------------------------------------------------------------

function computeDepthDominance(frames, landmarkIdx) {
  const xs = [], ys = [], zs = [];
  for (const f of frames) {
    const p = f && f[landmarkIdx];
    if (!p) continue;
    xs.push(p.x);
    ys.push(p.y);
    zs.push(p.z || 0);
  }
  if (xs.length < 4) return 0;

  const variance = (arr) => {
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((a, v) => a + (v - m) * (v - m), 0) / arr.length;
  };

  const vx = variance(xs), vy = variance(ys), vz = variance(zs);
  const total = vx + vy + vz;
  return total > 1e-10 ? vz / total : 0;
}

// ---------------------------------------------------------------------------
// Extract 3D signals from collected landmarks
// Returns array of { name, values } — same format as RepCounter._extractSignals
// ---------------------------------------------------------------------------

export function extractSignals3D(collectedLandmarks) {
  const N = collectedLandmarks.length;
  const signals = [];

  const lm = (frameIdx, landmarkIdx) => {
    const f = collectedLandmarks[frameIdx];
    return (f && f.length > landmarkIdx) ? f[landmarkIdx] : null;
  };

  // ── 3D Angle signals (9) ──
  // These already used z in calculateAngle3, but we make them explicit
  const angleSignal = (name, a, b, c) => {
    const values = [];
    for (let i = 0; i < N; i++) {
      const la = lm(i, a), lb = lm(i, b), lc = lm(i, c);
      if (!la || !lb || !lc) { values.push(null); continue; }
      values.push(angle3D(la, lb, lc));
    }
    return { name, values };
  };

  signals.push(angleSignal('elbow_L', LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST));
  signals.push(angleSignal('elbow_R', LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST));
  signals.push(angleSignal('knee_L', LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE));
  signals.push(angleSignal('knee_R', LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE));
  signals.push(angleSignal('hip_L', LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE));
  signals.push(angleSignal('hip_R', LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE));
  signals.push(angleSignal('shoulder_L', LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW));
  signals.push(angleSignal('shoulder_R', LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW));

  // Trunk angle
  const trunkValues = [];
  for (let i = 0; i < N; i++) {
    const ls = lm(i, LANDMARKS.LEFT_SHOULDER), rs = lm(i, LANDMARKS.RIGHT_SHOULDER);
    const lh = lm(i, LANDMARKS.LEFT_HIP), rh = lm(i, LANDMARKS.RIGHT_HIP);
    if (!ls || !rs || !lh || !rh) { trunkValues.push(null); continue; }
    const midS = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2, z: ((ls.z || 0) + (rs.z || 0)) / 2 };
    const midH = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2, z: ((lh.z || 0) + (rh.z || 0)) / 2 };
    const vertRef = { x: midH.x, y: midH.y - 1, z: midH.z };
    trunkValues.push(angle3D(midS, midH, vertRef));
  }
  signals.push({ name: 'trunk', values: trunkValues });

  // ── Y-position signals (6) ──
  const ySignal = (name, ...indices) => {
    const values = [];
    for (let i = 0; i < N; i++) {
      let sum = 0, count = 0;
      for (const idx of indices) {
        const p = lm(i, idx);
        if (p) { sum += p.y; count++; }
      }
      values.push(count > 0 ? sum / count : null);
    }
    return { name, values };
  };

  signals.push(ySignal('wrist_Y_L', LANDMARKS.LEFT_WRIST));
  signals.push(ySignal('wrist_Y_R', LANDMARKS.RIGHT_WRIST));
  signals.push(ySignal('nose_Y', LANDMARKS.NOSE));
  signals.push(ySignal('hip_Y', LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP));
  signals.push(ySignal('shoulder_Y', LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER));
  signals.push(ySignal('ankle_Y', LANDMARKS.LEFT_ANKLE, LANDMARKS.RIGHT_ANKLE));

  // ── Z-position signals (5) — THE NEW DEPTH SIGNALS ──
  // These capture motion along the camera's depth axis.
  // Bench press from front: wrist_Z oscillates. Pull-up from front: nose_Z oscillates.
  const zSignal = (name, ...indices) => {
    const values = [];
    for (let i = 0; i < N; i++) {
      let sum = 0, count = 0;
      for (const idx of indices) {
        const p = lm(i, idx);
        if (p && p.z !== undefined) { sum += p.z; count++; }
      }
      values.push(count > 0 ? sum / count : null);
    }
    return { name, values };
  };

  signals.push(zSignal('wrist_Z_L', LANDMARKS.LEFT_WRIST));
  signals.push(zSignal('wrist_Z_R', LANDMARKS.RIGHT_WRIST));
  signals.push(zSignal('nose_Z', LANDMARKS.NOSE));
  signals.push(zSignal('hip_Z', LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP));
  signals.push(zSignal('shoulder_Z', LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER));

  // ── 3D distance signals (4) ──
  // Camera-angle invariant: measures actual limb extension in 3D space
  const dist3DSignal = (name, a, b) => {
    const values = [];
    for (let i = 0; i < N; i++) {
      const la = lm(i, a), lb = lm(i, b);
      if (!la || !lb) { values.push(null); continue; }
      values.push(dist3D(la, lb));
    }
    return { name, values };
  };

  signals.push(dist3DSignal('wristShoulderDist3D_L', LANDMARKS.LEFT_WRIST, LANDMARKS.LEFT_SHOULDER));
  signals.push(dist3DSignal('wristShoulderDist3D_R', LANDMARKS.RIGHT_WRIST, LANDMARKS.RIGHT_SHOULDER));
  signals.push(dist3DSignal('ankleHipDist3D_L', LANDMARKS.LEFT_ANKLE, LANDMARKS.LEFT_HIP));
  signals.push(dist3DSignal('ankleHipDist3D_R', LANDMARKS.RIGHT_ANKLE, LANDMARKS.RIGHT_HIP));

  // ── 2D distance signals (for backward compat) ──
  const dist2DSignal = (name, a, b) => {
    const values = [];
    for (let i = 0; i < N; i++) {
      const la = lm(i, a), lb = lm(i, b);
      if (!la || !lb) { values.push(null); continue; }
      const dx = la.x - lb.x, dy = la.y - lb.y;
      values.push(Math.sqrt(dx * dx + dy * dy));
    }
    return { name, values };
  };

  signals.push(dist2DSignal('wristShoulderDist_L', LANDMARKS.LEFT_WRIST, LANDMARKS.LEFT_SHOULDER));
  signals.push(dist2DSignal('wristShoulderDist_R', LANDMARKS.RIGHT_WRIST, LANDMARKS.RIGHT_SHOULDER));

  return signals;
}

// ---------------------------------------------------------------------------
// Extended SIGNAL_PRIORITY with 3D signals
// Z-signals get priority for exercises where motion is primarily in depth axis
// ---------------------------------------------------------------------------

export const SIGNAL_PRIORITY_3D = {
  bicep_curl:    ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  hammer_curl:   ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  squat:         ['knee_L', 'knee_R', 'hip_Y', 'hip_Z'],
  goblet_squat:  ['knee_L', 'knee_R', 'hip_Y', 'hip_Z'],
  front_squat:   ['knee_L', 'knee_R', 'hip_Y'],
  lunge:         ['knee_L', 'knee_R', 'hip_Y'],
  // BENCH PRESS: the fix. Z-signals capture bar path toward/away from camera
  bench_press:   ['wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Y_L', 'wrist_Y_R'],
  push_up:       ['nose_Y', 'nose_Z', 'shoulder_Y', 'shoulder_Z'],
  pull_up:       ['nose_Y', 'nose_Z', 'shoulder_Y'],
  chin_up:       ['nose_Y', 'nose_Z', 'shoulder_Y'],
  sit_up:        ['nose_Y', 'trunk', 'nose_Z'],
  crunch:        ['nose_Y', 'trunk'],
  front_raise:   ['wrist_Y_L', 'wrist_Y_R', 'shoulder_L', 'shoulder_R'],
  lateral_raise: ['shoulder_L', 'shoulder_R', 'wrist_Y_L', 'wrist_Y_R'],
  overhead_press:['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R', 'wrist_Z_L', 'wrist_Z_R'],
  shoulder_press:['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R'],
  battle_rope:   ['wrist_Y_L', 'wrist_Y_R'],
  deadlift:      ['hip_L', 'hip_R', 'hip_Y', 'hip_Z'],
  romanian_deadlift: ['hip_L', 'hip_R', 'hip_Y', 'hip_Z'],
  bent_over_row: ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  upright_row:   ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R'],
  tricep_extension: ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R'],
  tricep_pushdown:  ['elbow_L', 'elbow_R'],
  leg_press:     ['knee_L', 'knee_R', 'ankleHipDist3D_L'],
  leg_extension: ['knee_L', 'knee_R'],
  leg_curl:      ['knee_L', 'knee_R'],
  calf_raise:    ['ankle_Y'],
  lying_bicep_curl: ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  lying_tricep_extension: ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
};

export { computeDepthDominance, angle3D, dist3D };
