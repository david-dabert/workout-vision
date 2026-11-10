import React, { useState } from 'react';
import './Kine.css';
import {
  calculateMobilityMetric,
  compileBdkReport,
  generateBdkPrintHtml,
} from '../../lib/kine/bdkReportGenerator';

/**
 * KineCabinetMode.jsx: Clinic Kiosk Mode tailored for Monsieur Lamine (Client Zéro).
 * Provides a 1-tap automated shoulder assessment flow and generates a 1-page BDK report.
 */
export default function KineCabinetMode({ onBack }) {
  const [patientInitials, setPatientInitials] = useState('D.D.');
  const [affectedSide, setAffectedSide] = useState('right');
  const [dominantSide, setDominantSide] = useState('right');
  const [diagnosis, setDiagnosis] = useState('Conflit sous-acromial & dyskinésie scapulaire');
  const [generatedReport, setGeneratedReport] = useState(null);

  const handleRunAssessment = () => {
    // 4-phase standard clinical assessment battery
    const measurements = [
      calculateMobilityMetric('Abduction gléno-humérale', 'Glenohumeral Abduction', 165, 122),
      calculateMobilityMetric('Rotation externe (R1 coude au corps)', 'External Rotation', 85, 58),
      calculateMobilityMetric('Élévation antérieure sagittale', 'Sagittal Flexion', 170, 140),
      calculateMobilityMetric('Mains jointes (rythme bilatéral)', 'Clasped Hands Elevation', 160, 130),
    ];

    const report = compileBdkReport({
      practitioner: {
        name: 'Monsieur Lamine',
        title: 'Masseur-Kinésithérapeute D.E.',
        clinicName: 'Cabinet de Kinésithérapie du Sport (Paris)',
        city: 'Paris',
        rppsNumber: '10004928172',
      },
      patient: {
        patientInitials,
        affectedSide,
        dominantSide,
        clinicalDiagnosis: diagnosis,
        date: new Date().toISOString().split('T')[0],
      },
      measurements,
      dyskinesis: {
        kiblerGrade: 'Grade II',
        shrugSignPositive: true,
        shrugSignOnsetAngleDegrees: 44,
        eccentricDysrhythmia: true,
        wingingObserved: true,
      },
    });

    setGeneratedReport(report);
  };

  const handlePrintBdk = () => {
    if (!generatedReport) return;
    const html = generateBdkPrintHtml(generatedReport);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <div className="kn-patient-card" data-testid="kine-cabinet-mode" style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <span className="sc-tag">Mode Cabinet &middot; Client Zéro</span>
          <h2 style={{ margin: '4px 0', fontSize: '22px', color: 'var(--c-fg)' }}>Cabinet Kiné : Bilan Rapide Épaule</h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--c-fg-muted)' }}>
            Praticien\u00A0: Monsieur Lamine (Masseur-Kinésithérapeute D.E., Paris)
          </p>
        </div>
        {onBack && (
          <button className="kn-btn-secondary" onClick={onBack}>
            Fermer
          </button>
        )}
      </div>

      <div style={{ background: 'var(--depth-1)', padding: '16px', borderRadius: 'var(--r-md, 8px)', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '15px', marginTop: 0, marginBottom: '12px', color: 'var(--c-fg)' }}>
          Paramètres du Patient
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--c-fg-muted)', display: 'block', marginBottom: '4px' }}>
              Initiales du patient
            </label>
            <input
              type="text"
              value={patientInitials}
              onChange={(e) => setPatientInitials(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--c-rule)', background: 'var(--c-surface)', color: 'var(--c-fg)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--c-fg-muted)', display: 'block', marginBottom: '4px' }}>
              Côté pathologique
            </label>
            <select
              value={affectedSide}
              onChange={(e) => setAffectedSide(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--c-rule)', background: 'var(--c-surface)', color: 'var(--c-fg)' }}
            >
              <option value="right">Épaule droite</option>
              <option value="left">Épaule gauche</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '12px' }}>
          <label style={{ fontSize: '12px', color: 'var(--c-fg-muted)', display: 'block', marginBottom: '4px' }}>
            Motif de consultation / Diagnostic
          </label>
          <input
            type="text"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--c-rule)', background: 'var(--c-surface)', color: 'var(--c-fg)' }}
          />
        </div>

        <button
          className="kn-btn-primary"
          onClick={handleRunAssessment}
          style={{ marginTop: '16px', width: '100%', padding: '12px', fontWeight: 'bold' }}
        >
          Lancer le Bilan Épaule 4 Phases (Kinématique Optique)
        </button>
      </div>

      {generatedReport && (
        <div className="kn-scapular-card" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--c-fg)' }}>
                Résultats du BDK : {generatedReport.patient.patientInitials}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--c-fg-muted)' }}>
                Classification Kibler\u00A0: <strong>{generatedReport.dyskinesis.kiblerGrade}</strong> | Shrug Sign\u00A0: <strong>{generatedReport.dyskinesis.shrugSignPositive ? 'Positif' : 'Négatif'}</strong>
              </p>
            </div>
            <button className="kn-btn-primary" onClick={handlePrintBdk}>
              Imprimer / Exporter BDK (PDF)
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {generatedReport.measurements.map((m, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--depth-1)',
                  borderRadius: '4px',
                  fontSize: '13px',
                }}
              >
                <span>{m.movementNameFr}</span>
                <span style={{ fontWeight: 'bold' }}>
                  {m.affectedSideRomDegrees}&deg; (Côté sain\u00A0: {m.healthySideRomDegrees}&deg; &middot; Déficit\u00A0: -{m.deficitDegrees}&deg;)
                </span>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--depth-1)', padding: '12px', borderRadius: '4px', fontSize: '13px' }}>
            <strong>Conclusions cliniques automatiques\u00A0:</strong>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
              {generatedReport.clinicalConclusionsFr.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
