/**
 * Coaching intelligence layer.
 *
 * Generates post-workout reports, tracks workload ratios, estimates
 * strength levels, and suggests future training. All logic is evidence-based
 * with citations inline.
 *
 * Key references:
 *   - Brzycki M, 1993, J Phys Educ Recreat Dance (1RM estimation)
 *   - Gabbett TJ, 2016, Br J Sports Med (acute:chronic workload ratio)
 *   - Rippetoe M, Kilgore L, 2006, Practical Programming (strength standards)
 *   - Schoenfeld BJ, 2010, J Strength Cond Res (volume landmarks)
 */

import { EXERCISES } from './exercises';

// ---------------------------------------------------------------------------
// Strength standards (kg, relative to bodyweight)
// Based on Rippetoe/Kilgore/ExRx.net compiled standards.
// Format: { male: [beginner, novice, intermediate, advanced, elite],
//           female: [beginner, novice, intermediate, advanced, elite] }
// Values are 1RM as ratio of bodyweight.
// ---------------------------------------------------------------------------

const STRENGTH_STANDARDS = {
  squat: {
    male: [0.75, 1.25, 1.5, 2.0, 2.5],
    female: [0.5, 0.75, 1.0, 1.5, 2.0],
  },
  front_squat: {
    male: [0.6, 1.0, 1.35, 1.75, 2.15],
    female: [0.4, 0.65, 0.85, 1.25, 1.65],
  },
  deadlift: {
    male: [1.0, 1.5, 1.85, 2.35, 3.0],
    female: [0.65, 1.0, 1.25, 1.75, 2.25],
  },
  romanian_deadlift: {
    male: [0.7, 1.1, 1.4, 1.8, 2.2],
    female: [0.45, 0.75, 1.0, 1.35, 1.7],
  },
  bench_press: {
    male: [0.5, 0.75, 1.0, 1.5, 2.0],
    female: [0.25, 0.5, 0.65, 1.0, 1.25],
  },
  overhead_press: {
    male: [0.35, 0.55, 0.8, 1.1, 1.4],
    female: [0.2, 0.35, 0.5, 0.75, 1.0],
  },
  bent_over_row: {
    male: [0.5, 0.75, 1.0, 1.4, 1.75],
    female: [0.3, 0.5, 0.7, 1.0, 1.3],
  },
  hip_thrust: {
    male: [0.75, 1.25, 1.75, 2.25, 3.0],
    female: [0.5, 1.0, 1.5, 2.0, 2.5],
  },
  bicep_curl: {
    male: [0.2, 0.35, 0.5, 0.7, 0.9],
    female: [0.1, 0.2, 0.3, 0.45, 0.6],
  },
};

const STRENGTH_LABELS = ['beginner', 'novice', 'intermediate', 'advanced', 'elite'];

// ---------------------------------------------------------------------------
// Muscle recovery time estimates (hours)
// Based on review literature: large muscle groups 48-72h, small 24-48h.
// ---------------------------------------------------------------------------

const RECOVERY_HOURS = {
  'Quadriceps': 60,
  'Glutes': 60,
  'Hamstrings': 60,
  'Erectors': 72,
  'Core': 24,
  'Pectorals': 48,
  'Anterior Deltoid': 48,
  'Medial Deltoid': 48,
  'Rear Deltoid': 36,
  'Triceps': 36,
  'Biceps Brachii': 36,
  'Biceps': 36,
  'Latissimus Dorsi': 60,
  'Rhomboids': 48,
  'Traps': 48,
  'Upper Back': 48,
  'Serratus Anterior': 36,
  'Forearms': 24,
  'Brachialis': 36,
  'Brachioradialis': 36,
  'Gastrocnemius': 36,
  'Soleus': 36,
  'Rectus Abdominis': 24,
  'Transverse Abdominis': 24,
  'Obliques': 24,
  'Hip Flexors': 36,
  'Upper Pectorals': 48,
  'Triceps (long head)': 36,
};

const DEFAULT_RECOVERY_HOURS = 48;

// ---------------------------------------------------------------------------
// Workout report
// ---------------------------------------------------------------------------

/**
 * Generate a comprehensive post-workout report.
 *
 * @param {{ bodyweight?: number, sex?: string, experience?: string }} profile
 * @param {Array<{
 *   exerciseKey: string,
 *   reps: number,
 *   sets: number,
 *   estimatedWeight?: number,
 *   analysis?: object,
 *   repHistory?: Array
 * }>} exerciseResults
 * @returns {{ summary: string, grade: string, highlights: string[],
 *            improvements: string[], volumeLoad: number,
 *            musclesWorked: Array }}
 */
export function generateWorkoutReport(profile, exerciseResults) {
  if (!exerciseResults || exerciseResults.length === 0) {
    return {
      summary: { key: 'coach_no_exercises' },
      grade: 'D',
      highlights: [],
      improvements: [{ key: 'coach_complete_one' }],
      volumeLoad: 0,
      musclesWorked: [],
    };
  }

  // Aggregate muscles worked
  const muscleMap = {};
  let totalVolumeLoad = 0;
  let totalScore = 0;
  let totalScoredSets = 0;
  const highlights = [];
  const improvements = [];

  for (const result of exerciseResults) {
    const exercise = EXERCISES[result.exerciseKey || result.exercise];
    if (!exercise) continue;

    const sets = result.sets || 1;
    const reps = result.reps || 0;
    const weight = result.estimatedWeight || 0;
    const repVolume = reps * sets * weight;
    totalVolumeLoad += repVolume;

    // Aggregate muscles
    const allMuscles = [
      ...exercise.muscles.primary.map((m) => ({ name: m, isPrimary: true })),
      ...exercise.muscles.secondary.map((m) => ({ name: m, isPrimary: false })),
    ];

    for (const m of allMuscles) {
      if (!muscleMap[m.name]) {
        muscleMap[m.name] = { sets: 0, estimatedVolume: 0, isPrimary: false };
      }
      if (m.isPrimary && reps > 0) {
        muscleMap[m.name].sets += sets;
        muscleMap[m.name].isPrimary = true;
      }
      muscleMap[m.name].estimatedVolume += repVolume;
    }

    // Score from analysis
    if (result.analysis && result.analysis.movementQuality != null) {
      totalScore += result.analysis.movementQuality;
      totalScoredSets++;
    } else if (result.repHistory && result.repHistory.length > 0) {
      const avgRepScore = result.repHistory.reduce((s, r) => s + (r.score || 0), 0) / result.repHistory.length;
      if (!isNaN(avgRepScore)) {
        totalScore += avgRepScore;
        totalScoredSets++;
      }
    }

    // Extract structured findings from analysis
    if (result.analysis) {
      if (result.analysis.asymmetry && result.analysis.asymmetry.score <= 10) {
        highlights.push({ key: 'coach_symmetry', exercise: exercise.key, exerciseName: exercise.name });
      }
      if (result.analysis.fatigue && result.analysis.fatigue.velocityDropoff > 30) {
        improvements.push({ key: 'coach_velocity_drop', exercise: exercise.key, exerciseName: exercise.name, dropoff: Math.round(result.analysis.fatigue.velocityDropoff) });
      }
      if (result.analysis.rangeOfMotion && result.analysis.rangeOfMotion.consistency < 70) {
        improvements.push({ key: 'coach_rom_inconsistent', exercise: exercise.key, exerciseName: exercise.name, consistency: result.analysis.rangeOfMotion.consistency });
      }
      if (result.analysis.compensationPatterns) {
        for (const comp of result.analysis.compensationPatterns) {
          if (comp.severity === 'major') {
            improvements.push({ key: 'coach_compensation', exercise: exercise.key, exerciseName: exercise.name, pattern: comp.pattern, description: comp.description });
          }
        }
      }
      if (result.analysis.movementQuality >= 85) {
        highlights.push({ key: 'coach_quality_strong', exercise: exercise.key, exerciseName: exercise.name, score: result.analysis.movementQuality });
      }
    }
  }

  // Compute average score and grade
  const avgScore = totalScoredSets > 0 ? totalScore / totalScoredSets : 50;
  const grade = _scoreToGrade(avgScore);

  // Build muscles worked list
  const musclesWorked = Object.entries(muscleMap)
    .filter(([_, data]) => data.isPrimary)
    .sort((a, b) => b[1].sets - a[1].sets)
    .map(([name, data]) => ({
      name,
      sets: data.sets,
      estimatedVolume: data.estimatedVolume > 0 ? `${Math.round(data.estimatedVolume)} kg` : 'bodyweight',
    }));

  // Volume adequacy highlights
  for (const m of musclesWorked) {
    if (m.sets >= 4) {
      highlights.push({ key: 'coach_good_volume', muscle: m.name, sets: m.sets });
    }
  }

  // Fallbacks
  if (highlights.length === 0) {
    highlights.push({ key: 'coach_session_completed', count: exerciseResults.length });
  }
  if (improvements.length === 0) {
    improvements.push({ key: 'coach_no_issues' });
  }

  // Deduplicate by key+exercise
  const dedup = (arr) => {
    const seen = new Set();
    return arr.filter(item => {
      const id = `${item.key}:${item.exercise || item.muscle || ''}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice(0, 5);
  };

  // Summary structure
  const totalReps = exerciseResults.reduce((s, r) => s + (r.reps || 0) * (r.sets || 1), 0);
  const qualityTier = avgScore >= 85 ? 'strong' : avgScore >= 70 ? 'solid' : avgScore >= 55 ? 'needs_attention' : 'significant_issues';

  return {
    summary: {
      key: 'coach_summary',
      grade,
      totalReps,
      exerciseCount: exerciseResults.length,
      exerciseNames: exerciseResults.map(r => EXERCISES[r.exerciseKey]?.name || r.exerciseKey).filter(Boolean),
      volumeLoad: Math.round(totalVolumeLoad),
      qualityTier,
    },
    grade,
    highlights: dedup(highlights),
    improvements: dedup(improvements),
    volumeLoad: Math.round(totalVolumeLoad),
    musclesWorked,
  };
}

function _scoreToGrade(score) {
  if (score >= 93) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 78) return 'B+';
  if (score >= 68) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}


// ---------------------------------------------------------------------------
// Acute:Chronic Workload Ratio
// ---------------------------------------------------------------------------

/**
 * Calculate acute:chronic workload ratio (ACWR).
 * Gabbett TJ, 2016, Br J Sports Med.
 *
 * Acute load = sum of last 7 days.
 * Chronic load = rolling 28-day average (per week).
 * Ratio 0.8-1.3 = optimal (sweet spot).
 * Ratio >1.5 = danger zone (spike).
 *
 * @param {Array<{ date: string|Date, load: number }>} workoutHistory
 *   load = reps * sets * estimated_intensity (arbitrary units, consistent is key)
 * @returns {{ acuteLoad: number, chronicLoad: number, ratio: number, zone: string }}
 */
export function calculateWorkloadRatio(workoutHistory) {
  if (!workoutHistory || workoutHistory.length === 0) {
    return { acuteLoad: 0, chronicLoad: 0, ratio: 0, zone: 'undertraining' };
  }

  const now = new Date();
  const msPerDay = 86400000;

  let acuteLoad = 0; // last 7 days
  const weeklyLoads = [0, 0, 0, 0]; // 4 weeks

  for (const entry of workoutHistory) {
    const entryDate = new Date(entry.date);
    const daysAgo = (now - entryDate) / msPerDay;

    if (daysAgo < 0 || daysAgo > 28) continue;

    if (daysAgo <= 7) {
      acuteLoad += entry.load;
    }

    // Assign to week bucket
    const weekIndex = Math.min(3, Math.floor(daysAgo / 7));
    weeklyLoads[weekIndex] += entry.load;
  }

  // Chronic = average weekly load over 4 weeks
  const chronicLoad = weeklyLoads.reduce((s, w) => s + w, 0) / 4;

  const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;

  let zone;
  if (ratio < 0.8) zone = 'undertraining';
  else if (ratio <= 1.3) zone = 'optimal';
  else if (ratio <= 1.5) zone = 'caution';
  else zone = 'danger';

  return {
    acuteLoad: Math.round(acuteLoad),
    chronicLoad: Math.round(chronicLoad),
    ratio: Math.round(ratio * 100) / 100,
    zone,
  };
}

// ---------------------------------------------------------------------------
// 1RM Estimation
// ---------------------------------------------------------------------------

/**
 * Estimate one-rep max from reps performed at a given weight.
 * Brzycki formula (1993): 1RM = weight / (1.0278 - 0.0278 * reps)
 * Most accurate for reps <= 10. For reps > 10, uses Epley formula
 * as fallback: 1RM = weight * (1 + reps / 30).
 *
 * @param {number} weight - weight lifted (any unit, returned in same unit)
 * @param {number} reps - reps completed (must be >= 1)
 * @returns {number} estimated 1RM
 */
export function estimateOneRepMax(weight, reps) {
  if (!weight || weight <= 0 || !reps || reps < 1) return 0;
  if (reps === 1) return weight;

  if (reps <= 10) {
    // Brzycki 1993
    const denominator = 1.0278 - 0.0278 * reps;
    return denominator > 0 ? Math.round(weight / denominator) : Math.round(weight * (1 + reps / 30));
  }

  // Epley formula for higher reps (more reliable above 10)
  return Math.round(weight * (1 + reps / 30));
}

// ---------------------------------------------------------------------------
// Strength level classification
// ---------------------------------------------------------------------------

/**
 * Classify strength level relative to population.
 * Based on compiled standards from Rippetoe/Kilgore, ExRx.net, and
 * Strength Level community data.
 *
 * @param {string} exerciseKey - key from EXERCISES
 * @param {number} oneRM - estimated or actual 1RM (kg)
 * @param {number} bodyweight - in kg
 * @param {string} sex - 'male' or 'female'
 * @returns {string} 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'elite'
 */
export function getStrengthLevel(exerciseKey, oneRM, bodyweight, sex) {
  if (!oneRM || !bodyweight || bodyweight <= 0) return 'beginner';

  const standards = STRENGTH_STANDARDS[exerciseKey];
  if (!standards) return 'intermediate'; // unknown exercise, default to middle

  const ratios = sex === 'female' ? standards.female : standards.male;
  const relativeStrength = oneRM / bodyweight;

  for (let i = ratios.length - 1; i >= 0; i--) {
    if (relativeStrength >= ratios[i]) {
      return STRENGTH_LABELS[i];
    }
  }

  return 'beginner';
}

// ---------------------------------------------------------------------------
// Next workout suggestion
// ---------------------------------------------------------------------------

/**
 * Suggest next workout based on training history and estimated recovery.
 *
 * Uses per-muscle recovery estimates from sports science literature.
 * Accounts for which muscles were trained and when.
 *
 * @param {{ bodyweight?: number, sex?: string, experience?: string }} profile
 * @param {Array<{
 *   date: string|Date,
 *   exercises: Array<{ exerciseKey: string, sets: number, reps: number }>
 * }>} workoutHistory - sorted newest first
 * @returns {{ recommendation: string, suggestedExercises: string[],
 *            estimatedRecovery: string, daysUntilRecovered: number }}
 */
export function suggestNextWorkout(profile, workoutHistory) {
  if (!workoutHistory || workoutHistory.length === 0) {
    return {
      recommendation: 'No training history available. Start with a full-body session focusing on compound movements at moderate intensity.',
      suggestedExercises: ['squat', 'bench_press', 'bent_over_row', 'overhead_press'],
      estimatedRecovery: 'recovered',
      daysUntilRecovered: 0,
    };
  }

  const now = new Date();
  const msPerHour = 3600000;

  // Track when each muscle was last trained and how heavily
  const muscleLastTrained = {}; // muscle -> { hoursAgo, sets }
  const muscleWeeklySets = {}; // muscle -> total sets in last 7 days

  for (const session of workoutHistory) {
    const sessionDate = new Date(session.date);
    const hoursAgo = (now - sessionDate) / msPerHour;

    if (hoursAgo > 168) continue; // only consider last 7 days

    for (const ex of (session.exercises || [])) {
      const exercise = EXERCISES[ex.exerciseKey];
      if (!exercise) continue;

      const allMuscles = [...exercise.muscles.primary, ...exercise.muscles.secondary];
      for (const muscle of allMuscles) {
        // Track last trained
        if (!muscleLastTrained[muscle] || hoursAgo < muscleLastTrained[muscle].hoursAgo) {
          muscleLastTrained[muscle] = { hoursAgo, sets: ex.sets || 1 };
        }
        // Weekly volume
        if (!muscleWeeklySets[muscle]) muscleWeeklySets[muscle] = 0;
        if (exercise.muscles.primary.includes(muscle)) {
          muscleWeeklySets[muscle] += (ex.sets || 1);
        }
      }
    }
  }

  // Determine recovery state per muscle
  const recoveredMuscles = [];
  const partialMuscles = [];
  const fatigued = [];
  let maxHoursUntilRecovered = 0;

  for (const [muscle, data] of Object.entries(muscleLastTrained)) {
    const recoveryTime = RECOVERY_HOURS[muscle] || DEFAULT_RECOVERY_HOURS;
    const remainingHours = recoveryTime - data.hoursAgo;

    if (remainingHours <= 0) {
      recoveredMuscles.push(muscle);
    } else if (remainingHours < recoveryTime * 0.3) {
      partialMuscles.push(muscle);
    } else {
      fatigued.push(muscle);
      if (remainingHours > maxHoursUntilRecovered) {
        maxHoursUntilRecovered = remainingHours;
      }
    }
  }

  // Overall recovery state
  let estimatedRecovery;
  if (fatigued.length === 0 && partialMuscles.length === 0) {
    estimatedRecovery = 'recovered';
  } else if (fatigued.length === 0) {
    estimatedRecovery = 'partial';
  } else {
    estimatedRecovery = 'rest needed';
  }

  const daysUntilRecovered = Math.max(0, Math.ceil(maxHoursUntilRecovered / 24));

  // Determine which muscle groups need volume (under 10 sets/week)
  const undertrainedMuscles = new Set();
  const allMajorMuscles = ['Quadriceps', 'Glutes', 'Hamstrings', 'Pectorals',
    'Latissimus Dorsi', 'Anterior Deltoid', 'Medial Deltoid', 'Biceps Brachii', 'Triceps'];

  for (const muscle of allMajorMuscles) {
    const weeklySets = muscleWeeklySets[muscle] || 0;
    if (weeklySets < 10 && !fatigued.includes(muscle)) {
      undertrainedMuscles.add(muscle);
    }
  }

  // Pick exercises that target recovered/partial muscles and fill volume gaps
  const suggestedExercises = _selectExercises(
    recoveredMuscles,
    partialMuscles,
    fatigued,
    undertrainedMuscles,
    workoutHistory
  );

  // Build recommendation text
  const recommendation = _buildRecommendation(
    estimatedRecovery,
    daysUntilRecovered,
    suggestedExercises,
    undertrainedMuscles,
    fatigued
  );

  return {
    recommendation,
    suggestedExercises,
    estimatedRecovery,
    daysUntilRecovered,
  };
}

function _selectExercises(recovered, partial, fatigued, undertrained, history) {
  const fatigueSet = new Set(fatigued);
  const selected = [];

  // Prefer compound exercises that hit undertrained, recovered muscles
  const candidates = Object.entries(EXERCISES)
    .filter(([key, ex]) => !ex.isIsometric)
    .map(([key, ex]) => {
      const primaryRecovered = ex.muscles.primary.filter((m) =>
        !fatigueSet.has(m)
      ).length;
      const hitsUndertrained = ex.muscles.primary.filter((m) =>
        undertrained.has(m)
      ).length;
      const isCompound = ex.category === 'compound';

      return {
        key,
        score: primaryRecovered * 3 + hitsUndertrained * 5 + (isCompound ? 4 : 0),
        exercise: ex,
      };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  // Pick top 4, avoiding duplicate muscle groups
  const coveredPrimary = new Set();
  for (const candidate of candidates) {
    if (selected.length >= 4) break;

    const newMuscle = candidate.exercise.muscles.primary.some(
      (m) => !coveredPrimary.has(m)
    );
    if (!newMuscle && selected.length >= 2) continue;

    selected.push(candidate.key);
    for (const m of candidate.exercise.muscles.primary) {
      coveredPrimary.add(m);
    }
  }

  // Fallback if nothing selected
  if (selected.length === 0) {
    return ['squat', 'push_up', 'bent_over_row'];
  }

  return selected;
}

function _buildRecommendation(recovery, daysUntil, exercises, undertrained, fatigued) {
  const exerciseNames = exercises
    .map((key) => EXERCISES[key]?.name || key)
    .join(', ');

  if (recovery === 'rest needed') {
    return `Some muscle groups are still recovering (${fatigued.slice(0, 3).join(', ')}). Full recovery in approximately ${daysUntil} day(s). If training today, focus on unrelated muscle groups: ${exerciseNames}.`;
  }

  if (recovery === 'partial') {
    return `Most muscles are recovered or nearly recovered. Good to train. Suggested session: ${exerciseNames}.`;
  }

  const undertrainedList = [...undertrained].slice(0, 3);
  const volumeNote = undertrainedList.length > 0
    ? ` Priority: ${undertrainedList.join(', ')} could use more weekly volume.`
    : '';

  return `Fully recovered and ready to train. Suggested session: ${exerciseNames}.${volumeNote}`;
}
