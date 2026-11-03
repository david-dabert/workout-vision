// What the lab states about a set, computed from the reps the app counted, never typed (R8). Pure, so a test reads it.
// Range and rep time are the app's own measures, shown under the experimental label (measures.js): none is validated
// on real phone video yet. Status: experimental.

/** { reps, romDeg, repSec } of the counted reps; romDeg and repSec are null when no rep carries them. */
export function labFacts(reps = []) {
  const whole = reps.filter(r => r && Number.isFinite(r.startTime) && Number.isFinite(r.endTime));
  const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const rom = mean(whole.map(r => r.romDegrees).filter(Number.isFinite));
  const sec = mean(whole.map(r => r.endTime - r.startTime).filter(x => x > 0));
  return {
    reps: whole.length,
    romDeg: rom === null ? null : Math.round(rom),
    repSec: sec === null ? null : Math.round(sec * 10) / 10,
  };
}

/** A decimal in the reader's language: "2,2" in French, "2.2" in English. */
export const decimal = (x, fr) => (fr ? String(x).replace('.', ',') : String(x));
