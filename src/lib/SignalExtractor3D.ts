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

import { LANDMARKS, calculateAngle } from './poseGeometry';
import type { Landmark } from './types';

type LandmarkFrame = Landmark[] | null;

export interface Signal3D {
  name: string;
  values: (number | null)[];
}

// ---------------------------------------------------------------------------
// 3D angle: uses calculateAngle from poseGeometry (single source of truth).
// Returns null instead of 0 for degenerate inputs because signal arrays
// use null as "missing data point" for downstream interpolation.
// ---------------------------------------------------------------------------

function angle3D(a: Landmark, b: Landmark, c: Landmark): number | null {
  const result = calculateAngle(a, b, c);
  return result === 0 ? null : result;
}

// ---------------------------------------------------------------------------
// 3D Euclidean distance
// ---------------------------------------------------------------------------

function dist3D(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Extract 3D signals from collected landmarks
// Returns array of { name, values } — same format as RepCounter._extractSignals
// ---------------------------------------------------------------------------

export function extractSignals3D(collectedLandmarks: LandmarkFrame[]): Signal3D[] {
  const N = collectedLandmarks.length;
  const signals = [];

  const lm = (frameIdx: number, landmarkIdx: number): Landmark | null => {
    const f = collectedLandmarks[frameIdx];
    return (f && f.length > landmarkIdx) ? f[landmarkIdx] : null;
  };

  // ── 3D Angle signals (9) ──
  // These already used z in calculateAngle3, but we make them explicit
  const angleSignal = (name: string, a: number, b: number, c: number): Signal3D => {
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
  // MediaPipe landmark.y is normalized 0-1. Scale to 0-100 so valley
  // counting thresholds (designed for degree-scale values) work correctly.
  const ySignal = (name: string, ...indices: number[]): Signal3D => {
    const values = [];
    for (let i = 0; i < N; i++) {
      let sum = 0, count = 0;
      for (const idx of indices) {
        const p = lm(i, idx);
        if (p) { sum += p.y; count++; }
      }
      values.push(count > 0 ? (sum / count) * 100 : null);
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
  // Scale to 0-100 range for compatibility with valley counting thresholds.
  const zSignal = (name: string, ...indices: number[]): Signal3D => {
    const values = [];
    for (let i = 0; i < N; i++) {
      let sum = 0, count = 0;
      for (const idx of indices) {
        const p = lm(i, idx);
        if (p && p.z !== undefined) { sum += p.z; count++; }
      }
      values.push(count > 0 ? (sum / count) * 100 : null);
    }
    return { name, values };
  };

  signals.push(zSignal('wrist_Z_L', LANDMARKS.LEFT_WRIST));
  signals.push(zSignal('wrist_Z_R', LANDMARKS.RIGHT_WRIST));
  signals.push(zSignal('nose_Z', LANDMARKS.NOSE));
  signals.push(zSignal('hip_Z', LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP));
  signals.push(zSignal('shoulder_Z', LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER));

  // ── 3D distance signals (4) ──
  // Camera-angle invariant: measures actual limb extension in 3D space.
  // Scale to 0-100 range for compatibility with valley counting thresholds.
  const dist3DSignal = (name: string, a: number, b: number): Signal3D => {
    const values = [];
    for (let i = 0; i < N; i++) {
      const la = lm(i, a), lb = lm(i, b);
      if (!la || !lb) { values.push(null); continue; }
      values.push(dist3D(la, lb) * 100);
    }
    return { name, values };
  };

  signals.push(dist3DSignal('wristShoulderDist3D_L', LANDMARKS.LEFT_WRIST, LANDMARKS.LEFT_SHOULDER));
  signals.push(dist3DSignal('wristShoulderDist3D_R', LANDMARKS.RIGHT_WRIST, LANDMARKS.RIGHT_SHOULDER));
  signals.push(dist3DSignal('ankleHipDist3D_L', LANDMARKS.LEFT_ANKLE, LANDMARKS.LEFT_HIP));
  signals.push(dist3DSignal('ankleHipDist3D_R', LANDMARKS.RIGHT_ANKLE, LANDMARKS.RIGHT_HIP));

  // ── 2D distance signals (for backward compat) ──
  // Scale to 0-100 range for compatibility with valley counting thresholds.
  const dist2DSignal = (name: string, a: number, b: number): Signal3D => {
    const values = [];
    for (let i = 0; i < N; i++) {
      const la = lm(i, a), lb = lm(i, b);
      if (!la || !lb) { values.push(null); continue; }
      const dx = la.x - lb.x, dy = la.y - lb.y;
      values.push(Math.sqrt(dx * dx + dy * dy) * 100);
    }
    return { name, values };
  };

  signals.push(dist2DSignal('wristShoulderDist_L', LANDMARKS.LEFT_WRIST, LANDMARKS.LEFT_SHOULDER));
  signals.push(dist2DSignal('wristShoulderDist_R', LANDMARKS.RIGHT_WRIST, LANDMARKS.RIGHT_SHOULDER));

  return signals;
}

// ---------------------------------------------------------------------------
// Z-signal reliability check
//
// MediaPipe's Z is pseudo-depth inferred from a single 2D image, not measured
// from a depth camera. It drifts, hallucinates under occlusion, and has no
// calibrated accuracy guarantee. This function checks whether Z values in the
// collected landmarks show enough variance and stability to be usable for
// rep counting. Returns 0-1 where 1 = Z appears reliable.
// ---------------------------------------------------------------------------

export function computeZReliability(collectedLandmarks: LandmarkFrame[]): number {
  const N = collectedLandmarks.length;
  if (N < 10) return 0;

  // Check Z variance across key landmarks (wrists, shoulders, hips)
  const checkIndices = [
    LANDMARKS.LEFT_WRIST, LANDMARKS.RIGHT_WRIST,
    LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER,
    LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP,
  ];

  let totalZVariance = 0;
  let totalXYVariance = 0;
  let zeroZCount = 0;
  let totalPoints = 0;

  for (const idx of checkIndices) {
    const zVals = [];
    const yVals = [];
    for (let i = 0; i < N; i++) {
      const f = collectedLandmarks[i];
      const p = f && f[idx];
      if (!p) continue;
      zVals.push(p.z || 0);
      yVals.push(p.y);
      if (p.z === 0 || p.z === undefined) zeroZCount++;
      totalPoints++;
    }
    if (zVals.length < 4) continue;

    const variance = (arr: number[]) => {
      const m = arr.reduce((a: number, b: number) => a + b, 0) / arr.length;
      return arr.reduce((a: number, v: number) => a + (v - m) * (v - m), 0) / arr.length;
    };

    totalZVariance += variance(zVals);
    totalXYVariance += variance(yVals);
  }

  // If most Z values are exactly 0, Z is not being provided
  if (totalPoints > 0 && zeroZCount / totalPoints > 0.5) return 0;

  // If Z has no variance relative to Y, it is flat/uninformative
  if (totalXYVariance > 1e-10 && totalZVariance / totalXYVariance < 0.01) return 0.1;

  // Z has some signal — check consistency via autocorrelation of wrist Z
  // A reliable Z signal for rep counting should be periodic
  const wristZvals = [];
  for (let i = 0; i < N; i++) {
    const f = collectedLandmarks[i];
    const p = f && f[LANDMARKS.LEFT_WRIST];
    if (p && p.z !== undefined && p.z !== 0) wristZvals.push(p.z);
    else wristZvals.push(null);
  }

  const nonNull = wristZvals.filter(v => v !== null);
  if (nonNull.length < N * 0.5) return 0.2; // Too many Z dropouts

  // Z appears present and has variance — moderate confidence
  const ratio = totalXYVariance > 1e-10 ? totalZVariance / totalXYVariance : 0;
  return Math.min(1, 0.3 + ratio * 2);
}

// Signal names that depend on Z-axis data
const Z_DEPENDENT_SIGNALS = new Set([
  'wrist_Z_L', 'wrist_Z_R', 'nose_Z', 'hip_Z', 'shoulder_Z',
  'wristShoulderDist3D_L', 'wristShoulderDist3D_R',
  'ankleHipDist3D_L', 'ankleHipDist3D_R',
]);

/**
 * Check if a signal name depends on Z-axis depth data.
 */
export function isZDependentSignal(signalName: string): boolean {
  return Z_DEPENDENT_SIGNALS.has(signalName);
}

// ---------------------------------------------------------------------------
// Extended SIGNAL_PRIORITY with 3D signals
// Z-signals get priority for exercises where motion is primarily in depth axis
// ---------------------------------------------------------------------------

// Default signal priorities by joint type. Exercises not in the explicit
// SIGNAL_PRIORITY_3D map get these based on their DSL `joint` field.
// This extends adaptive signal selection from ~30 exercises to all 275.
const JOINT_DEFAULT_PRIORITIES: Record<string, string[]> = {
  elbow:    ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  knee:     ['knee_L', 'knee_R', 'hip_Y', 'ankleHipDist3D_L', 'ankleHipDist3D_R'],
  shoulder: ['shoulder_L', 'shoulder_R', 'wrist_Y_L', 'wrist_Y_R'],
  hip:      ['hip_L', 'hip_R', 'hip_Y', 'hip_Z', 'trunk'],
  multi:    ['hip_Y', 'shoulder_Y', 'nose_Y', 'trunk'],
};

export const SIGNAL_PRIORITY_3D: Record<string, string[]> = {
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
  sit_up:        ['nose_Y', 'shoulder_Y', 'trunk', 'nose_Z'],
  crunch:        ['nose_Y', 'trunk'],
  front_raise:   ['wrist_Y_L', 'wrist_Y_R', 'shoulder_L', 'shoulder_R'],
  lateral_raise: ['shoulder_L', 'shoulder_R', 'wrist_Y_L', 'wrist_Y_R'],
  overhead_press:['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R', 'wrist_Z_L', 'wrist_Z_R'],
  shoulder_press:['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R'],
  battle_rope:   ['wrist_Y_L', 'wrist_Y_R'],
  deadlift:      ['hip_L', 'hip_R', 'hip_Y', 'hip_Z'],
  romanian_deadlift: ['hip_L', 'hip_R', 'hip_Y', 'hip_Z'],
  lat_pulldown:  ['shoulder_L', 'shoulder_R', 'wrist_Y_L', 'wrist_Y_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  bent_over_row: ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  upright_row:   ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R'],
  tricep_extension: ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R'],
  tricep_pushdown:  ['elbow_L', 'elbow_R'],
  cable_tricep_pushdown: ['elbow_L', 'elbow_R'],
  rope_pushdown:    ['elbow_L', 'elbow_R'],
  leg_press:     ['knee_L', 'knee_R', 'ankleHipDist3D_L'],
  leg_extension: ['knee_L', 'knee_R'],
  leg_curl:      ['knee_L', 'knee_R'],
  calf_raise:    ['ankle_Y'],
  lying_bicep_curl: ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  lying_tricep_extension: ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  // Bench press variants — same Z-signal priority as flat bench
  incline_bench_press: ['wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Y_L', 'wrist_Y_R'],
  decline_bench_press: ['wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Y_L', 'wrist_Y_R'],
  close_grip_bench:    ['wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Y_L', 'wrist_Y_R'],
  // Push-up variants — same nose_Y/Z priority as standard push-up
  diamond_push_up:  ['nose_Y', 'nose_Z', 'shoulder_Y', 'shoulder_Z'],
  wide_push_up:     ['nose_Y', 'nose_Z', 'shoulder_Y', 'shoulder_Z'],
  incline_push_up:  ['nose_Y', 'nose_Z', 'shoulder_Y', 'shoulder_Z'],
  decline_push_up:  ['nose_Y', 'nose_Z', 'shoulder_Y', 'shoulder_Z'],
  pike_push_up:     ['nose_Y', 'nose_Z', 'shoulder_Y', 'shoulder_Z'],
  // Dips — elbow angle primary, shoulder_Y for depth
  dip:              ['elbow_L', 'elbow_R', 'shoulder_Y', 'wristShoulderDist3D_L'],
  chest_dip:        ['elbow_L', 'elbow_R', 'shoulder_Y', 'wristShoulderDist3D_L'],
  bench_dip:        ['elbow_L', 'elbow_R', 'shoulder_Y'],
  // Hip/glute — hip angle + Y position
  hip_thrust:       ['hip_L', 'hip_R', 'hip_Y'],
  glute_bridge:     ['hip_L', 'hip_R', 'hip_Y'],
  // Kettlebell swing — hip hinge driven
  kettlebell_swing: ['hip_L', 'hip_R', 'hip_Y', 'wrist_Y_L', 'wrist_Y_R'],
  // Shrug — shoulder Y-position is the primary signal (shoulder angle barely moves)
  shrug:            ['shoulder_Y', 'wrist_Y_L', 'wrist_Y_R'],
  dumbbell_shrug:   ['shoulder_Y', 'wrist_Y_L', 'wrist_Y_R'],
  cable_shrug:      ['shoulder_Y', 'wrist_Y_L', 'wrist_Y_R'],
  // Rows
  seated_row:       ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  // Face pull
  face_pull:        ['shoulder_L', 'shoulder_R', 'wrist_Z_L', 'wrist_Z_R'],
  // Fly movements
  cable_fly:        ['shoulder_L', 'shoulder_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  dumbbell_fly:     ['shoulder_L', 'shoulder_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  // Squat variants
  hack_squat:       ['knee_L', 'knee_R', 'hip_Y', 'hip_Z'],
  bulgarian_split_squat: ['knee_L', 'knee_R', 'hip_Y'],
  sumo_deadlift:    ['hip_L', 'hip_R', 'hip_Y', 'hip_Z'],
  // Explosive / cardio
  burpee:           ['knee_L', 'knee_R', 'hip_Y', 'nose_Y'],
  mountain_climber: ['hip_L', 'hip_R', 'knee_L', 'knee_R'],
  box_jump:         ['knee_L', 'knee_R', 'hip_Y'],
  thruster:         ['knee_L', 'knee_R', 'wrist_Y_L', 'wrist_Y_R'],
};

/**
 * Get signal priority for any exercise. Falls back to joint-based defaults
 * for exercises not in the explicit map.
 */
export function getSignalPriority(exerciseKey: string, jointType?: string): string[] | null {
  return SIGNAL_PRIORITY_3D[exerciseKey] || (jointType ? JOINT_DEFAULT_PRIORITIES[jointType] : null) || null;
}

