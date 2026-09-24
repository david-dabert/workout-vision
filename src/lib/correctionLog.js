/**
 * Unified correction log — records every manual adjustment (rep count or exercise)
 * so the system can learn from user feedback and surface correction patterns.
 *
 * Stored in IndexedDB via localforage. Each correction is an immutable entry.
 */

import localforage from 'localforage';

const correctionStore = localforage.createInstance({
  name: 'workoutVision',
  storeName: 'corrections',
});

/**
 * Log a correction made by the user.
 * @param {object} entry
 * @param {'rep_count' | 'exercise'} entry.type
 * @param {string} [entry.workoutId] — ID of the affected workout
 * @param {string} [entry.exerciseKey] — exercise key involved
 * @param {*} entry.original — what the AI detected
 * @param {*} entry.corrected — what the user set it to
 * @param {number} [entry.confidence] — detector confidence at time of correction
 * @returns {Promise<object>} the saved entry with id and timestamp
 */
export async function logCorrection(entry) {
  const id = `corr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    id,
    ...entry,
    timestamp: Date.now(),
  };
  await correctionStore.setItem(id, record);
  return record;
}

/**
 * Get all corrections, newest first.
 * @param {object} [filters]
 * @param {'rep_count' | 'exercise'} [filters.type]
 * @param {string} [filters.exerciseKey]
 * @returns {Promise<Array>}
 */
export async function getCorrections(filters = {}) {
  const all = [];
  await correctionStore.iterate((value) => {
    if (filters.type && value.type !== filters.type) return;
    if (filters.exerciseKey && value.exerciseKey !== filters.exerciseKey) return;
    all.push(value);
  });
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Get summary stats about corrections.
 * @returns {Promise<{ total: number, repCorrections: number, exerciseCorrections: number, topMiscounted: Array }>}
 */
export async function getCorrectionStats() {
  let total = 0;
  let repCorrections = 0;
  let exerciseCorrections = 0;
  const repMisses = {}; // exerciseKey → count
  const exerciseMisses = {}; // "detected→corrected" → count

  await correctionStore.iterate((value) => {
    total++;
    if (value.type === 'rep_count') {
      repCorrections++;
      const key = value.exerciseKey || 'unknown';
      repMisses[key] = (repMisses[key] || 0) + 1;
    } else if (value.type === 'exercise') {
      exerciseCorrections++;
      const pair = `${value.original}→${value.corrected}`;
      exerciseMisses[pair] = (exerciseMisses[pair] || 0) + 1;
    }
  });

  const topMiscounted = Object.entries(repMisses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([exercise, count]) => ({ exercise, count }));

  const topMisidentified = Object.entries(exerciseMisses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pair, count]) => ({ pair, count }));

  return { total, repCorrections, exerciseCorrections, topMiscounted, topMisidentified };
}
