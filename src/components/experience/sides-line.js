// The front-view left/right comparison in words (counting/symmetry.ts), for the result screen and the
// report. It states both ranges, the gap between them (relative to their mean) and how often public video
// of lifters with no known asymmetry shows a larger gap; it draws no conclusion about the body (R8; EU MDR Rule 11: no reading meant to inform care).
// Copy for David's approval (R10). Status: experimental.
import { GAP_SI } from '../../lib/counting/symmetry';

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
        note: `Série filmée de face, gauche et droite de la personne filmée. Sur des vidéos publiques de sportifs sans asymétrie connue, environ un tiers dépassent ${GAP_SI}${pc} d’écart.` }
    : { line: `Range left ${sides.left}°${NB}· right ${sides.right}°${NB}· ${gap}${pc} apart`,
        note: `Set filmed from the front; the filmed person’s left and right. On public videos of lifters with no known asymmetry, about a third show a gap over ${GAP_SI}${pc}.` };
}
