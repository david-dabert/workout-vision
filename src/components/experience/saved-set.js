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
// proposal: PSC's count offered on the refused set's screen (Result.jsx, 8 October 2026), kept beside the person's
// count as { reps, by: 'psc' } so the history can tell a confirmed proposal from a typed count; never a count of the
// core (machineResult stays null).
// planned: the coach's target when the set was filmed from a programme (programme.js, plannedOf); the programme's
// screen reads it to show the set beside its target, and the report prints it ("Prévu : 3 × 10"). Absent otherwise.
export function savedSet({ result, lift, n, corrected, sides = null, manual = false, now = new Date(), planned = null, proposal = null }) {
  const withPlan = set => (planned ? { ...set, planned } : set);
  if (manual) {
    return withPlan({
      exercise: lift, reps: n, repDetails: [], arm: null, confidence: null, afterRefusal: true,
      date: now.toISOString(), source: 'manual', duration: result.metadata?.duration, corrected: true,
      sides: null, machineResult: null, correctedResult: { reps: n }, repDetailsVersion: 2, wave: null,
      ...(proposal ? { proposal: { reps: proposal, by: 'psc' } } : {}),
    });
  }
  const count = result.count;
  return withPlan({
    exercise: lift, reps: n, repDetails: result.reps, arm: result.arm, confidence: result.confidence,
    date: now.toISOString(), source: 'counter-core', duration: result.metadata?.duration, corrected,
    // Measured over the app's marks: kept only when the saved count is the app's.
    sides: n === count ? sides : null,
    // What the app counted stays apart from what the visitor kept.
    machineResult: { reps: count, confidence: result.confidence ?? null },
    // Where the body went unseen (counting/doubt.js), numbers only: stored, read by no screen yet.
    doubt: result.doubt ?? null,
    correctedResult: n !== count ? { reps: n } : null,
    // Rep details measured with step 3c's boundaries; older sets' details are not shown.
    repDetailsVersion: 2,
    // The measured angle over the set, compact, for the report's wave (wave.js).
    wave: compactWave(waveAngles(result), result.timestamps),
  });
}
