import { liftDefinition } from '../../lib/counting/core';

// The limb whose joint counts the lift (core.ts): arm for elbow and shoulder lifts,
// leg for knee lifts, side for hip lifts. `side` is 'left' or 'right'.
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
