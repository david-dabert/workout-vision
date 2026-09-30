// The tempo of a set, in coach notation (lowering-bottom-lifting-top): one rule for the whole app, so the
// result screen, the coach report and the spreadsheet write the same tempo for the same set
// (30 September: they had differed, in precision and in how the pause between reps was averaged).
// The set's tempo in whole seconds (setTempo); a rep's tempo in the per-rep table to the tenth (repTempo).

export const decimal = (x, fr) => (fr ? x.toFixed(1).replace('.', ',') : x.toFixed(1));

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
 * The set's tempo in coach notation, lowering-bottom-lifting-top, as David approved it for the result
 * screen on 29 September (test/real-phone/growth-step3/texts.md): whole seconds, as tempo is written, a
 * phase that took place reading at least 1 (convention). The phases and the pause at the turn are
 * averaged over the whole reps; the pause between reps over the gaps that exist (a whole rep followed by
 * any rep, a cut one included), not over the reps (review, 30 September: a real rest had read 0).
 * The result screen, the report's summary and the spreadsheet all write this one; the per-rep table keeps
 * tenths (repTempo). null without a whole rep.
 */
export function setTempo(reps, first = 'concentric') {
  const all = reps || [];
  const whole = all.map((r, i) => ({ r, next: all[i + 1] })).filter(({ r }) => !r.clipped);
  if (!whole.length) return null;
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
  const conc = mean(whole.map(({ r }) => r.concentricSec)), ecc = mean(whole.map(({ r }) => r.eccentricSec));
  const turn = mean(whole.map(({ r }) => Math.max(0, r.endTime - r.startTime - r.concentricSec - r.eccentricSec)));
  const gaps = whole.filter(({ next }) => next).map(({ r, next }) => Math.max(0, next.startTime - r.endTime));
  const between = gaps.length ? mean(gaps) : 0;
  const phase = x => (x > 0 ? Math.max(1, Math.round(x)) : 0);
  const [bottom, top] = first === 'eccentric' ? [turn, between] : [between, turn];
  return [phase(ecc), Math.round(bottom), phase(conc), Math.round(top)].join('-');
}
