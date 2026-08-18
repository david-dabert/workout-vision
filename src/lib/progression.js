/**
 * Progression engine — evidence-based training recommendations.
 *
 * Sources:
 * - Progressive overload: Kraemer & Ratamess (2004), ACSM Position Stand
 * - Periodization: Rhea & Alderman (2004) meta-analysis
 * - Hypertrophy volume: Schoenfeld et al. (2017), 10-20 sets/muscle/week
 * - RPE/RIR: Zourdos et al. (2016), autoregulation
 * - Deload: Pritchard et al. (2015), every 4-6 weeks
 * - Strength: Ralston et al. (2017), 3-5 reps for maximal strength
 * - Rest periods: Schoenfeld et al. (2016), 2-3 min for strength, 60-90s hypertrophy
 */

import { estimateOneRepMax, getStrengthLevel } from './coach';

/**
 * Analyze training history and generate progression recommendations.
 *
 * Returns:
 * {
 *   overallTrend: 'progressing' | 'plateau' | 'regressing',
 *   weeklyVolume: { [muscle]: sets },
 *   volumeRecommendations: [],
 *   exerciseProgressions: [{ exercise, trend, recommendation, nextTarget }],
 *   deloadNeeded: boolean,
 *   streakDays: number,
 *   weeklyFrequency: number,
 * }
 */
export function analyzeProgression(workouts, profile) {
  if (!workouts || workouts.length < 3) {
    return {
      overallTrend: 'insufficient',
      message: 'Complete at least 3 workouts to get progression analysis.',
      weeklyVolume: {},
      volumeRecommendations: [],
      exerciseProgressions: [],
      deloadNeeded: false,
      streakDays: calculateStreak(workouts),
      weeklyFrequency: 0,
    };
  }

  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const twoWeeks = 14 * 24 * 60 * 60 * 1000;
  const fourWeeks = 28 * 24 * 60 * 60 * 1000;

  // Weekly frequency
  const thisWeek = workouts.filter(w => now - (w.createdAt || new Date(w.date).getTime()) < oneWeek);
  const lastWeek = workouts.filter(w => {
    const t = w.createdAt || new Date(w.date).getTime();
    return now - t >= oneWeek && now - t < twoWeeks;
  });

  // Weekly volume per muscle group
  const weeklyVolume = {};
  thisWeek.forEach(w => {
    const muscles = getMusclesForExercise(w.exercise);
    muscles.forEach(m => {
      weeklyVolume[m] = (weeklyVolume[m] || 0) + 1; // 1 set per workout entry
    });
  });

  // Volume recommendations (Schoenfeld 2017: 10-20 sets/muscle/week for hypertrophy)
  const volumeRecommendations = [];
  const VOLUME_TARGETS = {
    Quadriceps: { min: 10, max: 20 },
    Hamstrings: { min: 8, max: 16 },
    Glutes: { min: 8, max: 16 },
    Chest: { min: 10, max: 20 },
    Back: { min: 10, max: 20 },
    Shoulders: { min: 8, max: 16 },
    Biceps: { min: 6, max: 14 },
    Triceps: { min: 6, max: 14 },
    Core: { min: 6, max: 12 },
    Calves: { min: 8, max: 16 },
  };

  for (const [muscle, target] of Object.entries(VOLUME_TARGETS)) {
    const current = weeklyVolume[muscle] || 0;
    if (current < target.min) {
      volumeRecommendations.push({
        muscle,
        current,
        target: target.min,
        status: 'under',
        message: `${muscle}: ${current}/${target.min} sets. Add ${target.min - current} more sets this week.`,
      });
    } else if (current > target.max) {
      volumeRecommendations.push({
        muscle,
        current,
        target: target.max,
        status: 'over',
        message: `${muscle}: ${current} sets (max ${target.max}). Consider reducing to avoid overtraining.`,
      });
    }
  }

  // Per-exercise progression
  const exerciseGroups = {};
  workouts.forEach(w => {
    if (!exerciseGroups[w.exercise]) exerciseGroups[w.exercise] = [];
    exerciseGroups[w.exercise].push(w);
  });

  const exerciseProgressions = [];
  for (const [exKey, sessions] of Object.entries(exerciseGroups)) {
    if (sessions.length < 2) continue;
    const recent = sessions.slice(0, 5); // most recent 5
    const progression = analyzeExerciseProgression(exKey, recent, profile);
    exerciseProgressions.push(progression);
  }

  // Overall trend
  const trends = exerciseProgressions.map(p => p.trend);
  const progCount = trends.filter(t => t === 'progressing').length;
  const regCount = trends.filter(t => t === 'regressing').length;
  let overallTrend = 'plateau';
  if (progCount > regCount && progCount > 0) overallTrend = 'progressing';
  if (regCount > progCount && regCount > 0) overallTrend = 'regressing';

  // Deload check (every 4-6 weeks of progressive training, Pritchard 2015).
  // Two independent triggers:
  //   1. Time-based: trained for 28+ days (first to last workout in history).
  //   2. Form-based: >16 sets in 4 weeks with avg form score < 65.
  const fourWeekWorkouts = workouts.filter(w =>
    now - (w.createdAt || new Date(w.date).getTime()) < fourWeeks
  );
  const avgFormScore = fourWeekWorkouts.length > 0
    ? fourWeekWorkouts.reduce((s, w) => s + (w.formScore || 0), 0) / fourWeekWorkouts.length
    : 100;

  // Time-based gate: if training history spans 28+ days, flag deload consideration
  const sortedByTime = [...workouts].sort((a, b) => {
    const ta = a.createdAt || new Date(a.date).getTime();
    const tb = b.createdAt || new Date(b.date).getTime();
    return ta - tb;
  });
  const firstWorkoutTime = sortedByTime[0]
    ? (sortedByTime[0].createdAt || new Date(sortedByTime[0].date).getTime())
    : now;
  const lastWorkoutTime = sortedByTime[sortedByTime.length - 1]
    ? (sortedByTime[sortedByTime.length - 1].createdAt || new Date(sortedByTime[sortedByTime.length - 1].date).getTime())
    : now;
  const trainingSpanDays = (lastWorkoutTime - firstWorkoutTime) / (24 * 60 * 60 * 1000);
  const timeBasedDeload = trainingSpanDays >= 28;

  const formBasedDeload = fourWeekWorkouts.length > 16 && avgFormScore < 65;
  const deloadNeeded = timeBasedDeload || formBasedDeload;

  return {
    overallTrend,
    weeklyVolume,
    volumeRecommendations: volumeRecommendations.sort((a, b) => a.current - b.current),
    exerciseProgressions: exerciseProgressions.sort((a, b) => {
      const order = { regressing: 0, plateau: 1, progressing: 2 };
      return (order[a.trend] || 1) - (order[b.trend] || 1);
    }),
    deloadNeeded,
    streakDays: calculateStreak(workouts),
    weeklyFrequency: thisWeek.length,
    lastWeekFrequency: lastWeek.length,
  };
}

function analyzeExerciseProgression(exerciseKey, sessions, profile) {
  const name = sessions[0]?.exerciseName || exerciseKey;

  // Compare most recent to oldest in window
  const newest = sessions[0];
  const oldest = sessions[sessions.length - 1];

  // Metrics to compare: volume load (weight * reps), form score, reps
  const newestVolume = (newest.weight || 0) * (newest.reps || 0);
  const oldestVolume = (oldest.weight || 0) * (oldest.reps || 0);
  const newestForm = newest.formScore || 0;
  const oldestForm = oldest.formScore || 0;

  let trend = 'plateau';
  const reasons = [];

  if (newestVolume > oldestVolume * 1.05) {
    trend = 'progressing';
    reasons.push('Volume load increasing');
  } else if (newestVolume < oldestVolume * 0.9 && newestVolume > 0) {
    trend = 'regressing';
    reasons.push('Volume load decreasing');
  }

  if (newestForm > oldestForm + 5) {
    if (trend !== 'progressing') trend = 'progressing';
    reasons.push('Form improving');
  } else if (newestForm < oldestForm - 10) {
    reasons.push('Form declining');
  }

  // Generate next target using progressive overload
  const recommendation = generateNextTarget(exerciseKey, sessions, profile);

  return {
    exercise: exerciseKey,
    name,
    trend,
    reasons,
    ...recommendation,
    lastWeight: newest.weight || 0,
    lastReps: newest.reps || 0,
    lastFormScore: newestForm,
    sessionCount: sessions.length,
  };
}

/**
 * Returns true if the exercise is an isolation movement.
 * Isolation exercises use 1.25kg increments; compound exercises use 2.5kg.
 */
function isIsolationExercise(exerciseKey) {
  const ISOLATION_EXERCISES = new Set([
    'bicep_curl', 'tricep_extension', 'lateral_raise', 'face_pull',
    'leg_extension', 'leg_curl', 'standing_leg_extension', 'calf_raise',
    'seated_calf_raise', 'crunch', 'hanging_leg_raise', 'nordic_curl',
  ]);
  return ISOLATION_EXERCISES.has(exerciseKey);
}

function generateNextTarget(exerciseKey, sessions, profile) {
  const latest = sessions[0];
  const w = latest.weight || 0;
  const r = latest.reps || 0;
  const form = latest.formScore || 0;

  // Progressive overload rules (ACSM, Kraemer & Ratamess 2004):
  // 1. If form > 80 and reps >= target range top: increase weight 2.5-5%
  // 2. If form > 80 and reps < target range top: increase reps
  // 3. If form < 60: decrease weight, focus on technique
  // 4. Rep ranges: strength 3-5, hypertrophy 6-12, endurance 12-20

  if (form < 60) {
    return {
      recommendation: 'Reduce weight by 10% and focus on form. Good technique prevents injury and builds better strength long-term.',
      nextWeight: w > 0 ? Math.round(w * 0.9 * 2) / 2 : 0,
      nextReps: r,
      priority: 'form',
    };
  }

  if (r >= 12 && form >= 75 && w > 0) {
    // Top of hypertrophy range with good form: increase weight.
    // Isolation movements use smaller plates (1.25kg); compounds use 2.5kg.
    // No 5kg increment — that risks form breakdown and joint stress.
    const increment = isIsolationExercise(exerciseKey) ? 1.25 : 2.5;
    return {
      recommendation: `Increase weight to ${w + increment}kg. You completed ${r} reps with good form — time to add load.`,
      nextWeight: w + increment,
      nextReps: Math.max(6, r - 4),
      priority: 'weight',
    };
  }

  if (r < 6 && w > 0) {
    // Strength range: small weight increase if form good
    if (form >= 80) {
      const increment = isIsolationExercise(exerciseKey) ? 1.25 : 2.5;
      return {
        recommendation: `Add ${increment}kg. Solid form at ${r} reps in the strength range.`,
        nextWeight: w + increment,
        nextReps: r,
        priority: 'weight',
      };
    }
    return {
      recommendation: `Stay at ${w}kg and aim for ${r + 1} reps. Build consistency before adding load.`,
      nextWeight: w,
      nextReps: r + 1,
      priority: 'reps',
    };
  }

  // Default: add reps
  return {
    recommendation: `Aim for ${r + 1}-${r + 2} reps at ${w > 0 ? w + 'kg' : 'bodyweight'}. Progressive overload through volume.`,
    nextWeight: w,
    nextReps: r + 1,
    priority: 'reps',
  };
}

function calculateStreak(workouts) {
  if (!workouts || workouts.length === 0) return 0;
  const dates = [...new Set(workouts.map(w => {
    const d = new Date(w.date || w.createdAt);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }))].sort().reverse();

  let streak = 0;
  const today = new Date();
  let check = new Date(today);

  for (let i = 0; i < 365; i++) {
    const key = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`;
    if (dates.includes(key)) {
      streak++;
    } else if (i > 0) {
      break; // streak broken
    }
    check.setDate(check.getDate() - 1);
  }
  return streak;
}

function getMusclesForExercise(exerciseKey) {
  const MUSCLE_MAP = {
    squat: ['Quadriceps', 'Glutes'],
    front_squat: ['Quadriceps', 'Core'],
    deadlift: ['Hamstrings', 'Back', 'Glutes'],
    romanian_deadlift: ['Hamstrings', 'Glutes'],
    bench_press: ['Chest', 'Triceps'],
    overhead_press: ['Shoulders', 'Triceps'],
    pull_up: ['Back', 'Biceps'],
    chin_up: ['Back', 'Biceps'],
    push_up: ['Chest', 'Triceps'],
    bent_over_row: ['Back', 'Biceps'],
    hip_thrust: ['Glutes', 'Hamstrings'],
    lunge: ['Quadriceps', 'Glutes'],
    bicep_curl: ['Biceps'],
    tricep_extension: ['Triceps'],
    lateral_raise: ['Shoulders'],
    leg_extension: ['Quadriceps'],
    leg_curl: ['Hamstrings'],
    calf_raise: ['Calves'],
    crunch: ['Core'],
    plank: ['Core'],
    lat_pulldown: ['Back', 'Biceps'],
    dip: ['Chest', 'Triceps'],
    goblet_squat: ['Quadriceps', 'Glutes'],
    kettlebell_swing: ['Hamstrings', 'Glutes', 'Core'],
  };
  return MUSCLE_MAP[exerciseKey] || ['Other'];
}

/**
 * Training knowledge base — key principles for the companion to reference.
 */
export const TRAINING_PRINCIPLES = {
  progressiveOverload: {
    principle: 'Progressive Overload',
    summary: 'Gradually increase stress on the musculoskeletal system to drive adaptation.',
    application: 'Increase weight, reps, sets, or decrease rest periods over time.',
    source: 'Kraemer & Ratamess 2004, ACSM Position Stand',
  },
  specificity: {
    principle: 'Specificity (SAID)',
    summary: 'Adaptations are specific to the demands imposed.',
    application: 'Train the movement patterns and rep ranges relevant to your goals.',
    source: 'Sale & MacDougall 1981',
  },
  volumeForHypertrophy: {
    principle: 'Volume for Muscle Growth',
    summary: '10-20 sets per muscle group per week for optimal hypertrophy.',
    application: 'Track weekly sets per muscle group. Below 10 is suboptimal; above 20 risks overtraining.',
    source: 'Schoenfeld et al. 2017 meta-analysis',
  },
  repRanges: {
    principle: 'Rep Range Continuum',
    summary: 'Strength: 1-5 reps. Hypertrophy: 6-12 reps. Endurance: 12-20+ reps.',
    application: 'All ranges build muscle. Heavier loads bias neural adaptations; moderate loads bias metabolic stress.',
    source: 'Schoenfeld 2010, ACSM 2009',
  },
  restPeriods: {
    principle: 'Rest Period Optimization',
    summary: 'Strength: 2-5 min. Hypertrophy: 60-120s. Endurance: 30-60s.',
    application: 'Longer rest allows heavier loads; shorter rest increases metabolic stress.',
    source: 'Schoenfeld et al. 2016',
  },
  deload: {
    principle: 'Planned Deloading',
    summary: 'Reduce volume/intensity by 40-60% every 4-6 weeks.',
    application: 'When form scores decline or plateau persists for 2+ weeks, take a deload week.',
    source: 'Pritchard et al. 2015',
  },
  proteinTiming: {
    principle: 'Protein Distribution',
    summary: '1.6-2.2g/kg/day spread across 3-5 meals. 20-40g per meal.',
    application: 'Post-workout protein within 2 hours. Casein before sleep for overnight synthesis.',
    source: 'Aragon et al. 2017 (ISSN), Schoenfeld & Aragon 2018',
  },
  sleepRecovery: {
    principle: 'Sleep for Recovery',
    summary: '7-9 hours. Sleep deprivation reduces strength by 5-10% and impairs protein synthesis.',
    application: 'Prioritize sleep quality. Consistent bed/wake times improve training adaptation.',
    source: 'Vitale et al. 2019, Dattilo et al. 2011',
  },
};
