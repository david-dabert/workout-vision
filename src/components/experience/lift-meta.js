import { liftDefinition } from '../../lib/counting/core';

// The lifts on the choice screen, in order, with their names in both languages and the
// names people use for them. Kept apart from the drawing code so tests can read it.
export const LIFTS = ['lateral_raise', 'bicep_curl', 'lat_pulldown', 'squat', 'bench_press', 'hip_thrust', 'romanian_deadlift', 'leg_press', 'overhead_press'];
export const META = {
  lateral_raise: { fr: 'Élévations latérales', en: 'Lateral raise', aliasFr: 'Élévation latérale · Lateral raise', aliasEn: 'Side raise · Élévations latérales' },
  bicep_curl: { fr: 'Curl biceps', en: 'Biceps curl', aliasFr: 'Curl haltère · Biceps curl', aliasEn: 'Dumbbell curl · Curl biceps' },
  lat_pulldown: { fr: 'Tirage vertical', en: 'Lat pulldown', aliasFr: 'Tirage poitrine · Lat pulldown', aliasEn: 'Pulldown · Tirage vertical' },
  squat: { fr: 'Squat', en: 'Squat', aliasFr: 'Squat barre · Back squat', aliasEn: 'Back squat · Squat barre' },
  bench_press: { fr: 'Développé couché', en: 'Bench press', aliasFr: 'DC · Bench press', aliasEn: 'Bench · Développé couché' },
  hip_thrust: { fr: 'Hip thrust', en: 'Hip thrust', aliasFr: 'Pont de hanches chargé · Hip thrust', aliasEn: 'Barbell hip thrust · Hip thrust' },
  romanian_deadlift: { fr: 'Soulevé de terre roumain', en: 'Romanian deadlift', aliasFr: 'SDT roumain · RDL', aliasEn: 'RDL · Soulevé de terre roumain' },
  leg_press: { fr: 'Presse à cuisses', en: 'Leg press', aliasFr: 'Presse · Leg press', aliasEn: 'Leg press machine · Presse à cuisses' },
  overhead_press: { fr: 'Développé militaire', en: 'Overhead press', aliasFr: 'Développé épaules · Overhead press', aliasEn: 'Shoulder press · Développé militaire' },
};

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
