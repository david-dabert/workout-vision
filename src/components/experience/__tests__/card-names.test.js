/**
 * Every name a lift's card prints (its French and English names and each alias, lift-meta.js) finds that lift
 * in the guide's search (Guide.jsx), so a name the app teaches is a name the app understands (review of
 * 2 October: the card said "Latérales" and the search for it missed the lateral raise). The card does not
 * repeat its own title in its alias line.
 */
import { describe, expect, it } from 'vitest';
import { LIFTS, META } from '../lift-meta';
import { getAllGuideExercises } from '../../../lib/exerciseGuide';

import { norm } from '../search-text';

const CATALOGUE = getAllGuideExercises();
// The search's text for an exercise, as Guide.jsx builds it, names only (zones and equipment cannot name a lift).
const found = name => CATALOGUE.filter(e => norm([e.fr, e.name, ...e.aliases].join(' ')).includes(norm(name))).map(e => e.key);

describe('the names on the cards', () => {
  for (const lift of LIFTS) {
    const m = META[lift];
    const names = [m.fr, m.en, ...m.aliasFr.split(' · '), ...m.aliasEn.split(' · ')];
    for (const name of names) it(`${lift}: "${name}" finds it in the guide`, () => expect(found(name)).toContain(lift));
    for (const [lang, title, alias] of [['French', m.fr, m.aliasFr], ['English', m.en, m.aliasEn]]) {
      it(`${lift}: the ${lang} alias line does not repeat the card's title`, () => {
        const t = norm(title), singular = t.replace(/s(?=\b)/g, '');
        for (const a of alias.split(' · ').map(norm)) expect([t, singular]).not.toContain(a);
      });
    }
  }
});
