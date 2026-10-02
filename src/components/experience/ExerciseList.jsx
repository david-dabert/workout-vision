import { useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { OFFERED, tierOf } from '../../lib/offer';
import { isTest } from '../../lib/fitness-tests';
import { tierTag } from '../../lib/liftTiers';
import { guideExercise } from './exercise-info';
import { EQUIPMENT, norm } from './Guide';

// Every exercise the app counts, 181 in all, searchable, under the nine cards (PLAN.md, GROWTH,
// step 2, David's choices of 29 September). Only the Beta ones carry a tag; one line under the title
// says the rest are experimental, so the names take the row's width. A tap opens its filming screen. Loaded after the choice, so the catalogue stays out of the first screen.
// The fitness tests have their own rows above (Choice.jsx); drawn from another exercise's guide entry, they
// would list that exercise twice here.
const ENTRIES = OFFERED.filter(k => !isTest(k)).map(guideExercise).filter(Boolean);
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

export default function ExerciseList({ onChoose }) {
  const { lang } = useT(), fr = lang === 'fr';
  const [query, setQuery] = useState('');
  const q = norm(query.trim());
  const name = e => (fr ? e.fr : e.name);
  const list = ENTRIES
    .filter(e => !q || norm([e.fr, e.name, ...e.aliases, e.equipment, EQUIPMENT[e.equipment], ...e.muscles, ...e.muscles.map(m => MUSCLE_FR[m] || '')].join(' ')).includes(q))
    .sort((a, b) => name(a).localeCompare(name(b), fr ? 'fr' : 'en'));
  return <section className="all-exercises" aria-labelledby="all-exercises-title">
    <h2 id="all-exercises-title" className="all-title">{fr ? 'Tous les exercices comptés' : 'Every exercise we count'}</h2>
    <p className="all-note">{fr ? 'Sauf mention Bêta, ces exercices sont expérimentaux\u00A0: nous apprenons encore à les compter.' : 'Unless marked Beta, these exercises are experimental: we are still learning to count them.'}</p>
    <div className="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg><label className="sr" htmlFor="all-search">{fr ? 'Rechercher un exercice' : 'Search exercises'}</label>
      <input id="all-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={fr ? 'Nom, muscle, matériel…' : 'Name, muscle, equipment…'} /></div>
    <p className="list-head" role="status">{list.length} / {ENTRIES.length} {fr ? 'exercices' : 'exercises'}</p>
    <ul className="list">{list.map(e => <li key={e.key} className="item" data-exercise={e.key}>
      <button className="item-btn press" onClick={() => onChoose(e.key)}>
        <span className="thumb"><img src={e.frames[0]} loading="lazy" width="56" height="56" alt="" /></span>
        <span><span className="item-name">{name(e)}</span><span className="item-sub">{fr ? e.name : e.fr} · {keep(fr ? EQUIPMENT[e.equipment] : e.equipment)}</span></span>
        {tierOf(e.key) === 'beta' && <span className="tag tier-tag tier-beta">{tierTag('beta', fr)}</span>}
      </button>
    </li>)}</ul>
    {!list.length && <p className="empty">{fr ? 'Aucun exercice trouvé.' : 'No exercises found.'}</p>}
    <p className="guide-credit">Illustrations: Everkinetic, via <a href="https://github.com/bryllim/workout-guide" target="_blank" rel="noreferrer">bryllim/workout-guide</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>. {fr ? 'Redimensionnées et converties en WebP.' : 'Resized and converted to WebP.'}</p>
  </section>;
}
