/**
 * Rep counting orchestration — initial counting, finalization, and enrichment.
 */

import { RepCounter } from '../repCounter';

/**
 * Run rep counting on collected frames and finalize.
 *
 * @param {Array} frames - Array of { landmarks, timestamp, angles }
 * @param {string} exercise - Exercise key
 * @param {number} analysisFps - Analysis frame rate
 * @param {Array} userInjuries - Injury keys
 * @param {number} weightKg - Weight in kg
 * @returns {RepCounter} The finalized rep counter instance
 */
export function countReps({ frames, exercise, analysisFps, userInjuries, weightKg }) {
  const repCounter = new RepCounter(exercise, { fps: analysisFps, userInjuries, mode: 'video', weightKg });
  for (const f of frames) repCounter.update(f.landmarks, f.timestamp);
  return repCounter;
}

/**
 * Enrich rep history with time-based fields.
 *
 * @param {Array} repHistory - Raw rep history from RepCounter
 * @param {number} interval - Time interval between frames (1/fps)
 * @returns {Array} Enriched rep history with startTime, peakTime, endTime
 */
export function enrichRepHistory(repHistory, interval) {
  return repHistory.map(r => ({
    ...r,
    startTime: (r.startFrame * interval),
    peakTime: ((r.peakFrame || r.bottomFrame) * interval),
    endTime: (r.endFrame * interval),
  }));
}
