// The front-view left/right comparison in words (counting/symmetry.ts), for the result screen and the
// report. It states both ranges, the gap between them (relative to their mean) and how far the app's gap
// lay from the true one on synthetic sets; it draws no conclusion about the body (R8; EU MDR Rule 11: no reading meant to inform care).
// Copy for David's approval (R10). Status: experimental.
import { liftDefinition } from '../../lib/counting/core';
import { jointName } from './lift-meta';
import { GAP_ERROR_POINTS, GAP_SYNTH_SETS, REP_GAP_ERROR_POINTS, SIDES_LIFTS, SIDES_VERSION } from '../../lib/counting/symmetry';

const NB = ' ';

/** The stored form of a measured comparison, rounded; null when the set was not measured. */
export function sidesRecord(result) {
  if (!result || result.status !== 'measured') return null;
  const c = result.comparison;
  return { left: Math.round(c.left), right: Math.round(c.right), si: Math.round(c.si), reps: c.reps, v: SIDES_VERSION };
}

/** { line, note } for a stored comparison of this lift; null without one, for a lift no longer compared, or
 * for a comparison saved under the older, wider rule (no SIDES_VERSION), whose numbers the note would not cover. */
export function sidesLines(sides, fr, lift) {
  if (!sides || sides.v !== SIDES_VERSION || !SIDES_LIFTS.has(lift)) return null;
  if (!Number.isFinite(sides.left) || !Number.isFinite(sides.right) || !Number.isFinite(sides.si)) return null;
  const gap = Math.abs(Math.round(sides.si));
  const joint = liftDefinition(lift)?.joint;
  const pc = fr ? `${NB}%` : '%';
  return fr
    ? { line: `Amplitude ${jointName(joint, true)}${NB}: gauche ${sides.left}°${NB}· droite ${sides.right}°${NB}· écart ${gap}${pc}`,
        note: `Série filmée bien de face, gauche et droite de la personne filmée. Sur ${GAP_SYNTH_SETS}${NB}séries de synthèse à l’écart connu, l’écart lu s’en éloignait jusqu’à ${GAP_ERROR_POINTS}${NB}points, et jusqu’à ${REP_GAP_ERROR_POINTS} d’une répétition à l’autre.` }
    : { line: `${jointName(joint, false)[0].toUpperCase()}${jointName(joint, false).slice(1)} range: left ${sides.left}°${NB}· right ${sides.right}°${NB}· ${gap}${pc} apart`,
        note: `Set filmed square on; the filmed person’s left and right. On ${GAP_SYNTH_SETS} synthetic sets with a known gap, the gap read was up to ${GAP_ERROR_POINTS} points off, and up to ${REP_GAP_ERROR_POINTS} for a single rep.` };
}
