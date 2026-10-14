import { useState, useMemo, useEffect, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  findCompatibleBuddies,
  ACTIVE_BUDDIES_POOL,
} from '../../lib/buddies';
import { useSets } from '../experience/sets';
import { hapticLight } from '../../lib/haptics';
import { useCondensingTopbar } from '../experience/topbar';
import { Topbar, DemoTag, GroupHead, Metric } from '../experience/Showcase';
import './GymBuddy.css';

const CheckIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>;
const MinusIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 12h12" /></svg>;
const PlusIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg>;

const SPLIT_FILTERS = [
  { id: 'all', labelEn: 'All Splits', labelFr: 'Tous Formats' },
  { id: 'ppl', labelEn: 'Push Pull Legs (PPL)', labelFr: 'Push Pull Legs (PPL)' },
  { id: 'upper_lower', labelEn: 'Upper / Lower', labelFr: 'Haut / Bas' },
  { id: 'powerlifting', labelEn: 'Powerlifting', labelFr: 'Force Athlétique' },
];

export default function GymBuddy({ onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const sets = useSets();

  const [activeSplit, setActiveSplit] = useState('all');
  const [connectedId, setConnectedId] = useState(null);
  // The title condenses into the topbar as the page scrolls under it (topbar.js), as on Guide, History and Pro.
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);

  // Derive initial compound working weights from logged sets
  const derivedInitial = useMemo(() => {
    let bench = 90;
    let squat = 120;
    let deadlift = 140;

    if (sets && sets.length) {
      for (const s of sets) {
        const k = (s.exercise || s.exerciseKey || '').toLowerCase();
        const w = s.weight || s.weightKg || s.loadKg || 0;
        if (w > 0) {
          if ((k.includes('bench') || k.includes('chest_press')) && w > bench) bench = w;
          if (k.includes('squat') && w > squat) squat = w;
          if ((k.includes('deadlift') || k.includes('rdl')) && w > deadlift) deadlift = w;
        }
      }
    }
    return { bench, squat, deadlift };
  }, [sets]);

  const [benchKg, setBenchKg] = useState(derivedInitial.bench);
  const [squatKg, setSquatKg] = useState(derivedInitial.squat);

  useEffect(() => {
    if (derivedInitial.bench !== 90) setBenchKg(derivedInitial.bench);
    if (derivedInitial.squat !== 120) setSquatKg(derivedInitial.squat);
  }, [derivedInitial]);

  const matches = useMemo(() => {
    return findCompatibleBuddies(
      {
        split: activeSplit === 'all' ? undefined : activeSplit,
        userCompounds: { benchPressKg: benchKg, squatKg },
      },
      ACTIVE_BUDDIES_POOL
    );
  }, [activeSplit, benchKg, squatKg]);

  const handleConnect = (buddy) => {
    hapticLight();
    setConnectedId(buddy.id);
    setTimeout(() => {
      // Seamlessly navigate to encrypted P2P chat room with training partner
      window.location.hash = `#chat?peer=${buddy.id}&name=${encodeURIComponent(buddy.name)}&gym=${encodeURIComponent(buddy.facility)}`;
    }, 700);
  };

  const adjustBench = (delta) => {
    hapticLight();
    setBenchKg(b => Math.max(20, Math.min(260, b + delta)));
  };

  const adjustSquat = (delta) => {
    hapticLight();
    setSquatKg(s => Math.max(20, Math.min(320, s + delta)));
  };

  // The partners are written in the code (src/lib/buddies): the list carries Demo. The working weights say where they
  // come from (the phone's sets, or set by hand from the code's starting values).
  const pct = (v) => `${v}${fr ? ' ' : ''}%`;
  const splitLabel = SPLIT_FILTERS.find(f => f.id === activeSplit)?.[fr ? 'labelFr' : 'labelEn'] ?? '';
  const synced = sets && sets.length > 0;

  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen buddy-screen" data-testid="gym-buddy-screen">
        <div className="wrap">
          <Topbar
            fr={fr}
            backTestId="buddy-back-btn"
            onBack={() => {
              hapticLight();
              if (onClose) onClose();
              else window.location.hash = '';
            }}
          />

          <p className="eyebrow" data-reveal style={{ '--i': 0 }}>{fr ? 'Partenaires d’Entraînement' : 'Gym Buddy Matcher'}</p>
          <h1 className="title" data-reveal style={{ '--i': 0 }}>{fr ? 'Trouvez votre Partenaire de Salle' : 'Find Your Dedicated Training Partner'}</h1>
          <p className="sub" data-reveal style={{ '--i': 1 }}>
            {fr
              ? 'Associez-vous avec des pratiquants de votre salle partageant votre créneau horaire, votre format d’entraînement et une parité de charge pour une parade sécurisée.'
              : 'Pair with lifters at your gym who share your schedule, training split, and working weight parity for reliable spotting and mutual progress.'}
          </p>

          {/* Network Onboarding Beta Banner */}
          <div className="sc-section" data-reveal style={{ '--i': 2 }}>
            <div className="sc-card" data-testid="buddy-beta-banner">
              <span className="sc-tag is-on buddy-beta-tag">{fr ? 'Bêta Publique • Déploiement en Salle' : 'Public Beta • Gym Rollout'}</span>
              <p className="sc-caption">
                {fr
                  ? 'Le moteur de calcul de parité des charges et de compatibilité des formats d’entraînement est opérationnel. L’adhésion des partenaires par salle (Basic-Fit, Fitness Park, etc.) est en cours de déploiement public.'
                  : 'Working weight parity matching and training split compatibility are operational. Partner registration across gym facilities (Basic-Fit, Fitness Park, etc.) is rolling out in public beta.'}
              </p>
            </div>
          </div>

          {/* User Compound Profile */}
          <section className="sc-section buddy-compounds" data-reveal style={{ '--i': 3 }}>
            <GroupHead title={fr ? 'Mes Charges de Travail (Calcul de Parité)' : 'My Working Weights (Parity Engine)'}>
              <span className="sc-tag">{synced ? (fr ? 'Synchronisé avec l’historique' : 'Synced with Logs') : (fr ? 'Réglage Manuel' : 'Manual Tuner')}</span>
            </GroupHead>
            <div className="buddy-steppers">
              <div className="buddy-stepper">
                <span className="buddy-stepper-label">{fr ? 'Développé Couché' : 'Bench Press'}</span>
                <div className="buddy-stepper-controls">
                  <button type="button" className="icon-btn press" onClick={() => adjustBench(-5)} aria-label={fr ? 'Développé Couché −5 kg' : 'Bench Press −5 kg'}><MinusIcon /></button>
                  <span className="buddy-stepper-val">{benchKg}<span className="sc-unit">{' '}kg</span></span>
                  <button type="button" className="icon-btn press" onClick={() => adjustBench(5)} aria-label={fr ? 'Développé Couché +5 kg' : 'Bench Press +5 kg'}><PlusIcon /></button>
                </div>
              </div>
              <div className="buddy-stepper">
                <span className="buddy-stepper-label">Squat</span>
                <div className="buddy-stepper-controls">
                  <button type="button" className="icon-btn press" onClick={() => adjustSquat(-5)} aria-label={fr ? 'Squat −5 kg' : 'Squat −5 kg'}><MinusIcon /></button>
                  <span className="buddy-stepper-val">{squatKg}<span className="sc-unit">{' '}kg</span></span>
                  <button type="button" className="icon-btn press" onClick={() => adjustSquat(5)} aria-label={fr ? 'Squat +5 kg' : 'Squat +5 kg'}><PlusIcon /></button>
                </div>
              </div>
            </div>
          </section>

          {/* Split Filters */}
          <div className="sc-section" data-reveal style={{ '--i': 4 }}>
            <div className="sc-rail" role="group" aria-label={fr ? 'Format d’entraînement' : 'Training split'}>
              {SPLIT_FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  className="sc-chip press"
                  aria-pressed={activeSplit === f.id}
                  onClick={() => {
                    hapticLight();
                    setActiveSplit(f.id);
                  }}
                  data-testid={`filter-${f.id}`}
                >
                  {fr ? f.labelFr : f.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Buddy Cards */}
          <section className="sc-section buddy-matches" data-reveal style={{ '--i': 5 }}>
            <GroupHead title={splitLabel}><DemoTag fr={fr} /></GroupHead>
            <div className="buddy-list">
              {matches.map(({ buddy, score }) => (
                <article key={buddy.id} className="sc-card buddy-card" data-testid={`buddy-card-${buddy.id}`}>
                  <div className="buddy-card-head">
                    <div className="buddy-name-block">
                      <h2 className="sc-name">{buddy.name}, {buddy.age}</h2>
                      <p className="sc-caption">{buddy.facility}</p>
                    </div>
                    <span className="sc-tag is-on buddy-parity">{pct(score.strengthParityPct)} {fr ? 'Parité' : 'Parity'}</span>
                  </div>
                  <div className="buddy-stats">
                    <Metric label={fr ? 'DC' : 'Bench'} value={buddy.compounds.benchPressKg} unit="kg" />
                    <Metric label="Squat" value={buddy.compounds.squatKg} unit="kg" />
                    {buddy.compounds.deadliftKg && (
                      <Metric label={fr ? 'SdT' : 'DL'} value={buddy.compounds.deadliftKg} unit="kg" />
                    )}
                  </div>
                  <p className="sc-text buddy-bio">{fr ? buddy.bioFr : buddy.bioEn}</p>
                  <button
                    type="button"
                    className="btn-line buddy-connect press"
                    onClick={() => handleConnect(buddy)}
                    data-testid={`connect-buddy-${buddy.id}`}
                  >
                    {connectedId === buddy.id
                      ? <><CheckIcon />{fr ? 'Connexion P2P en cours...' : 'Connecting via P2P...'}</>
                      : (fr ? 'Proposer une séance' : 'Request Training Session')}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
