// Per-lift camera placement and framing (card 041), shown on the filming screen and in the guide, and read by
// Result.jsx when saving a #collecte set (card 045).
// The framing comes from the joint of the lift the exercise counts as. The angle comes from exerciseView:
// fitness tests, card lifts and guide keys keep their own filmView; any catalogue variant unknown directly resolves via
// its counting_key so Film and Result agree on one view (card 045). Kept free of exercises.json so Guide stays lean.
// Source: test/real-phone/synth/synth.txt, rendered bodies filmed at 0 and 90 degrees for lateral_raise, overhead_press,
// bicep_curl and squat. Status: experimental (R9). Rendered bodies validate nothing (measures.js), so the screens give
// the advice and no figure (card 042, 15 November 2026, R8).
import { liftDefinition } from '../../lib/counting/core';
import { FITNESS_TESTS } from '../../lib/fitness-tests';
import families from '../../lib/counting/guide-families.json';
import { filmView } from './exercise-info';
import { hasFigure } from './lift-scenes';

const ownView = k => (
  Object.hasOwn(FITNESS_TESTS, k) ? filmView(k)
  : hasFigure(k) ? filmView(k)
  : Object.hasOwn(families, k) ? filmView(k)
  : null
);

/**
 * Shared view resolver for both Film and Result (#collecte): fitness tests, card lifts and guide keys keep their
 * own view; unknown catalogue variants inherit the view of countingKey (passed by Film/Result from getExercise).
 * Guards against prototype keys ('constructor', etc.) on both key and countingKey.
 * @param {string} key
 * @param {string|null} [countingKey]
 * @returns {'front'|'side'}
 */
export function exerciseView(key, countingKey = null) {
  if (typeof key !== 'string' || !key) return 'side';
  const direct = ownView(key);
  if (direct) return direct;
  if (typeof countingKey === 'string' && countingKey && countingKey !== key) {
    return ownView(countingKey) ?? 'side';
  }
  return 'side';
}

/**
 * Returns camera placement and framing for an exercise.
 * @param {string} key the exercise shown (a card lift, a guide key, or a catalogue id of the « Changer » drawer)
 * @param {boolean} fr
 * @param {string|null} [countingKey] the lift it counts as (the catalogue's counting_key), the key itself by default
 * @returns {{ view: 'front'|'side', angleLabel: string, framingLabel: string }}
 */
export function filmingGuideFor(key, fr = true, countingKey = key) {
  const view = exerciseView(key, countingKey);
  const wholeBody = ['knee', 'hip'].includes(liftDefinition(countingKey || key)?.joint);

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
