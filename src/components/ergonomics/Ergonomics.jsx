import { useState, useMemo } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  calculateNioshLifting,
} from '../../lib/ergonomics';
import './Ergonomics.css';

export default function Ergonomics({ onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr';

  const [loadWeightKg, setLoadWeightKg] = useState(18);
  const [horizontalDistanceCm, setHorizontalDistanceCm] = useState(35);
  const [verticalOriginCm, setVerticalOriginCm] = useState(65);
  const [verticalTravelDistanceCm, setVerticalTravelDistanceCm] = useState(40);
  const [asymmetryAngleDeg, setAsymmetryAngleDeg] = useState(15);

  const result = useMemo(() => {
    return calculateNioshLifting({
      loadWeightKg,
      horizontalDistanceCm,
      verticalOriginCm,
      verticalTravelDistanceCm,
      asymmetryAngleDeg,
    });
  }, [loadWeightKg, horizontalDistanceCm, verticalOriginCm, verticalTravelDistanceCm, asymmetryAngleDeg]);

  const statusClass =
    result.riskCategory === 'safe'
      ? 'ergo-status-safe'
      : result.riskCategory === 'moderate'
      ? 'ergo-status-mod'
      : 'ergo-status-danger';

  return (
    <div className="ergo-container" data-testid="ergonomics-screen">
      {/* Topbar */}
      <div className="ergo-topbar">
        <button
          type="button"
          className="ergo-back-btn press"
          onClick={onClose || (() => { window.location.hash = ''; })}
          data-testid="ergo-back-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {fr ? 'Retour' : 'Back'}
        </button>
        <div className="ergo-topbar-title">
          <span>{fr ? 'Ergonomie au Travail (NIOSH)' : 'Workplace Ergonomics (NIOSH)'}</span>
          <span className="ergo-badge">Enterprise AI</span>
        </div>
        <div style={{ width: '60px' }} />
      </div>

      <div className="ergo-content">
        {/* Hero */}
        <div className="ergo-hero">
          <h1>{fr ? 'Équation de Levage NIOSH & Risque Spinal L5/S1' : 'NIOSH Lifting Equation & Spinal L5/S1 Analysis'}</h1>
          <p>
            {fr
              ? 'Évaluation objective des charges de manutention, calcul de la Charge Limite Recommandée (RWL) et de l’Indice de Levage (LI). 100% sur l’appareil pour une conformité totale au RGPD.'
              : 'Objective occupational biomechanics, Recommended Weight Limit (RWL), and Lifting Index (LI). 100% on-device for total privacy and enterprise labor compliance.'}
          </p>
        </div>

        {/* Enterprise Privacy Card */}
        <div className="ergo-privacy-card">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div>
            <b>{fr ? 'Conformité Entreprise & Vie Privée des Salariés' : 'Enterprise Privacy & Labor Compliance'}</b>
            <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '2px' }}>
              {fr
                ? 'Aucun visage, flux vidéo ou donnée biométrique n’est transmis au cloud. Tout le calcul squelettique reste confiné dans le navigateur de l’opérateur.'
                : 'Zero facial data or video footage is uploaded to cloud servers. All skeletal calculations remain isolated within the device.'}
            </div>
          </div>
        </div>

        {/* HUD Gauges */}
        <div className="ergo-dashboard">
          <div className="ergo-gauge-card">
            <span className="ergo-gauge-label">{fr ? 'Indice de Levage (LI)' : 'Lifting Index (LI)'}</span>
            <span className={`ergo-gauge-value ${statusClass}`} data-testid="ergo-li-value">
              {result.liftingIndexLI}
            </span>
            <span className="ergo-gauge-sub">
              {result.riskCategory === 'safe'
                ? fr ? 'Conforme / Risque Faible (LI ≤ 1.0)' : 'Safe / Low Risk (LI ≤ 1.0)'
                : result.riskCategory === 'moderate'
                ? fr ? 'Risque Modéré (1.0 < LI ≤ 3.0)' : 'Moderate Risk (1.0 < LI ≤ 3.0)'
                : fr ? 'Danger Ergonomique (LI > 3.0)' : 'High Ergonomic Risk (LI > 3.0)'}
            </span>
          </div>

          <div className="ergo-gauge-card">
            <span className="ergo-gauge-label">{fr ? 'Charge Max Recommandée (RWL)' : 'Recommended Weight (RWL)'}</span>
            <span className="ergo-gauge-value" style={{ color: '#38bdf8' }} data-testid="ergo-rwl-value">
              {result.recommendedWeightLimitKg} kg
            </span>
            <span className="ergo-gauge-sub">
              {fr ? `Charge réelle : ${loadWeightKg} kg` : `Actual Load: ${loadWeightKg} kg`}
            </span>
          </div>

          <div className="ergo-gauge-card">
            <span className="ergo-gauge-label">{fr ? 'Compression L5/S1 Estimée' : 'Est. L5/S1 Compression'}</span>
            <span className={`ergo-gauge-value ${result.estimatedL5S1CompressionNewtons > 3400 ? 'ergo-status-danger' : 'ergo-status-safe'}`}>
              {result.estimatedL5S1CompressionNewtons} N
            </span>
            <span className="ergo-gauge-sub">
              {fr ? 'Limite d’action NIOSH : 3 400 N' : 'NIOSH Action Limit: 3,400 N'}
            </span>
          </div>
        </div>

        {/* Interactive Sliders */}
        <div className="ergo-controls">
          <h3>{fr ? 'Paramètres du Poste de Travail' : 'Workstation & Lift Parameters'}</h3>
          <div className="ergo-slider-group">
            <div className="slider-row">
              <div className="slider-label">
                <span>{fr ? 'Poids de la charge' : 'Load Weight'}</span>
                <b>{loadWeightKg} kg</b>
              </div>
              <input
                type="range"
                min="5"
                max="45"
                step="1"
                value={loadWeightKg}
                onChange={e => setLoadWeightKg(parseFloat(e.target.value))}
                className="ergo-slider"
                data-testid="slider-load"
              />
            </div>

            <div className="slider-row">
              <div className="slider-label">
                <span>{fr ? 'Portée horizontale (H)' : 'Horizontal Reach (H)'}</span>
                <b>{horizontalDistanceCm} cm</b>
              </div>
              <input
                type="range"
                min="25"
                max="65"
                step="1"
                value={horizontalDistanceCm}
                onChange={e => setHorizontalDistanceCm(parseFloat(e.target.value))}
                className="ergo-slider"
                data-testid="slider-h"
              />
            </div>

            <div className="slider-row">
              <div className="slider-label">
                <span>{fr ? 'Hauteur d’origine (V)' : 'Vertical Origin Height (V)'}</span>
                <b>{verticalOriginCm} cm</b>
              </div>
              <input
                type="range"
                min="10"
                max="150"
                step="5"
                value={verticalOriginCm}
                onChange={e => setVerticalOriginCm(parseFloat(e.target.value))}
                className="ergo-slider"
                data-testid="slider-v"
              />
            </div>

            <div className="slider-row">
              <div className="slider-label">
                <span>{fr ? 'Angle d’asymétrie / torsion (A)' : 'Twist / Asymmetry Angle (A)'}</span>
                <b>{asymmetryAngleDeg}°</b>
              </div>
              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={asymmetryAngleDeg}
                onChange={e => setAsymmetryAngleDeg(parseFloat(e.target.value))}
                className="ergo-slider"
                data-testid="slider-a"
              />
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {result.recommendations.length > 0 && (
          <div className="ergo-recommendations">
            <h3>{fr ? 'Recommandations Ergonomiques Immédiates' : 'Immediate Ergonomic Recommendations'}</h3>
            <ul className="rec-list">
              {result.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
