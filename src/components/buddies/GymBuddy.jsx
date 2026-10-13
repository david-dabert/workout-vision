import { useState, useMemo } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  findCompatibleBuddies,
  ACTIVE_BUDDIES_POOL,
} from '../../lib/buddies';
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

  const [activeSplit, setActiveSplit] = useState('all');
  const [connectedId, setConnectedId] = useState(null);

  const matches = useMemo(() => {
    return findCompatibleBuddies(
      {
        split: activeSplit === 'all' ? undefined : activeSplit,
        userCompounds: { benchPressKg: 90, squatKg: 120 },
      },
      ACTIVE_BUDDIES_POOL
    );
  }, [activeSplit]);

  const handleConnect = (buddy) => {
    setConnectedId(buddy.id);
    setTimeout(() => setConnectedId(null), 3000);
  };

  return (
    <div className="buddy-container" data-testid="gym-buddy-screen">
      {/* Topbar */}
      <div className="buddy-topbar">
        <button
          type="button"
          className="buddy-back-btn press"
          onClick={onClose || (() => { window.location.hash = ''; })}
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

        {/* Split Filters */}
        <div className="buddy-filters">
          {SPLIT_FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              className={`buddy-filter-btn ${activeSplit === f.id ? 'active' : ''}`}
              onClick={() => setActiveSplit(f.id)}
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
                    ? (fr ? '✓ Demande de parade envoyée !' : '✓ Spotter Request Sent!')
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
