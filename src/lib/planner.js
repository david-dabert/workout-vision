/**
 * Workout plan generation engine.
 *
 * Generates personalized, periodized training programs based on user profile
 * data and workout history. Implements evidence-based volume recommendations
 * (Schoenfeld 2017), Mifflin-St Jeor BMR, Tanaka 2001 max HR, and Hamwi
 * ideal weight. Periodization follows a 4-week mesocycle with progressive
 * overload (weeks 1-3) and a deload (week 4).
 */

import { EXERCISES } from './exercises';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Activity level multipliers for TDEE calculation (Harris-Benedict adapted). */
const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

/** BMI classification thresholds (WHO). */
const BMI_CLASSES = [
  { max: 18.5, label: 'underweight' },
  { max: 25, label: 'normal' },
  { max: 30, label: 'overweight' },
  { max: 35, label: 'obese_class_1' },
  { max: 40, label: 'obese_class_2' },
  { max: Infinity, label: 'obese_class_3' },
];

/**
 * Exercises excluded per injury site.
 * Keys must match the strings in profile.injuries.
 */
const INJURY_EXCLUSIONS = {
  lower_back: ['deadlift', 'bent_over_row', 'good_morning', 'romanian_deadlift', 'barbell_row'],
  shoulder: ['overhead_press', 'lateral_raise', 'bench_press', 'incline_bench_press', 'arnold_press', 'front_raise', 'face_pull'],
  knee: ['squat', 'lunge', 'leg_press', 'leg_extension', 'leg_curl', 'jump_squat', 'pistol_squat',
    'bulgarian_split_squat', 'walking_lunge', 'reverse_lunge', 'side_lunge', 'hack_squat',
    'box_jump', 'nordic_curl', 'wall_sit', 'step_up'],
  wrist: ['push_up', 'diamond_push_up', 'plank', 'front_squat'],
  hip: ['deadlift', 'hip_thrust', 'squat', 'lunge', 'romanian_deadlift',
    'bulgarian_split_squat', 'step_up', 'good_morning', 'kettlebell_swing'],
  ankle: ['squat', 'lunge', 'jump_squat', 'box_jump', 'pistol_squat', 'calf_raise',
    'walking_lunge', 'side_lunge', 'bulgarian_split_squat'],
  neck: ['overhead_press', 'barbell_row', 'deadlift', 'shoulder_shrug'],
  elbow: ['bicep_curl', 'hammer_curl', 'tricep_extension', 'skull_crusher',
    'cable_tricep_pushdown', 'preacher_curl', 'diamond_push_up', 'chin_up'],
};

/**
 * Muscle group to exercise key mapping.
 * Order reflects general preference (compounds first).
 */
const MUSCLE_EXERCISES = {
  chest: ['bench_press', 'incline_bench_press', 'dumbbell_fly', 'push_up', 'cable_crossover', 'machine_chest_press'],
  back: ['pull_up', 'bent_over_row', 'lat_pulldown', 'seated_row', 'deadlift', 'chin_up'],
  shoulders: ['overhead_press', 'lateral_raise', 'front_raise', 'rear_delt_fly', 'face_pull', 'arnold_press'],
  legs: ['squat', 'leg_press', 'romanian_deadlift', 'leg_extension', 'leg_curl', 'lunge', 'hip_thrust', 'calf_raise'],
  triceps: ['tricep_extension', 'skull_crusher', 'cable_tricep_pushdown', 'diamond_push_up'],
  biceps: ['bicep_curl', 'hammer_curl', 'preacher_curl', 'chin_up'],
  arms: ['bicep_curl', 'hammer_curl', 'tricep_extension', 'skull_crusher', 'cable_tricep_pushdown', 'preacher_curl'],
  core: ['plank', 'crunch', 'hanging_leg_raise', 'russian_twist', 'sit_up'],
};

/**
 * Volume recommendations in sets per muscle per week (Schoenfeld 2017).
 * { base: [min, max], goalAdjust } where goalAdjust is added to both ends.
 */
const VOLUME_TABLE = {
  beginner: { min: 6, max: 10 },
  intermediate: { min: 12, max: 16 },
  advanced: { min: 16, max: 22 },
};

const VOLUME_GOAL_ADJUST = {
  strength: -2,
  hypertrophy: 0,
  endurance: -4,
  weight_loss: -2,
  general: -1,
};

/**
 * Rep / rest schemes per goal.
 * strength: heavy, low reps, long rest.
 * hypertrophy: moderate, medium reps, moderate rest.
 * endurance: light, high reps, short rest.
 */
const GOAL_SCHEME = {
  strength: { repsMin: 3, repsMax: 5, restSeconds: 180 },
  hypertrophy: { repsMin: 8, repsMax: 12, restSeconds: 90 },
  endurance: { repsMin: 15, repsMax: 20, restSeconds: 45 },
  weight_loss: { repsMin: 10, repsMax: 15, restSeconds: 60 },
  general: { repsMin: 8, repsMax: 15, restSeconds: 75 },
};

/**
 * Protein targets in g per kg body weight per day.
 */
const PROTEIN_TARGETS = {
  strength: 2.0,
  hypertrophy: 1.8,
  endurance: 1.4,
  weight_loss: 2.2,
  general: 1.6,
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a Set of excluded exercise keys from the user's injury list.
 * @param {string[]} injuries
 * @returns {Set<string>}
 */
function buildExclusionSet(injuries) {
  const set = new Set();
  if (!injuries || !injuries.length) return set;
  for (const injury of injuries) {
    const excluded = INJURY_EXCLUSIONS[injury];
    if (excluded) {
      for (const key of excluded) set.add(key);
    }
  }
  return set;
}

/**
 * Filter an exercise list against an exclusion set, keeping only keys that
 * exist in the EXERCISES database.
 * @param {string[]} exerciseKeys
 * @param {Set<string>} exclusions
 * @returns {string[]}
 */
function filterExercises(exerciseKeys, exclusions) {
  return exerciseKeys.filter((k) => !exclusions.has(k) && EXERCISES[k]);
}

/**
 * Build a single day object.
 * @param {string} name - Day label, e.g. "Push A".
 * @param {string[]} muscleGroups - e.g. ['chest', 'shoulders', 'arms'].
 * @param {object} scheme - From GOAL_SCHEME.
 * @param {Set<string>} exclusions - Injury exclusions.
 * @param {number} setsPerMuscle - Target sets per muscle for this session.
 * @returns {object}
 */
function buildDay(name, muscleGroups, scheme, exclusions, setsPerMuscle) {
  const exercises = [];

  for (const muscle of muscleGroups) {
    const available = filterExercises(MUSCLE_EXERCISES[muscle] || [], exclusions);
    if (!available.length) continue;

    let setsRemaining = setsPerMuscle;
    let exerciseIndex = 0;

    while (setsRemaining > 0 && exerciseIndex < available.length) {
      const setsForThis = Math.min(exerciseIndex === 0 ? 4 : 3, setsRemaining);
      const reps = `${scheme.repsMin}-${scheme.repsMax}`;
      const exKey = available[exerciseIndex];
      const exData = EXERCISES[exKey];
      const isIsometric = exData && exData.category === 'isometric';

      exercises.push({
        exerciseKey: exKey,
        sets: setsForThis,
        reps: isIsometric ? `${scheme.repsMax * 2}s hold` : reps,
        restSeconds: scheme.restSeconds,
        notes: exerciseIndex === 0 ? 'Primary compound; focus on progressive overload' : '',
      });

      setsRemaining -= setsForThis;
      exerciseIndex++;
    }
  }

  return { name, muscleGroups, exercises };
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Returns a list of exercise keys for a given muscle group that are safe
 * given the user's injuries.
 *
 * @param {string} muscle - Muscle group key (chest, back, shoulders, legs, arms, core).
 * @param {string[]} injuries - Array of injury site strings.
 * @returns {string[]} Safe exercise keys.
 */
export function getExercisesForMuscle(muscle, injuries) {
  const exclusions = buildExclusionSet(injuries);
  return filterExercises(MUSCLE_EXERCISES[muscle] || [], exclusions);
}

/**
 * Calculate optimal weekly volume for a muscle group given experience and goal.
 *
 * Based on Schoenfeld 2017 meta-analysis. Returns minimum, maximum, and
 * a recommended optimal value (geometric mean of the adjusted range).
 *
 * @param {string} muscle - Muscle group key (unused for now; same formula across muscles).
 * @param {'beginner'|'intermediate'|'advanced'} experience
 * @param {'strength'|'hypertrophy'|'endurance'|'weight_loss'|'general'} goal
 * @returns {{ minSets: number, maxSets: number, optimal: number }}
 */
export function calculateOptimalVolume(muscle, experience, goal) {
  const base = VOLUME_TABLE[experience] || VOLUME_TABLE.intermediate;
  const adjust = VOLUME_GOAL_ADJUST[goal] ?? 0;

  const minSets = Math.max(4, base.min + adjust);
  const maxSets = Math.max(minSets, base.max + adjust);
  const optimal = Math.round((minSets + maxSets) / 2);

  return { minSets, maxSets, optimal };
}

/**
 * Generate a comprehensive physical analysis from the user's profile.
 *
 * Calculations:
 *  - BMI (kg/m^2) with WHO classification.
 *  - BMR via Mifflin-St Jeor (1990).
 *  - TDEE via activity multiplier.
 *  - Body fat estimate via BMI-based formula (Deurenberg 1991); accuracy caveat included.
 *  - Max HR via Tanaka 2001 (208 - 0.7 * age).
 *  - Heart rate training zones using Karvonen formula with actual resting HR.
 *  - Ideal weight range via Hamwi method.
 *  - Protein target (g/day) based on goal.
 *  - Calorie target adjusted for goal.
 *  - Strength potential estimates (Symmetric Strength population norms).
 *
 * @param {object} profile
 * @param {string} profile.name
 * @param {number} profile.weight - kg
 * @param {number} profile.height - cm
 * @param {number} profile.age
 * @param {'male'|'female'} profile.sex
 * @param {string} profile.activityLevel
 * @param {number} profile.restingHR - bpm
 * @param {'beginner'|'intermediate'|'advanced'} profile.experience
 * @param {string} profile.goal
 * @param {string[]} profile.injuries
 * @returns {object} Structured analysis with all metrics and textual recommendations.
 */
export function generatePhysicalAnalysis(profile) {
  const weight = parseFloat(profile.weight) || 0;
  const height = parseFloat(profile.height) || 0;
  const age = parseFloat(profile.age) || 25;
  const sex = profile.sex || 'male';
  const activityLevel = profile.activityLevel || 'moderate';
  const restingHR = parseFloat(profile.restingHR) || 70;
  const experience = profile.experience || 'intermediate';
  const goal = profile.goal || 'general';

  const heightM = height / 100;
  const isMale = sex === 'male';

  if (!weight || !heightM) {
    return {
      name: profile.name,
      bmi: { value: 0, classification: 'unknown' },
      bmr: 0, tdee: 0,
      bodyFat: { estimatedPct: 0, method: 'Deurenberg 1991', accuracyNote: 'Insufficient data.' },
      maxHR: 0, heartRateZones: {},
      idealWeightRange: { min: 0, max: 0, midpoint: 0, unit: 'kg' },
      protein: { gramsPerDay: 0, gramsPerKg: 0 },
      calories: { target: 0, tdee: 0, adjustment: 0, note: 'Enter weight and height in profile.' },
      strengthPotential: null,
      recommendations: ['Enter your weight and height in your profile to get a full analysis.'],
    };
  }

  // --- BMI ---
  const bmi = weight / (heightM * heightM);
  const bmiClass = BMI_CLASSES.find((c) => bmi < c.max)?.label || 'obese_class_3';

  // --- BMR (Mifflin-St Jeor 1990) ---
  const bmr = isMale
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  // --- TDEE ---
  const activityMultiplier = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.moderate;
  const tdee = Math.round(bmr * activityMultiplier);

  // --- Body fat estimate (Deurenberg 1991, BMI-based) ---
  const bodyFatPct = isMale
    ? 1.2 * bmi + 0.23 * age - 16.2
    : 1.2 * bmi + 0.23 * age - 5.4;

  // --- Max HR (Tanaka 2001) ---
  const maxHR = Math.round(208 - 0.7 * age);

  // --- Heart rate zones (Karvonen formula using actual resting HR) ---
  const hrReserve = maxHR - restingHR;
  const zoneCalc = (low, high) => ({
    min: Math.round(restingHR + hrReserve * low),
    max: Math.round(restingHR + hrReserve * high),
  });

  const heartRateZones = {
    zone1_recovery: { ...zoneCalc(0.5, 0.6), label: 'Recovery / warm-up' },
    zone2_aerobic: { ...zoneCalc(0.6, 0.7), label: 'Aerobic base / fat burn' },
    zone3_tempo: { ...zoneCalc(0.7, 0.8), label: 'Tempo / aerobic capacity' },
    zone4_threshold: { ...zoneCalc(0.8, 0.9), label: 'Lactate threshold' },
    zone5_max: { ...zoneCalc(0.9, 1.0), label: 'VO2max / anaerobic' },
  };

  // --- Ideal weight range (Hamwi method) ---
  const heightInches = height / 2.54;
  let idealBase;
  let perInchOver60;
  if (isMale) {
    idealBase = 48.0; // kg for first 5 feet
    perInchOver60 = 2.7; // kg per inch over 60 inches
  } else {
    idealBase = 45.5;
    perInchOver60 = 2.2;
  }
  const inchesOver60 = Math.max(0, heightInches - 60);
  const idealWeight = idealBase + perInchOver60 * inchesOver60;
  const idealWeightRange = {
    min: Math.round(idealWeight * 0.9 * 10) / 10,
    max: Math.round(idealWeight * 1.1 * 10) / 10,
    midpoint: Math.round(idealWeight * 10) / 10,
    unit: 'kg',
  };

  // --- Protein target ---
  const proteinPerKg = PROTEIN_TARGETS[goal] || PROTEIN_TARGETS.general;
  const proteinGrams = Math.round(weight * proteinPerKg);

  // --- Calorie target ---
  let calorieAdjustment = 0;
  let calorieNote = 'Maintenance';
  if (goal === 'weight_loss') {
    calorieAdjustment = -500;
    calorieNote = 'Deficit of 500 kcal/day (~0.45 kg/week loss)';
  } else if (goal === 'hypertrophy') {
    calorieAdjustment = 300;
    calorieNote = 'Surplus of 300 kcal/day for lean mass gain';
  } else if (goal === 'strength') {
    calorieAdjustment = 200;
    calorieNote = 'Slight surplus of 200 kcal/day to support strength gains';
  }
  const calorieTarget = tdee + calorieAdjustment;

  // --- Strength potential estimates (rough 1RM population norms by experience) ---
  const strengthMultipliers = {
    beginner: { bench: 0.5, squat: 0.75, deadlift: 1.0 },
    intermediate: { bench: 1.0, squat: 1.5, deadlift: 1.75 },
    advanced: { bench: 1.5, squat: 2.0, deadlift: 2.5 },
  };
  const mult = strengthMultipliers[experience] || strengthMultipliers.intermediate;
  const strengthPotential = {
    benchPress1RM: Math.round(weight * mult.bench),
    squat1RM: Math.round(weight * mult.squat),
    deadlift1RM: Math.round(weight * mult.deadlift),
    unit: 'kg',
    note: 'Rough estimates based on body weight ratios for typical lifters at this experience level.',
  };

  // --- Recommendations ---
  const recommendations = [];

  if (bmiClass === 'underweight') {
    recommendations.push('BMI indicates underweight. Prioritize caloric surplus and progressive resistance training.');
  } else if (bmiClass === 'overweight') {
    recommendations.push('BMI indicates overweight. A moderate caloric deficit combined with resistance training can improve body composition.');
  } else if (bmiClass.startsWith('obese')) {
    recommendations.push('BMI indicates obesity. Consult a physician before starting an intense program. Prioritize low-impact movement and gradual caloric reduction.');
  }

  if (bodyFatPct > (isMale ? 25 : 35)) {
    recommendations.push('Estimated body fat is above healthy range. Body recomposition (deficit + high protein + resistance training) is recommended.');
  }

  if (restingHR > 80) {
    recommendations.push('Resting heart rate is elevated. Include steady-state cardio in zone 2 (3-4 sessions/week, 30-45 min) to improve cardiovascular fitness.');
  }

  if (profile.injuries && profile.injuries.length > 0) {
    recommendations.push(`Active injuries noted (${profile.injuries.join(', ')}). Exercises loading those areas are excluded from your plan. Consult a physiotherapist for rehabilitation protocols.`);
  }

  return {
    name: profile.name,
    bmi: { value: Math.round(bmi * 10) / 10, classification: bmiClass },
    bmr: Math.round(bmr),
    tdee,
    bodyFat: {
      estimatedPct: Math.round(bodyFatPct * 10) / 10,
      method: 'Deurenberg 1991 (BMI-based)',
      accuracyNote: 'BMI-based body fat estimates have a standard error of 4-5%. DEXA or hydrostatic weighing are far more accurate. Treat this as a rough indicator only.',
    },
    maxHR,
    heartRateZones,
    idealWeightRange,
    protein: { gramsPerDay: proteinGrams, gramsPerKg: proteinPerKg },
    calories: { target: calorieTarget, tdee, adjustment: calorieAdjustment, note: calorieNote },
    strengthPotential,
    recommendations,
  };
}

/**
 * Generate a full personalized, periodized training program.
 *
 * Split selection:
 *  - Beginner: 3-day full body.
 *  - Intermediate: 4-day upper/lower.
 *  - Advanced: 5-6 day PPL (push/pull/legs repeated).
 *
 * Each day contains exercises with sets, rep ranges, rest periods, and notes.
 * Volume is calibrated per Schoenfeld 2017 and adjusted by goal. Exercises
 * that load injured areas are excluded automatically. A 4-week mesocycle
 * periodization structure is included (weeks 1-3 progressive overload,
 * week 4 deload).
 *
 * @param {object} profile - User profile object.
 * @param {Array<object>} [workoutHistory=[]] - Past workout records (reserved for future auto-progression).
 * @returns {{
 *   split: string,
 *   daysPerWeek: number,
 *   program: Array<object>,
 *   periodization: object,
 *   deloadWeek: object
 * }}
 */
export function generateWorkoutPlan(profile, workoutHistory = []) {
  const { experience, goal, injuries } = profile;
  const exclusions = buildExclusionSet(injuries);
  const scheme = GOAL_SCHEME[goal] || GOAL_SCHEME.general;

  // Determine weekly volume per muscle
  const { optimal: weeklyVolume } = calculateOptimalVolume('general', experience, goal);

  // Build the split
  let split;
  let daysPerWeek;
  let dayBlueprints;

  if (experience === 'beginner') {
    split = 'Full Body';
    daysPerWeek = 3;
    const setsPerMusclePerSession = Math.ceil(weeklyVolume / daysPerWeek);

    const fullBodyMuscles = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
    dayBlueprints = [
      { name: 'Full Body A', muscles: fullBodyMuscles },
      { name: 'Full Body B', muscles: fullBodyMuscles },
      { name: 'Full Body C', muscles: fullBodyMuscles },
    ];

    dayBlueprints = dayBlueprints.map((bp) =>
      buildDay(bp.name, bp.muscles, scheme, exclusions, setsPerMusclePerSession),
    );
  } else if (experience === 'intermediate') {
    split = 'Upper / Lower';
    daysPerWeek = 4;
    // Each muscle hit 2x/week (2 upper + 2 lower days), so divide weekly target by 2
    const setsPerMusclePerSession = Math.min(Math.ceil(weeklyVolume / 2), 6);

    const upperMuscles = ['chest', 'back', 'shoulders', 'arms'];
    const lowerMuscles = ['legs', 'core'];

    dayBlueprints = [
      buildDay('Upper A', upperMuscles, scheme, exclusions, setsPerMusclePerSession),
      buildDay('Lower A', lowerMuscles, scheme, exclusions, setsPerMusclePerSession),
      buildDay('Upper B', upperMuscles, scheme, exclusions, setsPerMusclePerSession),
      buildDay('Lower B', lowerMuscles, scheme, exclusions, setsPerMusclePerSession),
    ];
  } else {
    // Advanced: PPL
    split = 'Push / Pull / Legs';
    daysPerWeek = 6;
    // Each muscle hit 2x/week, cap per-session volume to avoid 28-set days
    const setsPerMusclePerSession = Math.min(Math.ceil(weeklyVolume / 2), 6);

    const pushMuscles = ['chest', 'shoulders', 'triceps'];
    const pullMuscles = ['back', 'biceps'];
    const legMuscles = ['legs', 'core'];

    dayBlueprints = [
      buildDay('Push A', pushMuscles, scheme, exclusions, setsPerMusclePerSession),
      buildDay('Pull A', pullMuscles, scheme, exclusions, setsPerMusclePerSession),
      buildDay('Legs A', legMuscles, scheme, exclusions, setsPerMusclePerSession),
      buildDay('Push B', pushMuscles, scheme, exclusions, setsPerMusclePerSession),
      buildDay('Pull B', pullMuscles, scheme, exclusions, setsPerMusclePerSession),
      buildDay('Legs B', legMuscles, scheme, exclusions, setsPerMusclePerSession),
    ];
  }

  // Periodization: 4-week mesocycle
  const periodization = {
    mesocycleWeeks: 4,
    structure: [
      {
        week: 1,
        label: 'Baseline',
        volumeMultiplier: 1.0,
        intensityNote: 'Establish working weights. RPE 7-8.',
      },
      {
        week: 2,
        label: 'Progressive Overload',
        volumeMultiplier: 1.0,
        intensityNote: 'Increase load by 2-5% on compounds, or add 1 rep per set. RPE 8.',
      },
      {
        week: 3,
        label: 'Peak',
        volumeMultiplier: 1.0,
        intensityNote: 'Push for PRs on primary compounds. Increase load or reps further. RPE 8-9.',
      },
      {
        week: 4,
        label: 'Deload',
        volumeMultiplier: 0.6,
        intensityNote: 'Reduce all loads by 10%. Reduce volume by 40%. RPE 5-6. Focus on recovery and technique.',
      },
    ],
  };

  // Deload week: pre-computed reduced program
  const deloadWeek = {
    label: 'Deload (Week 4)',
    instructions: 'Reduce working weight by 10%. Perform 60% of normal set volume. Maintain movement quality. No sets to failure.',
    program: dayBlueprints.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) => ({
        ...ex,
        sets: Math.max(1, Math.round(ex.sets * 0.6)),
        notes: ex.notes ? `${ex.notes} (deload: reduce weight 10%)` : 'Deload: reduce weight 10%',
      })),
    })),
  };

  return {
    split,
    daysPerWeek,
    program: dayBlueprints,
    periodization,
    deloadWeek,
  };
}
