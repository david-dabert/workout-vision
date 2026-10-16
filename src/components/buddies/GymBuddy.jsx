import { useState, useMemo, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { findCompatibleBuddies, DEMO_BUDDY_PROFILES } from '../../lib/buddies';
import { hapticLight } from '../../lib/haptics';
import { useCondensingTopbar } from '../experience/topbar';
import { Topbar, DemoTag, GroupHead, Metric } from '../experience/Showcase';
import { num } from '../experience/showcase-text';
import './GymBuddy.css';

// Gym Buddy, a demo (honesty pass of 14 October 2026, BUD-1 to BUD-3 and the missed filter item): fictional profiles
// in fictional gyms, a split that filters, the person's working weights typed by hand (saved sets carry no load, so
// "synchronisé avec l'historique" showed the code's 90 and 120 kg), and no "Proposer une séance": it sent the person
// to the home screen through a "Connexion P2P" that does not exist. Second review: no parity percentage, the gap in
// kg instead; bios in French typography; English gym names. French awaiting David's approval (R10).

const SPLIT_FILTERS = [
  { id: 'all', en: 'All splits', fr: 'Tous les programmes' },
  { id: 'ppl', en: 'Push Pull Legs (PPL)', fr: 'Push Pull Legs (PPL)' },
  { id: 'upper_lower', en: 'Upper / Lower', fr: 'Haut / Bas' },
  { id: 'powerlifting', en: 'Powerlifting', fr: 'Force athlétique' },
];

const COPY = {
  fr: {
    eyebrow: 'Partenaires d’entraînement',
    title: 'Trouvez un partenaire de salle',
    sub: 'Comparez vos charges de travail avec des profils fictifs, par type de programme.',
    banner: 'Ces profils et leurs salles sont fictifs. Aucun partenaire réel n’est inscrit, et l’appli ne met encore personne en relation.',
    loads: 'Mes charges de travail',
    byHand: 'Saisi à la main',
    bench: 'Développé couché (kg)',
    squat: 'Squat (kg)',
    typeLoads: 'Indiquez vos charges pour les comparer.',
    gap: (b, sq) => `Par rapport à vos charges\u00A0: DC ${b}, squat ${sq}`,
    fictional: 'Profil fictif',
    none: 'Aucun profil fictif pour ce programme.',
    split: 'Type de programme',
    benchShort: 'DC',
    deadliftShort: 'SdT',
  },
  en: {
    eyebrow: 'Training partners',
    title: 'Find a gym partner',
    sub: 'Compare your working weights with fictional profiles, by training split.',
    banner: 'These profiles and their gyms are fictional. No real partner has signed up, and the app does not put anyone in touch yet.',
    loads: 'My working weights',
    byHand: 'Typed by hand',
    bench: 'Bench press (kg)',
    squat: 'Squat (kg)',
    typeLoads: 'Enter your weights to compare them.',
    gap: (b, sq) => `Against your weights: bench ${b}, squat ${sq}`,
    fictional: 'Fictional profile',
    none: 'No fictional profile for this split.',
    split: 'Training split',
    benchShort: 'Bench',
    deadliftShort: 'DL',
  },
};

export default function GymBuddy({ onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const c = COPY[fr ? 'fr' : 'en'];
  const [activeSplit, setActiveSplit] = useState('all');
  const [bench, setBench] = useState('');
  const [squat, setSquat] = useState('');
  // The title condenses into the topbar as the page scrolls under it (topbar.js), as on Guide, History and Pro.
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);

  const benchKg = parseFloat(String(bench).replace(',', '.'));
  const squatKg = parseFloat(String(squat).replace(',', '.'));
  const typed = benchKg > 0 && squatKg > 0;
  const matches = useMemo(() => findCompatibleBuddies({
    split: activeSplit === 'all' ? undefined : activeSplit,
    userCompounds: typed ? { benchPressKg: benchKg, squatKg } : undefined,
  }, DEMO_BUDDY_PROFILES), [activeSplit, typed, benchKg, squatKg]);
  const splitLabel = SPLIT_FILTERS.find(f => f.id === activeSplit)?.[fr ? 'fr' : 'en'] ?? '';
  // Their working weight minus yours, in kg: arithmetic on two typed values, no score (second review of 14 October
  // 2026: "65 % de parité" came from an UNSOURCED plateau and floor, matcher.ts).
  const kgGap = (theirs, yours) => {
    const d = Math.round((theirs - yours) * 10) / 10;
    return `${d > 0 ? '+' : d < 0 ? '−' : '±'}${num(Math.abs(d), fr)}\u00A0kg`;
  };

  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen buddy-screen" data-testid="gym-buddy-screen">
        <div className="wrap">
          <Topbar fr={fr} backTestId="buddy-back-btn" onBack={() => { hapticLight(); if (onClose) onClose(); else window.location.hash = ''; }}>
            <DemoTag fr={fr} />
          </Topbar>

          <p className="eyebrow" data-reveal style={{ '--i': 0 }}>{c.eyebrow}</p>
          <h1 className="title" data-reveal style={{ '--i': 0 }}>{c.title}</h1>
          <p className="sub" data-reveal style={{ '--i': 1 }}>{c.sub}</p>

          <div className="sc-section" data-reveal style={{ '--i': 2 }}>
            <p className="sc-frame-note is-quiet" data-testid="buddy-beta-banner">{c.banner}</p>
          </div>

          {/* The person's working weights, typed by hand */}
          <section className="sc-section buddy-compounds" data-reveal style={{ '--i': 3 }}>
            <GroupHead title={c.loads}><span className="sc-tag">{c.byHand}</span></GroupHead>
            <div className="buddy-steppers">
              <label className="buddy-stepper">
                <span className="buddy-stepper-label">{c.bench}</span>
                <input className="buddy-load" type="number" inputMode="decimal" min="0" value={bench} onChange={e => setBench(e.target.value)} data-testid="buddy-bench" />
              </label>
              <label className="buddy-stepper">
                <span className="buddy-stepper-label">{c.squat}</span>
                <input className="buddy-load" type="number" inputMode="decimal" min="0" value={squat} onChange={e => setSquat(e.target.value)} data-testid="buddy-squat" />
              </label>
            </div>
            {!typed && <p className="sc-caption">{c.typeLoads}</p>}
          </section>

          <div className="sc-section" data-reveal style={{ '--i': 4 }}>
            <div className="sc-rail" role="group" aria-label={c.split}>
              {SPLIT_FILTERS.map(f => (
                <button key={f.id} type="button" className="sc-chip press" aria-pressed={activeSplit === f.id} onClick={() => { hapticLight(); setActiveSplit(f.id); }} data-testid={`filter-${f.id}`}>
                  {fr ? f.fr : f.en}
                </button>
              ))}
            </div>
          </div>

          <section className="sc-section buddy-matches" data-reveal style={{ '--i': 5 }}>
            <GroupHead title={splitLabel}><DemoTag fr={fr} /></GroupHead>
            {matches.length === 0 ? <p className="sc-caption" data-testid="buddy-none">{c.none}</p> : (
              <div className="buddy-list">
                {matches.map(({ buddy }) => (
                  <article key={buddy.id} className="sc-card buddy-card" data-testid={`buddy-card-${buddy.id}`}>
                    <div className="buddy-card-head">
                      <div className="buddy-name-block">
                        <h2 className="sc-name">{buddy.name}, {buddy.age}</h2>
                        <p className="sc-caption">{fr ? buddy.facility : buddy.facilityEn} · {buddy.city}</p>
                      </div>
                    </div>
                    <span className="sc-tag buddy-fictional">{c.fictional}</span>
                    <div className="buddy-stats">
                      <Metric label={c.benchShort} value={num(buddy.compounds.benchPressKg, fr)} unit="kg" />
                      <Metric label="Squat" value={num(buddy.compounds.squatKg, fr)} unit="kg" />
                      {buddy.compounds.deadliftKg && <Metric label={c.deadliftShort} value={num(buddy.compounds.deadliftKg, fr)} unit="kg" />}
                    </div>
                    {typed && <p className="sc-caption buddy-gap" data-testid={`buddy-gap-${buddy.id}`}>{c.gap(kgGap(buddy.compounds.benchPressKg, benchKg), kgGap(buddy.compounds.squatKg, squatKg))}</p>}
                    <p className="sc-text buddy-bio">{fr ? buddy.bioFr : buddy.bioEn}</p>
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
