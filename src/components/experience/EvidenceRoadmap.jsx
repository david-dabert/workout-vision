import { useT } from '../../lib/LanguageContext';
import './EvidenceRoadmap.css';

/**
 * EvidenceRoadmap: The transparent, dated validation evidence and technical roadmap.
 * Replaces vague marketing promises with exact, dated benchmarks and explicit limits.
 *
 * Adheres strictly to:
 * - Rule R10 (French typography, non-breaking space before : ; ? !)
 * - Design tokens (zero raw color literals, uses CSS variables)
 */
export default function EvidenceRoadmap({ onBack }) {
  const { lang } = useT(), fr = lang === 'fr';

  return (
    <div className="wv-evidence-view" data-testid="evidence-roadmap">
      {/* Header */}
      <header className="wv-evidence-header">
        <button
          type="button"
          className="wv-evidence-back tactile"
          onClick={onBack}
          aria-label={fr ? 'Retour' : 'Back'}
        >
          ← {fr ? 'Retour' : 'Back'}
        </button>

        <div className="wv-evidence-date-tag">
          {fr ? 'Mesure certifiée au 6 novembre 2026' : 'Certified baseline as of 6 November 2026'}
        </div>

        <h1 className="wv-evidence-title">
          {fr ? 'Preuves et feuille de route' : 'Evidence & Roadmap'}
        </h1>

        <p className="wv-evidence-intro">
          {fr
            ? 'Workout Vision applique une discipline stricte\u00A0: nous distinguons ce qui est calibré et mesuré aujourd’hui de ce qui relève de la recherche.'
            : 'Workout Vision maintains strict scientific discipline: we separate what is calibrated and measured today from ongoing research.'}
        </p>
      </header>

      {/* 1. DISPONIBLE (Version Pilote) */}
      <section className="wv-evidence-card is-pilot">
        <div className="wv-evidence-card-header">
          <span className="wv-evidence-pill is-green">
            {fr ? '1. Disponible (Version Pilote)' : '1. Available (Pilot Version)'}
          </span>
          <span className="wv-evidence-metric-badge">7 {fr ? 'mouvements' : 'lifts'}</span>
        </div>

        <h2 className="wv-evidence-card-title">
          {fr
            ? 'Squat, Curl biceps, Élévations latérales, Tirage vertical, Hip Thrust, RDL, Presse'
            : 'Squat, Bicep Curl, Lateral Raise, Lat Pulldown, Hip Thrust, RDL, Leg Press'}
        </h2>

        <div className="wv-evidence-stats-grid">
          <div className="wv-evidence-stat">
            <strong className="wv-evidence-stat-value">13 / 15</strong>
            <span className="wv-evidence-stat-label">
              {fr ? 'Séries internes exactes (86,7\u00A0%)' : 'Exact internal sets (86.7%)'}
            </span>
          </div>

          <div className="wv-evidence-stat">
            <strong className="wv-evidence-stat-value">13 / 16</strong>
            <span className="wv-evidence-stat-label">
              {fr ? 'Vidéos réelles exactes (81,3\u00A0%)' : 'Exact real videos (81.3%)'}
            </span>
          </div>

          <div className="wv-evidence-stat">
            <strong className="wv-evidence-stat-value">0</strong>
            <span className="wv-evidence-stat-label">
              {fr ? 'Erreur catastrophique (≥3 reps)' : 'Catastrophic error (≥3 reps)'}
            </span>
          </div>
        </div>

        <p className="wv-evidence-note">
          {fr
            ? 'Données de développement filmées sur smartphone en salle. Les mouvements sont accompagnés d’un écran de vérification humaine systématique.'
            : 'Internal development sets filmed on smartphones in gym settings. All sets include systematic human review.'}
        </p>
      </section>

      {/* 2. EXPÉRIMENTAL (En Recherche) */}
      <section className="wv-evidence-card is-experimental">
        <div className="wv-evidence-card-header">
          <span className="wv-evidence-pill is-amber">
            {fr ? '2. Expérimental (En recherche)' : '2. Experimental (Under research)'}
          </span>
          <span className="wv-evidence-metric-badge">2 {fr ? 'mouvements' : 'lifts'}</span>
        </div>

        <h2 className="wv-evidence-card-title">
          {fr
            ? 'Développé couché et Développé militaire'
            : 'Bench Press & Overhead Press'}
        </h2>

        <p className="wv-evidence-text">
          {fr
            ? 'Ces mouvements de poussée reposent au verrouillage haut. Défis techniques en cours\u00A0: masquage de la trajectoire par les montants du rack et occultation des avant-bras sous certains angles.'
            : 'These pressing movements rest at high lockout. Active research challenges: bar occlusion by rack uprights and forearm crossover from oblique angles.'}
        </p>

        <p className="wv-evidence-note">
          {fr
            ? 'Statut\u00A0: Mesuré en régression interne, non validé pour le déploiement général.'
            : 'Status: Measured in internal regressions, not validated for general release.'}
        </p>
      </section>

      {/* 3. FEUILLE DE ROUTE (À Venir) */}
      <section className="wv-evidence-card is-roadmap">
        <div className="wv-evidence-card-header">
          <span className="wv-evidence-pill is-blue">
            {fr ? '3. Feuille de route (Engagements R&D)' : '3. Roadmap (R&D Commitments)'}
          </span>
        </div>

        <h2 className="wv-evidence-card-title">
          {fr ? 'Objectifs techniques prioritaires' : 'Priority Technical Milestones'}
        </h2>

        <ul className="wv-evidence-list">
          <li>
            <strong>{fr ? 'Examens de libération formels (PLAN.md Règle 14)\u00A0:' : 'Formal Release Exams (PLAN.md Rule 14):'}</strong>{' '}
            {fr
              ? 'Chaque mouvement doit réussir 4 séries d’examen filmées à l’aveugle avec 100\u00A0% de comptes exacts avant toute mention de validation définitive.'
              : 'Each lift must pass 4 blind exam sets with 100% exact counts before any final validation claim.'}
          </li>
          <li>
            <strong>{fr ? 'Accélération WebGPU WGSL\u00A0:' : 'WebGPU WGSL Acceleration:'}</strong>{' '}
            {fr
              ? 'Filtrage temporel des 33 points anatomiques directement sur le GPU mobile pour éliminer la charge CPU.'
              : 'Temporal smoothing of 33 landmarks executed on mobile GPU compute shaders to eliminate CPU throttling.'}
          </li>
          <li>
            <strong>{fr ? 'Détection automatique de début de série\u00A0:' : 'Automated Set Start Detection:'}</strong>{' '}
            {fr
              ? 'Segmentation intelligente ignorant les réglages et l’installation préalable sous la barre.'
              : 'Intelligent boundary detection ignoring setup rituals and rack walkouts.'}
          </li>
        </ul>
      </section>

      {/* Bottom Action */}
      <div className="wv-evidence-footer">
        <button
          type="button"
          className="wv-evidence-btn tactile"
          onClick={onBack}
        >
          {fr ? 'Retour à l’entraînement' : 'Back to training'}
        </button>
      </div>
    </div>
  );
}
