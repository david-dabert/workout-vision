/**
 * Workout of the Week — deterministic weekly exercise challenge.
 *
 * Each week, one exercise is selected for everyone to attempt.
 * Creates a shared ritual: all users working on the same exercise that week,
 * with shareable results for social comparison.
 *
 * Selection is deterministic from the week number so all users see the same exercise.
 */

import { EXERCISES } from './exercises';

// Curated pool of exercises suitable for weekly challenges
// (popular, well-tracked by pose estimation, comparable across users)
const CHALLENGE_POOL = [
  'squat', 'bench_press', 'deadlift', 'overhead_press',
  'bent_over_row', 'pull_up', 'push_up', 'lunge',
  'bicep_curl', 'tricep_extension', 'lateral_raise',
  'front_squat', 'romanian_deadlift', 'goblet_squat',
];

/**
 * Get ISO week number from a date.
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Get the current Workout of the Week.
 * Deterministic: same exercise for all users during the same ISO week.
 *
 * @param {Date} [date] - optional date override (defaults to now)
 * @returns {{ exercise: string, exerciseName: string, weekNumber: number, year: number, daysLeft: number }}
 */
export function getWorkoutOfTheWeek(date = new Date()) {
  const weekNum = getWeekNumber(date);
  const year = date.getFullYear();

  // Deterministic selection using week + year as seed
  const seed = year * 100 + weekNum;
  const index = seed % CHALLENGE_POOL.length;
  const exerciseKey = CHALLENGE_POOL[index];
  const exerciseData = EXERCISES[exerciseKey];

  // Calculate days left in the week (week ends Sunday)
  const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
  const daysLeft = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

  return {
    exercise: exerciseKey,
    exerciseName: exerciseData?.name || exerciseKey.replace(/_/g, ' '),
    weekNumber: weekNum,
    year,
    daysLeft,
    category: exerciseData?.category || 'compound',
  };
}

/**
 * Check if a workout result matches the current Workout of the Week.
 * @param {object} result - workout result with exercise key
 * @returns {boolean}
 */
export function isWorkoutOfTheWeek(result) {
  const wotw = getWorkoutOfTheWeek();
  return result?.exercise === wotw.exercise;
}
