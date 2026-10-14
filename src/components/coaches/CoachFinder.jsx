import { useState, useMemo, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  findNearestCoaches,
  VERIFIED_COACH_REGISTRY,
} from '../../lib/coaches';
import { useSets } from '../experience/sets';
import { hapticLight } from '../../lib/haptics';
import { useCondensingTopbar } from '../experience/topbar';
import { Topbar, DemoTag, GroupHead } from '../experience/Showcase';
import { num } from '../experience/showcase-text';
import './CoachFinder.css';

const CheckIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>;

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
  // The title condenses into the topbar as the page scrolls under it (topbar.js), as on Guide, History and Pro.
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);

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
      // True when one of the values above is the code's fixed stand-in, not the set's own (shown with Demo, R8).
      filled: s.reps == null || !(s.formScore || s.score || s.confidence) || !(s.symmetry || s.bioAnalysis?.symmetry || s.bilateralSymmetry),
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

  // The profiles, their rates and ratings are written in the code (src/lib/coaches): the list carries Demo. The linked
  // set's values come from the phone's last set, except where the set lacks one and the code puts a fixed value.
  const pct = (v) => `${v}${fr ? ' ' : ''}%`;
  const km = (d) => (d < 1 ? '< 1 km' : `${num(d.toFixed(1), fr)} km`);
  const filterLabel = SPECIALTY_FILTERS.find(f => f.id === activeFilter)?.[fr ? 'labelFr' : 'labelEn'] ?? '';

  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen coach-screen" data-testid="coach-finder-screen">
        <div className="wrap">
          <Topbar
            fr={fr}
            backTestId="coach-back-btn"
            onBack={() => {
              hapticLight();
              if (onClose) onClose();
              else window.location.hash = '';
            }}
          />

          <p className="eyebrow" data-reveal style={{ '--i': 0 }}>{fr ? 'Trouver un Coach & Kiné' : 'Coach & Physio Matcher'}</p>
          <h1 className="title" data-reveal style={{ '--i': 0 }}>{fr ? 'Spécialistes & Kinésithérapeutes du Sport' : 'Verified Sports Physios & Strength Coaches'}</h1>
          <p className="sub" data-reveal style={{ '--i': 1 }}>
            {fr
              ? 'Algorithme de proximité géospatiale (100 % sur l’appareil). Partagez vos scores d’asymétrie et vos amplitudes articulaires directement avec un professionnel certifié.'
              : 'Local-first proximity matching engine. Share your form scores, range of motion, and bilateral asymmetry directly with a certified practitioner.'}
          </p>

          {/* Network Onboarding Beta Banner */}
          <div className="sc-section" data-reveal style={{ '--i': 2 }}>
            <div className="sc-card" data-testid="coach-beta-banner">
              <span className="sc-tag is-on coach-beta-tag">{fr ? 'Bêta Publique • Réseau en Déploiement' : 'Public Beta • Network Onboarding'}</span>
              <p className="sc-caption">
                {fr
                  ? 'L’algorithme géospatial de matching et le partage chiffré de télémétrie sont opérationnels. Le registre des kinésithérapeutes du sport et entraîneurs certifiés est en cours d’intégration progressive.'
                  : 'Local proximity matching and encrypted telemetry sharing are active. The verified registry of sports physiotherapists and strength coaches is actively onboarding practitioners.'}
              </p>
            </div>

            {/* Real Telemetry Attachment Indicator */}
            <div className="sc-card coach-telemetry">
              {latestTelemetry ? (
                <p className="sc-caption">
                  {fr ? 'Dernière série liée : ' : 'Linked Set Telemetry: '}
                  <b>{latestTelemetry.exerciseName}</b> ({latestTelemetry.reps} reps
                  {latestTelemetry.partialReps > 0 ? ` + ${latestTelemetry.partialReps} ${fr ? 'partielles' : 'partials'}` : ''}) • {pct(latestTelemetry.formScore)} {fr ? 'forme' : 'form'} • {pct(latestTelemetry.symmetry)} {fr ? 'symétrie' : 'symmetry'}
                </p>
              ) : (
                <p className="sc-caption">
                  {fr ? 'Télémétrie prête : Enregistrez une série pour joindre vos vidéos et biomécanique en 1-clic.' : 'Telemetry Ready: Record a set to attach on-device form scores and angles.'}
                </p>
              )}
              {latestTelemetry?.filled ? <DemoTag fr={fr} /> : null}
            </div>
          </div>

          {/* Cities, then specialties: two rails */}
          <div className="sc-section coach-filters" data-reveal style={{ '--i': 3 }}>
            <div className="sc-rail" role="group" aria-label={fr ? 'Ville' : 'City'}>
              {CITIES.map(city => (
                <button
                  key={city.name}
                  type="button"
                  className="sc-chip press"
                  aria-pressed={selectedCity.name === city.name}
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
            <div className="sc-rail" role="group" aria-label={fr ? 'Spécialité' : 'Specialty'}>
              {SPECIALTY_FILTERS.map(f => (
                <button
                  key={f.id}
                  type="button"
                  className="sc-chip press"
                  aria-pressed={activeFilter === f.id}
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
          </div>

          {/* Matches List */}
          <section className="sc-section coach-matches" data-reveal style={{ '--i': 4 }}>
            <GroupHead title={`${selectedCity.name} · ${filterLabel}`}><DemoTag fr={fr} /></GroupHead>
            <div className="coach-list">
              {matches.map(({ coach, score }) => (
                <article key={coach.id} className="sc-card coach-card" data-testid={`coach-card-${coach.id}`}>
                  <div className="coach-card-head">
                    <div className="coach-name-block">
                      <h2 className="sc-name">{coach.name}</h2>
                      <p className="sc-caption">{coach.title} • {coach.organization || coach.city}</p>
                    </div>
                    <span className="sc-tag coach-distance">{km(score.distanceKm)}</span>
                  </div>

                  <div className="coach-credentials">
                    {coach.credentials.map(c => (
                      <span key={c} className="sc-tag">{c}</span>
                    ))}
                  </div>

                  <p className="sc-text coach-bio">{fr ? coach.bioFr : coach.bioEn}</p>

                  <div className="coach-card-foot">
                    <div className="coach-rate">
                      <span className="coach-rate-value">{coach.hourlyRate}<span className="sc-unit">{' '}{coach.currency} / {fr ? 'séance' : 'session'}</span></span>
                      <span className="coach-rating">
                        <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                        {num(coach.rating.toFixed(2), fr)} ({coach.reviewCount} {fr ? 'avis' : 'reviews'})
                      </span>
                    </div>
                    <div className="coach-actions">
                      <button
                        type="button"
                        className="btn-ghost is-s press"
                        onClick={() => handleShareTelemetry(coach)}
                        data-testid={`share-telemetry-${coach.id}`}
                      >
                        {copiedId === coach.id ? <><CheckIcon />{fr ? 'Lien Copié' : 'Link Copied'}</> : (fr ? 'Partager mon profil' : 'Share Telemetry Card')}
                      </button>
                      <button
                        type="button"
                        className="btn-line coach-connect press"
                        onClick={() => handleConnectCoach(coach)}
                      >
                        {fr ? 'Contacter' : 'Connect'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
