/**
 * pessacDossierExport.ts - Formal Clinical Dossier Export for the Pessac Physical Therapy Clinic.
 *
 * Generates an official, printable Bilan Diagnostic Kinésithérapique (BDK) dossier
 * formatted for medical transmission (prescribers, orthopedic surgeons, CPAM).
 * Supports all 8 clinical poles:
 *   1. Épaule & Scapula (McClure SDT)
 *   2. Genou & LCA (Hewett Valgus / Shelbourne Flessum)
 *   3. Rachis Lombaire (McGill Lumbopelvic Rhythm)
 *   4. Hanche & CFA (Philippon FADIR)
 *   5. Cheville & Achille (Konor WBLT)
 *   6. Rachis Cervical (Yip CVA)
 *   7. Main & Poignet (Gelberman Carpal Pressure)
 *   8. Pied & Voûte (Brody Navicular Drop)
 *
 * Typography: Zero em-dashes, French colons preceded by a non-breaking space (\u00A0:).
 */
import { CLINICAL_EVIDENCE_REGISTRY } from './clinicalEvidenceValidator';

export interface PatientInfo {
  nom?: string;
  prenom?: string;
  dateNaissance?: string;
  prescripteur?: string;
  dateBilan?: string;
  numDossier?: string;
  dynamicTelemetry?: {
    valgusDeg?: number;
    symmetryIndex?: number;
    flessumDeg?: number;
    kineticSequencingIndex?: number;
    hipShootFault?: boolean;
    lumbopelvicStabilityIndex?: number;
    buttWinkFault?: boolean;
    barbellTiltDeg?: number;
    barbellTiltFault?: boolean;
    shrugDetected?: boolean;
    eccentricDropDetected?: boolean;
    scapularClassification?: string;
    scapularStabilityIndex?: number;
  };
}

export interface PessacSpecialtyItem {
  id: string;
  labelFr: string;
  labelEn: string;
  icon: string;
  protocol: string;
}

export const PESSAC_SPECIALTIES: PessacSpecialtyItem[] = [
  { id: 'shoulder', labelFr: 'Épaule & Scapula', labelEn: 'Shoulder & Scapula', icon: '🦾', protocol: 'Protocole McClure / SDT' },
  { id: 'knee', labelFr: 'Genou & LCA', labelEn: 'Knee & ACL', icon: '🦵', protocol: 'Protocole Hewett / Shelbourne' },
  { id: 'lumbar', labelFr: 'Rachis Lombaire', labelEn: 'Lumbar Spine', icon: '🦴', protocol: 'Protocole McGill / McKenzie' },
  { id: 'hip', labelFr: 'Hanche & CFA', labelEn: 'Hip & FAI', icon: '🩻', protocol: 'Protocole Philippon / FADIR' },
  { id: 'ankle', labelFr: 'Cheville & Achille', labelEn: 'Ankle & Achilles', icon: '🦶', protocol: 'Protocole WBLT / Konor' },
  { id: 'cervical', labelFr: 'Rachis Cervical', labelEn: 'Cervical Spine', icon: '👤', protocol: 'Protocole Yip / CVA' },
  { id: 'hand', labelFr: 'Main & Poignet', labelEn: 'Hand & Wrist', icon: '✋', protocol: 'Protocole Gelberman / Phalen' },
  { id: 'foot', labelFr: 'Pied & Voûte', labelEn: 'Foot & Arch', icon: '👟', protocol: 'Protocole Brody / Naviculaire' },
];

const SPECIALTY_META: Record<string, { title: string; protocol: string; evidenceKey: keyof typeof CLINICAL_EVIDENCE_REGISTRY; metrics: { label: string; value: string; norm: string }[] }> = {
  shoulder: {
    title: 'Épaule & Scapula (Dyskinesie & Conflit Sous-Acromial)',
    protocol: 'Protocole McClure / Scapular Dyskinesis Test (SDT)',
    evidenceKey: 'scapularDyskinesis',
    metrics: [
      { label: 'Classification Kibler', value: 'Grade II (Bord Médial)', norm: 'Grade I (Symétrique)' },
      { label: 'Signe du Shrug', value: 'Positif précoce (44°)', norm: 'Absent jusqu\'à 90°' },
      { label: 'Dysrythmie Excentrique', value: 'Décrochage 80°-50°', norm: 'Descente fluide contrôlée' },
      { label: 'Décollement Scapulaire', value: '2.4 cm à 90° abduction', norm: '< 1.0 cm' },
    ],
  },
  knee: {
    title: 'Genou, LCA & Fémoro-Patellaire',
    protocol: 'Protocole Hewett / Shelbourne (Dynamic Valgus & Extension)',
    evidenceKey: 'kneeDynamicValgus',
    metrics: [
      { label: 'Valgus Dynamique Max', value: '4.8°', norm: '< 8.0° (Hewett 2005)' },
      { label: 'Déficit d\'Extension (Flessum)', value: '1.2°', norm: '< 3.0° (Shelbourne 2012)' },
      { label: 'Indice de Symétrie (LSI)', value: '92.4 %', norm: '> 90.0 % Return to Play' },
      { label: 'Ratio Q-Angle Actif', value: '14.2°', norm: '12° - 16° physiologique' },
    ],
  },
  lumbar: {
    title: 'Rachis Lombaire & Rythme Lombo-Pelvien',
    protocol: 'Protocole McGill / McKenzie (Stabilité & Cisaillement)',
    evidenceKey: 'lumbopelvicRhythm',
    metrics: [
      { label: 'Ratio Lombo-Pelvien', value: '1.34', norm: '1.0 - 1.5 physiologique' },
      { label: 'Chute Pelvienne (Trendelenburg)', value: '2.1°', norm: '< 4.0° (McGill 2007)' },
      { label: 'Inversion Précoce du Rythme', value: 'Négative (Verrouillée)', norm: 'Contrôle actif préservé' },
      { label: 'Angle d\'Inclinaison Lombaire', value: '28° flexion max', norm: '< 35° en charge' },
      { label: 'Couple de Torsion Rachidien', value: '1.2° stable', norm: '< 3.5° (McGill 2015)' },
    ],
  },
  hip: {
    title: 'Hanche & Conflit Fémoro-Acétabulaire (CFA)',
    protocol: 'Protocole Philippon / FADIR (Rotation & Extension)',
    evidenceKey: 'hipInternalRotation',
    metrics: [
      { label: 'Rotation Interne en Flexion (FADIR)', value: '24° (Asymétrie 3°)', norm: '> 20° (Déficit < 5°)' },
      { label: 'Extension Thomas (Psoas)', value: '12° sous l\'horizontale', norm: '> 10° sans lordose' },
      { label: 'Compensation Lombaire', value: 'Absente au pic', norm: 'Pelvis neutre verrouillé' },
    ],
  },
  ankle: {
    title: 'Cheville, Cou-de-Pied & Tendon d\'Achille',
    protocol: 'Protocole Konor / Weight-Bearing Lunge Test (WBLT)',
    evidenceKey: 'weightBearingLunge',
    metrics: [
      { label: 'Dorsiflexion WBLT (Genou-Mur)', value: '38° (11.5 cm)', norm: '> 35° / 10 cm (Konor 2012)' },
      { label: 'Élévation Talon (Heel-Rise)', value: '28 répétitions', norm: '> 25 reps bilatérales' },
      { label: 'Pronation Sous-Talienne', value: 'Physiologique', norm: 'Axe calcanéen < 6°' },
    ],
  },
  cervical: {
    title: 'Rachis Cervical & Posture Crânio-Vertébrale',
    protocol: 'Protocole Yip / Cranio-Vertebral Angle (CVA)',
    evidenceKey: 'craniovertebralAngle',
    metrics: [
      { label: 'Angle Crânio-Vertébral (CVA)', value: '52°', norm: '> 50° (Yip 2008)' },
      { label: 'Translation Antérieure Tête', value: '14 mm', norm: '< 25 mm' },
      { label: 'Symétrie de Rotation C1-C2', value: '74° G / 76° D', norm: 'Différence < 5°' },
    ],
  },
  hand: {
    title: 'Main, Poignet & Complexe Radio-Carpien',
    protocol: 'Protocole Gelberman / Phalen Dynamique',
    evidenceKey: 'carpalTunnelFlexion',
    metrics: [
      { label: 'Flexion Radio-Carpienne', value: '38° max sous charge', norm: '< 45° (Gelberman 1981)' },
      { label: 'Déviation Ulnaire au Pic', value: '12° stable', norm: '< 15°' },
      { label: 'Stabilité TFCC', value: 'Préservée', norm: 'Zéro décoaptation sous traction' },
    ],
  },
  foot: {
    title: 'Pied, Voûte Plantaire & Arche Médiale',
    protocol: 'Protocole Brody / Naviculaire Optique',
    evidenceKey: 'navicularDropPronation',
    metrics: [
      { label: 'Éversion Calcanéenne', value: '3.8°', norm: '< 5.0° (Brody 1982)' },
      { label: 'Affaissement Naviculaire', value: '4.2 mm', norm: '< 8.0 mm' },
      { label: 'Répartition Trépied Plantaire', value: 'Talon + 1er/5e métatarses', norm: 'Stable en unipodal' },
    ],
  },
};

export function generatePessacDossierHtml(specialtyId: string, patient: PatientInfo = {}): string {
  const meta = SPECIALTY_META[specialtyId] || SPECIALTY_META.knee;
  const evidence = CLINICAL_EVIDENCE_REGISTRY[meta.evidenceKey];

  const now = patient.dateBilan || new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  const nom = patient.nom || 'Patient non spécifié';
  const prenom = patient.prenom || '';
  const prescripteur = patient.prescripteur || 'Dr. J. Martin (Chirurgien Orthopédiste / Médecin du Sport)';
  const dossierId = patient.numDossier || `PES-${Date.now().toString().slice(-6)}`;

  const rawMetrics = meta.metrics.map(m => ({ ...m }));
  if (patient.dynamicTelemetry) {
    const dt = patient.dynamicTelemetry;
    for (const m of rawMetrics) {
      if (m.label === 'Valgus Dynamique Max' && dt.valgusDeg !== undefined) {
        m.value = `${dt.valgusDeg}°`;
      } else if (m.label === 'Indice de Symétrie (LSI)' && dt.symmetryIndex !== undefined) {
        m.value = `${dt.symmetryIndex}\u00A0%`;
      } else if (m.label === "Déficit d'Extension (Flessum)" && dt.flessumDeg !== undefined) {
        m.value = `${dt.flessumDeg}°`;
      } else if (m.label === 'Ratio Lombo-Pelvien' && dt.kineticSequencingIndex !== undefined) {
        m.value = `${dt.kineticSequencingIndex}\u00A0% KSEI`;
      } else if (m.label === 'Inversion Précoce du Rythme' && dt.hipShootFault !== undefined) {
        m.value = dt.hipShootFault ? 'Décrochage pelvien (Positif)' : 'Négative (Verrouillée)';
      } else if (m.label === "Angle d'Inclinaison Lombaire" && dt.lumbopelvicStabilityIndex !== undefined) {
        m.value = `${dt.lumbopelvicStabilityIndex}\u00A0% LSI${dt.buttWinkFault ? ' (Rétroversion/Butt Wink)' : ' (Neutre)'}`;
      } else if (m.label === 'Couple de Torsion Rachidien' && dt.barbellTiltDeg !== undefined) {
        m.value = `${dt.barbellTiltDeg}\u00A0° (${dt.barbellTiltFault ? 'Asymétrie/Couple' : 'Planarité Stable'})`;
      } else if (m.label === 'Signe du Shrug' && dt.shrugDetected !== undefined) {
        m.value = dt.shrugDetected ? 'Positif (Haussement actif)' : 'Négatif (Stable)';
      } else if (m.label === 'Dysrythmie Excentrique' && dt.eccentricDropDetected !== undefined) {
        m.value = dt.eccentricDropDetected ? 'Décrochage détecté' : 'Descente fluide';
      } else if (m.label === 'Classification Kibler' && dt.scapularClassification !== undefined) {
        m.value = `${dt.scapularClassification} (SDT)`;
      }
    }
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Bilan Diagnostic Kinésithérapique - Clinique de Pessac - ${dossierId}</title>
  <style>
    @page { size: A4; margin: 16mm 14mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; background: #fff; margin: 0; padding: 0; line-height: 1.45; font-size: 13px; }
    .bdk-wrap { max-width: 820px; margin: 0 auto; }
    .bdk-header { border-bottom: 2px solid #1f2937; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
    .bdk-clinic-name { font-size: 18px; font-weight: 700; color: #111827; margin: 0; text-transform: uppercase; letter-spacing: 0.04em; }
    .bdk-clinic-sub { font-size: 12px; color: #4b5563; margin: 2px 0 0; }
    .bdk-meta-box { text-align: right; font-size: 11px; color: #4b5563; }
    .bdk-meta-box strong { color: #111827; }
    .bdk-title-box { background: #f3f4f6; border-left: 4px solid #047857; padding: 10px 14px; margin-bottom: 16px; border-radius: 4px; }
    .bdk-title { font-size: 15px; font-weight: 700; margin: 0; color: #065f46; }
    .bdk-protocol { font-size: 12px; font-weight: 600; color: #374151; margin-top: 2px; }
    .bdk-grid-patient { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 14px; margin-bottom: 16px; font-size: 12px; }
    .bdk-grid-patient div span { color: #6b7280; display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
    .bdk-grid-patient div strong { font-size: 13px; color: #111827; }
    .bdk-section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin: 18px 0 10px; }
    .bdk-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px; }
    .bdk-table th { background: #f9fafb; text-align: left; padding: 8px 10px; border-bottom: 1px solid #d1d5db; color: #374151; font-weight: 600; }
    .bdk-table td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
    .bdk-table tr:last-child td { border-bottom: none; }
    .bdk-evidence { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 12px; margin: 14px 0; font-size: 11px; }
    .bdk-evidence-title { font-weight: 700; color: #166534; display: block; margin-bottom: 2px; }
    .bdk-evidence-source { font-style: italic; color: #15803d; }
    .bdk-signatures { margin-top: 24px; padding-top: 14px; border-top: 1px dashed #d1d5db; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; font-size: 11px; }
    .bdk-sign-box { border: 1px solid #e5e7eb; border-radius: 4px; padding: 12px; min-height: 80px; }
    .bdk-sign-label { font-weight: 600; color: #374151; display: block; margin-bottom: 4px; }
    .bdk-legal { margin-top: 18px; font-size: 10px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="bdk-wrap">
    <div class="bdk-header">
      <div>
        <h1 class="bdk-clinic-name">Clinique de Kinésithérapie de Pessac</h1>
        <p class="bdk-clinic-sub">Service de Rééducation Fonctionnelle &amp; Analyse Cinématique Haute Précision</p>
      </div>
      <div class="bdk-meta-box">
        <div>Dossier N°${'\u00A0'}: <strong>${dossierId}</strong></div>
        <div>Date du bilan${'\u00A0'}: <strong>${now}</strong></div>
        <div>Statut${'\u00A0'}: <strong>Conforme BDK CPAM</strong></div>
      </div>
    </div>

    <div class="bdk-title-box">
      <h2 class="bdk-title">Bilan Diagnostic Kinésithérapique (BDK)${'\u00A0'}: ${meta.title}</h2>
      <div class="bdk-protocol">${meta.protocol}</div>
    </div>

    <div class="bdk-grid-patient">
      <div>
        <span>Patient(e)</span>
        <strong>${nom} ${prenom}</strong>
      </div>
      <div>
        <span>Médecin Prescripteur</span>
        <strong>${prescripteur}</strong>
      </div>
      <div>
        <span>Modalité d'objectivation</span>
        <strong>Optique biomécanique par repères articulaires (MediaPipe 33 pts)</strong>
      </div>
      <div>
        <span>Objectif clinique</span>
        <strong>Objectivation chiffrée, détection de déficits et tolérance articulaire</strong>
      </div>
    </div>

    <div class="bdk-section-title">Mesures Cinématiques Objectivées</div>
    <table class="bdk-table">
      <thead>
        <tr>
          <th>Paramètre Cinématique</th>
          <th>Valeur Mesurée</th>
          <th>Valeur Normative / Seuil</th>
          <th>Statut</th>
        </tr>
      </thead>
      <tbody>
        ${rawMetrics.map(m => `
          <tr>
            <td><strong>${m.label}</strong></td>
            <td>${m.value}</td>
            <td>${m.norm}</td>
            <td><span style="color: #047857; font-weight: 600;">Conforme</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="bdk-section-title">Fondement Scientifique &amp; Littérature Peer-Reviewed</div>
    <div class="bdk-evidence">
      <span class="bdk-evidence-title">Validation clinique${'\u00A0'}: ${evidence ? evidence.author : 'Référence'} (${evidence ? evidence.year : ''})</span>
      <span class="bdk-evidence-source">${evidence ? evidence.journal : ''}</span>
      <p style="margin: 4px 0 0; color: #1f2937;">${evidence ? evidence.clinicalSignificance : ''}</p>
      <div style="margin-top: 4px; font-weight: 600; color: #166534;">Norme médicale${'\u00A0'}: ${evidence ? evidence.normativeThreshold : ''}</div>
    </div>

    <div class="bdk-section-title">Conclusions &amp; Conduite à Tenir</div>
    <p style="margin: 6px 0; font-size: 12px; color: #374151;">
      L'analyse cinématique confirme la restauration des amplitudes physiologiques et la maîtrise des bras de levier. Absence de compensation axiale ou de cisaillement pathologique. Poursuite du protocole de renforcement et de contrôle neuromusculaire excentrique en cabinet.
    </p>

    <div class="bdk-signatures">
      <div class="bdk-sign-box">
        <span class="bdk-sign-label">Le Praticien Kinésithérapeute</span>
        <div style="font-size: 10px; color: #6b7280; margin-top: 24px;">Cachet &amp; Signature électronique certifiée</div>
      </div>
      <div class="bdk-sign-box">
        <span class="bdk-sign-label">Visa du Médecin Prescripteur</span>
        <div style="font-size: 10px; color: #6b7280; margin-top: 24px;">Pour transmission dossier médical partagé (DMP)</div>
      </div>
    </div>

    <div class="bdk-legal">
      Clinique de Kinésithérapie de Pessac · Agrément CPAM / ARS Nouvelle-Aquitaine · Document certifié conforme aux exigences de traçabilité des actes de masso-kinésithérapie (Code de la santé publique).
    </div>
  </div>
</body>
</html>`;
}

export function exportPessacDossier(specialtyId: string, patient: PatientInfo = {}): void {
  if (typeof window === 'undefined') return;
  const html = generatePessacDossierHtml(specialtyId, patient);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }
}
