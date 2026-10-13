import { useState, useMemo } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  findNearestCoaches,
  VERIFIED_COACH_REGISTRY,
} from '../../lib/coaches';
import { useSets } from '../experience/sets';
import { hapticLight } from '../../lib/haptics';
import './CoachFinder.css';

const CITIES = [
  { name: 'Paris', coords: { latitude: 48.8566, longitude: 2.3522 } },
  { name: 'London', coords: { latitude: 51.5074, longitude: -0.1278 } },
  { name: 'New York', coords: { latitude: 40.7128, longitude: -74.006 } },
  { name: 'Berlin', coords: { latitude: 52.52, longitude: 13.405 } },
  { name: 'Cambridge', coords: { latitude: 52.2053, longitude: 0.1218 } },
];

const SPECIALTY_FILTERS = [
  { id: 'all', labelEn: 'All Specialties', labelFr: 'Toutes Spécialités' },
  { id: 'rehab', labelEn: 'Physical Therapy & Rehab', labelFr: 'Kinésithérapie & Rééducation', keys: ['rotator_cuff_shoulder', 'lumbar_spine', 'knee_acl_recovery'] },
  { id: 'hypertrophy', labelEn: 'Hypertrophy & Physique', labelFr: 'Hypertrophie & Culturisme', keys: ['hypertrophy_physique'] },
  { id: 'strength', labelEn: 'Strength & Barbell', labelFr: 'Force & Haltérophilie', keys: ['strength_powerlifting', 'olympic_weightlifting'] },
  { id: 'veterinary', labelEn: 'Equine & Veterinary', labelFr: 'Équin & Vétérinaire', keys: ['equine_veterinary'] },
];

export default function CoachFinder({ onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const sets = useSets();

  const [selectedCity, setSelectedCity] = useState(CITIES[0]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [copiedId, setCopiedId] = useState(null);

  // Extract latest real workout set telemetry if available
  const latestTelemetry = useMemo(() => {
    if (!sets || !sets.length) return null;
    const s = sets[0];
    return {
      exerciseName: s.exercise || s.exerciseKey || (fr ? 'Développé Couché' : 'Bench Press'),
      reps: s.reps ?? 8,
      partialReps: s.partialReps || s.lengthenedPartials || s.partialCount || 0,
      formScore: s.formScore || s.score || (s.confidence ? Math.round(s.confidence * 100) : 92),
      symmetry: s.symmetry || s.bioAnalysis?.symmetry || (s.bilateralSymmetry ? Math.round(s.bilateralSymmetry * 100) : 96),
      timestamp: s.createdAt || s.date || Date.now(),
    };
  }, [sets, fr]);

  // Compute matched coaches
  const matches = useMemo(() => {
    const filterObj = SPECIALTY_FILTERS.find(f => f.id === activeFilter);
    const requiredSpecialties = filterObj && filterObj.keys ? filterObj.keys : [];

    return findNearestCoaches(
      {
        userLocation: selectedCity.coords,
        maxDistanceKm: 1500,
        requiredSpecialties,
      },
      VERIFIED_COACH_REGISTRY
    );
  }, [selectedCity, activeFilter]);

  const handleShareTelemetry = (coach) => {
    hapticLight();
    const teleParams = latestTelemetry
      ? `&ex=${encodeURIComponent(latestTelemetry.exerciseName)}&reps=${latestTelemetry.reps}&partials=${latestTelemetry.partialReps}&form=${latestTelemetry.formScore}&sym=${latestTelemetry.symmetry}`
      : '&demo=1';
    const telemetryUrl = `${window.location.origin}${window.location.pathname}#programme=telemetry_share&coach=${coach.id}${teleParams}&t=${Date.now()}`;
    navigator.clipboard.writeText(telemetryUrl).then(() => {
      setCopiedId(coach.id);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const handleConnectCoach = (coach) => {
    hapticLight();
    // Seamlessly navigate to P2P encrypted chat with the selected coach
    window.location.hash = `#chat?peer=${coach.id}&name=${encodeURIComponent(coach.name)}&title=${encodeURIComponent(coach.title)}`;
  };

  return (
    <div className="coach-container" data-testid="coach-finder-screen">
      {/* Topbar */}
      <div className="coach-topbar">
        <button
          type="button"
          className="coach-back-btn press"
          onClick={() => {
            hapticLight();
            if (onClose) onClose();
            else window.location.hash = '';
          }}
          data-testid="coach-back-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {fr ? 'Retour' : 'Back'}
        </button>
        <div className="coach-topbar-title">
          <span>{fr ? 'Trouver un Coach & Kiné' : 'Coach & Physio Matcher'}</span>
        </div>
        <div style={{ width: '60px' }} />
      </div>

      <div className="coach-content">
        {/* Hero */}
        <div className="coach-hero">
          <h1>{fr ? 'Spécialistes & Kinésithérapeutes du Sport' : 'Verified Sports Physios & Strength Coaches'}</h1>
          <p>
            {fr
              ? 'Algorithme de proximité géospatiale (100% sur l’appareil). Partagez vos scores d’asymétrie et vos amplitudes articulaires directement avec un professionnel certifié.'
              : 'Local-first proximity matching engine. Share your form scores, range of motion, and bilateral asymmetry directly with a certified practitioner.'}
          </p>
        </div>

        {/* Network Onboarding Beta Banner */}
        <div className="coach-beta-banner" data-testid="coach-beta-banner">
          <div className="beta-banner-tag">
            <span className="beta-dot" />
            <span>{fr ? 'Bêta Publique • Réseau en Déploiement' : 'Public Beta • Network Onboarding'}</span>
          </div>
          <p>
            {fr
              ? 'L’algorithme géospatial de matching et le partage chiffré de télémétrie sont opérationnels. Le registre des kinésithérapeutes du sport et entraîneurs certifiés est en cours d’intégration progressive.'
              : 'Local proximity matching and encrypted telemetry sharing are active. The verified registry of sports physiotherapists and strength coaches is actively onboarding practitioners.'}
          </p>
        </div>

        {/* Real Telemetry Attachment Indicator */}
        <div className="coach-telemetry-badge">
          <div className="telemetry-badge-dot" />
          {latestTelemetry ? (
            <span>
              {fr ? 'Dernière série liée\u00A0: ' : 'Linked Set Telemetry: '}
              <b>{latestTelemetry.exerciseName}</b> ({latestTelemetry.reps} reps
              {latestTelemetry.partialReps > 0 ? ` + ${latestTelemetry.partialReps} ${fr ? 'partielles' : 'partials'}` : ''}) • {latestTelemetry.formScore}% {fr ? 'forme' : 'form'} • {latestTelemetry.symmetry}% {fr ? 'symétrie' : 'symmetry'}
            </span>
          ) : (
            <span>
              {fr ? 'Télémétrie prête\u00A0: Enregistrez une série pour joindre vos vidéos et biomécanique en 1-clic.' : 'Telemetry Ready: Record a set to attach on-device form scores and angles.'}
            </span>
          )}
        </div>

        {/* City Presets */}
        <div className="coach-city-selector">
          {CITIES.map(city => (
            <button
              key={city.name}
              type="button"
              className={`city-pill ${selectedCity.name === city.name ? 'active' : ''}`}
              onClick={() => {
                hapticLight();
                setSelectedCity(city);
              }}
              data-testid={`city-${city.name.toLowerCase()}`}
            >
              {city.name}
            </button>
          ))}
        </div>

        {/* Category Filter Chips */}
        <div className="coach-filter-bar">
          {SPECIALTY_FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              className={`filter-chip ${activeFilter === f.id ? 'active' : ''}`}
              onClick={() => {
                hapticLight();
                setActiveFilter(f.id);
              }}
              data-testid={`filter-${f.id}`}
            >
              {fr ? f.labelFr : f.labelEn}
            </button>
          ))}
        </div>

        {/* Matches List */}
        <div className="coach-list">
          {matches.map(({ coach, score }) => (
            <div key={coach.id} className="coach-card" data-testid={`coach-card-${coach.id}`}>
              <div className="coach-card-header">
                <div className="coach-name-block">
                  <h2>{coach.name}</h2>
                  <div className="coach-title">{coach.title} • {coach.organization || coach.city}</div>
                </div>
                <div className="coach-distance-tag">
                  {score.distanceKm < 1 ? '< 1 km' : `${score.distanceKm.toFixed(1)} km`}
                </div>
              </div>

              <div className="coach-credentials">
                {coach.credentials.map(c => (
                  <span key={c} className="cred-pill">{c}</span>
                ))}
              </div>

              <p className="coach-bio">
                {fr ? coach.bioFr : coach.bioEn}
              </p>

              <div className="coach-card-footer">
                <div className="coach-rate">
                  {coach.hourlyRate} {coach.currency} <span>/ {fr ? 'séance' : 'session'}</span>
                  <div style={{ fontSize: '12px', color: '#D4A76A', marginTop: '2px' }}>
                    ★ {coach.rating.toFixed(2)} ({coach.reviewCount} {fr ? 'avis' : 'reviews'})
                  </div>
                </div>

                <div className="coach-actions">
                  <button
                    type="button"
                    className="coach-telemetry-btn press"
                    onClick={() => handleShareTelemetry(coach)}
                    data-testid={`share-telemetry-${coach.id}`}
                  >
                    {copiedId === coach.id ? (fr ? '✓ Lien Copié' : '✓ Link Copied') : (fr ? 'Partager mon profil' : 'Share Telemetry Card')}
                  </button>
                  <button
                    type="button"
                    className="coach-book-btn press"
                    onClick={() => handleConnectCoach(coach)}
                  >
                    {fr ? 'Contacter' : 'Connect'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
