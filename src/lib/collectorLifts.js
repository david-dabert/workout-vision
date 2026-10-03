// The exercises the set collectors list (collect.html, collect-batch.html): the same as the app offers
// (src/lib/offer.js, PLAN.md, GROWTH, step 2), by their names in French and English, French name first and
// sorted in French, so that every « Rowing … » sits together (David, 29 September), except the two fitness tests.
// A test set could be labelled with its 30-second protocol score or with every rep in the video, and David has not
// said which (third audit C52, and the review of its fix, 3 October): a set collected before he does could carry
// a label of either meaning (R1, R12). So the collectors leave the tests out, and say so, until he decides.
// The four floor exercises withdrawn from the app on 3 October (offer.js, WITHDRAWN, third audit C21) stay
// listed: they come back only when collected sets show a view that counts them, and the collectors are where
// those sets are filmed and labelled.
import { OFFERED, WITHDRAWN } from './offer';
import { FITNESS_TESTS, isTest } from './fitness-tests';
import catalogue from './guide-catalog.json';

const byKey = new Map(catalogue.map(e => [e.key, e]));

/** French and English names of an offered exercise, or null when neither the guide nor the tests name it. */
function namesOf(key) {
  if (isTest(key)) return { fr: FITNESS_TESTS[key].fr, en: FITNESS_TESTS[key].en };
  const e = byKey.get(key);
  return e ? { fr: e.fr, en: e.name } : null;
}

/** [{ key, label: 'French / English' }], in French alphabetical order. */
export const COLLECTOR_LIFTS = [...OFFERED, ...Object.keys(WITHDRAWN)].filter(key => !isTest(key)).map(key => ({ key, n: namesOf(key) })).filter(x => x.n)
  .map(({ key, n }) => ({ key, label: `${n.fr} / ${n.en}` }))
  .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
