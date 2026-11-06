import { useT } from '../../lib/LanguageContext';
import './TrainHome.css';

/**
 * TrainHome: The truthful, focused first-minute home screen for the "Train" destination.
 * Directly answers the 4 first-minute visitor questions:
 * 1. What does the app do today? (Count and review a filmed set on phone)
 * 2. What can I try right now? (Analyze a set OR 1-tap sample analysis)
 * 3. What happens to my video? (Stays on device, zero servers)
 * 4. What is the evidence? (Pilot version, 7 calibrated lifts, link to evidence)
 *
 * Adheres strictly to:
 * - Rule R10 (French typography, non-breaking space before : ; ? !)
 * - Design tokens (zero raw color literals, uses CSS variables)
 */
export default function TrainHome({
  onStartAnalysis,
  onSampleDemo,
  onSelectLift,
  onOpenEvidence,
  onOpenAllExercises,
}) {
  const { lang } = useT(), fr = lang === 'fr';

  const PILOT_LIFTS = [
    { key: 'squat', nameFr: 'Squat', nameEn: 'Squat', icon: '🦵', jointFr: 'Genou', jointEn: 'Knee' },
    { key: 'bicep_curl', nameFr: 'Curl biceps', nameEn: 'Bicep Curl', icon: '💪', jointFr: 'Coude', jointEn: 'Elbow' },
    { key: 'lateral_raise', nameFr: 'Élévations latérales', nameEn: 'Lateral Raise', icon: '🦅', jointFr: 'Épaule', jointEn: 'Shoulder' },
    { key: 'lat_pulldown', nameFr: 'Tirage vertical', nameEn: 'Lat Pulldown', icon: '🏋️', jointFr: 'Coude', jointEn: 'Elbow' },
    { key: 'hip_thrust', nameFr: 'Hip Thrust', nameEn: 'Hip Thrust', icon: '🍑', jointFr: 'Hanche', jointEn: 'Hip' },
    { key: 'romanian_deadlift', nameFr: 'Soulevé de terre roumain', nameEn: 'Romanian Deadlift', icon: '⚡', jointFr: 'Hanche', jointEn: 'Hip' },
    { key: 'leg_press', nameFr: 'Presse à cuisses', nameEn: 'Leg Press', icon: '🎯', jointFr: 'Genou', jointEn: 'Knee' },
  ];

  return (
    <div className="wv-train-home" data-testid="train-home">
      {/* 1. Truthful Hero */}
      <header className="wv-train-hero">
        <div className="wv-train-badge-row">
          <span className="wv-train-pill">
            {fr ? 'Version Pilote' : 'Pilot Version'}
          </span>
          <span className="wv-train-privacy-badge">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {fr ? '100\u00A0% sur l’appareil' : '100% On-Device'}
          </span>
        </div>

        <h1 className="wv-train-headline">
          {fr
            ? 'Comptez et analysez vos séries directement sur votre téléphone.'
            : 'Count and review a filmed set on your phone.'}
        </h1>

        <p className="wv-train-sub">
          {fr
            ? 'Zéro capteur. Zéro serveur. Votre vidéo et vos mouvements restent strictement sur votre appareil.'
            : 'Zero sensors. Zero servers. Your video and movement data stay on your phone during rep counting.'}
        </p>
      </header>

      {/* 2. Primary Action Buttons */}
      <div className="wv-train-actions" role="group" aria-label={fr ? 'Actions principales' : 'Primary actions'}>
        <button
          type="button"
          className="wv-train-btn is-primary tactile"
          data-testid="train-start-btn"
          onClick={() => {
            navigator.vibrate?.(10);
            onStartAnalysis?.();
          }}
        >
          <span className="wv-train-btn-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </span>
          <span className="wv-train-btn-content">
            <strong className="wv-train-btn-title">
              {fr ? 'Analyser une série' : 'Analyze a set'}
            </strong>
            <small className="wv-train-btn-sub">
              {fr ? 'Caméra en direct ou sélection vidéo' : 'Live camera or video file'}
            </small>
          </span>
          <svg className="wv-train-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>

        <button
          type="button"
          className="wv-train-btn is-demo tactile"
          data-testid="train-demo-btn"
          onClick={() => {
            navigator.vibrate?.(10);
            onSampleDemo?.();
          }}
        >
          <span className="wv-train-btn-icon is-amber" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </span>
          <span className="wv-train-btn-content">
            <strong className="wv-train-btn-title">
              {fr ? 'Tester une analyse type (30\u00A0s)' : 'Try a sample analysis (30s)'}
            </strong>
            <small className="wv-train-btn-sub">
              {fr ? 'Démonstration instantanée sans caméra' : 'Instant meeting demo without camera'}
            </small>
          </span>
        </button>
      </div>

      {/* 3. Evidence & Limits Callout */}
      <div className="wv-train-evidence-bar">
        <span className="wv-train-evidence-text">
          {fr
            ? 'Version Pilote\u00A0: 7 mouvements calibrés sur séries réelles.'
            : 'Pilot version: 7 movements calibrated on real sets.'}
        </span>
        <button
          type="button"
          className="wv-train-evidence-link tactile"
          onClick={onOpenEvidence}
        >
          {fr ? 'Preuves et limites\u00A0>' : 'Evidence & limits >'}
        </button>
      </div>

      {/* 4. Pilot Lifts Fast Grid */}
      <section className="wv-train-lifts" aria-label={fr ? 'Mouvements en Version Pilote' : 'Pilot movements'}>
        <div className="wv-train-lifts-header">
          <h2 className="wv-train-lifts-title">
            {fr ? 'Mouvements Pilotes' : 'Pilot Exercises'}
          </h2>
          <button
            type="button"
            className="wv-train-all-btn tactile"
            onClick={onOpenAllExercises}
          >
            {fr ? 'Tous les mouvements (183)' : 'All exercises (183)'}
          </button>
        </div>

        <div className="wv-train-grid">
          {PILOT_LIFTS.map((lift) => (
            <button
              key={lift.key}
              type="button"
              className="wv-train-card tactile"
              data-testid={`pilot-lift-${lift.key}`}
              onClick={() => {
                navigator.vibrate?.(10);
                onSelectLift?.(lift.key);
              }}
            >
              <div className="wv-train-card-top">
                <span className="wv-train-card-ico" aria-hidden="true">{lift.icon}</span>
                <span className="wv-train-card-joint">
                  {fr ? lift.jointFr : lift.jointEn}
                </span>
              </div>
              <strong className="wv-train-card-name">
                {fr ? lift.nameFr : lift.nameEn}
              </strong>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
