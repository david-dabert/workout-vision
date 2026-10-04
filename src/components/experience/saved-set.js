import { compactWave, waveAngles } from './wave';

/**
 * The set as the result screen saves it (storage.saveWorkout): what the app counted stays apart from what the
 * person kept. n: the count kept; corrected: true when the person typed it. A set the app counted no rep in
 * (Result.jsx, unsure) is saved with the person's count, its machineResult 0 and its correctedResult theirs,
 * so the history, the report, the spreadsheet and the contributions say the app counted none (R8).
 */
// manual: a set the app refused, whose count the person typed (WP1.6 of docs/SPEC-production.md). It is saved as theirs
// alone: no count of the app, no rep details, no measure, no wave; the history, the report and the spreadsheet say
// "saisi à la main". No arm: the app could not see one (the core's default side is no observation). afterRefusal tells
// these from the sets ManualLog.jsx typed (25-26 September), which the app never tried to count.
export function savedSet({ result, lift, n, corrected, sides = null, manual = false, now = new Date() }) {
  if (manual) {
    return {
      exercise: lift, reps: n, repDetails: [], arm: null, confidence: null, afterRefusal: true,
      date: now.toISOString(), source: 'manual', duration: result.metadata?.duration, corrected: true,
      sides: null, machineResult: null, correctedResult: { reps: n }, repDetailsVersion: 2, wave: null,
    };
  }
  const count = result.count;
  return {
    exercise: lift, reps: n, repDetails: result.reps, arm: result.arm, confidence: result.confidence,
    date: now.toISOString(), source: 'counter-core', duration: result.metadata?.duration, corrected,
    // Measured over the app's marks: kept only when the saved count is the app's.
    sides: n === count ? sides : null,
    // What the app counted stays apart from what the visitor kept.
    machineResult: { reps: count, confidence: result.confidence ?? null },
    correctedResult: n !== count ? { reps: n } : null,
    // Rep details measured with step 3c's boundaries; older sets' details are not shown.
    repDetailsVersion: 2,
    // The measured angle over the set, compact, for the report's wave (wave.js).
    wave: compactWave(waveAngles(result), result.timestamps),
  };
}
