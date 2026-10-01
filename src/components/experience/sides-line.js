// The front-view left/right comparison in words (counting/symmetry.ts), for the result screen and the
// report. It states both ranges, the gap between them and how large a gap measurement alone gives on
// public video; it draws no conclusion about the body (R8; EU MDR Rule 11: no reading meant to inform care).
// Copy for David's approval (R10). Status: experimental.
import { NOISE_SI } from '../../lib/counting/symmetry';

const NB = ' ';

/** The stored form of a measured comparison, rounded; null when the set was not measured. */
export function sidesRecord(result) {
  if (!result || result.status !== 'measured') return null;
  const c = result.comparison;
  return { left: Math.round(c.left), right: Math.round(c.right), si: Math.round(c.si), reps: c.reps };
}

/** { line, note } for a stored comparison; null without one. */
export function sidesLines(sides, fr) {
  if (!sides || !Number.isFinite(sides.left) || !Number.isFinite(sides.right) || !Number.isFinite(sides.si)) return null;
  const gap = Math.abs(Math.round(sides.si));
  const pc = fr ? `${NB}%` : '%';
  return fr
    ? { line: `Amplitude gauche ${sides.left}°${NB}· droite ${sides.right}°${NB}· écart ${gap}${pc}`,
        note: `Mesuré de face. Sur des vidéos publiques, la mesure seule donne souvent des écarts jusqu’à ${NOISE_SI}${pc}.` }
    : { line: `Range left ${sides.left}°${NB}· right ${sides.right}°${NB}· ${gap}${pc} apart`,
        note: `Measured from the front. On public videos, measurement alone often gives gaps up to ${NOISE_SI}${pc}.` };
}
