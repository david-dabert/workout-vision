import { useState, useMemo, useEffect } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  findCompatibleBuddies,
  ACTIVE_BUDDIES_POOL,
} from '../../lib/buddies';
import { useSets } from '../experience/sets';
import { hapticLight } from '../../lib/haptics';
import './GymBuddy.css';

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

  return (
    <div className="buddy-container" data-testid="gym-buddy-screen">
      {/* Topbar */}
      <div className="buddy-topbar">
        <button
          type="button"
          className="buddy-back-btn press"
          onClick={() => {
            hapticLight();
            if (onClose) onClose();
            else window.location.hash = '';
          }}
          data-testid="buddy-back-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {fr ? 'Retour' : 'Back'}
        </button>
        <div className="buddy-topbar-title">
          <span>{fr ? 'Partenaires d’Entraînement' : 'Gym Buddy Matcher'}</span>
        </div>
        <div style={{ width: '60px' }} />
      </div>

      <div className="buddy-content">
        {/* Hero */}
        <div className="buddy-hero">
          <h1>{fr ? 'Trouvez votre Partenaire de Salle' : 'Find Your Dedicated Training Partner'}</h1>
          <p>
            {fr
              ? 'Associez-vous avec des pratiquants de votre salle partageant votre créneau horaire, votre format d’entraînement et une parité de charge pour une parade sécurisée.'
              : 'Pair with lifters at your gym who share your schedule, training split, and working weight parity for reliable spotting and mutual progress.'}
          </p>
        </div>

        {/* Network Onboarding Beta Banner */}
        <div className="buddy-beta-banner" data-testid="buddy-beta-banner">
          <div className="beta-banner-tag">
            <span className="beta-dot" />
            <span>{fr ? 'Bêta Publique • Déploiement en Salle' : 'Public Beta • Gym Rollout'}</span>
          </div>
          <p>
            {fr
              ? 'Le moteur de calcul de parité des charges et de compatibilité des formats d’entraînement est opérationnel. L’adhésion des partenaires par salle (Basic-Fit, Fitness Park, etc.) est en cours de déploiement public.'
              : 'Working weight parity matching and training split compatibility are operational. Partner registration across gym facilities (Basic-Fit, Fitness Park, etc.) is rolling out in public beta.'}
          </p>
        </div>

        {/* User Compound Profile Bar */}
        <div className="buddy-user-compounds-card">
          <div className="compounds-header">
            <span>{fr ? 'Mes Charges de Travail (Calcul de Parité)' : 'My Working Weights (Parity Engine)'}</span>
            <span className="compounds-source-tag">
              {sets && sets.length > 0 ? (fr ? 'Synchronisé avec l’historique' : 'Synced with Logs') : (fr ? 'Réglage Manuel' : 'Manual Tuner')}
            </span>
          </div>
          <div className="compounds-steppers-row">
            <div className="compound-stepper">
              <span className="stepper-label">{fr ? 'Développé Couché\u00A0:' : 'Bench Press:'}</span>
              <div className="stepper-controls">
                <button type="button" className="stepper-btn" onClick={() => adjustBench(-5)}>-</button>
                <span className="stepper-val">{benchKg} kg</span>
                <button type="button" className="stepper-btn" onClick={() => adjustBench(5)}>+</button>
              </div>
            </div>

            <div className="compound-stepper">
              <span className="stepper-label">Squat\u00A0:</span>
              <div className="stepper-controls">
                <button type="button" className="stepper-btn" onClick={() => adjustSquat(-5)}>-</button>
                <span className="stepper-val">{squatKg} kg</span>
                <button type="button" className="stepper-btn" onClick={() => adjustSquat(5)}>+</button>
              </div>
            </div>
          </div>
        </div>

        {/* Split Filters */}
        <div className="buddy-filters">
          {SPLIT_FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              className={`buddy-filter-btn ${activeSplit === f.id ? 'active' : ''}`}
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

        {/* Buddy Cards Grid */}
        <div className="buddy-list">
          {matches.map(({ buddy, score }) => (
            <div key={buddy.id} className="buddy-card" data-testid={`buddy-card-${buddy.id}`}>
              <div className="buddy-header">
                <div>
                  <div className="buddy-name">{buddy.name}, {buddy.age}</div>
                  <div className="buddy-facility">{buddy.facility}</div>
                </div>
                <div className="buddy-badge">
                  {score.strengthParityPct}% {fr ? 'Parité' : 'Parity'}
                </div>
              </div>

              <div className="buddy-stats-row">
                <div>{fr ? 'DC' : 'Bench'}: <b>{buddy.compounds.benchPressKg} kg</b></div>
                <div>Squat: <b>{buddy.compounds.squatKg} kg</b></div>
                {buddy.compounds.deadliftKg && (
                  <div>{fr ? 'SdT' : 'DL'}: <b>{buddy.compounds.deadliftKg} kg</b></div>
                )}
              </div>

              <p className="buddy-bio">
                {fr ? buddy.bioFr : buddy.bioEn}
              </p>

              <div className="buddy-footer">
                <button
                  type="button"
                  className="buddy-connect-btn press"
                  onClick={() => handleConnect(buddy)}
                  data-testid={`connect-buddy-${buddy.id}`}
                >
                  {connectedId === buddy.id
                    ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '4px' }}><polyline points="20 6 9 17 4 12"/></svg>{fr ? 'Connexion P2P en cours...' : 'Connecting via P2P...'}</>
                    : (fr ? 'Proposer une séance' : 'Request Training Session')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
