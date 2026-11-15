// Per-lift camera placement and framing (card 041), shown on the filming screen and in the guide.
// The framing comes from the joint of the lift the exercise counts as; the angle from the exercise's own view where the
// guide or a card knows one, else from that lift's view (filmView answers 'side' for any key it does not know).
// Source: test/real-phone/synth/synth.txt, rendered bodies filmed at 0 and 90 degrees for lateral_raise, overhead_press,
// bicep_curl and squat. Status: experimental (R9). Rendered bodies validate nothing (measures.js), so the screens give
// the advice and no figure (card 042, 15 November 2026, R8).
import { liftDefinition } from '../../lib/counting/core';
import families from '../../lib/counting/guide-families.json';
import { FITNESS_TESTS } from '../../lib/fitness-tests';
import { filmView } from './exercise-info';
import { hasFigure } from './lift-scenes';

// The keys filmView knows a view for: a fitness test, a card lift with its figure, a family of the guide.
const knowsView = k => Boolean(FITNESS_TESTS[k] || hasFigure(k) || families[k]);

/**
 * Returns camera placement and framing for an exercise.
 * @param {string} key the exercise shown (a card lift, a guide key, or a catalogue id of the « Changer » drawer)
 * @param {boolean} fr
 * @param {string} [countingKey] the lift it counts as (the catalogue's counting_key), the key itself by default
 * @returns {{ view: 'front'|'side', angleLabel: string, framingLabel: string }}
 */
export function filmingGuideFor(key, fr = true, countingKey = key) {
  const view = filmView(knowsView(key) ? key : countingKey);
  const wholeBody = ['knee', 'hip'].includes(liftDefinition(countingKey)?.joint);

  const angleLabel = view === 'front'
    ? (fr ? 'De face (0°)' : 'Front (0°)')
    : (fr ? 'De profil (90°)' : 'Side (90°)');

  const framingLabel = wholeBody
    ? (fr ? 'corps entier, pieds compris' : 'whole body, feet included')
    : view === 'side'
    ? (fr ? 'bras qui travaille face à l’objectif, tête aux hanches' : 'working arm facing the lens, head to hips')
    : (fr ? 'tête aux hanches, deux bras visibles' : 'head to hips, both arms in frame');

  return { view, angleLabel, framingLabel };
}
