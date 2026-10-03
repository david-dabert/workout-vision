// The exercises the set collectors list (collect.html, collect-batch.html): the same as the app offers
// (src/lib/offer.js, PLAN.md, GROWTH, step 2), by their names in French and English, French name first and
// sorted in French, so that every « Rowing … » sits together (David, 29 September). A fitness test has no guide
// entry, so its names come from fitness-tests.js: the collectors dropped both tests until the third audit (C52).
import { OFFERED } from './offer';
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
export const COLLECTOR_LIFTS = OFFERED.map(key => ({ key, n: namesOf(key) })).filter(x => x.n)
  .map(({ key, n }) => ({ key, label: `${n.fr} / ${n.en}` }))
  .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
