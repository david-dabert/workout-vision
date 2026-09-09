/**
 * Six-category Personal Record (PR) detection system.
 * Compares each new workout against all previous workouts from IndexedDB
 * and returns an array of PR types achieved.
 *
 * Categories:
 *   1. Heaviest   — max weight lifted for an exercise
 *   2. Most Reps  — most reps in a single set for an exercise
 *   3. Best Form  — highest form score for an exercise
 *   4. Longest Set — longest duration set for an exercise
 *   5. Max Volume — highest single-set volume (weight x reps) for an exercise
 *   6. Streak     — longest consecutive scheduled days trained
 */

import localforage from 'localforage';
import { getAllWorkouts, getProfile } from './storage';

const prStore = localforage.createInstance({ name: 'workoutVision', storeName: 'personalRecords' });

// ── PR Store CRUD ──

async function getAllPRs() {
  const prs = [];
  await prStore.iterate((value) => {
    prs.push(value);
  });
  return prs.sort((a, b) => b.achievedAt - a.achievedAt);
}

async function getPRsForExercise(exerciseKey) {
  const all = await getAllPRs();
  return all.filter(pr => pr.exercise === exerciseKey);
}

async function savePR(pr) {
  const id = `pr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry = { id, ...pr, achievedAt: Date.now() };
  await prStore.setItem(id, entry);
  return entry;
}

// ── Streak calculation (smart: scheduled days only) ──

export function calculateSmartStreak(workouts, trainingDays) {
  if (!workouts || workouts.length === 0) return 0;

  // Default to Mon/Wed/Fri if no training days set
  const schedule = (trainingDays && trainingDays.length > 0)
    ? trainingDays
    : [1, 3, 5];

  // Build a set of date strings when workouts happened
  const workedDates = new Set(
    workouts.map(w => {
      const d = new Date(w.date || w.createdAt);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Walk backwards day by day, only counting scheduled days
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ...

    // Skip non-scheduled days
    if (!schedule.includes(dayOfWeek)) continue;

    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (workedDates.has(key)) {
      streak++;
    } else {
      // If today is a scheduled day and we haven't trained yet, don't break
      if (i === 0) continue;
      break;
    }
  }

  return streak;
}

// ── Longest streak ever (for Streak PR) ──

function calculateLongestStreak(workouts, trainingDays) {
  if (!workouts || workouts.length === 0) return 0;

  const schedule = (trainingDays && trainingDays.length > 0)
    ? trainingDays
    : [1, 3, 5];

  const workedDates = new Set(
    workouts.map(w => {
      const d = new Date(w.date || w.createdAt);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  // Find date range
  const dates = workouts.map(w => new Date(w.date || w.createdAt).getTime());
  const earliest = new Date(Math.min(...dates));
  const latest = new Date(Math.max(...dates));
  earliest.setHours(0, 0, 0, 0);
  latest.setHours(0, 0, 0, 0);

  let longest = 0;
  let current = 0;

  const d = new Date(earliest);
  while (d <= latest) {
    const dayOfWeek = d.getDay();
    if (schedule.includes(dayOfWeek)) {
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (workedDates.has(key)) {
        current++;
        longest = Math.max(longest, current);
      } else {
        current = 0;
      }
    }
    d.setDate(d.getDate() + 1);
  }

  return longest;
}

// ── Average form score for an exercise ──

function getAverageFormScore(workouts, exerciseKey) {
  const matching = workouts.filter(w =>
    w.exercise === exerciseKey && w.formScore != null && w.formScore > 0
  );
  if (matching.length === 0) return null;
  return matching.reduce((sum, w) => sum + w.formScore, 0) / matching.length;
}

// ── Main PR detection function ──

export async function detectPRs(currentWorkout) {
  const allWorkouts = await getAllWorkouts();
  const profile = await getProfile();
  const trainingDays = profile?.trainingDays;

  // Filter to past workouts for the same exercise (exclude the current one by id)
  const exerciseKey = currentWorkout.exercise;
  const pastForExercise = allWorkouts.filter(w =>
    w.exercise === exerciseKey && w.id !== currentWorkout.id
  );

  const achievedPRs = [];
  const weight = currentWorkout.weight || 0;
  const reps = currentWorkout.reps || 0;
  const formScore = currentWorkout.formScore || 0;
  const duration = currentWorkout.duration || 0;
  const volume = weight * reps;

  // 1. Heaviest
  if (weight > 0) {
    const prevMax = Math.max(0, ...pastForExercise.map(w => w.weight || 0));
    if (weight > prevMax) {
      achievedPRs.push({
        type: 'heaviest',
        exercise: exerciseKey,
        exerciseName: currentWorkout.exerciseName,
        value: weight,
        previousBest: prevMax || null,
        unit: 'kg',
      });
    }
  }

  // 2. Most Reps
  if (reps > 0) {
    const prevMax = Math.max(0, ...pastForExercise.map(w => w.reps || 0));
    if (reps > prevMax && pastForExercise.length > 0) {
      achievedPRs.push({
        type: 'most_reps',
        exercise: exerciseKey,
        exerciseName: currentWorkout.exerciseName,
        value: reps,
        previousBest: prevMax || null,
        unit: 'reps',
      });
    }
  }

  // 3. Best Form
  if (formScore > 0) {
    const prevMax = Math.max(0, ...pastForExercise.map(w => w.formScore || 0));
    if (formScore > prevMax && pastForExercise.length > 0) {
      achievedPRs.push({
        type: 'best_form',
        exercise: exerciseKey,
        exerciseName: currentWorkout.exerciseName,
        value: formScore,
        previousBest: prevMax || null,
        unit: 'pts',
      });
    }
  }

  // 4. Longest Set
  if (duration > 0) {
    const prevMax = Math.max(0, ...pastForExercise.map(w => w.duration || 0));
    if (duration > prevMax && pastForExercise.length > 0) {
      achievedPRs.push({
        type: 'longest_set',
        exercise: exerciseKey,
        exerciseName: currentWorkout.exerciseName,
        value: duration,
        previousBest: prevMax || null,
        unit: 's',
      });
    }
  }

  // 5. Max Volume
  if (volume > 0) {
    const prevMax = Math.max(0, ...pastForExercise.map(w => (w.weight || 0) * (w.reps || 0)));
    if (volume > prevMax) {
      achievedPRs.push({
        type: 'max_volume',
        exercise: exerciseKey,
        exerciseName: currentWorkout.exerciseName,
        value: volume,
        previousBest: prevMax || null,
        unit: 'kg',
      });
    }
  }

  // 6. Streak
  const currentStreak = calculateSmartStreak(allWorkouts, trainingDays);
  const pastWorkoutsWithoutToday = allWorkouts.filter(w => {
    const wDate = new Date(w.date || w.createdAt);
    const today = new Date();
    return wDate.toDateString() !== today.toDateString();
  });
  const previousLongest = calculateLongestStreak(pastWorkoutsWithoutToday, trainingDays);
  if (currentStreak > previousLongest && currentStreak > 1) {
    achievedPRs.push({
      type: 'streak',
      exercise: null,
      exerciseName: null,
      value: currentStreak,
      previousBest: previousLongest || null,
      unit: 'days',
    });
  }

  // Save achieved PRs to the store
  for (const pr of achievedPRs) {
    await savePR(pr);
  }

  return achievedPRs;
}

// ── Form regression detection ──

export async function detectFormRegression(currentWorkout) {
  const allWorkouts = await getAllWorkouts();
  const exerciseKey = currentWorkout.exercise;
  const formScore = currentWorkout.formScore || 0;

  if (formScore <= 0) return null;

  const avgScore = getAverageFormScore(allWorkouts, exerciseKey);
  if (avgScore === null) return null;

  const drop = Math.round(avgScore - formScore);
  if (drop > 15) {
    return {
      currentScore: formScore,
      averageScore: Math.round(avgScore),
      drop,
    };
  }

  return null;
}
