/**
 * Exercise ontology — hierarchical classification for the detector.
 *
 * Three levels:
 *   Level 0 (Context):    seated / standing / prone / hanging / supine
 *   Level 1 (Movement):   upper_push / upper_pull / lower_push / lower_pull / core / iso_hold
 *   Level 2 (Leaf):       specific exercise ID matching EXERCISES keys
 *
 * P0 = gym machines with guided motion (highest detection confidence).
 * P1 = free-weight compound and isolation.
 * P2 = bodyweight and plyometric.
 *
 * Monocular pose ceiling: seated machine press vs seated machine row are
 * indistinguishable by joint trajectory alone (load direction invisible).
 * Level 1 stops at "upper_horizontal" rather than claiming push vs pull
 * for seated machines. The split is resolved by weak evidence + user tap.
 */

// ---------------------------------------------------------------------------
// Ontology tree
// ---------------------------------------------------------------------------

export const ONTOLOGY = {
  seated: {
    lower_push: {
      exercises: ['leg_press', 'single_leg_press', 'leg_extension', 'hack_squat', 'smith_squat', 'pendulum_squat'],
      priority: 'P0',
    },
    lower_pull: {
      exercises: ['leg_curl', 'lying_leg_curl', 'seated_back_extension'],
      priority: 'P0',
    },
    upper_horizontal: {
      // Camera cannot separate push from pull when seated; chips shown
      exercises: ['seated_row', 'machine_chest_press', 'chest_supported_row', 'machine_row', 'cable_row_single'],
      priority: 'P0',
    },
    upper_vertical: {
      exercises: ['lat_pulldown', 'straight_arm_pulldown', 'machine_shoulder_press', 'seated_dumbbell_press'],
      priority: 'P0',
    },
    upper_isolation: {
      exercises: ['preacher_curl', 'machine_curl', 'machine_tricep_extension', 'seated_lateral_raise'],
      priority: 'P1',
    },
    core_seated: {
      exercises: ['russian_twist', 'ab_crunch_machine', 'cable_crunch'],
      priority: 'P1',
    },
    lower_isolation: {
      exercises: ['adductor_machine', 'abductor_machine', 'seated_calf_raise'],
      priority: 'P0',
    },
  },
  standing: {
    lower_push: {
      exercises: [
        'squat', 'front_squat', 'goblet_squat', 'box_squat', 'pause_squat',
        'belt_squat', 'heel_elevated_squat', 'landmine_squat', 'sissy_squat',
        'overhead_squat', 'zercher_squat', 'lunge', 'bulgarian_split_squat',
        'step_up', 'curtsy_lunge', 'calf_raise', 'donkey_calf_raise',
        'leg_press_calf_raise',
      ],
      priority: 'P1',
    },
    lower_pull: {
      exercises: [
        'deadlift', 'romanian_deadlift', 'stiff_leg_deadlift', 'sumo_deadlift',
        'good_morning', 'rack_pull', 'kettlebell_deadlift', 'cable_pull_through',
        'kettlebell_swing',
      ],
      priority: 'P1',
    },
    upper_push: {
      exercises: [
        'overhead_press', 'dumbbell_overhead_press', 'arnold_press', 'z_press',
        'push_press', 'landmine_press', 'kettlebell_press',
        'lateral_raise', 'cable_lateral_raise', 'front_raise', 'cable_front_raise',
      ],
      priority: 'P1',
    },
    upper_pull: {
      exercises: [
        'bent_over_row', 'pendlay_row', 'yates_row', 't_bar_row',
        'single_arm_dumbbell_row', 'meadows_row', 'upright_row',
        'face_pull', 'rear_delt_fly', 'cable_rear_delt_fly', 'machine_rear_delt_fly',
        'band_pull_apart', 'shrug', 'dumbbell_shrug', 'cable_shrug',
      ],
      priority: 'P1',
    },
    upper_isolation: {
      exercises: [
        'bicep_curl', 'hammer_curl', 'barbell_curl', 'ez_bar_curl',
        'cable_curl', 'reverse_curl', 'zottman_curl', 'drag_curl',
        'cross_body_curl', 'concentration_curl',
        'tricep_extension', 'cable_tricep_pushdown', 'rope_pushdown',
        'kickback', 'cable_kickback', 'overhead_cable_tricep',
        'cable_crossover', 'cable_fly',
      ],
      priority: 'P1',
    },
    explosive: {
      exercises: [
        'power_clean', 'hang_clean', 'clean_and_press', 'clean_and_jerk',
        'snatch', 'hang_snatch', 'clean_pull', 'snatch_pull',
        'kettlebell_clean', 'kettlebell_snatch', 'dumbbell_snatch', 'dumbbell_clean',
        'thruster', 'jump_squat', 'box_jump', 'depth_jump', 'broad_jump',
        'split_squat_jump', 'tuck_jump', 'skater_jump',
      ],
      priority: 'P2',
    },
    full_body: {
      exercises: [
        'farmers_walk', 'sled_push', 'battle_rope', 'assault_bike',
        'jumping_jack', 'burpee',
      ],
      priority: 'P2',
    },
  },
  hanging: {
    upper_pull: {
      exercises: [
        'pull_up', 'chin_up', 'neutral_grip_pull_up', 'wide_grip_pull_up',
        'close_grip_pull_up', 'commando_pull_up', 'typewriter_pull_up',
        'assisted_pull_up', 'scapular_pull_up', 'muscle_up', 'rope_climb',
      ],
      priority: 'P1',
    },
    core_hanging: {
      exercises: [
        'hanging_leg_raise', 'hanging_knee_raise', 'toes_to_bar',
        'l_sit',
      ],
      priority: 'P1',
    },
    iso_hold: {
      exercises: ['dead_hang'],
      priority: 'P2',
    },
  },
  prone: {
    upper_push: {
      exercises: [
        'push_up', 'diamond_push_up', 'pike_push_up', 'decline_push_up',
        'close_grip_push_up', 'one_arm_push_up', 'ring_push_up',
        'handstand_push_up',
      ],
      priority: 'P1',
    },
    core_prone: {
      exercises: [
        'plank', 'side_plank', 'mountain_climber', 'bear_crawl',
        'ab_wheel_rollout', 'dragon_flag',
      ],
      priority: 'P2',
    },
    back_extension: {
      exercises: ['superman', 'back_extension', 'back_extension_45', 'reverse_hyperextension'],
      priority: 'P1',
    },
  },
  supine: {
    upper_push: {
      exercises: [
        'bench_press', 'close_grip_bench', 'incline_bench_press',
        'decline_bench_press', 'floor_press',
        'flat_dumbbell_press', 'incline_dumbbell_press', 'decline_dumbbell_press',
        'dumbbell_fly', 'machine_fly', 'skull_crusher',
      ],
      priority: 'P1',
    },
    upper_pull_supine: {
      exercises: ['dumbbell_pullover', 'seal_row', 'incline_dumbbell_row'],
      priority: 'P1',
    },
    upper_isolation_supine: {
      exercises: ['lying_bicep_curl', 'spider_curl'],
      priority: 'P1',
    },
    lower_push_supine: {
      exercises: ['hip_thrust', 'single_leg_hip_thrust', 'glute_bridge', 'glute_ham_raise', 'nordic_curl'],
      priority: 'P1',
    },
    core_supine: {
      exercises: [
        'crunch', 'sit_up', 'v_up', 'bicycle_crunch', 'decline_crunch',
        'lying_leg_raise', 'flutter_kick', 'hollow_body_hold', 'wood_chop',
      ],
      priority: 'P2',
    },
  },
  supported: {
    dip: {
      exercises: ['dip', 'chest_dip', 'ring_dip', 'bench_dip'],
      priority: 'P1',
    },
    inverted: {
      exercises: ['inverted_row', 'ring_row', 'renegade_row'],
      priority: 'P1',
    },
    hold: {
      exercises: ['wall_sit', 'overhead_hold'],
      priority: 'P2',
    },
  },
};

// ---------------------------------------------------------------------------
// Reverse lookup: exercise key → { context, movementClass, priority }
// ---------------------------------------------------------------------------

const _reverseLookup = {};
for (const [context, classes] of Object.entries(ONTOLOGY)) {
  for (const [movementClass, data] of Object.entries(classes)) {
    for (const ex of data.exercises) {
      _reverseLookup[ex] = { context, movementClass, priority: data.priority };
    }
  }
}

/**
 * Look up ontology position for an exercise key.
 * @param {string} exerciseKey
 * @returns {{ context: string, movementClass: string, priority: string } | null}
 */
export function lookupExercise(exerciseKey) {
  return _reverseLookup[exerciseKey] || null;
}

/**
 * Get all exercise keys in a given context.
 * @param {string} context - e.g. 'seated', 'standing'
 * @returns {string[]}
 */
export function exercisesInContext(context) {
  const classes = ONTOLOGY[context];
  if (!classes) return [];
  const result = [];
  for (const data of Object.values(classes)) {
    result.push(...data.exercises);
  }
  return result;
}

/**
 * Get all exercise keys in a given context + movement class.
 * @param {string} context
 * @param {string} movementClass
 * @returns {string[]}
 */
export function exercisesInClass(context, movementClass) {
  return ONTOLOGY[context]?.[movementClass]?.exercises || [];
}

/**
 * Get exercises filtered by priority tier.
 * @param {'P0'|'P1'|'P2'} priority
 * @returns {string[]}
 */
export function exercisesByPriority(priority) {
  const result = [];
  for (const classes of Object.values(ONTOLOGY)) {
    for (const data of Object.values(classes)) {
      if (data.priority === priority) result.push(...data.exercises);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Gym vs Home mode ontology filter
// ---------------------------------------------------------------------------

const GYM_ONLY_EXERCISES = new Set([
  // Machine exercises only available in a gym
  'leg_press', 'single_leg_press', 'hack_squat', 'smith_squat', 'pendulum_squat',
  'leg_extension', 'leg_curl', 'lying_leg_curl',
  'lat_pulldown', 'straight_arm_pulldown', 'seated_row', 'machine_row',
  'cable_row_single', 'machine_chest_press', 'chest_supported_row',
  'machine_shoulder_press', 'machine_curl', 'machine_tricep_extension',
  'cable_tricep_pushdown', 'rope_pushdown', 'cable_kickback',
  'overhead_cable_tricep', 'cable_crossover', 'cable_fly',
  'cable_curl', 'cable_lateral_raise', 'cable_front_raise',
  'cable_rear_delt_fly', 'machine_rear_delt_fly', 'machine_fly',
  'adductor_machine', 'abductor_machine', 'seated_calf_raise',
  'ab_crunch_machine', 'cable_crunch', 'cable_pull_through',
  'preacher_curl', 'seated_back_extension',
  'assisted_pull_up', 'sled_push', 'assault_bike',
]);

/**
 * Filter exercise list by mode.
 * @param {string[]} exercises
 * @param {'gym'|'home'} mode
 * @returns {string[]}
 */
export function filterByMode(exercises, mode) {
  if (mode === 'gym') return exercises; // gym has everything
  return exercises.filter(ex => !GYM_ONLY_EXERCISES.has(ex));
}

/**
 * Get the full set of exercises available in a mode.
 * @param {'gym'|'home'} mode
 * @returns {string[]}
 */
export function getAvailableExercises(mode) {
  const all = Object.keys(_reverseLookup);
  return filterByMode(all, mode);
}
