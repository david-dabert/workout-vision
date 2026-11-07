import { liftDefinition } from '../../lib/counting/core';

// The limb a set was counted on, named for the result and the history. Kept apart from lift-meta.js, which the choice
// of lift reads at the first paint: the lift's joint comes from the counting core, which the first paint must not load
// (Phase 5 of David's order of 6 November 2026, PLAN.md).
export function limbLabel(lift, side, fr) {
  const joint = liftDefinition(lift)?.joint || 'elbow';
  // A both-sides exercise (walking lunge, dead bug…) is counted on both limbs, and says so.
  if (side === 'both') {
    if (joint === 'knee') return { text: fr ? 'les deux jambes' : 'both legs', noun: fr ? 'jambes' : 'legs', feminine: true, plural: true };
    if (joint === 'hip') return { text: fr ? 'les deux côtés' : 'both sides', noun: fr ? 'côtés' : 'sides', feminine: false, plural: true };
    return { text: fr ? 'les deux bras' : 'both arms', noun: fr ? 'bras' : 'arms', feminine: false, plural: true };
  }
  const left = side === 'left';
  if (joint === 'knee') return { text: fr ? `jambe ${left ? 'gauche' : 'droite'}` : `${left ? 'left' : 'right'} leg`, feminine: true };
  if (joint === 'hip') return { text: fr ? `côté ${left ? 'gauche' : 'droit'}` : `${left ? 'left' : 'right'} side`, feminine: false };
  return { text: fr ? `bras ${left ? 'gauche' : 'droit'}` : `${left ? 'left' : 'right'} arm`, feminine: false };
}
