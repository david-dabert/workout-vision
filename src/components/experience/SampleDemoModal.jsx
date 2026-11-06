import { useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import './SampleDemoModal.css';

/**
 * SampleDemoModal: 1-tap instant Meeting Demo mode.
 * Allows tech enthusiasts, executives, and investors to inspect the full
 * analysis workflow, transparency, and human review loop without needing a
 * camera, gym weights, or video upload.
 *
 * Grounded in David's verified 7-rep gym squat set (squat_7_side_21fd7ccf).
 *
 * Adheres strictly to:
 * - Rule R10 (French typography, non-breaking space before : ; ? !)
 * - Design tokens (zero raw color literals, uses CSS variables)
 */
export default function SampleDemoModal({ onClose, onTryWithCamera }) {
  const { lang } = useT(), fr = lang === 'fr';
  const [count, setCount] = useState(7);
  const [corrected, setCorrected] = useState(false);

  const handleAdjust = (delta) => {
    navigator.vibrate?.(10);
    setCount((prev) => Math.max(1, prev + delta));
    setCorrected(true);
  };

  return (
    <div className="wv-demo-overlay" role="dialog" aria-modal="true" data-testid="sample-demo-modal">
      <div className="wv-demo-card">
        {/* Header */}
        <div className="wv-demo-header">
          <div className="wv-demo-badge-row">
            <span className="wv-demo-badge is-pilot">
              {fr ? 'Exemple type certifié' : 'Calibrated Sample Set'}
            </span>
            <span className="wv-demo-badge is-local">
              {fr ? 'Exécuté sur le téléphone' : 'Processed On-Device'}
            </span>
          </div>
          <button
            type="button"
            className="wv-demo-close tactile"
            onClick={onClose}
            aria-label={fr ? 'Fermer la démo' : 'Close demo'}
          >
            ✕
          </button>
        </div>

        {/* Title */}
        <h2 className="wv-demo-title">
          {fr ? 'Squat en salle (7 répétitions)' : 'Gym Squat (7 Repetitions)'}
        </h2>
        <p className="wv-demo-context">
          {fr
            ? 'Filmé de profil à 2,5\u00A0m, téléphone posé sur un banc (hauteur 45\u00A0cm). Temps de traitement\u00A0: 2,4\u00A0s.'
            : 'Filmed from side at 2.5m, phone rested on a bench (45cm height). On-device processing time: 2.4s.'}
        </p>

        {/* Metrics Grid */}
        <div className="wv-demo-metrics">
          <div className="wv-demo-metric is-count">
            <span className="wv-demo-metric-label">
              {fr ? 'Compte détecté' : 'Detected Reps'}
            </span>
            <div className="wv-demo-count-control">
              <button
                type="button"
                className="wv-demo-step-btn tactile"
                onClick={() => handleAdjust(-1)}
                aria-label={fr ? 'Diminuer le compte' : 'Decrease count'}
              >
                −
              </button>
              <strong className="wv-demo-count-value">{count}</strong>
              <button
                type="button"
                className="wv-demo-step-btn tactile"
                onClick={() => handleAdjust(1)}
                aria-label={fr ? 'Augmenter le compte' : 'Increase count'}
              >
                +
              </button>
            </div>
            {corrected && (
              <span className="wv-demo-correction-tag">
                {fr ? 'Compte ajusté manuellement' : 'Manually corrected count'}
              </span>
            )}
          </div>

          <div className="wv-demo-metric">
            <span className="wv-demo-metric-label">
              {fr ? 'Amplitude genou' : 'Knee ROM'}
            </span>
            <strong className="wv-demo-metric-value">82°</strong>
            <small className="wv-demo-metric-sub">
              {fr ? 'Flexion sous la parallèle' : 'Below parallel depth'}
            </small>
          </div>

          <div className="wv-demo-metric">
            <span className="wv-demo-metric-label">
              {fr ? 'Tempo moyen' : 'Avg. Tempo'}
            </span>
            <strong className="wv-demo-metric-value">2,1 s</strong>
            <small className="wv-demo-metric-sub">
              {fr ? '1,1 s exc. · 0,2 s arrêt · 0,8 s conc.' : '1.1s ecc · 0.2s pause · 0.8s conc'}
            </small>
          </div>
        </div>

        {/* Rep phase bars visual */}
        <div className="wv-demo-reps-strip">
          <span className="wv-demo-reps-title">
            {fr ? 'Décomposition des 7 répétitions\u00A0:' : '7 Repetition Breakdown:'}
          </span>
          <div className="wv-demo-bars">
            {[1, 2, 3, 4, 5, 6, 7].map((rep) => (
              <div key={rep} className="wv-demo-bar-col">
                <div className="wv-demo-bar-fill" style={{ height: `${60 + rep * 5}%` }} />
                <span className="wv-demo-bar-num">R{rep}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Honest Boundaries Card */}
        <div className="wv-demo-limits-box">
          <h3 className="wv-demo-limits-heading">
            {fr ? 'Transparence et limites de mesure\u00A0:' : 'Transparency & Measurement Limits:'}
          </h3>
          <ul className="wv-demo-limits-list">
            <li>
              <strong>{fr ? 'Mesuré\u00A0:' : 'Measured:'}</strong>{' '}
              {fr
                ? 'Répétitions complètes, angle articulaire (°), durées concentrique / excentrique (s).'
                : 'Full repetition cycles, joint angles (°), concentric and eccentric durations (s).'}
            </li>
            <li>
              <strong>{fr ? 'Non mesuré\u00A0:' : 'Not measured:'}</strong>{' '}
              {fr
                ? 'Vitesse de barre en m/s (VBT), forces en Newtons, score de posture arbitraire.'
                : 'Bar speed in m/s (VBT), forces in Newtons, arbitrary posture score.'}
            </li>
          </ul>
        </div>

        {/* Modal Actions */}
        <div className="wv-demo-footer">
          <button
            type="button"
            className="wv-demo-btn is-primary tactile"
            onClick={() => {
              onClose?.();
              onTryWithCamera?.();
            }}
          >
            {fr ? 'Essayer avec ma caméra' : 'Try with camera'}
          </button>
          <button
            type="button"
            className="wv-demo-btn is-dismiss tactile"
            onClick={onClose}
          >
            {fr ? 'Fermer' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
