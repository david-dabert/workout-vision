import React, { useState } from 'react';
import './Kine.css';
import {
  calculateMobilityMetric,
  compileBdkReport,
  generateBdkPrintHtml,
} from '../../lib/kine/bdkReportGenerator';
import PessacClinicSpecialtyHub from './PessacClinicSpecialtyHub';

const SPECIALTY_PROFILES = {
  shoulder: {
    id: 'shoulder',
    labelFr: 'Épaule & Scapula',
    title: 'Pôle Épaule & Scapula',
    diagnosis: 'Conflit sous-acromial & dyskinésie scapulaire (Kibler II)',
    measurements: [
      { fr: 'Abduction gléno-humérale', en: 'Glenohumeral Abduction', norm: 165, val: 122 },
      { fr: 'Rotation externe (R1 coude au corps)', en: 'External Rotation', norm: 85, val: 58 },
      { fr: 'Élévation antérieure sagittale', en: 'Sagittal Flexion', norm: 170, val: 140 },
      { fr: 'Rythme scapulo-thoracique (Scaption)', en: 'Scapulothoracic Rhythm', norm: 160, val: 130 },
    ],
  },
  knee: {
    id: 'knee',
    labelFr: 'Genou & LCA',
    title: 'Pôle Genou & LCA / Fémoro-Patellaire',
    diagnosis: 'Entorse LCA stade rééducation & syndrome fémoro-patellaire',
    measurements: [
      { fr: 'Valgus dynamique au squat monopodal', en: 'Dynamic Knee Valgus', norm: 4, val: 11 },
      { fr: 'Extension terminale (flessum résiduel)', en: 'Terminal Extension Deficit', norm: 0, val: 4 },
      { fr: 'Flexion active en chaîne fermée', en: 'Closed-Chain Knee Flexion', norm: 140, val: 128 },
      { fr: 'Indice de symétrie de force (LSI)', en: 'Limb Symmetry Index (LSI)', norm: 100, val: 84 },
    ],
  },
  lumbar: {
    id: 'lumbar',
    labelFr: 'Rachis Lombaire',
    title: 'Pôle Rachis Lombaire & Pelvis',
    diagnosis: 'Lombalgie chronique & instabilité lombo-pelvienne L4-S1',
    measurements: [
      { fr: 'Ratio lombo-pelvien en flexion antérieure', en: 'Lumbopelvic Rhythm Ratio', norm: 1.2, val: 2.1 },
      { fr: 'Dévers pelvien monopodal (Trendelenburg)', en: 'Trendelenburg Pelvic Drop', norm: 1.5, val: 5.2 },
      { fr: 'Extension lombaire contrôlée (McKenzie)', en: 'Lumbar Extension Mobility', norm: 30, val: 18 },
      { fr: 'Inclinaison latérale rachidienne', en: 'Lateral Spine Inclination', norm: 35, val: 24 },
    ],
  },
  hip: {
    id: 'hip',
    labelFr: 'Hanche & CFA',
    title: 'Pôle Hanche & CFA',
    diagnosis: 'Conflit fémoro-acétabulaire (Came) & rétraction du psoas',
    measurements: [
      { fr: 'Rotation interne à 90° de flexion (FADIR)', en: 'Internal Rotation at 90°', norm: 35, val: 18 },
      { fr: 'Rotation externe coxo-fémorale', en: 'External Hip Rotation', norm: 45, val: 38 },
      { fr: 'Extension de hanche (Test de Thomas)', en: 'Thomas Test Hip Extension', norm: 12, val: -3 },
      { fr: 'Flexion coxo-fémorale active', en: 'Active Hip Flexion', norm: 125, val: 108 },
    ],
  },
  ankle: {
    id: 'ankle',
    labelFr: 'Cheville & Achille',
    title: 'Pôle Cheville & Achille',
    diagnosis: 'Instabilité chronique de cheville & tendinopathie calcanéenne',
    measurements: [
      { fr: 'Dorsiflexion en charge (Test WBLT)', en: 'Weight-Bearing Lunge Test', norm: 38, val: 26 },
      { fr: 'Test Heel-Rise unilatéral (Endurance)', en: 'Single-Leg Heel-Rise Reps', norm: 28, val: 16 },
      { fr: 'Flexion plantaire active', en: 'Active Plantarflexion', norm: 45, val: 38 },
      { fr: 'Éversion / Inversion talo-calcanéenne', en: 'Subtalar Inversion/Eversion', norm: 30, val: 20 },
    ],
  },
  cervical: {
    id: 'cervical',
    labelFr: 'Rachis Cervical',
    title: 'Pôle Rachis Cervical & Céphalées',
    diagnosis: 'Céphalée cervicogénique & dysfonction C1-C3 avec projection céphalique',
    measurements: [
      { fr: 'Angle Cranio-Vertébral (CVA)', en: 'Cranio-Vertebral Angle (CVA)', norm: 52, val: 42 },
      { fr: 'Rotation cervicale droite (C1-C2)', en: 'Right Cervical Rotation', norm: 80, val: 62 },
      { fr: 'Rotation cervicale gauche (C1-C2)', en: 'Left Cervical Rotation', norm: 80, val: 78 },
      { fr: 'Flexion / Extension cranio-rachidienne', en: 'Cervical Flexion/Extension', norm: 120, val: 95 },
    ],
  },
};

/**
 * KineCabinetMode.jsx: Multi-Specialty Clinic Kiosk Mode tailored for Monsieur Lamine (Client Zéro)
 * and the specialist physiotherapists of the Pessac Physical Therapy Clinic.
 */
export default function KineCabinetMode({ onBack }) {
  const [selectedSpecialty, setSelectedSpecialty] = useState('knee');
  const [patientInitials, setPatientInitials] = useState('D.D.');
  const [affectedSide, setAffectedSide] = useState('right');
  const [dominantSide, setDominantSide] = useState('right');
  const [showInteractiveHub, setShowInteractiveHub] = useState(false);
  const [diagnosis, setDiagnosis] = useState(SPECIALTY_PROFILES.knee.diagnosis);
  const [generatedReport, setGeneratedReport] = useState(null);

  const handleSelectSpecialty = (key) => {
    setSelectedSpecialty(key);
    setDiagnosis(SPECIALTY_PROFILES[key].diagnosis);
    setGeneratedReport(null);
  };

  const handleRunAssessment = () => {
    const profile = SPECIALTY_PROFILES[selectedSpecialty];
    const measurements = profile.measurements.map(m =>
      calculateMobilityMetric(m.fr, m.en, m.norm, m.val)
    );

    const report = compileBdkReport({
      practitioner: {
        name: 'Monsieur Lamine',
        title: 'Masseur-Kinésithérapeute D.E.',
        clinicName: 'Clinique de Kinésithérapie du Sport (Pessac / Paris)',
        city: 'Pessac / Paris',
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
        kiblerGrade: selectedSpecialty === 'shoulder' ? 'Grade II' : 'Non applicable',
        shrugSignPositive: selectedSpecialty === 'shoulder',
        shrugSignOnsetAngleDegrees: 44,
        eccentricDysrhythmia: selectedSpecialty === 'shoulder',
        wingingObserved: selectedSpecialty === 'shoulder',
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

  if (showInteractiveHub) {
    return (
      <PessacClinicSpecialtyHub
        initialSpecialty={selectedSpecialty}
        onClose={() => setShowInteractiveHub(false)}
        onExportPdf={handlePrintBdk}
      />
    );
  }

  const currentProfile = SPECIALTY_PROFILES[selectedSpecialty];

  return (
    <div className="kn-patient-card" data-testid="kine-cabinet-mode" style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <span className="sc-tag">Clinique de Pessac &middot; Client Zéro</span>
          <h2 style={{ margin: '4px 0', fontSize: '22px', color: 'var(--c-fg)' }}>
            Cabinet Kiné : Bilan Rapide {currentProfile.labelFr}
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--c-fg-muted)' }}>
            Praticien{'\u00A0'}: Monsieur Lamine (Clinique de Kinésithérapie, Pessac)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="kn-btn-secondary"
            onClick={() => setShowInteractiveHub(true)}
            data-testid="open-pessac-hub-btn"
          >
            Hub Multi-Pôles
          </button>
          {onBack && (
            <button className="kn-btn-secondary" onClick={onBack}>
              Fermer
            </button>
          )}
        </div>
      </div>

      {/* Specialty Picker Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }} role="tablist">
        {Object.values(SPECIALTY_PROFILES).map((sp) => (
          <button
            key={sp.id}
            type="button"
            className={`btn-line press${selectedSpecialty === sp.id ? ' is-on' : ''}`}
            onClick={() => handleSelectSpecialty(sp.id)}
            data-testid={`cabinet-sp-${sp.id}`}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              borderColor: selectedSpecialty === sp.id ? 'var(--c-accent)' : 'var(--c-rule)',
              color: selectedSpecialty === sp.id ? 'var(--c-accent)' : 'var(--c-fg)',
            }}
          >
            {sp.labelFr}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--depth-1)', padding: '16px', borderRadius: 'var(--r-md, 8px)', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '15px', marginTop: 0, marginBottom: '12px', color: 'var(--c-fg)' }}>
          Paramètres du Patient & Pôle Clinique
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
              Côté affecté / pathologique
            </label>
            <select
              value={affectedSide}
              onChange={(e) => setAffectedSide(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--c-rule)', background: 'var(--c-surface)', color: 'var(--c-fg)' }}
            >
              <option value="right">Droit</option>
              <option value="left">Gauche</option>
              <option value="bilateral">Bilatéral</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '12px' }}>
          <label style={{ fontSize: '12px', color: 'var(--c-fg-muted)', display: 'block', marginBottom: '4px' }}>
            Diagnostic d'entrée (prescrit ou orienté)
          </label>
          <input
            type="text"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--c-rule)', background: 'var(--c-surface)', color: 'var(--c-fg)' }}
          />
        </div>
      </div>

      {/* Action Button: Run Optical Assessment */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <button
          className="btn-primary"
          style={{ width: '100%', padding: '14px', fontSize: '16px', fontWeight: 'bold' }}
          onClick={handleRunAssessment}
          data-testid="cabinet-run-assessment"
        >
          Lancer l'évaluation optique (30 s) : {currentProfile.title}
        </button>
      </div>

      {/* Generated BDK Summary */}
      {generatedReport && (
        <div style={{ border: '1px solid var(--c-rule)', borderRadius: 'var(--r-md, 8px)', padding: '20px', background: 'var(--c-surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--c-rule)', paddingBottom: '12px', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--c-fg)' }}>
                Bilan Diagnostic Kinésithérapique (BDK Initial)
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--c-fg-muted)' }}>
                Réf\u00A0: {generatedReport.reportId} &middot; Normes HAS / CNAM
              </span>
            </div>
            <button
              className="btn-primary is-s"
              onClick={handlePrintBdk}
              data-testid="cabinet-print-bdk"
            >
              Imprimer / Exporter PDF BDK
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            {generatedReport.measurements.map((m, idx) => (
              <div key={idx} style={{ background: 'var(--depth-1)', padding: '10px', borderRadius: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--c-fg-muted)', display: 'block' }}>{m.movementNameFr}</span>
                <strong style={{ fontSize: '18px', color: m.isDeficit ? 'var(--c-accent)' : 'var(--c-fg)' }}>
                  {m.activeRomDegrees}&deg;
                </strong>
                <span style={{ fontSize: '11px', display: 'block', color: 'var(--c-fg-muted)' }}>
                  Norme\u00A0: {m.referenceNormDegrees}&deg; (Déficit\u00A0: {m.deficitDegrees}&deg;)
                </span>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--depth-1)', borderLeft: '3px solid var(--c-accent)', padding: '12px', borderRadius: '4px', fontSize: '13px' }}>
            <strong>Conclusion Clinique {currentProfile.labelFr}{'\u00A0'}:</strong>
            <p style={{ margin: '4px 0 0 0' }}>
              {selectedSpecialty === 'shoulder'
                ? 'Dyskinésie scapulaire évidente (Kibler II) avec signe du haussement précoce à 44°. Conflit sous-acromial avéré.'
                : selectedSpecialty === 'knee'
                ? 'Déficit d\'extension terminale (flessum 4°) et valgus dynamique à 11° (seuil critique >8°). LSI à 84% sous le seuil de reprise sportive.'
                : selectedSpecialty === 'lumbar'
                ? 'Inversion du rythme lombo-pelvien (ratio 2.1 > 1.8) avec dévers pelvien unilatéral à 5.2°. Cisaillement L4-S1 accru.'
                : selectedSpecialty === 'hip'
                ? 'Déficit de rotation interne à 90° de flexion (18° vs norme 35°). Signe FADIR positif, suspicion de CFA type Came.'
                : selectedSpecialty === 'ankle'
                ? 'Flexion dorsale en charge WBLT réduite à 26° (norme ≥35°). Endurance du tendon d\'Achille diminuée (16 réps).'
                : 'Angle Cranio-Vertébral réduit à 42° (norme ≥50°). Projection antérieure de la tête avec restriction rotatoire C1-C2 droite.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
