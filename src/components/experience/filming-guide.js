// Per-lift camera placement and framing guide grounded in test/real-phone/synth/synth.txt (R8/R9/R10).
// Multi-angle synthetic measurements exist for four reference lifts (lateral_raise, overhead_press,
// bicep_curl, squat); every other exercise inherits its filmView ('front' or 'side') and states clearly
// that multi-angle synthetic measurements were not run on that lift.
import { liftDefinition } from '../../lib/counting/core';
import { filmView } from './exercise-info';

const NB = '\u00A0';

const SYNTH_NOTES = {
  lateral_raise: {
    fr: `Synthèse (0°)${NB}: 6/6 exactes de face (-4° d’amplitude) et symétrie gauche/droite mesurée uniquement de face.`,
    en: 'Synthetic check (0°): 6/6 exact from the front (-4° range), and left/right symmetry is only measured straight-on.',
  },
  overhead_press: {
    fr: `Synthèse (0°)${NB}: 6/6 exactes de face contre des séries manquées ou faussées de profil (90°).`,
    en: 'Synthetic check (0°): 6/6 exact from the front, whereas side 90° views drop or miscount reps.',
  },
  bicep_curl: {
    fr: `Synthèse (90°)${NB}: 4/6 exactes de profil, ce qui évite l’écrasement d’amplitude vu de face (-48° à -104°).`,
    en: 'Synthetic check (90°): 4/6 exact from the side, avoiding the -48° to -104° range flattening seen straight-on.',
  },
  squat: {
    fr: `Synthèse (90°)${NB}: 4/6 exactes de profil (-15° d’écart d’amplitude contre -50° à -77° de face).`,
    en: 'Synthetic check (90°): 4/6 exact from the side (-15° range error vs -50° to -77° from the front).',
  },
};

/**
 * Returns camera placement, framing, and synthetic-benchmark provenance for a lift key.
 * @param {string} key
 * @param {boolean} fr
 * @returns {{ view: 'front'|'side', angleLabel: string, framingLabel: string, evidenceNote: string, synthMeasured: boolean }}
 */
export function filmingGuideFor(key, fr = true) {
  const def = liftDefinition(key);
  const countingKey = def?.key || key;
  const view = filmView(key) || filmView(countingKey) || 'side';
  const wholeBody = ['knee', 'hip'].includes(def?.joint);

  const angleLabel = view === 'front'
    ? (fr ? 'De face (0°)' : 'Front (0°)')
    : (fr ? 'De profil (90°)' : 'Side (90°)');

  const framingLabel = wholeBody
    ? (fr ? 'corps entier, pieds compris' : 'whole body, feet included')
    : view === 'side'
    ? (fr ? 'bras qui travaille face à l’objectif, tête aux hanches' : 'working arm facing the lens, head to hips')
    : (fr ? 'tête aux hanches, deux bras visibles' : 'head to hips, both arms in frame');

  const synth = SYNTH_NOTES[countingKey];
  const synthMeasured = Boolean(synth);
  const evidenceNote = synth
    ? synth[fr ? 'fr' : 'en']
    : (fr
      ? 'Placement dérivé du plan du mouvement (aucune mesure multi-angle synthétique sur cet exercice).'
      : 'Placement derived from movement plane (no multi-angle synthetic measurement for this exercise yet).');

  return { view, angleLabel, framingLabel, evidenceNote, synthMeasured };
}
