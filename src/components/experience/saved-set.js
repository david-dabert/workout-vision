import { compactWave, waveAngles } from './wave';

/**
 * The set as the result screen saves it (storage.saveWorkout): what the app counted stays apart from what the
 * person kept. n: the count kept; corrected: true when the person typed it. A set the app counted no rep in
 * (Result.jsx, unsure) is saved with the person's count, its machineResult 0 and its correctedResult theirs,
 * so the history, the report, the spreadsheet and the contributions say the app counted none (R8).
 */
export function savedSet({ result, lift, n, corrected, sides = null, now = new Date() }) {
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
