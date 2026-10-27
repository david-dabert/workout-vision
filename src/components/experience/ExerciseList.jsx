import { useState, useMemo } from 'react';
import { useT } from '../../lib/LanguageContext';
import { OFFERED, tierOf } from '../../lib/offer';
import { isTest } from '../../lib/fitness-tests';
import { tierTag } from '../../lib/liftTiers';
import { guideExercise } from './exercise-info';
import { EQUIPMENT, Thumb } from './Guide';
import { searchMatch, searchWords } from './search-text';
import { getMappedKeys } from '../../lib/exerciseGuide';
import { knownExercise, programmable } from './programme';

// Every exercise the app counts (OFFERED but the fitness tests: 183 on 8 October 2026 with the prone Y raise; 182 on 5 October 2026 with the machine seated back extension; 181 on 3 October 2026, 183 less the four floor
// exercises withdrawn that day, offer.js WITHDRAWN, and with the behind-the-neck press and wall ball added that day (the barbell jump squat not yet counted); pinned by __tests__/exercise-list.test.js and
// e2e/shared/exercises.tests.js), searchable, under the nine cards (PLAN.md, GROWTH,
// step 2, David's choices of 29 September). Only the Beta ones carry a tag, pinned at the top (3 October); one line under the title
// says the rest are experimental, so the names take the row's width. A tap opens its filming screen. Loaded after the choice, so the catalogue stays out of the first screen.
// The fitness tests have their own rows above (Choice.jsx); drawn from another exercise's guide entry, they
// would list that exercise twice here.
const ENTRIES = OFFERED.filter(k => !isTest(k)).map(guideExercise).filter(Boolean);
// Every exercise of the guide, for the coach's exercise sheet (Pro.jsx, 14 October 2026): 309 on that day, those the
// app does not count marked, done by the client without filming (programme.js, filmable).
const ALL = getMappedKeys().filter(knownExercise).map(guideExercise).filter(Boolean);
// The equipment's name never breaks, so no word of it stands alone on the row's last line.
const keep = s => (s || '').replace(/ /g, '\u00A0');
// The catalogue names muscles in English; the French names people search for, so that the hint
// "Nom, muscle, matériel" holds in French too (review of 29 September).
const MUSCLE_FR = {
  Core: 'abdominaux abdos gainage', Glutes: 'fessiers', Shoulders: 'épaules deltoïdes', Hamstrings: 'ischios ischio-jambiers',
  Triceps: 'triceps', Quads: 'quadriceps cuisses', Biceps: 'biceps', Chest: 'pectoraux pecs', Back: 'dos', Lats: 'dorsaux grand dorsal',
  Forearms: 'avant-bras', 'Upper Back': 'haut du dos trapèzes', 'Rear Delts': 'deltoïdes postérieurs arrière d’épaule',
  'Lower Back': 'lombaires bas du dos', Calves: 'mollets', 'Posterior Chain': 'chaîne postérieure', Grip: 'prise poigne',
  Adductors: 'adducteurs', Legs: 'jambes',
};

const REALM_FILTERS = [
  { id: 'all', labelFr: 'Tous', labelEn: 'All' },
  { id: 'chest_arms', labelFr: 'Pecs & Bras', labelEn: 'Chest & Arms', muscles: ['Chest', 'Biceps', 'Triceps', 'Forearms'] },
  { id: 'back_shoulders', labelFr: 'Dos & Épaules', labelEn: 'Back & Shoulders', muscles: ['Back', 'Lats', 'Upper Back', 'Rear Delts', 'Shoulders'] },
  { id: 'legs', labelFr: 'Cuisses & Fessiers', labelEn: 'Legs & Glutes', muscles: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Legs', 'Posterior Chain'] },
  { id: 'core', labelFr: 'Tronc & Abdos', labelEn: 'Core & Abs', muscles: ['Core', 'Lower Back'] },
  { id: 'beta', labelFr: 'Bêta (Vérifiés)', labelEn: 'Beta (Verified)', onlyBeta: true },
];

// Each exercise's words for the search (search-text.js), cut once: its names, equipment and muscles in both languages.
const WORDS = new Map([...ENTRIES, ...ALL].map(e => [e.key, searchWords([e.fr, e.name, ...e.aliases, e.equipment, EQUIPMENT[e.equipment], ...e.muscles, ...e.muscles.map(m => MUSCLE_FR[m] || '')].join(' '))]));

// The list's honesty line: unless marked Beta, what the app counts is experimental (R8). The coach's picker keeps it
// (review of 14 October 2026: the picker had lost it with the exercise sheet), said of the counted exercises only,
// since it lists the guide's others too; copy.note follows it there. EXPERIMENTAL_ALL: French awaiting David's
// approval (R10).
const EXPERIMENTAL = {
  fr: 'Sauf mention Bêta, ces exercices sont expérimentaux\u00A0: nous apprenons encore à les compter.',
  en: 'Unless marked Beta, these exercises are experimental: we are still learning to count them.',
};
const EXPERIMENTAL_ALL = {
  fr: 'Sauf mention Bêta, les exercices comptés sont expérimentaux\u00A0: nous apprenons encore à les compter.',
  en: 'Unless marked Beta, the exercises we count are experimental: we are still learning to count them.',
};

/**
 * all: every exercise of the guide (the coach's picker, Pro.jsx), each the app does not count tagged copy.tag, under
 * copy.title, the honesty line (EXPERIMENTAL_ALL) and copy.note; otherwise the exercises the app counts (the choice's
 * list, Choice.jsx), under the honesty line.
 */
export default function ExerciseList({ onChoose, all = false, copy = null }) {
  const { lang } = useT(), fr = lang === 'fr';
  const [query, setQuery] = useState('');
  const [realm, setRealm] = useState('all');
  const name = e => (fr ? e.fr : e.name);
  const entries = all ? ALL : ENTRIES;

  const filteredEntries = useMemo(() => {
    if (realm === 'all' || query.trim()) return entries;
    const filter = REALM_FILTERS.find(f => f.id === realm);
    if (!filter) return entries;
    if (filter.onlyBeta) return entries.filter(e => tierOf(e.key) === 'beta');
    return entries.filter(e => e.muscles?.some(m => filter.muscles?.includes(m)));
  }, [entries, realm, query]);

  const list = filteredEntries
    .filter(e => searchMatch(WORDS.get(e.key), query))
    // The Beta exercises are pinned on top, with their tag and no heading (David, 3 October); each group alphabetical.
    .sort((a, b) => (tierOf(b.key) === 'beta') - (tierOf(a.key) === 'beta') || name(a).localeCompare(name(b), fr ? 'fr' : 'en'));

  return (
    <section className="all-exercises" aria-labelledby="all-exercises-title">
      <div className="all-header-block">
        <span className="all-kicker">{fr ? 'Répertoire biomécanique' : 'Biomechanical repertoire'}</span>
        <h2 id="all-exercises-title" className="all-title">{all && copy ? copy.title : fr ? 'Tous les exercices comptés' : 'Every exercise we count'}</h2>
        <p className="all-note">{(all ? EXPERIMENTAL_ALL : EXPERIMENTAL)[fr ? 'fr' : 'en']}{all && copy?.note ? ` ${copy.note}` : ''}</p>
      </div>

      <div className="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <label className="sr" htmlFor="all-search">{fr ? 'Rechercher un exercice' : 'Search exercises'}</label>
        <input id="all-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={fr ? 'Nom, muscle, matériel…' : 'Name, muscle, equipment…'} />
      </div>

      <div className="all-realms-bar" role="tablist" aria-label={fr ? 'Filtrer par groupe musculaire' : 'Filter by muscle group'}>
        {REALM_FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={realm === f.id}
            className={`all-realm-chip${realm === f.id ? ' is-active' : ''}`}
            onClick={() => setRealm(f.id)}
          >
            {fr ? f.labelFr : f.labelEn}
          </button>
        ))}
      </div>

      <div className="all-count-row">
        <p className="list-head" role="status">{list.length} / {entries.length} {fr ? 'exercices' : 'exercises'}</p>
      </div>

      <ul className="list">{list.map(e => <li key={e.key} className="item" data-exercise={e.key}>
        <button className="item-btn press" onClick={() => onChoose(e.key)}>
          <Thumb exercise={e} />
          <span className="item-text-wrap">
            <span className="item-name">{name(e)}</span>
            <span className="item-sub">
              <span className="item-sub-name">{fr ? e.name : e.fr}</span>
              <span className="item-sub-dot" aria-hidden="true"> · </span>
              <span className="item-sub-eq">{keep(fr ? EQUIPMENT[e.equipment] : e.equipment)}</span>
              {e.muscles?.[0] && (
                <>
                  <span className="item-sub-dot" aria-hidden="true"> · </span>
                  <span className="item-sub-muscle">{fr ? (MUSCLE_FR[e.muscles[0]]?.split(' ')[0] || e.muscles[0]) : e.muscles[0]}</span>
                </>
              )}
            </span>
          </span>
          {tierOf(e.key) === 'beta' && (
            <span className="tag tier-tag tier-beta">{tierTag('beta', fr)}</span>
          )}
          {all && !programmable(e.key) && <span className="tag">{copy?.tag}</span>}
        </button>
      </li>)}</ul>
      {!list.length && <p className="empty">{fr ? 'Aucun exercice trouvé.' : 'No exercises found.'}</p>}
      <p className="guide-credit">{fr ? 'Illustrations\u00A0:' : 'Illustrations:'} Everkinetic, via <a href="https://github.com/bryllim/workout-guide" target="_blank" rel="noreferrer">bryllim/workout-guide</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>. {fr ? 'Redimensionnées et converties en WebP.' : 'Resized and converted to WebP.'}</p>
    </section>
  );
}
