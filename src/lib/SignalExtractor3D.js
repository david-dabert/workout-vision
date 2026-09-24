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

// ---------------------------------------------------------------------------
// 3D angle: uses calculateAngle from poseGeometry (single source of truth).
// Returns null instead of 0 for degenerate inputs because signal arrays
// use null as "missing data point" for downstream interpolation.
// ---------------------------------------------------------------------------

function angle3D(a, b, c) {
  const result = calculateAngle(a, b, c);
  return result === 0 ? null : result;
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
  // MediaPipe landmark.y is normalized 0-1. Scale to 0-100 so valley
  // counting thresholds (designed for degree-scale values) work correctly.
  const ySignal = (name, ...indices) => {
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
  const zSignal = (name, ...indices) => {
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
  const dist3DSignal = (name, a, b) => {
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
  const dist2DSignal = (name, a, b) => {
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
// Extended SIGNAL_PRIORITY with 3D signals
// Z-signals get priority for exercises where motion is primarily in depth axis
// ---------------------------------------------------------------------------

// Default signal priorities by joint type. Exercises not in the explicit
// SIGNAL_PRIORITY_3D map get these based on their DSL `joint` field.
// This extends adaptive signal selection from ~30 exercises to all 275.
const JOINT_DEFAULT_PRIORITIES = {
  elbow:    ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  knee:     ['knee_L', 'knee_R', 'hip_Y', 'ankleHipDist3D_L', 'ankleHipDist3D_R'],
  shoulder: ['shoulder_L', 'shoulder_R', 'wrist_Y_L', 'wrist_Y_R'],
  hip:      ['hip_L', 'hip_R', 'hip_Y', 'hip_Z', 'trunk'],
  multi:    ['hip_Y', 'shoulder_Y', 'nose_Y', 'trunk'],
};

export const SIGNAL_PRIORITY_3D = {
  // ── SQUAT variants (knee primary, hip Y tracks vertical body motion) ──
  squat:              ['knee_L', 'knee_R', 'hip_Y', 'hip_Z', 'ankleHipDist3D_L', 'ankleHipDist3D_R'],
  front_squat:        ['knee_L', 'knee_R', 'hip_Y', 'hip_Z', 'ankleHipDist3D_L'],
  goblet_squat:       ['knee_L', 'knee_R', 'hip_Y', 'hip_Z', 'ankleHipDist3D_L'],
  hack_squat:         ['knee_L', 'knee_R', 'hip_Y', 'ankleHipDist3D_L', 'ankleHipDist3D_R'],
  smith_squat:        ['knee_L', 'knee_R', 'hip_Y', 'ankleHipDist3D_L'],
  zercher_squat:      ['knee_L', 'knee_R', 'hip_Y', 'hip_Z', 'ankleHipDist3D_L'],
  overhead_squat:     ['knee_L', 'knee_R', 'hip_Y', 'hip_Z', 'wrist_Y_L', 'wrist_Y_R'],
  box_squat:          ['knee_L', 'knee_R', 'hip_Y', 'hip_Z', 'ankleHipDist3D_L'],
  pause_squat:        ['knee_L', 'knee_R', 'hip_Y', 'hip_Z', 'ankleHipDist3D_L'],
  belt_squat:         ['knee_L', 'knee_R', 'hip_Y', 'ankleHipDist3D_L', 'ankleHipDist3D_R'],
  heel_elevated_squat:['knee_L', 'knee_R', 'hip_Y', 'hip_Z', 'ankleHipDist3D_L'],
  landmine_squat:     ['knee_L', 'knee_R', 'hip_Y', 'hip_Z'],
  pendulum_squat:     ['knee_L', 'knee_R', 'hip_Y', 'ankleHipDist3D_L', 'ankleHipDist3D_R'],
  sissy_squat:        ['knee_L', 'knee_R', 'hip_Y', 'shoulder_Y'],
  jump_squat:         ['knee_L', 'knee_R', 'hip_Y', 'ankle_Y'],
  pistol_squat:       ['knee_L', 'knee_R', 'hip_Y', 'ankleHipDist3D_L', 'ankleHipDist3D_R'],
  squat_jump_to_lunge:['knee_L', 'knee_R', 'hip_Y', 'ankle_Y'],
  kettlebell_goblet_squat: ['knee_L', 'knee_R', 'hip_Y', 'hip_Z', 'ankleHipDist3D_L'],
  trx_squat:          ['knee_L', 'knee_R', 'hip_Y', 'ankleHipDist3D_L'],
  band_squat:         ['knee_L', 'knee_R', 'hip_Y', 'ankleHipDist3D_L'],

  // ── LUNGE variants (knee primary, hip Y for vertical drop) ──
  lunge:              ['knee_L', 'knee_R', 'hip_Y', 'ankleHipDist3D_L', 'ankleHipDist3D_R'],
  bulgarian_split_squat: ['knee_L', 'knee_R', 'hip_Y', 'ankleHipDist3D_L', 'ankleHipDist3D_R'],
  reverse_lunge:      ['knee_L', 'knee_R', 'hip_Y', 'ankleHipDist3D_L'],
  walking_lunge:      ['knee_L', 'knee_R', 'hip_Y', 'ankleHipDist3D_L'],
  side_lunge:         ['knee_L', 'knee_R', 'hip_Y', 'ankleHipDist3D_L'],
  curtsy_lunge:       ['knee_L', 'knee_R', 'hip_Y', 'ankleHipDist3D_L'],
  trx_lunge:          ['knee_L', 'knee_R', 'hip_Y', 'ankleHipDist3D_L'],

  // ── DEADLIFT variants (hip hinge, hip angles + vertical rise) ──
  deadlift:           ['hip_L', 'hip_R', 'hip_Y', 'hip_Z', 'shoulder_Y'],
  romanian_deadlift:  ['hip_L', 'hip_R', 'hip_Y', 'hip_Z', 'shoulder_Y'],
  sumo_deadlift:      ['hip_L', 'hip_R', 'hip_Y', 'hip_Z', 'shoulder_Y'],
  stiff_leg_deadlift: ['hip_L', 'hip_R', 'hip_Y', 'hip_Z', 'shoulder_Y'],
  single_leg_deadlift:['hip_L', 'hip_R', 'hip_Y', 'hip_Z', 'shoulder_Y'],
  rack_pull:          ['hip_L', 'hip_R', 'hip_Y', 'hip_Z', 'shoulder_Y'],
  kettlebell_deadlift:['hip_L', 'hip_R', 'hip_Y', 'hip_Z', 'shoulder_Y'],
  band_deadlift:      ['hip_L', 'hip_R', 'hip_Y', 'hip_Z', 'shoulder_Y'],

  // ── HIP HINGE / GOOD MORNING variants ──
  good_morning:       ['hip_L', 'hip_R', 'hip_Y', 'trunk', 'shoulder_Y'],
  band_good_morning:  ['hip_L', 'hip_R', 'hip_Y', 'trunk', 'shoulder_Y'],
  jefferson_curl:     ['hip_L', 'hip_R', 'hip_Y', 'trunk', 'nose_Y'],
  kettlebell_swing:   ['hip_L', 'hip_R', 'hip_Y', 'wrist_Y_L', 'wrist_Y_R', 'hip_Z'],

  // ── HIP THRUST / GLUTE BRIDGE variants ──
  hip_thrust:         ['hip_L', 'hip_R', 'hip_Y', 'hip_Z', 'shoulder_Y'],
  glute_bridge:       ['hip_L', 'hip_R', 'hip_Y', 'hip_Z'],
  single_leg_hip_thrust: ['hip_L', 'hip_R', 'hip_Y', 'hip_Z'],
  band_hip_thrust:    ['hip_L', 'hip_R', 'hip_Y', 'hip_Z'],
  stability_ball_hip_thrust: ['hip_L', 'hip_R', 'hip_Y', 'hip_Z'],
  cable_pull_through: ['hip_L', 'hip_R', 'hip_Y', 'hip_Z'],

  // ── GLUTE ISOLATION ──
  donkey_kick:        ['hip_L', 'hip_R', 'ankle_Y', 'ankleHipDist3D_L', 'ankleHipDist3D_R'],
  fire_hydrant:       ['hip_L', 'hip_R', 'ankle_Y', 'ankleHipDist3D_L'],
  cable_hip_extension:['hip_L', 'hip_R', 'ankle_Y', 'ankleHipDist3D_L', 'ankleHipDist3D_R'],
  reverse_hyperextension: ['hip_L', 'hip_R', 'ankle_Y', 'ankleHipDist3D_L'],
  band_clamshell:     ['hip_L', 'hip_R', 'knee_L', 'knee_R'],

  // ── HIP ADDUCTOR / ABDUCTOR ──
  adductor_machine:   ['hip_L', 'hip_R', 'ankleHipDist3D_L', 'ankleHipDist3D_R'],
  abductor_machine:   ['hip_L', 'hip_R', 'ankleHipDist3D_L', 'ankleHipDist3D_R'],
  cable_hip_adduction:['hip_L', 'hip_R', 'ankle_Y', 'ankleHipDist3D_L'],
  cable_hip_abduction:['hip_L', 'hip_R', 'ankle_Y', 'ankleHipDist3D_L'],

  // ── LEG PRESS / LEG MACHINE variants ──
  leg_press:          ['knee_L', 'knee_R', 'ankleHipDist3D_L', 'ankleHipDist3D_R'],
  single_leg_press:   ['knee_L', 'knee_R', 'ankleHipDist3D_L', 'ankleHipDist3D_R'],
  leg_extension:      ['knee_L', 'knee_R', 'ankle_Y', 'ankleHipDist3D_L', 'ankleHipDist3D_R'],
  standing_leg_extension: ['knee_L', 'knee_R', 'ankle_Y', 'ankleHipDist3D_L'],
  leg_curl:           ['knee_L', 'knee_R', 'ankle_Y', 'ankleHipDist3D_L', 'ankleHipDist3D_R'],
  lying_leg_curl:     ['knee_L', 'knee_R', 'ankle_Y', 'ankleHipDist3D_L'],
  nordic_curl:        ['knee_L', 'knee_R', 'nose_Y', 'shoulder_Y', 'trunk'],
  glute_ham_raise:    ['knee_L', 'knee_R', 'nose_Y', 'trunk', 'hip_L'],
  trx_hamstring_curl: ['knee_L', 'knee_R', 'ankle_Y', 'ankleHipDist3D_L', 'hip_Y'],
  stability_ball_hamstring_curl: ['knee_L', 'knee_R', 'ankle_Y', 'ankleHipDist3D_L', 'hip_Y'],

  // ── CALF variants ──
  calf_raise:         ['ankle_Y', 'hip_Y', 'shoulder_Y'],
  seated_calf_raise:  ['ankle_Y', 'knee_L', 'knee_R'],
  donkey_calf_raise:  ['ankle_Y', 'hip_Y'],
  leg_press_calf_raise: ['ankle_Y', 'ankleHipDist3D_L'],
  tibialis_raise:     ['ankle_Y', 'knee_L', 'knee_R'],
  step_up:            ['knee_L', 'knee_R', 'hip_Y', 'ankle_Y'],

  // ── PLYOMETRIC (knee, hip Y + ankle Y for jump height) ──
  box_jump:           ['knee_L', 'knee_R', 'hip_Y', 'ankle_Y'],
  depth_jump:         ['knee_L', 'knee_R', 'hip_Y', 'ankle_Y'],
  broad_jump:         ['knee_L', 'knee_R', 'hip_Y', 'ankle_Y'],
  split_squat_jump:   ['knee_L', 'knee_R', 'hip_Y', 'ankle_Y'],
  tuck_jump:          ['knee_L', 'knee_R', 'hip_Y', 'ankle_Y'],
  skater_jump:        ['knee_L', 'knee_R', 'hip_Y', 'ankle_Y'],

  // ── PUSH-UP variants (body drops/rises, nose Y + Z primary) ──
  push_up:            ['nose_Y', 'nose_Z', 'shoulder_Y', 'shoulder_Z', 'elbow_L', 'elbow_R'],
  diamond_push_up:    ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  wide_push_up:       ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  archer_push_up:     ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  incline_push_up:    ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  decline_push_up:    ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  deficit_push_up:    ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  deficit_push_down:  ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  hand_release_push_up: ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  close_grip_push_up: ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  pike_push_up:       ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  one_arm_push_up:    ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  trx_push_up:        ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  ring_push_up:       ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  stability_ball_push_up: ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],

  // ── BENCH PRESS variants (bar depth Z, bar height Y, wrist-shoulder dist) ──
  bench_press:        ['wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Y_L', 'wrist_Y_R'],
  incline_bench_press:['wrist_Z_L', 'wrist_Z_R', 'wrist_Y_L', 'wrist_Y_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  decline_bench_press:['wrist_Z_L', 'wrist_Z_R', 'wrist_Y_L', 'wrist_Y_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  close_grip_bench:   ['wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'elbow_L', 'elbow_R'],
  floor_press:        ['wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'elbow_L', 'elbow_R'],
  incline_dumbbell_press: ['wrist_Z_L', 'wrist_Z_R', 'wrist_Y_L', 'wrist_Y_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  decline_dumbbell_press: ['wrist_Z_L', 'wrist_Z_R', 'wrist_Y_L', 'wrist_Y_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  flat_dumbbell_press:['wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Y_L', 'wrist_Y_R'],
  machine_chest_press:['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  landmine_press:     ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R', 'wrist_Z_L', 'wrist_Z_R'],
  band_chest_press:   ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  jm_press:           ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  tate_press:         ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  svend_press:        ['wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],

  // ── DIP variants (body drops, elbow bends) ──
  dip:                ['elbow_L', 'elbow_R', 'shoulder_Y', 'nose_Y', 'wrist_Y_L'],
  chest_dip:          ['elbow_L', 'elbow_R', 'shoulder_Y', 'nose_Y', 'wrist_Y_L'],
  bench_dip:          ['elbow_L', 'elbow_R', 'shoulder_Y', 'hip_Y'],
  ring_dip:           ['elbow_L', 'elbow_R', 'shoulder_Y', 'nose_Y'],

  // ── OVERHEAD PRESS variants (wrist rises, elbow extends) ──
  overhead_press:     ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R', 'wrist_Z_L', 'wrist_Z_R'],
  shoulder_press:     ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R'],
  arnold_press:       ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R', 'shoulder_L', 'shoulder_R'],
  push_press:         ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R', 'knee_L'],
  split_jerk:         ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R', 'knee_L'],
  machine_shoulder_press: ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R'],
  dumbbell_overhead_press: ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R', 'wrist_Z_L'],
  seated_dumbbell_press: ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R'],
  z_press:            ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R'],
  kettlebell_press:   ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R'],
  handstand_push_up:  ['elbow_L', 'elbow_R', 'nose_Y', 'shoulder_Y'],

  // ── PULL-UP / CHIN-UP variants (body rises, nose Y primary) ──
  pull_up:            ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  chin_up:            ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  neutral_grip_pull_up: ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  wide_grip_pull_up:  ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  close_grip_pull_up: ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  assisted_pull_up:   ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  kipping_pull_up:    ['nose_Y', 'nose_Z', 'shoulder_Y', 'hip_Y'],
  commando_pull_up:   ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  muscle_up:          ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  typewriter_pull_up: ['nose_Y', 'nose_Z', 'shoulder_Y', 'elbow_L', 'elbow_R'],
  scapular_pull_up:   ['shoulder_Y', 'nose_Y', 'shoulder_L', 'shoulder_R'],

  // ── LAT PULLDOWN / VERTICAL PULL ──
  lat_pulldown:       ['shoulder_L', 'shoulder_R', 'wrist_Y_L', 'wrist_Y_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  straight_arm_pulldown: ['shoulder_L', 'shoulder_R', 'wrist_Y_L', 'wrist_Y_R', 'wristShoulderDist3D_L'],

  // ── ROW variants (elbow bends, wrist Z pulls toward body) ──
  bent_over_row:      ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  t_bar_row:          ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  pendlay_row:        ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  yates_row:          ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  seated_row:         ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  chest_supported_row:['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  single_arm_dumbbell_row: ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  meadows_row:        ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  seal_row:           ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  machine_row:        ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  cable_row_single:   ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  incline_dumbbell_row: ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  inverted_row:       ['elbow_L', 'elbow_R', 'nose_Y', 'nose_Z', 'shoulder_Y'],
  renegade_row:       ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  upright_row:        ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R', 'shoulder_L', 'shoulder_R'],
  trx_row:            ['elbow_L', 'elbow_R', 'nose_Y', 'nose_Z', 'shoulder_Y'],
  band_row:           ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  ring_row:           ['elbow_L', 'elbow_R', 'nose_Y', 'nose_Z', 'shoulder_Y'],
  kettlebell_row:     ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],

  // ── BICEP CURL variants (elbow flexion, wrist-shoulder distance) ──
  bicep_curl:         ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Y_L', 'wrist_Y_R'],
  hammer_curl:        ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Y_L', 'wrist_Y_R'],
  preacher_curl:      ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Y_L'],
  concentration_curl: ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  lying_bicep_curl:   ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  spider_curl:        ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  barbell_curl:       ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Y_L', 'wrist_Y_R'],
  ez_bar_curl:        ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Y_L', 'wrist_Y_R'],
  cable_curl:         ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Y_L', 'wrist_Y_R'],
  incline_dumbbell_curl: ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Y_L'],
  reverse_curl:       ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Y_L', 'wrist_Y_R'],
  zottman_curl:       ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Y_L', 'wrist_Y_R'],
  drag_curl:          ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Y_L'],
  cross_body_curl:    ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  machine_curl:       ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  trx_bicep_curl:     ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'nose_Y'],

  // ── TRICEP PUSHDOWN / EXTENSION variants (wrist Y drops, elbow extends) ──
  tricep_pushdown:    ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  cable_tricep_pushdown: ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  rope_pushdown:      ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  tricep_extension:   ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  lying_tricep_extension: ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Z_L'],
  skull_crusher:      ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R', 'wrist_Z_L', 'wrist_Z_R'],
  overhead_cable_tricep: ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  machine_tricep_extension: ['elbow_L', 'elbow_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  kickback:           ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  cable_kickback:     ['elbow_L', 'elbow_R', 'wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L'],
  trx_tricep_extension: ['elbow_L', 'elbow_R', 'nose_Y', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],

  // ── SHOULDER RAISE / FLY variants (arm abduction/flexion, wrist Y) ──
  front_raise:        ['wrist_Y_L', 'wrist_Y_R', 'shoulder_L', 'shoulder_R', 'wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
  lateral_raise:      ['shoulder_L', 'shoulder_R', 'wrist_Y_L', 'wrist_Y_R', 'wristShoulderDist_L', 'wristShoulderDist_R'],
  seated_lateral_raise: ['shoulder_L', 'shoulder_R', 'wrist_Y_L', 'wrist_Y_R', 'wristShoulderDist_L'],
  cable_lateral_raise:['shoulder_L', 'shoulder_R', 'wrist_Y_L', 'wrist_Y_R', 'wristShoulderDist_L'],
  cable_front_raise:  ['wrist_Y_L', 'wrist_Y_R', 'shoulder_L', 'shoulder_R', 'wristShoulderDist3D_L'],
  band_lateral_raise: ['shoulder_L', 'shoulder_R', 'wrist_Y_L', 'wrist_Y_R', 'wristShoulderDist_L'],
  rear_delt_fly:      ['shoulder_L', 'shoulder_R', 'wristShoulderDist_L', 'wristShoulderDist_R', 'wrist_Z_L', 'wrist_Z_R'],
  cable_rear_delt_fly:['shoulder_L', 'shoulder_R', 'wristShoulderDist_L', 'wristShoulderDist_R', 'wrist_Z_L'],
  machine_rear_delt_fly: ['shoulder_L', 'shoulder_R', 'wristShoulderDist_L', 'wristShoulderDist_R'],
  cable_reverse_fly:  ['shoulder_L', 'shoulder_R', 'wristShoulderDist_L', 'wristShoulderDist_R', 'wrist_Z_L'],
  prone_y_raise:      ['shoulder_L', 'shoulder_R', 'wrist_Y_L', 'wrist_Y_R'],
  band_pull_apart:    ['shoulder_L', 'shoulder_R', 'wristShoulderDist_L', 'wristShoulderDist_R'],

  // ── FACE PULL / ROTATOR CUFF ──
  face_pull:          ['shoulder_L', 'shoulder_R', 'wrist_Y_L', 'wrist_Y_R', 'elbow_L', 'elbow_R'],
  band_face_pull:     ['shoulder_L', 'shoulder_R', 'wrist_Y_L', 'wrist_Y_R', 'elbow_L', 'elbow_R'],
  external_rotation:  ['shoulder_L', 'shoulder_R', 'wrist_Z_L', 'wrist_Z_R'],
  internal_rotation:  ['shoulder_L', 'shoulder_R', 'wrist_Z_L', 'wrist_Z_R'],

  // ── CHEST FLY / CROSSOVER variants ──
  cable_fly:          ['shoulder_L', 'shoulder_R', 'wristShoulderDist_L', 'wristShoulderDist_R', 'wrist_Z_L', 'wrist_Z_R'],
  dumbbell_fly:       ['shoulder_L', 'shoulder_R', 'wristShoulderDist_L', 'wristShoulderDist_R', 'wrist_Z_L', 'wrist_Z_R'],
  cable_crossover:    ['shoulder_L', 'shoulder_R', 'wristShoulderDist_L', 'wristShoulderDist_R', 'wrist_Z_L', 'wrist_Z_R'],
  machine_fly:        ['shoulder_L', 'shoulder_R', 'wristShoulderDist_L', 'wristShoulderDist_R'],
  dumbbell_pullover:  ['shoulder_L', 'shoulder_R', 'wrist_Y_L', 'wrist_Y_R', 'wrist_Z_L', 'wrist_Z_R'],

  // ── SHRUG variants (shoulder Y rises) ──
  shrug:              ['shoulder_Y', 'shoulder_L', 'shoulder_R'],
  dumbbell_shrug:     ['shoulder_Y', 'shoulder_L', 'shoulder_R'],
  cable_shrug:        ['shoulder_Y', 'shoulder_L', 'shoulder_R'],

  // ── FOREARM / WRIST ──
  wrist_curl:         ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R'],
  wrist_extension:    ['elbow_L', 'elbow_R', 'wrist_Y_L', 'wrist_Y_R'],

  // ── CORE / ABS (trunk angle, nose Y, hip angles) ──
  sit_up:             ['nose_Y', 'trunk', 'nose_Z', 'hip_L', 'hip_R'],
  crunch:             ['nose_Y', 'trunk', 'shoulder_Y'],
  v_up:               ['nose_Y', 'trunk', 'ankle_Y', 'hip_L'],
  russian_twist:      ['trunk', 'wrist_Z_L', 'wrist_Z_R', 'shoulder_Z'],
  bicycle_crunch:     ['knee_L', 'knee_R', 'trunk', 'nose_Y'],
  flutter_kick:       ['ankle_Y', 'hip_L', 'hip_R', 'nose_Y'],
  superman:           ['trunk', 'nose_Y', 'shoulder_Y', 'ankle_Y'],
  toes_to_bar:        ['ankle_Y', 'hip_L', 'hip_R', 'nose_Y'],
  hanging_leg_raise:  ['ankle_Y', 'hip_L', 'hip_R', 'knee_L'],
  hanging_knee_raise: ['knee_L', 'knee_R', 'hip_L', 'hip_R', 'ankle_Y'],
  lying_leg_raise:    ['ankle_Y', 'hip_L', 'hip_R'],
  ab_wheel_rollout:   ['shoulder_L', 'shoulder_R', 'nose_Y', 'wrist_Y_L', 'wristShoulderDist3D_L'],
  dragon_flag:        ['hip_L', 'hip_R', 'ankle_Y', 'trunk', 'nose_Y'],
  cable_crunch:       ['trunk', 'nose_Y', 'hip_L', 'hip_R'],
  decline_crunch:     ['trunk', 'nose_Y', 'hip_L', 'hip_R'],
  wood_chop:          ['trunk', 'wrist_Y_L', 'wrist_Y_R', 'shoulder_L', 'shoulder_R'],
  pallof_press:       ['wrist_Z_L', 'wrist_Z_R', 'wristShoulderDist3D_L', 'shoulder_L'],
  dead_bug:           ['ankle_Y', 'wrist_Y_L', 'wrist_Y_R', 'hip_L', 'hip_R'],
  windshield_wiper:   ['ankle_Y', 'hip_L', 'hip_R', 'knee_L'],
  ab_crunch_machine:  ['trunk', 'nose_Y', 'hip_L', 'hip_R'],
  stability_ball_crunch: ['trunk', 'nose_Y', 'shoulder_Y'],

  // ── PLANK / ISOMETRIC HOLD variants ──
  plank:              ['hip_Y', 'trunk', 'nose_Y', 'shoulder_Y'],
  side_plank:         ['hip_Y', 'trunk', 'shoulder_Y'],
  copenhagen_plank:   ['hip_Y', 'trunk', 'shoulder_Y', 'ankle_Y'],
  hollow_body_hold:   ['hip_Y', 'trunk', 'nose_Y', 'ankle_Y'],
  l_sit:              ['hip_Y', 'hip_L', 'hip_R', 'ankle_Y'],
  wall_sit:           ['knee_L', 'knee_R', 'hip_Y', 'shoulder_Y'],
  dead_hang:          ['shoulder_Y', 'shoulder_L', 'shoulder_R', 'wrist_Y_L'],
  overhead_hold:      ['wrist_Y_L', 'wrist_Y_R', 'shoulder_L', 'shoulder_R'],
  front_lever:        ['shoulder_L', 'shoulder_R', 'hip_Y', 'nose_Y'],
  back_lever:         ['shoulder_L', 'shoulder_R', 'hip_Y', 'nose_Y'],
  planche:            ['shoulder_L', 'shoulder_R', 'hip_Y', 'nose_Y'],

  // ── BACK EXTENSION variants ──
  back_extension:     ['hip_L', 'hip_R', 'trunk', 'nose_Y', 'shoulder_Y'],
  back_extension_45:  ['hip_L', 'hip_R', 'trunk', 'nose_Y', 'shoulder_Y'],
  seated_back_extension: ['hip_L', 'hip_R', 'trunk', 'nose_Y'],
  stability_ball_back_extension: ['hip_L', 'hip_R', 'trunk', 'nose_Y', 'shoulder_Y'],

  // ── OLYMPIC LIFTS (multi-joint, hip + wrist Y + shoulder) ──
  power_clean:        ['hip_L', 'hip_R', 'hip_Y', 'wrist_Y_L', 'wrist_Y_R', 'shoulder_Y'],
  snatch:             ['hip_L', 'hip_R', 'hip_Y', 'wrist_Y_L', 'wrist_Y_R', 'shoulder_Y'],
  clean_and_press:    ['hip_Y', 'wrist_Y_L', 'wrist_Y_R', 'knee_L', 'knee_R', 'elbow_L'],
  clean_and_jerk:     ['hip_Y', 'wrist_Y_L', 'wrist_Y_R', 'elbow_L', 'elbow_R', 'knee_L'],
  hang_clean:         ['hip_L', 'hip_R', 'hip_Y', 'wrist_Y_L', 'wrist_Y_R'],
  hang_snatch:        ['hip_L', 'hip_R', 'hip_Y', 'wrist_Y_L', 'wrist_Y_R'],
  clean_pull:         ['hip_L', 'hip_R', 'hip_Y', 'shoulder_Y', 'wrist_Y_L'],
  snatch_pull:        ['hip_L', 'hip_R', 'hip_Y', 'shoulder_Y', 'wrist_Y_L'],
  kettlebell_clean:   ['hip_L', 'hip_R', 'hip_Y', 'wrist_Y_L', 'wrist_Y_R'],
  kettlebell_snatch:  ['wrist_Y_L', 'wrist_Y_R', 'hip_L', 'hip_R', 'shoulder_L'],

  // ── COMPLEX / FULL BODY ──
  thruster:           ['knee_L', 'knee_R', 'hip_Y', 'wrist_Y_L', 'wrist_Y_R', 'elbow_L'],
  man_maker:          ['knee_L', 'knee_R', 'hip_Y', 'wrist_Y_L', 'nose_Y', 'elbow_L'],
  turkish_get_up:     ['wrist_Y_L', 'wrist_Y_R', 'hip_Y', 'shoulder_L', 'shoulder_R', 'nose_Y'],
  wall_ball:          ['knee_L', 'knee_R', 'hip_Y', 'wrist_Y_L', 'wrist_Y_R'],
  burpee:             ['knee_L', 'knee_R', 'hip_Y', 'nose_Y', 'ankle_Y'],
  mountain_climber:   ['knee_L', 'knee_R', 'hip_Y', 'ankle_Y', 'hip_L'],
  bear_crawl:         ['hip_Y', 'knee_L', 'knee_R', 'shoulder_Y', 'nose_Y'],
  devil_press:        ['wrist_Y_L', 'wrist_Y_R', 'hip_Y', 'nose_Y', 'shoulder_L'],
  dumbbell_snatch:    ['wrist_Y_L', 'wrist_Y_R', 'hip_Y', 'hip_L', 'shoulder_L'],
  dumbbell_clean:     ['hip_L', 'hip_R', 'hip_Y', 'wrist_Y_L', 'wrist_Y_R'],
  skin_the_cat:       ['shoulder_L', 'shoulder_R', 'hip_Y', 'nose_Y', 'ankle_Y'],
  wall_walk:          ['wrist_Y_L', 'wrist_Y_R', 'nose_Y', 'shoulder_Y', 'hip_Y'],

  // ── KETTLEBELL SPECIALS ──
  kettlebell_windmill:['hip_L', 'hip_R', 'trunk', 'wrist_Y_L', 'wrist_Y_R'],

  // ── TRX / PIKE SPECIALS ──
  trx_pike:           ['hip_Y', 'shoulder_Y', 'nose_Y', 'trunk'],
  stability_ball_pike:['hip_Y', 'shoulder_Y', 'nose_Y', 'trunk'],

  // ── CARDIO / MACHINE ──
  battle_rope:        ['wrist_Y_L', 'wrist_Y_R', 'shoulder_L', 'shoulder_R'],
  jumping_jack:       ['shoulder_L', 'shoulder_R', 'wrist_Y_L', 'wrist_Y_R', 'ankle_Y'],
  rowing_machine:     ['hip_L', 'hip_R', 'hip_Y', 'knee_L', 'wrist_Z_L', 'shoulder_Y'],
  ski_erg:            ['wrist_Y_L', 'wrist_Y_R', 'shoulder_L', 'shoulder_R', 'hip_Y'],
  assault_bike:       ['knee_L', 'knee_R', 'hip_Y', 'wrist_Y_L'],

  // ── CARRY / LOCOMOTION ──
  farmers_walk:       ['shoulder_Y', 'hip_Y', 'wrist_Y_L', 'wrist_Y_R'],
  sandbag_carry:      ['shoulder_Y', 'hip_Y', 'nose_Y'],
  sled_push:          ['knee_L', 'knee_R', 'hip_Y', 'shoulder_Y'],
  sled_pull:          ['hip_L', 'hip_R', 'hip_Y', 'shoulder_Y'],
  tire_flip:          ['hip_L', 'hip_R', 'hip_Y', 'wrist_Y_L', 'knee_L'],
  rope_climb:         ['wrist_Y_L', 'wrist_Y_R', 'nose_Y', 'elbow_L', 'elbow_R'],

  // ── MULTI / CATCH-ALL ──
  superset:           ['hip_Y', 'shoulder_Y', 'nose_Y', 'trunk', 'knee_L', 'knee_R'],
};

/**
 * Get signal priority for any exercise. Falls back to joint-based defaults
 * for exercises not in the explicit map.
 */
export function getSignalPriority(exerciseKey, jointType) {
  return SIGNAL_PRIORITY_3D[exerciseKey] || JOINT_DEFAULT_PRIORITIES[jointType] || null;
}

