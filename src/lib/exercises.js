/**
 * Exercise database and shared helpers.
 *
 * Scientific references embedded per exercise. Joint angle thresholds
 * calibrated from biomechanics literature and empirical tuning on
 * MediaPipe Pose Landmarker output (normalized 0-1 coordinates, lite model).
 *
 * Angles object shape (from poseAnalysis.extractJointAngles):
 *   { leftKnee, rightKnee, leftHip, rightHip,
 *     leftElbow, rightElbow, leftShoulder, rightShoulder, trunk }
 *   All values in degrees.
 *
 * RepCounter and ExerciseAutoDetector have been split into separate modules
 * (repCounter.js and exerciseDetector.js) but are re-exported here so that
 * existing imports continue to work.
 */

// ---------------------------------------------------------------------------
// Visibility-aware bilateral selection
// ---------------------------------------------------------------------------
// When filming from the side, MediaPipe hallucinates the occluded arm/leg.
// Using Math.min of both sides clamps the value to the hallucinated angle,
// preventing threshold crossing. This helper uses the side with better
// landmark visibility, falling back safely when both are low-confidence.
//
// VIS_THRESHOLD raised from 0.5 to 0.6: MediaPipe visibility is a confidence
// score, not actual occlusion percentage. At 0.5, ~30% of selected landmarks
// are hallucinations. At 0.6, this drops to ~15%.
const VIS_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// Continuous form quality helpers (0-1 gradient scoring)
// ---------------------------------------------------------------------------
// These replace binary pass/fail with smooth quality curves.
// A quality of 1.0 = perfect form. 0.0 = clearly failing.
// The margin parameter controls the transition zone width in degrees.

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

/** Quality for "angle should be below threshold" (e.g., depth, trunk lean) */
export function qualityBelow(angle, threshold, margin = 15) {
  if (angle == null || isNaN(angle)) return 0;
  return clamp01((threshold - angle + margin) / (2 * margin));
}

/** Quality for "angle should be above threshold" (e.g., lockout, extension) */
export function qualityAbove(angle, threshold, margin = 15) {
  if (angle == null || isNaN(angle)) return 0;
  return clamp01((angle - threshold + margin) / (2 * margin));
}

/** Quality for bilateral symmetry checks (lower difference = higher quality) */
export function qualitySymmetry(left, right, threshold) {
  if (left == null || right == null || isNaN(left) || isNaN(right)) return 0;
  const diff = Math.abs(left - right);
  return clamp01(1 - diff / (threshold * 1.5));
}

/** Quality for "angle within range" checks (e.g., trunk 20-80°) */
export function qualityRange(angle, low, high, margin = 10) {
  if (angle == null || isNaN(angle)) return 0;
  if (angle >= low && angle <= high) return 1;
  const distOutside = angle < low ? low - angle : angle - high;
  return clamp01(1 - distOutside / margin);
}

/**
 * Visibility-aware bilateral selection.
 * @param {object} angles - joint angles with visibility metadata
 * @param {string} leftKey - left angle key
 * @param {string} rightKey - right angle key
 * @param {string} visLeftKey - left visibility key
 * @param {string} visRightKey - right visibility key
 * @param {function} agg - aggregation when both sides valid (Math.min or Math.max)
 */
function bestSideAgg(angles, leftKey, rightKey, visLeftKey, visRightKey, agg) {
  const lv = angles[visLeftKey] || 0;
  const rv = angles[visRightKey] || 0;
  const left = angles[leftKey];
  const right = angles[rightKey];
  const leftOk = lv >= VIS_THRESHOLD && left != null && !isNaN(left);
  const rightOk = rv >= VIS_THRESHOLD && right != null && !isNaN(right);
  if (leftOk && rightOk) return agg(left, right);
  if (leftOk) return left;
  if (rightOk) return right;
  // Neither well-tracked: prefer higher-visibility side
  if (left != null && !isNaN(left) && right != null && !isNaN(right)) {
    return lv >= rv ? left : right;
  }
  if (left != null && !isNaN(left)) return left;
  if (right != null && !isNaN(right)) return right;
  return null;
}

export function bestSide(angles, leftKey, rightKey, visLeftKey, visRightKey) {
  return bestSideAgg(angles, leftKey, rightKey, visLeftKey, visRightKey, Math.min);
}

export function bestSideMax(angles, leftKey, rightKey, visLeftKey, visRightKey) {
  return bestSideAgg(angles, leftKey, rightKey, visLeftKey, visRightKey, Math.max);
}

// ---------------------------------------------------------------------------
// Exercise database — compiled from declarative DSL definitions
// ---------------------------------------------------------------------------
// The DSL definitions live in exerciseDefinitions.js and are compiled at
// module init by exerciseDSL.js. This replaces the previous 5000+ lines of
// imperative definitions with a single import + compile step.
// ---------------------------------------------------------------------------

import { compileExercises } from './exerciseDSL';
import { EXERCISE_DEFINITIONS } from './exerciseDefinitions';

// Compile DSL definitions into runtime objects — single source of truth
export const EXERCISES = compileExercises(EXERCISE_DEFINITIONS);

// Build a map from exercise key to its DSL value type string (e.g. 'bestSide', 'bestSideMax', 'direct')
// Used by tier classification to check if an exercise's signal pattern has been validated.
const VALUE_TYPE_MAP = {};
for (const [key, dsl] of Object.entries(EXERCISE_DEFINITIONS)) {
  VALUE_TYPE_MAP[key] = dsl.value?.type || 'bestSide';
}

// RepCounter and ExerciseAutoDetector: import directly from './repCounter' and './exerciseDetector'
// Re-exports removed to break circular dependency (exercises <-> repCounter/exerciseDetector).

// ---------------------------------------------------------------------------
// Default limitations for pose estimation — applied to exercises that don't
// specify their own. Honest disclosure of what the AI cannot assess.
// ---------------------------------------------------------------------------
const DEFAULT_LIMITATIONS = ['breathing technique'];

const CATEGORY_LIMITATIONS = {
  compound: ['grip width', 'breathing technique', 'intra-abdominal pressure'],
  isolation: ['grip rotation', 'breathing technique'],
  bodyweight: ['breathing technique', 'hand placement width'],
  machine: ['seat/pad adjustment', 'breathing technique'],
};

/**
 * Get the limitations for an exercise (explicit or default by category).
 * @param {string} key - exercise key
 * @returns {string[]}
 */
export function getExerciseLimitations(key) {
  const ex = EXERCISES[key];
  if (!ex) return DEFAULT_LIMITATIONS;
  if (ex.limitations && ex.limitations.length > 0) return ex.limitations;
  return CATEGORY_LIMITATIONS[ex.category] || DEFAULT_LIMITATIONS;
}

// ---------------------------------------------------------------------------
// Exercise validation tiers — honest disclosure of what has been tested
// ---------------------------------------------------------------------------
// Tier 1 "validated": benchmark videos exist, accuracy measured.
// Tier 2 "supported": shares signal pattern with a validated exercise,
//         has real form checks. Expected to work but not ground-truth tested.
// Tier 3 "experimental": placeholder or uses an untested signal pattern.

const VALIDATED_EXERCISES = new Set([
  'squat', 'bench_press', 'bicep_curl', 'battle_rope',
  'pull_up', 'push_up', 'lunge', 'front_raise', 'sit_up',
]);

// Signal patterns covered by validated exercises.
// Maps DSL value type + joint to a pattern key.
// squat=bestSide+knee, bicep_curl=bestSide+elbow, front_raise=bestSideMax+shoulder,
// bench_press=bestSide+elbow, pull_up=bestSide+elbow, push_up=bestSide+elbow,
// lunge=bestSide+knee, sit_up=direct+trunk, battle_rope=custom
// All four core value types are covered by at least one validated exercise.
// 'heelDisplacement' (calf raises) has no benchmark video yet.
const VALIDATED_VALUE_TYPES = new Set([
  'bestSide', 'bestSideMax', 'direct', 'custom',
]);

function classifyExerciseTier(key, ex) {
  if (VALIDATED_EXERCISES.has(key)) return 'validated';
  if (ex.placeholder) return 'experimental';
  const valueType = VALUE_TYPE_MAP[key];
  if (valueType && VALIDATED_VALUE_TYPES.has(valueType) && ex.formChecks?.length > 0) return 'supported';
  return 'experimental';
}

// Attach tier to each exercise
for (const [key, ex] of Object.entries(EXERCISES)) {
  ex.tier = classifyExerciseTier(key, ex);
}

/**
 * Get the validation tier for an exercise.
 * @param {string} key
 * @returns {'validated'|'supported'|'experimental'}
 */
export function getExerciseTier(key) {
  return EXERCISES[key]?.tier || 'experimental';
}

// Tier label suffixes for the exercise picker
const TIER_SUFFIX = { validated: ' \u2713', supported: '', experimental: ' \u00B7' };

/**
 * Get display name with tier indicator.
 * @param {string} key
 * @param {string} name
 * @returns {string}
 */
export function exerciseNameWithTier(key, name) {
  const tier = getExerciseTier(key);
  return name + (TIER_SUFFIX[tier] || '');
}

// ---------------------------------------------------------------------------
// Shared exercise grouping for UI selectors
// ---------------------------------------------------------------------------
// Groups exercises by category (compound / isolation / bodyweight), sorted
// by tier first (validated > supported > experimental), then alphabetically.
// Skips 'superset' (handled as "Other").
export const EXERCISE_GROUPS = (() => {
  const tierOrder = { validated: 0, supported: 1, experimental: 2 };
  const groups = { compound: [], isolation: [], bodyweight: [], machine: [] };
  for (const [key, ex] of Object.entries(EXERCISES)) {
    if (key === 'superset') continue;
    const cat = ex.category || 'compound';
    if (groups[cat]) groups[cat].push({ key, name: ex.name, tier: ex.tier });
    else groups.compound.push({ key, name: ex.name, tier: ex.tier });
  }
  for (const g of Object.values(groups)) {
    g.sort((a, b) => {
      const ta = tierOrder[a.tier] ?? 2;
      const tb = tierOrder[b.tier] ?? 2;
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name);
    });
  }
  return groups;
})();

// ---------------------------------------------------------------------------
// Exercise illustration mapping (self-hosted, no CDN dependency)
// Images: 512x512 PNG, 3 frames per exercise (start, mid, end).
// Source: @bryllim/workout-guide, copied to public/assets/exercises/
// ---------------------------------------------------------------------------
const ILLUSTRATION_BASE = `${import.meta.env.BASE_URL}assets/exercises`;

const EXERCISE_SLUG_MAP = {
  // Keys must match EXERCISES object keys exactly.
  // Where no exact bryllim slug exists, map to closest visual match.
  squat: 'squat', front_squat: 'front-squat', goblet_squat: 'goblet-squat',
  deadlift: 'deadlift', romanian_deadlift: 'romanian-deadlift',
  hip_thrust: 'hip-thrust', lunge: 'walking-lunge',
  bulgarian_split_squat: 'bulgarian-split-squat',
  standing_leg_extension: 'leg-extension', calf_raise: 'standing-calf-raise',
  push_up: 'push-up', overhead_press: 'overhead-press',
  bench_press: 'bench-press', dip: 'dip',
  bent_over_row: 'barbell-row', pull_up: 'pull-up',
  bicep_curl: 'bicep-curl', tricep_extension: 'overhead-tricep-extension',
  upright_row: 'upright-row', lateral_raise: 'lateral-raise',
  chest_supported_row: 'chest-supported-row', seated_row: 'seated-row',
  lat_pulldown: 'lat-pulldown', leg_press: 'leg-press',
  leg_extension: 'leg-extension', leg_curl: 'leg-curl',
  machine_chest_press: 'machine-chest-press',
  plank: 'plank', crunch: 'crunch', mountain_climber: 'mountain-climber',
  burpee: 'burpee', jumping_jack: 'jumping-jack',
  pike_push_up: 'pike-push-up', diamond_push_up: 'diamond-push-up',
  inverted_row: 'inverted-row', jump_squat: 'jump-squat',
  pistol_squat: 'pistol-squat', glute_bridge: 'glute-bridge',
  wall_sit: 'wall-sit', dead_hang: 'dead-hang', l_sit: 'l-sit-hold',
  hollow_body_hold: 'hollow-body-hold', overhead_hold: 'overhead-press',
  side_plank: 'side-plank', step_up: 'step-up',
  kettlebell_swing: 'kettlebell-swing', thruster: 'squat',
  clean_and_press: 'deadlift', renegade_row: 'push-up',
  turkish_get_up: 'plank', bear_crawl: 'bear-crawl',
  muscle_up: 'pull-up', chin_up: 'chin-up',
  box_jump: 'jump-squat', skater_jump: 'skater-hop',
  squat_jump_to_lunge: 'jump-squat', man_maker: 'push-up',
  commando_pull_up: 'commando-pull-up', face_pull: 'face-pull',
  incline_bench_press: 'incline-bench-press', sumo_deadlift: 'sumo-deadlift',
  nordic_curl: 'nordic-hamstring-curl', seated_calf_raise: 'seated-calf-raise',
  hanging_leg_raise: 'hanging-leg-raise', hack_squat: 'hack-squat',
  smith_squat: 'smith-machine-squat', zercher_squat: 'squat',
  overhead_squat: 'squat', power_clean: 'deadlift', snatch: 'deadlift',
  t_bar_row: 't-bar-row', pendlay_row: 'pendlay-row',
  close_grip_bench: 'close-grip-bench-press', decline_bench_press: 'decline-bench-press',
  floor_press: 'bench-press', landmine_press: 'landmine-press',
  arnold_press: 'arnold-press', hammer_curl: 'hammer-curl',
  preacher_curl: 'preacher-curl', concentration_curl: 'concentration-curl',
  lying_bicep_curl: 'spider-curl', spider_curl: 'spider-curl',
  skull_crusher: 'skull-crusher', cable_tricep_pushdown: 'tricep-pushdown',
  front_raise: 'front-raise', rear_delt_fly: 'rear-delt-fly',
  shrug: 'shrug', cable_fly: 'cable-fly', dumbbell_fly: 'dumbbell-fly',
  cable_crossover: 'cable-fly', wrist_curl: 'wrist-curl',
  sit_up: 'decline-sit-up', v_up: 'v-up',
  // New exercises slug mappings
  box_squat: 'squat', pause_squat: 'squat', belt_squat: 'squat',
  heel_elevated_squat: 'squat', landmine_squat: 'squat', pendulum_squat: 'squat',
  sissy_squat: 'squat', adductor_machine: 'hip-adduction', abductor_machine: 'hip-abduction',
  single_leg_press: 'leg-press', stiff_leg_deadlift: 'romanian-deadlift',
  single_leg_hip_thrust: 'hip-thrust', cable_pull_through: 'hip-thrust',
  lying_leg_curl: 'leg-curl', glute_ham_raise: 'nordic-hamstring-curl',
  reverse_hyperextension: 'hip-thrust', back_extension_45: 'back-extension',
  back_extension: 'back-extension', rack_pull: 'deadlift',
  donkey_calf_raise: 'standing-calf-raise', leg_press_calf_raise: 'standing-calf-raise',
  depth_jump: 'jump-squat', broad_jump: 'jump-squat',
  split_squat_jump: 'jump-squat', tuck_jump: 'jump-squat',
  curtsy_lunge: 'walking-lunge',
  incline_dumbbell_press: 'incline-bench-press', decline_dumbbell_press: 'decline-bench-press',
  flat_dumbbell_press: 'bench-press', machine_fly: 'pec-deck-fly',
  chest_dip: 'dip', decline_push_up: 'push-up',
  neutral_grip_pull_up: 'pull-up', wide_grip_pull_up: 'pull-up',
  close_grip_pull_up: 'pull-up', straight_arm_pulldown: 'lat-pulldown',
  assisted_pull_up: 'pull-up', scapular_pull_up: 'pull-up',
  single_arm_dumbbell_row: 'dumbbell-row', meadows_row: 'dumbbell-row',
  seal_row: 'barbell-row', machine_row: 'seated-row',
  cable_row_single: 'seated-row', dumbbell_pullover: 'dumbbell-fly',
  yates_row: 'barbell-row', incline_dumbbell_row: 'chest-supported-row',
  machine_shoulder_press: 'overhead-press', dumbbell_overhead_press: 'overhead-press',
  seated_dumbbell_press: 'overhead-press', z_press: 'overhead-press',
  cable_lateral_raise: 'lateral-raise', cable_front_raise: 'front-raise',
  cable_rear_delt_fly: 'rear-delt-fly', machine_rear_delt_fly: 'rear-delt-fly',
  band_pull_apart: 'face-pull', seated_lateral_raise: 'lateral-raise',
  barbell_curl: 'bicep-curl', ez_bar_curl: 'bicep-curl',
  cable_curl: 'bicep-curl', incline_dumbbell_curl: 'bicep-curl',
  reverse_curl: 'bicep-curl', zottman_curl: 'bicep-curl',
  drag_curl: 'bicep-curl', cross_body_curl: 'hammer-curl',
  machine_curl: 'bicep-curl',
  bench_dip: 'dip', kickback: 'tricep-kickback',
  cable_kickback: 'tricep-kickback', rope_pushdown: 'tricep-pushdown',
  overhead_cable_tricep: 'overhead-tricep-extension',
  machine_tricep_extension: 'overhead-tricep-extension',
  close_grip_push_up: 'diamond-push-up',
  dumbbell_shrug: 'shrug', cable_shrug: 'shrug',
  ab_wheel_rollout: 'plank', dragon_flag: 'hanging-leg-raise',
  cable_crunch: 'crunch', decline_crunch: 'decline-sit-up',
  hanging_knee_raise: 'hanging-leg-raise', lying_leg_raise: 'hanging-leg-raise',
  wood_chop: 'crunch', ab_crunch_machine: 'crunch',
  hang_clean: 'deadlift', hang_snatch: 'deadlift',
  clean_and_jerk: 'deadlift', clean_pull: 'deadlift', snatch_pull: 'deadlift',
  kettlebell_clean: 'kettlebell-swing', kettlebell_snatch: 'kettlebell-swing',
  kettlebell_press: 'overhead-press', kettlebell_goblet_squat: 'goblet-squat',
  kettlebell_row: 'dumbbell-row', kettlebell_deadlift: 'deadlift',
  ring_dip: 'dip', ring_push_up: 'push-up', ring_row: 'inverted-row',
  typewriter_pull_up: 'pull-up', one_arm_push_up: 'push-up',
  handstand_push_up: 'pike-push-up',
  sled_push: 'squat', rope_climb: 'pull-up',
  dumbbell_snatch: 'deadlift', dumbbell_clean: 'deadlift',
  farmers_walk: 'shrug', assault_bike: 'squat',
};

/**
 * Get illustration URL for an exercise frame.
 * @param {string} exerciseKey - Our exercise key (e.g. 'squat')
 * @param {number} frame - Frame number (1, 2, or 3)
 * @returns {string|null} CDN URL or null if no mapping exists
 */
export function getExerciseIllustration(exerciseKey, frame = 1) {
  const slug = EXERCISE_SLUG_MAP[exerciseKey];
  if (!slug) return null;
  return `${ILLUSTRATION_BASE}/${slug}/frame-${frame}.png`;
}

// ---------------------------------------------------------------------------
// Exercise definition validation
// ---------------------------------------------------------------------------

/**
 * Validate a single exercise definition has all required fields.
 * @param {object} exercise - Exercise definition object
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateExercise(exercise) {
  const errors = [];
  if (!exercise.name || typeof exercise.name !== 'string') errors.push('missing or invalid name');
  if (exercise.isIsometric) return { valid: errors.length === 0, errors };
  if (typeof exercise.getValue !== 'function') errors.push('missing getValue function');
  if (exercise.downThreshold == null) errors.push('missing downThreshold');
  if (exercise.upThreshold == null) errors.push('missing upThreshold');
  if (!Array.isArray(exercise.formChecks)) {
    errors.push('missing formChecks array');
  } else {
    for (let i = 0; i < exercise.formChecks.length; i++) {
      const fc = exercise.formChecks[i];
      if (!fc.name) errors.push(`formCheck[${i}] missing name`);
      if (typeof fc.check !== 'function') errors.push(`formCheck[${i}] missing check function`);
      if (!fc.good) errors.push(`formCheck[${i}] missing good text`);
      if (!fc.bad) errors.push(`formCheck[${i}] missing bad text`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate all exercises and log warnings for invalid definitions.
 * @returns {{ total: number, valid: number, invalid: Array<{ key: string, errors: string[] }> }}
 */
function validateAllExercises() {
  const results = { total: 0, valid: 0, invalid: [] };
  for (const [key, ex] of Object.entries(EXERCISES)) {
    results.total++;
    const { valid, errors } = validateExercise(ex);
    if (valid) {
      results.valid++;
    } else {
      results.invalid.push({ key, errors });
    }
  }
  if (results.invalid.length > 0) {
    console.warn(`[exercises] ${results.invalid.length}/${results.total} exercises have validation errors:`,
      results.invalid.map(e => `${e.key}: ${e.errors.join(', ')}`).join('; '));
  }
  return results;
}

// Run validation at boot in development mode only
if (import.meta.env && import.meta.env.DEV) {
  validateAllExercises();
}

// ---------------------------------------------------------------------------
// Per-exercise rep timing bounds (milliseconds)
// Based on biomechanics literature for controlled tempo lifting.
// Compound lifts: 1.5-8s per rep (includes pause at bottom)
// Isolation: 1-6s per rep
// Bodyweight: 1.2-7s per rep
// ---------------------------------------------------------------------------

const REP_TIMING = {
  squat:              { minRepPeriod: 1500, maxRepPeriod: 8000 },
  front_squat:        { minRepPeriod: 1500, maxRepPeriod: 8000 },
  goblet_squat:       { minRepPeriod: 1500, maxRepPeriod: 8000 },
  bench_press:        { minRepPeriod: 1500, maxRepPeriod: 8000 },
  deadlift:           { minRepPeriod: 1500, maxRepPeriod: 8000 },
  romanian_deadlift:  { minRepPeriod: 1500, maxRepPeriod: 8000 },
  overhead_press:     { minRepPeriod: 1500, maxRepPeriod: 8000 },
  shoulder_press:     { minRepPeriod: 1500, maxRepPeriod: 8000 },
  bent_over_row:      { minRepPeriod: 1500, maxRepPeriod: 8000 },
  hip_thrust:         { minRepPeriod: 1500, maxRepPeriod: 8000 },
  lunge:              { minRepPeriod: 1500, maxRepPeriod: 8000 },
  leg_press:          { minRepPeriod: 1500, maxRepPeriod: 8000 },
  bicep_curl:         { minRepPeriod: 1000, maxRepPeriod: 6000 },
  hammer_curl:        { minRepPeriod: 1000, maxRepPeriod: 6000 },
  tricep_extension:   { minRepPeriod: 1000, maxRepPeriod: 6000 },
  tricep_pushdown:    { minRepPeriod: 1000, maxRepPeriod: 6000 },
  lateral_raise:      { minRepPeriod: 1000, maxRepPeriod: 6000 },
  front_raise:        { minRepPeriod: 1000, maxRepPeriod: 6000 },
  calf_raise:         { minRepPeriod: 1000, maxRepPeriod: 6000 },
  push_up:            { minRepPeriod: 1200, maxRepPeriod: 7000 },
  pull_up:            { minRepPeriod: 1200, maxRepPeriod: 7000 },
  chin_up:            { minRepPeriod: 1200, maxRepPeriod: 7000 },
  dip:                { minRepPeriod: 1200, maxRepPeriod: 7000 },
};
