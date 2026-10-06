// The tempo of a set, in coach notation (lowering-bottom-lifting-top): one rule for the whole app, so the
// result screen, the coach report and the spreadsheet write the same tempo for the same set
// (30 September: they had differed, in precision and in how the pause between reps was averaged).
// The set's tempo in whole seconds (setTempo); a rep's tempo in the per-rep table to the tenth (repTempo).

export const decimal = (x, fr) => (fr ? x.toFixed(1).replace('.', ',') : x.toFixed(1));

// A partial rep (David, 2 October 2026: a machine chest press report printed a tempo of 0.1-6-0.1-1 and 343°/s):
// a rep the video holds whole, but whose range is under half the set's median, or one of whose moving phases is
// under 0.2 s. It stays counted, with its range; its tempo and speeds are not shown and it leaves the set's tempo
// and time under tension. Status: experimental, UNSOURCED thresholds (a rep shorter than 0.5 s is already
// implausible, core.ts MIN_REP_SEC; a half-range rep is not the movement the set is made of).
export const PARTIAL_RANGE_RATIO = 0.5;
export const MIN_PHASE_SEC = 0.2;
export function partialIn(reps) {
  const whole = (reps || []).filter(r => !r.clipped);
  const sorted = whole.map(r => r.romDegrees).sort((a, b) => a - b), m = sorted.length >> 1;
  const median = sorted.length >= 3 ? (sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2) : null;
  return r => !r.clipped && ((median !== null && r.romDegrees < PARTIAL_RANGE_RATIO * median)
    || !(r.concentricSec >= MIN_PHASE_SEC) || !(r.eccentricSec >= MIN_PHASE_SEC));
}
/**
 * A set's average range, over the reps the video holds whole (a partial rep's range is measured), and its average
 * duration, over the timed reps only (audit FINDING-025): null where there is no rep to average.
 */
export function setAverages(reps) {
  const held = (reps || []).filter(r => !r.clipped), timed = timedReps(reps);
  const mean = (xs, f) => (xs.length ? xs.reduce((a, r) => a + f(r), 0) / xs.length : null);
  return { rom: mean(held, r => r.romDegrees), dur: mean(timed, r => r.endTime - r.startTime) };
}

/** The reps whose times are shown: held whole by the video and not partial. */
export const timedReps = reps => { const partial = partialIn(reps); return (reps || []).filter(r => !r.clipped && !partial(r)); };

/**
 * Per-rep tempo: lowering, bottom pause, lifting, top pause.
 * Lowering = eccentric phase; lifting = concentric phase.
 * The two pauses depend on which phase comes first:
 *   eccentric first → bottom pause = working pause, top pause = rest gap
 *   concentric first → top pause = working pause, bottom pause = rest gap
 * Working pause = total rep time minus both phases.
 * Rest gap = time from this rep's end to the next rep's start (0 for the last rep).
 */
export function repTempo(r, nextStart, first) {
  const total = r.endTime - r.startTime;
  const workPause = Math.max(0, total - r.concentricSec - r.eccentricSec);
  const restGap = nextStart != null ? Math.max(0, nextStart - r.endTime) : 0;
  if (first === 'eccentric') {
    return { lowering: r.eccentricSec, bottom: workPause, lifting: r.concentricSec, top: restGap };
  }
  return { lowering: r.eccentricSec, bottom: restGap, lifting: r.concentricSec, top: workPause };
}

/**
 * The set's tempo as four averages in seconds, lowering-bottom-lifting-top, before any rounding: the one
 * source of the set tempo, for the result screen, the report's tile and summary and the spreadsheet
 * (audit of 6 October: the report's tile averaged each rep's row, so the last rep's rest gap, which does not
 * exist, read 0 and pulled the pause between reps down, the 30 September bug back). The phases and the pause
 * at the turn are averaged over the whole reps; the pause between reps over the gaps that exist (a whole rep
 * followed by any rep, a cut one included), not over the reps (review, 30 September: a real rest had read 0).
 * null without a whole rep. Status: experimental (measures.js), averaging rule by convention.
 */
export function setTempoParts(reps, first = 'concentric') {
  const all = reps || [];
  const partial = partialIn(all);
  const whole = all.map((r, i) => ({ r, next: all[i + 1] })).filter(({ r }) => !r.clipped && !partial(r));
  if (!whole.length) return null;
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
  const conc = mean(whole.map(({ r }) => r.concentricSec)), ecc = mean(whole.map(({ r }) => r.eccentricSec));
  const turn = mean(whole.map(({ r }) => Math.max(0, r.endTime - r.startTime - r.concentricSec - r.eccentricSec)));
  const gaps = whole.filter(({ next }) => next).map(({ r, next }) => Math.max(0, next.startTime - r.endTime));
  const between = gaps.length ? mean(gaps) : 0;
  const [bottom, top] = first === 'eccentric' ? [turn, between] : [between, turn];
  return { lowering: ecc, bottom, lifting: conc, top };
}

/**
 * The set's tempo in coach notation, lowering-bottom-lifting-top, as David approved it for the result
 * screen on 29 September (test/real-phone/growth-step3/texts.md): whole seconds, as tempo is written, a
 * phase that took place reading at least 1 (convention), from setTempoParts. The result screen, the report's
 * tile and summary and the spreadsheet all write this one, in this one precision; the per-rep table keeps
 * tenths (repTempo). null without a whole rep.
 */
export function setTempo(reps, first = 'concentric') {
  const t = setTempoParts(reps, first);
  if (!t) return null;
  const phase = x => (x > 0 ? Math.max(1, Math.round(x)) : 0);
  return [phase(t.lowering), Math.round(t.bottom), phase(t.lifting), Math.round(t.top)].join('-');
}
