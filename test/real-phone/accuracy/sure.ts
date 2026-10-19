// Right when it says it is sure (CLAUDE.md R16, David, 18 October 2026: "the app is right whenever it says it is sure,
// says plainly when it is not, and is sure more often each month"). ROADMAP.md item 1.
// A set is shown as sure when the result screen shows its count with no question (Result.jsx: not refused, a count
// above 0, flagged by neither the body check nor the sensitivity check, on every phone since 19 October 2026); a first
// reading counts the body check alone, as the app shipped before that day, so the line shows what the second check adds.
// Measured, decides nothing.
import { SENSITIVITY_GRID, summarizeCount } from '../../../src/lib/coreAnalysis';

/** One set as the result screen would show it: err is |count - label| (null when no count is shown). */
export type SureRow = { err: number | null; flagged: boolean; moved: boolean };

/**
 * The row of a set from the app's result (coreAnalysis.js path, body check included) against its label. countOf gives
 * the number scored from a result (a public whole clip is scored inside its labelled window, sets.ts countInWindow); the
 * sensitivity check's recounts (coreAnalysis.js SENSITIVITY_GRID, as withSensitivity) are read through it too, so
 * "moved" describes the number scored.
 */
export function sureRow(result: any, lift: string, label: number, countOf: (r: any) => number = r => r.count): SureRow {
  const shown = result && !result.refused ? countOf(result) : 0;
  if (!(shown > 0)) return { err: null, flagged: false, moved: false };
  const moved = SENSITIVITY_GRID.some(tuning => {
    const r: any = summarizeCount(result.worldLandmarks, result.timestamps, lift, tuning);
    return r.refused || countOf(r) !== shown;
  });
  return { err: Math.abs(shown - label), flagged: result.bodyCheck?.flagged === true, moved };
}

const pct = (k: number, n: number) => (n ? Math.round((100 * k) / n) : 0);
function part(rows: SureRow[]) {
  const n = rows.length, exact = rows.filter(r => r.err === 0).length, near = rows.filter(r => r.err! >= 1 && r.err! <= 2).length, bad = rows.filter(r => r.err! >= 3).length;
  return `${n}: ${exact} exact (${pct(exact, n)}%), ${near} off by 1 or 2, ${bad} off by 3+`;
}

/** The line printed under each scoreboard head. */
export function sureLine(rows: SureRow[]) {
  const counted = rows.filter(r => r.err !== null);
  const sure = counted.filter(r => !r.flagged), sureSens = sure.filter(r => !r.moved);
  return `Right when sure (R16, sure.ts; measured, decides nothing): of ${rows.length} sets that decide, ${counted.length} counted. `
    + `With the body check alone (before 19 October 2026), shown as sure ${part(sure)}; asked to confirm ${part(counted.filter(r => r.flagged))}. `
    + `As the app ships, the sensitivity check asking too: shown as sure ${part(sureSens)}; asked to confirm ${part(counted.filter(r => r.flagged || r.moved))}.`;
}
