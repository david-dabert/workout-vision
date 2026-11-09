import React from 'react';
import './Kine.css';

/**
 * ShoulderDyskinesisCard.jsx — Clinical card presenting scapular dyskinesis & bilateral asymmetry.
 * Designed for Monsieur Lamine (shoulder physiotherapist & university teacher).
 */
export default function ShoulderDyskinesisCard({ report, onExportPdf, onClose }) {
  if (!report) return null;

  const {
    classification,
    asymmetry,
    shrugSign,
    eccentricControl,
    trunkCompensation,
    hypotheses = [],
    durationSeconds,
  } = report;

  const severityClass = {
    NORMAL: 'is-normal',
    SUBTLE: 'is-warning',
    OBVIOUS: 'is-alert',
  }[classification] || 'is-normal';

  const severityLabel = {
    NORMAL: 'Rythme Scapulaire Normal',
    SUBTLE: 'Dyskinésie Discrète (Subtle)',
    OBVIOUS: 'Dyskinésie Évidente (Obvious)',
  }[classification] || 'Évaluation';

  return (
    <div className="kn-scapular-card" data-testid="shoulder-dyskinesis-card">
      <div className="kn-scapular-header">
        <div>
          <span className="sc-tag">Protocole McClure / SDT</span>
          <h3 className="kn-scapular-title">Bilan Épaule & Cinématique Scapulaire</h3>
          <p className="kn-scapular-sub">Analyse optique bilatérale ({durationSeconds} s)</p>
        </div>
        <div className={`kn-severity-pill ${severityClass}`}>
          {severityLabel}
        </div>
      </div>

      {/* Bilateral ROM & Asymmetry Indicator */}
      <div className="kn-scapular-metrics-grid">
        <div className="kn-metric-box">
          <span className="kn-metric-label">ROM Gauche</span>
          <span className="kn-metric-val">{asymmetry.leftPeakRom}°</span>
          <span className="kn-metric-sub">Élévation max</span>
        </div>
        <div className="kn-metric-box">
          <span className="kn-metric-label">ROM Droite</span>
          <span className="kn-metric-val">{asymmetry.rightPeakRom}°</span>
          <span className="kn-metric-sub">Élévation max</span>
        </div>
        <div className="kn-metric-box">
          <span className="kn-metric-label">Indice d’Asymétrie (ASI)</span>
          <span className={`kn-metric-val ${asymmetry.isClinicallySignificant ? 'is-alert' : 'is-normal'}`}>
            {asymmetry.asiPercent}\u00A0%
          </span>
          <span className="kn-metric-sub">
            {asymmetry.isClinicallySignificant ? 'Seuil critique >15\u00A0%' : 'Symétrie normale (<15\u00A0%)'}
          </span>
        </div>
      </div>

      {/* Optical Signatures Checklist */}
      <div className="kn-signatures-list">
        <div className="kn-signature-item">
          <div className="kn-sig-icon">{shrugSign.detected ? '⚠️' : '✓'}</div>
          <div className="kn-sig-content">
            <strong>Haussement du trapèze (Shrug Sign)</strong>
            <p>{shrugSign.clinicalNoteFr}</p>
          </div>
        </div>

        <div className="kn-signature-item">
          <div className="kn-sig-icon">
            {eccentricControl.leftDropDetected || eccentricControl.rightDropDetected ? '⚠️' : '✓'}
          </div>
          <div className="kn-sig-content">
            <strong>Contrôle excentrique (120° à 60°)</strong>
            <p>{eccentricControl.clinicalNoteFr}</p>
          </div>
        </div>

        <div className="kn-signature-item">
          <div className="kn-sig-icon">{trunkCompensation.isCompensating ? 'ℹ️' : '✓'}</div>
          <div className="kn-sig-content">
            <strong>Stabilité axiale du rachis</strong>
            <p>{trunkCompensation.clinicalNoteFr}</p>
          </div>
        </div>
      </div>

      {/* Hypotheses for the Clinician */}
      {hypotheses.length > 0 && (
        <div className="kn-hypotheses-block">
          <h4 className="kn-hypo-head">Déductions Biomécaniques pour le Praticien</h4>
          {hypotheses.map(h => (
            <div key={h.id} className={`kn-hypo-card is-${h.severity}`}>
              <div className="kn-hypo-top">
                <span className="kn-hypo-title">{h.titleFr}</span>
                <span className="kn-hypo-badge">{h.severity === 'alert' ? 'Alerte' : h.severity === 'warning' ? 'Attention' : 'Info'}</span>
              </div>
              <p className="kn-hypo-desc">{h.descriptionFr}</p>
              <div className="kn-hypo-evidence">
                <em>Preuve optique\u00A0: {h.evidenceFr}</em>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Footer */}
      <div className="kn-scapular-actions">
        {onExportPdf && (
          <button type="button" className="btn-primary is-s" onClick={onExportPdf}>
            Exporter Rapport Médical PDF
          </button>
        )}
        {onClose && (
          <button type="button" className="btn-ghost is-s" onClick={onClose}>
            Fermer
          </button>
        )}
      </div>
    </div>
  );
}
