// An exercise's name, filming view and guide drawings, for the nine card lifts and for every other
// countable exercise of the guide (PLAN.md, GROWTH, step 2). Read by the screens that load after
// the choice, so the catalogue stays out of the first screen's code.
import catalogue from '../../lib/guide-catalog.json';
import families from '../../lib/counting/guide-families.json';
import { getGuideExercise } from '../../lib/exerciseGuide';
import { META } from './lift-meta';
import { hasFigure, liftView } from './lift-scenes';
import { FITNESS_TESTS } from '../../lib/fitness-tests';

const byKey = new Map(catalogue.map(e => [e.key, e]));

/** The name people know the exercise by: the card's, else the guide's, in the screen's language. */
export function exerciseName(key, lang) {
  // Own keys only: a restored set named "constructor" is not the object's own constructor (audit of 3 October).
  if (Object.hasOwn(META, key)) return META[key][lang === 'fr' ? 'fr' : 'en'];
  if (Object.hasOwn(FITNESS_TESTS, key)) return FITNESS_TESTS[key][lang === 'fr' ? 'fr' : 'en'];
  const e = byKey.get(key);
  return e ? (lang === 'fr' ? e.fr : e.name) : key;
}

/** 'side' or 'front': the card's reference set, else the guide's view of the exercise. */
export const filmView = key => (FITNESS_TESTS[key] ? FITNESS_TESTS[key].view : hasFigure(key) ? liftView(key) : families[key]?.view === 'front' ? 'front' : 'side');

/** The guide's entry with its three drawings, or null. */
// A fitness test is drawn with its movement's drawings (fitness-tests.js).
export const guideExercise = key => getGuideExercise(FITNESS_TESTS[key]?.illustration ?? key);
