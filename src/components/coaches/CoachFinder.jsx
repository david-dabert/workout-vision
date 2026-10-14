import { useState, useMemo, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { DEMO_CITIES, demoProfilesFor } from '../../lib/coaches';
import { hapticLight } from '../../lib/haptics';
import { useCondensingTopbar } from '../experience/topbar';
import { Topbar, DemoTag, GroupHead } from '../experience/Showcase';
import SendToCoach from './SendToCoach';
import './CoachFinder.css';

// Trouver un coach (honesty pass of 14 October 2026, FND-1 to FND-4 and the missed filter item): a demo of the
// directory to come, with fictional placeholders only (src/lib/coaches/matcher.ts), the city chosen by the person, a
// specialty that filters, and the one way that works today to send a set to a coach (SendToCoach). No "verified", no
// geolocation, no encryption, no network roll-out is claimed: none exists. French awaiting David's approval (R10).

const SPECIALTIES = [
  { id: 'all', fr: 'Toutes', en: 'All' },
  { id: 'rehab', fr: 'Kinésithérapie', en: 'Physiotherapy' },
  { id: 'hypertrophy', fr: 'Musculation', en: 'Bodybuilding' },
  { id: 'strength', fr: 'Force', en: 'Strength' },
];

const COPY = {
  fr: {
    eyebrow: 'Trouver un coach',
    title: 'Coachs et kinés',
    sub: 'L’annuaire est en préparation. Les profils ci-dessous sont fictifs, pour montrer à quoi il ressemblera.',
    plan: 'Plus tard, les coachs s’inscriront eux-mêmes et leur carte professionnelle sera vérifiée. Aucun n’est inscrit pour l’instant.',
    city: 'Ville',
    specialty: 'Spécialité',
    fictional: 'Profil fictif',
    none: 'Aucun profil fictif pour ce choix.',
  },
  en: {
    eyebrow: 'Find a coach',
    title: 'Coaches and physios',
    sub: 'The directory is being prepared. The profiles below are fictional, to show what it will look like.',
    plan: 'Later, coaches will sign up themselves and their professional card will be checked. None has signed up yet.',
    city: 'City',
    specialty: 'Specialty',
    fictional: 'Fictional profile',
    none: 'No fictional profile for this choice.',
  },
};

export default function CoachFinder({ onClose, onHistory }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const c = COPY[fr ? 'fr' : 'en'];
  const [city, setCity] = useState(DEMO_CITIES[0].name);
  const [specialty, setSpecialty] = useState('all');
  // The title condenses into the topbar as the page scrolls under it (topbar.js), as on Guide, History and Pro.
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);
  const profiles = useMemo(() => demoProfilesFor(city, specialty), [city, specialty]);
  const specialtyLabel = SPECIALTIES.find(s => s.id === specialty)?.[fr ? 'fr' : 'en'] ?? '';
  const initials = (name) => name.split(' ').map(w => w[0]).filter(ch => /[A-Z]/.test(ch)).slice(0, 2).join('');

  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen coach-screen" data-testid="coach-finder-screen">
        <div className="wrap">
          <Topbar fr={fr} backTestId="coach-back-btn" onBack={() => { hapticLight(); if (onClose) onClose(); else window.location.hash = ''; }}>
            <DemoTag fr={fr} />
          </Topbar>

          <p className="eyebrow" data-reveal style={{ '--i': 0 }}>{c.eyebrow}</p>
          <h1 className="title" data-reveal style={{ '--i': 0 }}>{c.title}</h1>
          <p className="sub" data-reveal style={{ '--i': 1 }}>{c.sub}</p>

          <div className="sc-section" data-reveal style={{ '--i': 2 }}>
            <p className="sc-frame-note is-quiet" data-testid="coach-plan">{c.plan}</p>
            <SendToCoach onHistory={onHistory} />
          </div>

          <div className="sc-section coach-filters" data-reveal style={{ '--i': 3 }}>
            <div className="sc-rail" role="group" aria-label={c.city}>
              {DEMO_CITIES.map(x => (
                <button key={x.name} type="button" className="sc-chip press" aria-pressed={city === x.name} onClick={() => { hapticLight(); setCity(x.name); }} data-testid={`city-${x.name.toLowerCase()}`}>
                  {x.name}
                </button>
              ))}
            </div>
            <div className="sc-rail" role="group" aria-label={c.specialty}>
              {SPECIALTIES.map(s => (
                <button key={s.id} type="button" className="sc-chip press" aria-pressed={specialty === s.id} onClick={() => { hapticLight(); setSpecialty(s.id); }} data-testid={`filter-${s.id}`}>
                  {fr ? s.fr : s.en}
                </button>
              ))}
            </div>
          </div>

          <section className="sc-section coach-matches" data-reveal style={{ '--i': 4 }}>
            <GroupHead title={`${city} · ${specialtyLabel}`}><DemoTag fr={fr} /></GroupHead>
            {profiles.length === 0 ? <p className="sc-caption" data-testid="coach-none">{c.none}</p> : (
              <div className="coach-list">
                {profiles.map(p => (
                  <article key={p.id} className="sc-card coach-card" data-testid={`coach-card-${p.id}`}>
                    <div className="coach-card-head">
                      <span className="coach-avatar" aria-hidden="true">{initials(fr ? p.name : p.nameEn)}</span>
                      <div className="coach-name-block">
                        <h2 className="sc-name">{fr ? p.name : p.nameEn}</h2>
                        <p className="sc-caption">{fr ? p.roleFr : p.roleEn} · {p.city}</p>
                      </div>
                      <span className="sc-tag coach-fictional">{c.fictional}</span>
                    </div>
                    <div className="coach-credentials">
                      {p.specialties.map(s => <span key={s} className="sc-tag">{SPECIALTIES.find(x => x.id === s)?.[fr ? 'fr' : 'en']}</span>)}
                    </div>
                    <p className="sc-text coach-bio">{fr ? p.bioFr : p.bioEn}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
