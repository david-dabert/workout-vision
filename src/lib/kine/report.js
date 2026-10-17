// An attempt's report, as the patient keeps it (KinePatient.jsx): the figures of the comparison (compare.js
// compareAttempt), the exercise, who and when, small enough to keep every attempt on the phone (store.js logAttempt)
// and to print again later (pdf.js attemptPdf). Angles as the screens show them (shownAngle); no landmark, no video.
import { SAMPLE_HZ, shownAngle } from '../reference/compare';

const share = x => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
const angle = x => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);
const secs = x => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);

/** The report of a comparison result; context: { id, patient, kine, date, prog, side }. */
export function reportOf(result, { id, patient = '', kine = '', date, prog = '', side = '' }) {
  const refused = result.verdict === 'refused';
  return {
    v: 1, id, patient, kine, date, prog, side,
    verdict: result.verdict,
    reasons: [...result.reasons],
    // The share of the movement the verdict rests on: of the reference's moments, those both videos show, for the
    // measure the least shown (R8).
    judged: refused ? null : share(Math.min(...result.joints.map(j => j.shown ?? 1))),
    tempo: refused ? null : share(result.tempo),
    attSec: refused ? null : secs(result.end - result.start),
    refSec: refused ? null : secs(result.reference[0].length / SAMPLE_HZ),
    joints: result.joints.map(j => ({
      name: j.name, kind: j.kind, within: share(j.within), gap: angle(j.gapP90), range: share(j.rangeShare),
      worst: j.worst ? { atSec: secs(j.worst.atSec), ref: angle(shownAngle(j.worst.reference, j.direction)), att: angle(shownAngle(j.worst.attempt, j.direction)) } : null,
    })),
    holds: (result.holds || []).map(h => ({ ref: angle(shownAngle(h.refAngle, h.direction)), att: angle(shownAngle(h.attAngle, h.direction)), refSec: secs(h.refSec), attSec: secs(h.attSec), status: h.status })),
  };
}

/** Whether a stored value is a report this module wrote (an attempt logged before reports were kept has none). */
export const isReport = r => !!r && typeof r === 'object' && r.v === 1 && typeof r.id === 'string' && ['match', 'revise', 'refused'].includes(r.verdict) && Array.isArray(r.joints) && Array.isArray(r.holds);
