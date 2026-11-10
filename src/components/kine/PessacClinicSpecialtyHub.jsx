import React, { useState } from 'react';
import './Kine.css';

/**
 * PessacClinicSpecialtyHub.jsx - Comprehensive Multi-Specialty Kinematics Hub for the Pessac Physical Therapy Clinic.
 * Co-designed for Monsieur Lamine and specialist physiotherapists in Pessac across 6 clinical poles:
 *   1. Épaule & Scapula (McClure SDT, Shrug Sign, Eccentric Drop)
 *   2. Genou & LCA (Dynamic Valgus, Flessum Deficit, Limb Symmetry Index LSI)
 *   3. Rachis Lombaire (Lumbopelvic Rhythm Inversion, Trendelenburg Pelvic Drop)
 *   4. Hanche & CFA (FADIR Internal Rotation Deficit, Thomas Hip Extension)
 *   5. Cheville & Achille (Weight-Bearing Lunge Test WBLT, Heel-Rise Endurance)
 *   6. Rachis Cervical (Cranio-Vertebral Angle CVA, Rotation Symmetry)
 */

export const PESSAC_SPECIALTIES = [
  { id: 'shoulder', labelFr: 'Épaule & Scapula', icon: '🦾', protocol: 'Protocole McClure / SDT' },
  { id: 'knee', labelFr: 'Genou & LCA', icon: '🦵', protocol: 'Protocole Hewett / Shelbourne' },
  { id: 'lumbar', labelFr: 'Rachis Lombaire', icon: '🦴', protocol: 'Protocole McGill / McKenzie' },
  { id: 'hip', labelFr: 'Hanche & CFA', icon: '🩻', protocol: 'Protocole Philippon / FADIR' },
  { id: 'ankle', labelFr: 'Cheville & Achille', icon: '🦶', protocol: 'Protocole WBLT / Konor' },
  { id: 'cervical', labelFr: 'Rachis Cervical', icon: '👤', protocol: 'Protocole Yip / CVA' },
];

export default function PessacClinicSpecialtyHub({
  initialSpecialty = 'knee',
  onExportPdf = null,
  onClose = null,
}) {
  const [activeSpecialty, setActiveSpecialty] = useState(initialSpecialty);

  return (
    <div className="kn-pessac-hub" data-testid="pessac-specialty-hub">
      <div className="kn-pessac-header">
        <div>
          <span className="sc-tag">Clinique de Kinésithérapie de Pessac</span>
          <h2 className="kn-pessac-title">Plateforme Cinématique Multi-Spécialités</h2>
          <p className="kn-pessac-sub">Objectivation optique haute précision pour chaque pôle clinique</p>
        </div>
        {onClose && (
          <button type="button" className="btn-ghost is-s" onClick={onClose} data-testid="pessac-close-btn">
            Fermer
          </button>
        )}
      </div>

      {/* Specialty Tabs */}
      <div className="kn-pessac-tabs" role="tablist" aria-label="Pôles cliniques spécialisés">
        {PESSAC_SPECIALTIES.map(sp => (
          <button
            key={sp.id}
            type="button"
            role="tab"
            aria-selected={activeSpecialty === sp.id}
            className={`kn-pessac-tab${activeSpecialty === sp.id ? ' is-active' : ''}`}
            data-testid={`pessac-tab-${sp.id}`}
            onClick={() => setActiveSpecialty(sp.id)}
          >
            <span className="kn-tab-icon" aria-hidden="true">{sp.icon}</span>
            <span className="kn-tab-label">{sp.labelFr}</span>
          </button>
        ))}
      </div>

      {/* Specialty Content Card */}
      <div className="kn-pessac-content">
        {activeSpecialty === 'shoulder' && <ShoulderClinicalPanel onExportPdf={onExportPdf} />}
        {activeSpecialty === 'knee' && <KneeClinicalPanel onExportPdf={onExportPdf} />}
        {activeSpecialty === 'lumbar' && <LumbarClinicalPanel onExportPdf={onExportPdf} />}
        {activeSpecialty === 'hip' && <HipClinicalPanel onExportPdf={onExportPdf} />}
        {activeSpecialty === 'ankle' && <AnkleClinicalPanel onExportPdf={onExportPdf} />}
        {activeSpecialty === 'cervical' && <CervicalClinicalPanel onExportPdf={onExportPdf} />}
      </div>
    </div>
  );
}

function KneeClinicalPanel({ onExportPdf }) {
  return (
    <div className="kn-scapular-card" data-testid="knee-clinical-panel">
      <div className="kn-scapular-header">
        <div>
          <span className="sc-tag">Protocole Hewett / Shelbourne</span>
          <h3 className="kn-scapular-title">Bilan Genou, LCA & Syndrome Fémoro-Patellaire</h3>
          <p className="kn-scapular-sub">Cinématique d'amorti, valgus dynamique et extension terminale</p>
        </div>
        <div className="kn-severity-pill is-normal">
          Axe Fémoro-Tibial Stable
        </div>
      </div>

      <div className="kn-scapular-metrics-grid">
        <div className="kn-metric-box">
          <span className="kn-metric-label">Valgus Dynamique</span>
          <span className="kn-metric-val">4.2°</span>
          <span className="kn-metric-sub">Norme{'\u00A0'}: &lt; 8° (Hewett)</span>
        </div>
        <div className="kn-metric-box">
          <span className="kn-metric-label">Extension Terminale</span>
          <span className="kn-metric-val">0.5°</span>
          <span className="kn-metric-sub">Flessum résiduel &lt; 2°</span>
        </div>
        <div className="kn-metric-box">
          <span className="kn-metric-label">Symétrie Membre (LSI)</span>
          <span className="kn-metric-val is-normal">96{'\u00A0'}%</span>
          <span className="kn-metric-sub">Seuil retour au sport &ge; 90{'\u00A0'}%</span>
        </div>
      </div>

      <div className="kn-signatures-list">
        <div className="kn-signature-item">
          <div className="kn-sig-icon">✓</div>
          <div className="kn-sig-content">
            <strong>Contrôle du valgus dynamique à l'impact</strong>
            <p>Absence d'effondrement médial au squat monopodal. Stabilité du quadriceps et du moyen fessier validée.</p>
          </div>
        </div>
        <div className="kn-signature-item">
          <div className="kn-sig-icon">✓</div>
          <div className="kn-sig-content">
            <strong>Verrouillage en extension terminale</strong>
            <p>Extension complète bilatérale sans flessum résiduel (protection du cartilage fémoro-patellaire).</p>
          </div>
        </div>
      </div>

      <div className="kn-scapular-actions">
        {onExportPdf && (
          <button type="button" className="btn-primary is-s" onClick={onExportPdf}>
            Exporter Bilan Genou PDF (Normes HAS)
          </button>
        )}
      </div>
    </div>
  );
}

function LumbarClinicalPanel({ onExportPdf }) {
  return (
    <div className="kn-scapular-card" data-testid="lumbar-clinical-panel">
      <div className="kn-scapular-header">
        <div>
          <span className="sc-tag">Protocole McGill / McKenzie</span>
          <h3 className="kn-scapular-title">Bilan Rachis Lombaire & Rythme Lombo-Pelvien</h3>
          <p className="kn-scapular-sub">Dissociation rachis/bassin, stabilité axiale et test de Trendelenburg</p>
        </div>
        <div className="kn-severity-pill is-normal">
          Rythme Lombo-Pelvien Équilibré
        </div>
      </div>

      <div className="kn-scapular-metrics-grid">
        <div className="kn-metric-box">
          <span className="kn-metric-label">Ratio Lombo-Pelvien</span>
          <span className="kn-metric-val">1.2</span>
          <span className="kn-metric-sub">Norme{'\u00A0'}: &lt; 1.8</span>
        </div>
        <div className="kn-metric-box">
          <span className="kn-metric-label">Dévers Pelvien Monopodal</span>
          <span className="kn-metric-val">1.8°</span>
          <span className="kn-metric-sub">Trendelenburg si &gt; 4°</span>
        </div>
        <div className="kn-metric-box">
          <span className="kn-metric-label">Cisaillement Lombaire</span>
          <span className="kn-metric-val is-normal">Minimal</span>
          <span className="kn-metric-sub">Dissociation lombo-sacrée validée</span>
        </div>
      </div>

      <div className="kn-signatures-list">
        <div className="kn-signature-item">
          <div className="kn-sig-icon">✓</div>
          <div className="kn-sig-content">
            <strong>Stabilité lombo-pelvienne en flexion</strong>
            <p>La flexion antérieure s'effectue par rotation antérieure du bassin sans inversion précoce de la courbure lombaire.</p>
          </div>
        </div>
        <div className="kn-signature-item">
          <div className="kn-sig-icon">✓</div>
          <div className="kn-sig-content">
            <strong>Stabilité du bassin unipodal (Moyen Fessier)</strong>
            <p>Dévers pelvien maintenu sous 2°. Absence de compensation axiale controlatérale.</p>
          </div>
        </div>
      </div>

      <div className="kn-scapular-actions">
        {onExportPdf && (
          <button type="button" className="btn-primary is-s" onClick={onExportPdf}>
            Exporter Bilan Rachis PDF
          </button>
        )}
      </div>
    </div>
  );
}

function HipClinicalPanel({ onExportPdf }) {
  return (
    <div className="kn-scapular-card" data-testid="hip-clinical-panel">
      <div className="kn-scapular-header">
        <div>
          <span className="sc-tag">Protocole Philippon / FADIR</span>
          <h3 className="kn-scapular-title">Bilan Hanche & Dépistage Conflit Fémoro-Acétabulaire</h3>
          <p className="kn-scapular-sub">Rotations en flexion à 90°, test de Thomas et rétraction du psoas</p>
        </div>
        <div className="kn-severity-pill is-normal">
          Mobilité Coxo-Fémorale Conforme
        </div>
      </div>

      <div className="kn-scapular-metrics-grid">
        <div className="kn-metric-box">
          <span className="kn-metric-label">Rotation Interne G/D</span>
          <span className="kn-metric-val">34° / 32°</span>
          <span className="kn-metric-sub">Seuil pathologique{'\u00A0'}: &lt; 20°</span>
        </div>
        <div className="kn-metric-box">
          <span className="kn-metric-label">Asymétrie Rotatoire</span>
          <span className="kn-metric-val">2.0°</span>
          <span className="kn-metric-sub">Conflit suspecté si &gt; 12°</span>
        </div>
        <div className="kn-metric-box">
          <span className="kn-metric-label">Extension Thomas</span>
          <span className="kn-metric-val is-normal">+11.5°</span>
          <span className="kn-metric-sub">Flexum si &lt; 0° (rétraction psoas)</span>
        </div>
      </div>

      <div className="kn-signatures-list">
        <div className="kn-signature-item">
          <div className="kn-sig-icon">✓</div>
          <div className="kn-sig-content">
            <strong>Dégagement fémoro-acétabulaire (Signe FADIR)</strong>
            <p>Amplitude de rotation interne symétrique sans butée mécanique ni esquive antalgique.</p>
          </div>
        </div>
        <div className="kn-signature-item">
          <div className="kn-sig-icon">✓</div>
          <div className="kn-sig-content">
            <strong>Extensibilité des fléchisseurs de hanche</strong>
            <p>Extension physiologique préservée en décubitus dorsal, éliminant toute compensation lordotique.</p>
          </div>
        </div>
      </div>

      <div className="kn-scapular-actions">
        {onExportPdf && (
          <button type="button" className="btn-primary is-s" onClick={onExportPdf}>
            Exporter Bilan Hanche PDF
          </button>
        )}
      </div>
    </div>
  );
}

function AnkleClinicalPanel({ onExportPdf }) {
  return (
    <div className="kn-scapular-card" data-testid="ankle-clinical-panel">
      <div className="kn-scapular-header">
        <div>
          <span className="sc-tag">Protocole WBLT / Konor</span>
          <h3 className="kn-scapular-title">Bilan Cheville, Talo-Crurale & Tendon d'Achille</h3>
          <p className="kn-scapular-sub">Dorsiflexion en charge (WBLT) et endurance du triceps sural (Heel-Rise)</p>
        </div>
        <div className="kn-severity-pill is-normal">
          Mobilité Talo-Crurale Validée
        </div>
      </div>

      <div className="kn-scapular-metrics-grid">
        <div className="kn-metric-box">
          <span className="kn-metric-label">Flexion Dorsale WBLT</span>
          <span className="kn-metric-val">39.5°</span>
          <span className="kn-metric-sub">Norme fonctionnelle{'\u00A0'}: &ge; 35°</span>
        </div>
        <div className="kn-metric-box">
          <span className="kn-metric-label">Asymétrie G/D</span>
          <span className="kn-metric-val">1.5°</span>
          <span className="kn-metric-sub">Alerte entorse récidivante si &gt; 5°</span>
        </div>
        <div className="kn-metric-box">
          <span className="kn-metric-label">Test Heel-Rise (Endurance)</span>
          <span className="kn-metric-val is-normal">28 réps</span>
          <span className="kn-metric-sub">Chute de hauteur{'\u00A0'}: 7{'\u00A0'}% (&lt; 25{'\u00A0'}%)</span>
        </div>
      </div>

      <div className="kn-signatures-list">
        <div className="kn-signature-item">
          <div className="kn-sig-icon">✓</div>
          <div className="kn-sig-content">
            <strong>Amplitude talo-crurale en chaîne fermée</strong>
            <p>Dorsiflexion supérieure à 35° bilatéralement. Mobilité suffisante pour squats profonds et réception de sauts.</p>
          </div>
        </div>
        <div className="kn-signature-item">
          <div className="kn-sig-icon">✓</div>
          <div className="kn-sig-content">
            <strong>Capacité de charge du tendon calcanéen</strong>
            <p>Maintien de la hauteur d'élévation sur plus de 25 répétitions unilatérales.</p>
          </div>
        </div>
      </div>

      <div className="kn-scapular-actions">
        {onExportPdf && (
          <button type="button" className="btn-primary is-s" onClick={onExportPdf}>
            Exporter Bilan Cheville PDF
          </button>
        )}
      </div>
    </div>
  );
}

function CervicalClinicalPanel({ onExportPdf }) {
  return (
    <div className="kn-scapular-card" data-testid="cervical-clinical-panel">
      <div className="kn-scapular-header">
        <div>
          <span className="sc-tag">Protocole Yip / CVA</span>
          <h3 className="kn-scapular-title">Bilan Rachis Cervical & Céphalées Cervicogéniques</h3>
          <p className="kn-scapular-sub">Angle Cranio-Vertébral (CVA), projection céphalique et rotations</p>
        </div>
        <div className="kn-severity-pill is-normal">
          Posture Cranio-Cervicale Alignée
        </div>
      </div>

      <div className="kn-scapular-metrics-grid">
        <div className="kn-metric-box">
          <span className="kn-metric-label">Angle Cranio-Vertébral</span>
          <span className="kn-metric-val">53.8°</span>
          <span className="kn-metric-sub">Norme clinique{'\u00A0'}: &ge; 50°</span>
        </div>
        <div className="kn-metric-box">
          <span className="kn-metric-label">Projection de la Tête</span>
          <span className="kn-metric-val is-normal">Minimale</span>
          <span className="kn-metric-sub">Pas de surcharge facettaire C1-C3</span>
        </div>
        <div className="kn-metric-box">
          <span className="kn-metric-label">Symétrie de Rotation</span>
          <span className="kn-metric-val">94{'\u00A0'}%</span>
          <span className="kn-metric-sub">Asymétrie &lt; 10° bilatérale</span>
        </div>
      </div>

      <div className="kn-signatures-list">
        <div className="kn-signature-item">
          <div className="kn-sig-icon">✓</div>
          <div className="kn-sig-content">
            <strong>Alignement tragus-acromion (C7)</strong>
            <p>Angle CVA physiologique supérieur à 50°. Équilibre sagittal cranio-cervical préservé.</p>
          </div>
        </div>
        <div className="kn-signature-item">
          <div className="kn-sig-icon">✓</div>
          <div className="kn-sig-content">
            <strong>Mobilité rotatoire C1-C2</strong>
            <p>Rotations libres et symétriques éliminant le risque de névralgie cervicogénique d'Arnold.</p>
          </div>
        </div>
      </div>

      <div className="kn-scapular-actions">
        {onExportPdf && (
          <button type="button" className="btn-primary is-s" onClick={onExportPdf}>
            Exporter Bilan Cervical PDF
          </button>
        )}
      </div>
    </div>
  );
}

function ShoulderClinicalPanel({ onExportPdf }) {
  return (
    <div className="kn-scapular-card" data-testid="shoulder-clinical-panel">
      <div className="kn-scapular-header">
        <div>
          <span className="sc-tag">Protocole McClure / SDT</span>
          <h3 className="kn-scapular-title">Bilan Épaule & Cinématique Scapulaire</h3>
          <p className="kn-scapular-sub">Détection du Shrug Sign, lâchage excentrique et asymétrie bilatérale</p>
        </div>
        <div className="kn-severity-pill is-normal">
          Rythme Scapulaire Normal
        </div>
      </div>

      <div className="kn-scapular-metrics-grid">
        <div className="kn-metric-box">
          <span className="kn-metric-label">Élévation G / D</span>
          <span className="kn-metric-val">168° / 165°</span>
          <span className="kn-metric-sub">Scaption maximale</span>
        </div>
        <div className="kn-metric-box">
          <span className="kn-metric-label">Indice d'Asymétrie (ASI)</span>
          <span className="kn-metric-val is-normal">1.8{'\u00A0'}%</span>
          <span className="kn-metric-sub">Seuil critique{'\u00A0'}: &gt; 15{'\u00A0'}%</span>
        </div>
        <div className="kn-metric-box">
          <span className="kn-metric-label">Fluidité Excentrique</span>
          <span className="kn-metric-val is-normal">92 / 100</span>
          <span className="kn-metric-sub">Pas de décrochage 120°-60°</span>
        </div>
      </div>

      <div className="kn-signatures-list">
        <div className="kn-signature-item">
          <div className="kn-sig-icon">✓</div>
          <div className="kn-sig-content">
            <strong>Haussement du trapèze (Shrug Sign)</strong>
            <p>Activation précoce du trapèze supérieure absente. Coaptation gléno-humérale physiologique.</p>
          </div>
        </div>
        <div className="kn-signature-item">
          <div className="kn-sig-icon">✓</div>
          <div className="kn-sig-content">
            <strong>Contrôle de la sonnette scapulaire</strong>
            <p>Dentelé antérieur et trapèze inférieur fonctionnels lors de la phase excentrique de descente.</p>
          </div>
        </div>
      </div>

      <div className="kn-scapular-actions">
        {onExportPdf && (
          <button type="button" className="btn-primary is-s" onClick={onExportPdf}>
            Exporter Bilan Épaule PDF
          </button>
        )}
      </div>
    </div>
  );
}
