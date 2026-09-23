/**
 * Signal extraction, smoothing, and candidate scoring for exercise auto-detection.
 */

import { ExerciseAutoDetector } from '../exerciseDetector';
import { EXERCISES } from '../exercises';
import { RepCounter } from '../repCounter';

/**
 * Run exercise auto-detection over collected frames.
 *
 * @param {Array} frames - Array of { landmarks, timestamp, angles }
 * @param {string} initialExercise - Default exercise key
 * @param {number} analysisFps - Analysis frame rate
 * @param {Array} userInjuries - Injury keys to skip form checks for
 * @param {number} weightKg - Weight in kg
 * @param {boolean} isAutoMode - Whether exercise is '__auto__'
 * @param {Function} onExerciseDetected - Callback when exercise is detected
 * @returns {{ detectedExercise, detectionConfidence, detectionLowConfidence, candidateScores, autoDetected, repCounter }}
 */
export function detectExercise({
  frames,
  initialExercise,
  isAutoMode,
  analysisFps,
  userInjuries,
  weightKg,
  onExerciseDetected,
}) {
  const tallies = {};
  const detector = new ExerciseAutoDetector({ fps: analysisFps });
  for (const f of frames) {
    const det = detector.update(f.landmarks);
    if (det) tallies[det] = (tallies[det] || 0) + 1;
  }
  const detectionInfo = detector.getDetectionInfo();
  let detectionConfidence = detectionInfo.confidence;
  const detectionLowConfidence = detectionInfo.isLowConfidence;

  const candidates = Object.keys(tallies);
  const candidateScores = [];
  let detectedExercise = initialExercise;
  let autoDetected = false;
  let repCounter = null;

  if (candidates.length > 0) {
    let bestEx = initialExercise;
    let bestScore = -1;
    for (const ex of candidates) {
      const rc = new RepCounter(ex, { fps: analysisFps, userInjuries, mode: 'video', weightKg });
      for (const f of frames) rc.update(f.landmarks, f.timestamp);
      rc.finalize();
      const reps = rc.repHistory ? rc.repHistory.length : 0;
      const hasChecks = EXERCISES[ex]?.formChecks?.length > 0 ? 500 : 0;
      const score = reps * 1000 + hasChecks + tallies[ex];
      candidateScores.push({ exercise: ex, score, reps, tally: tallies[ex] });
      if (score > bestScore) { bestScore = score; bestEx = ex; }
    }
    candidateScores.sort((a, b) => b.score - a.score);
    if (bestEx !== initialExercise || candidates.includes(initialExercise)) {
      detectedExercise = bestEx;
      autoDetected = true;
      onExerciseDetected(detectedExercise);
      repCounter = new RepCounter(detectedExercise, { fps: analysisFps, userInjuries, mode: 'video', weightKg });
      for (const f of frames) repCounter.update(f.landmarks, f.timestamp);
    }
  } else if (isAutoMode) {
    autoDetected = 'failed';
  }

  return {
    detectedExercise,
    detectionConfidence,
    detectionLowConfidence,
    candidateScores,
    autoDetected,
    repCounter,
  };
}
