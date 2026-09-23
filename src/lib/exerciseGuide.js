/**
 * Exercise visual guide — maps our exercise keys to the bryllim/workout-guide
 * library for animated SVG illustrations.
 *
 * Source: https://github.com/bryllim/workout-guide (CC BY-SA 4.0)
 * 302 exercises with 3-frame SVG animations.
 *
 * CDN pattern: https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets/{slug}/frame-{n}.svg
 */

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets';

/**
 * Map our snake_case exercise keys to workout-guide kebab-case slugs.
 * Only exercises with a known visual match are listed.
 */
const KEY_TO_SLUG = {
  // Lower compound
  squat: 'barbell-back-squat',
  front_squat: 'front-squat',
  goblet_squat: 'goblet-squat',
  deadlift: 'deadlift',
  romanian_deadlift: 'romanian-deadlift',
  sumo_deadlift: 'sumo-deadlift',
  bulgarian_split_squat: 'bulgarian-split-squat',
  lunge: 'lunge',
  reverse_lunge: 'reverse-lunge',
  walking_lunge: 'walking-lunge',
  step_up: 'step-up',
  hip_thrust: 'hip-thrust',
  glute_bridge: 'glute-bridge',
  leg_press: 'leg-press',
  hack_squat: 'hack-squat',
  sissy_squat: 'sissy-squat',

  // Lower isolation
  leg_extension: 'leg-extension',
  leg_curl: 'leg-curl',
  seated_leg_curl: 'seated-leg-curl',
  calf_raise: 'standing-calf-raise',
  seated_calf_raise: 'seated-calf-raise',

  // Upper push compound
  bench_press: 'bench-press',
  incline_bench_press: 'incline-bench-press',
  decline_bench_press: 'decline-bench-press',
  dumbbell_bench_press: 'dumbbell-bench-press',
  flat_dumbbell_press: 'dumbbell-bench-press',
  incline_dumbbell_press: 'incline-dumbbell-press',
  overhead_press: 'overhead-press',
  dumbbell_shoulder_press: 'dumbbell-shoulder-press',
  machine_shoulder_press: 'machine-shoulder-press',
  push_up: 'push-up',
  diamond_push_up: 'diamond-push-up',
  pike_push_up: 'pike-push-up',
  deficit_push_up: 'deficit-push-up',
  dip: 'dip',

  // Upper push isolation
  lateral_raise: 'lateral-raise',
  front_raise: 'front-raise',
  dumbbell_fly: 'dumbbell-fly',
  cable_fly: 'cable-fly',
  pec_deck: 'pec-deck',
  tricep_extension: 'tricep-extension',
  cable_tricep_pushdown: 'cable-tricep-pushdown',
  machine_tricep_extension: 'machine-tricep-extension',
  skull_crusher: 'skull-crusher',

  // Upper pull compound
  pull_up: 'pull-up',
  chin_up: 'chin-up',
  assisted_pull_up: 'assisted-pull-up',
  lat_pulldown: 'lat-pulldown',
  bent_over_row: 'bent-over-row',
  dumbbell_row: 'dumbbell-row',
  seated_row: 'seated-row',
  cable_row: 'cable-row',
  t_bar_row: 't-bar-row',
  upright_row: 'upright-row',
  face_pull: 'face-pull',

  // Upper pull isolation
  bicep_curl: 'bicep-curl',
  hammer_curl: 'hammer-curl',
  ez_bar_curl: 'ez-bar-curl',
  concentration_curl: 'concentration-curl',
  preacher_curl: 'preacher-curl',
  incline_curl: 'incline-dumbbell-curl',
  reverse_curl: 'reverse-curl',

  // Core
  crunch: 'crunch',
  sit_up: 'sit-up',
  plank: 'plank',
  mountain_climber: 'mountain-climber',
  russian_twist: 'russian-twist',
  leg_raise: 'leg-raise',
  hanging_leg_raise: 'hanging-leg-raise',

  // Bodyweight
  jumping_jack: 'jumping-jack',
  burpee: 'burpee',
  box_jump: 'box-jump',

  // Full body / Olympic
  clean_and_press: 'clean-and-press',
  kettlebell_swing: 'kettlebell-swing',
};

/**
 * Get the CDN URL for an exercise frame SVG.
 * @param {string} slug - workout-guide slug
 * @param {1|2|3} frame - frame number (1-3)
 * @returns {string} CDN URL
 */
export function getFrameUrl(slug, frame) {
  return `${CDN_BASE}/${slug}/frame-${frame}.svg`;
}

/**
 * Get frame URLs for an exercise by our internal key.
 * @param {string} exerciseKey - our snake_case key
 * @returns {{ slug: string, frames: string[] } | null}
 */
export function getExerciseFrames(exerciseKey) {
  const slug = KEY_TO_SLUG[exerciseKey];
  if (!slug) return null;
  return {
    slug,
    frames: [
      getFrameUrl(slug, 1),
      getFrameUrl(slug, 2),
      getFrameUrl(slug, 3),
    ],
  };
}

/**
 * Check if an exercise has visual guide frames available.
 * @param {string} exerciseKey
 * @returns {boolean}
 */
export function hasExerciseGuide(exerciseKey) {
  return exerciseKey in KEY_TO_SLUG;
}

/**
 * Get the slug for an exercise key.
 * @param {string} exerciseKey
 * @returns {string|null}
 */
export function getSlug(exerciseKey) {
  return KEY_TO_SLUG[exerciseKey] || null;
}

/**
 * Get all mapped exercise keys.
 * @returns {string[]}
 */
export function getMappedKeys() {
  return Object.keys(KEY_TO_SLUG);
}
