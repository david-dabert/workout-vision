/**
 * bdkReportGenerator.ts
 *
 * Automated BDK (Bilan Diagnostic Kinésithérapique) Report Generator.
 * Tailored for French clinical practice and Monsieur Lamine (Client Zéro).
 *
 * Generates an objective, printable 1-page clinical document summarizing
 * bilateral ROM deficits, Kibler scapular dyskinesis grade, shrug sign %,
 * and actionable clinical recommendations for referring physicians.
 */

export interface BdkPatientData {
  patientInitials: string;
  age?: number;
  gender?: 'M' | 'F' | 'Other';
  dominantSide: 'right' | 'left';
  affectedSide: 'right' | 'left';
  clinicalDiagnosis: string;
  date: string;
}

export interface BdkPractitionerData {
  name: string;
  title: string; // e.g. "Masseur-Kinésithérapeute D.E."
  clinicName?: string;
  city?: string;
  rppsNumber?: string;
}

export interface BdkMobilityMeasurement {
  movementNameFr: string;
  movementNameEn: string;
  healthySideRomDegrees: number;
  affectedSideRomDegrees: number;
  deficitDegrees: number;
  deficitPercent: number;
  symmetryIndexPercent: number;
}

export interface BdkScapularDyskinesis {
  kiblerGrade: 'Normal' | 'Grade I' | 'Grade II' | 'Grade III';
  shrugSignPositive: boolean;
  shrugSignOnsetAngleDegrees?: number;
  eccentricDysrhythmia: boolean;
  wingingObserved: boolean;
}

export interface BdkReportData {
  practitioner: BdkPractitionerData;
  patient: BdkPatientData;
  measurements: BdkMobilityMeasurement[];
  dyskinesis: BdkScapularDyskinesis;
  clinicalConclusionsFr: string[];
  therapeuticPlanFr: string[];
}

/**
 * Calculates bilateral mobility deficits between healthy and affected limbs.
 */
export function calculateMobilityMetric(
  movementNameFr: string,
  movementNameEn: string,
  healthyRom: number,
  affectedRom: number
): BdkMobilityMeasurement {
  const healthy = Math.max(1, Math.round(healthyRom));
  const affected = Math.max(0, Math.round(affectedRom));
  const deficit = Math.max(0, healthy - affected);
  const deficitPct = Math.round((deficit / healthy) * 100);
  const symmetry = Math.max(0, Math.min(100, Math.round((affected / healthy) * 100)));

  return {
    movementNameFr,
    movementNameEn,
    healthySideRomDegrees: healthy,
    affectedSideRomDegrees: affected,
    deficitDegrees: deficit,
    deficitPercent: deficitPct,
    symmetryIndexPercent: symmetry,
  };
}

/**
 * Compiles a structured BDK Report object.
 */
export function compileBdkReport(params: {
  practitioner: BdkPractitionerData;
  patient: BdkPatientData;
  measurements: BdkMobilityMeasurement[];
  dyskinesis: BdkScapularDyskinesis;
}): BdkReportData {
  const conclusions: string[] = [];
  const plan: string[] = [];

  // Automated clinical synthesis
  const highDeficit = params.measurements.find(m => m.deficitPercent >= 25);
  if (highDeficit) {
    conclusions.push(
      `Déficit de mobilité significatif sur ${highDeficit.movementNameFr} (${highDeficit.deficitDegrees}\u00B0, -${highDeficit.deficitPercent}% vs côté sain).`
    );
  }

  if (params.dyskinesis.kiblerGrade !== 'Normal') {
    conclusions.push(
      `Dyskinésie scapulaire ${params.dyskinesis.kiblerGrade} avec ${params.dyskinesis.wingingObserved ? 'décollement médial (winging)' : 'asynchronisme dynamique'}.`
    );
  }

  if (params.dyskinesis.shrugSignPositive) {
    conclusions.push(
      `Signe du moignon d\u2019épaule positif (élévation précoce du trapèze supérieur dès ${params.dyskinesis.shrugSignOnsetAngleDegrees || 45}\u00B0 d\u2019abduction).`
    );
    plan.push(
      'Inhibition active et étirement du trapèze supérieur et élévateur de la scapula.'
    );
  }

  plan.push('Renforcement ciblé des rotateurs externes (infra-épineux, petit rond) et abaisseurs (serratus anterior).');
  plan.push('Rééducation proprioceptive en chaîne cinétique fermée et ouverte sous contrôle miroir.');

  return {
    practitioner: params.practitioner,
    patient: params.patient,
    measurements: params.measurements,
    dyskinesis: params.dyskinesis,
    clinicalConclusionsFr: conclusions,
    therapeuticPlanFr: plan,
  };
}

/**
 * Generates an executive, printable HTML string for browser print or PDF rendering.
 */
export function generateBdkPrintHtml(report: BdkReportData): string {
  const measurementRows = report.measurements
    .map(
      m => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: 500;">${m.movementNameFr}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${m.healthySideRomDegrees}&deg;</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center; color: #b91c1c; font-weight: bold;">${m.affectedSideRomDegrees}&deg;</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">-${m.deficitDegrees}&deg; (${m.deficitPercent}%)</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${m.symmetryIndexPercent}%</td>
      </tr>
    `
    )
    .join('');

  const conclusionsList = report.clinicalConclusionsFr
    .map(c => `<li style="margin-bottom: 4px;">${c}</li>`)
    .join('');

  const planList = report.therapeuticPlanFr
    .map(p => `<li style="margin-bottom: 4px;">${p}</li>`)
    .join('');

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Bilan Diagnostic Kinésithérapique : ${report.patient.patientInitials}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.4; padding: 24px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 20px; color: #0f172a; margin-bottom: 4px; border-bottom: 2px solid #3b82f6; padding-bottom: 6px; }
    .header-table { width: 100%; margin-bottom: 20px; font-size: 13px; }
    .header-table td { vertical-align: top; }
    .metric-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    .metric-table th { background-color: #f1f5f9; padding: 8px; border: 1px solid #cbd5e1; text-align: center; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge-alert { background-color: #fee2e2; color: #991b1b; }
    .section-title { font-size: 15px; font-weight: bold; color: #1e3a8a; margin-top: 16px; margin-bottom: 6px; }
    .footer { font-size: 11px; color: #64748b; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 8px; text-align: center; }
  </style>
</head>
<body>
  <h1>Bilan Diagnostic Kinésithérapique (BDK) : Épaule</h1>
  
  <table class="header-table">
    <tr>
      <td style="width: 50%;">
        <strong>Praticien\u00A0:</strong> ${report.practitioner.name}<br>
        <em>${report.practitioner.title}</em><br>
        ${report.practitioner.clinicName ? `${report.practitioner.clinicName}<br>` : ''}
        ${report.practitioner.rppsNumber ? `N&deg; RPPS\u00A0: ${report.practitioner.rppsNumber}` : ''}
      </td>
      <td style="width: 50%; text-align: right;">
        <strong>Patient\u00A0:</strong> ${report.patient.patientInitials}<br>
        <strong>Date d\u2019évaluation\u00A0:</strong> ${report.patient.date}<br>
        <strong>Côté pathologique\u00A0:</strong> ${report.patient.affectedSide === 'right' ? 'Droit' : 'Gauche'} (dominant\u00A0: ${report.patient.dominantSide === 'right' ? 'Droit' : 'Gauche'})<br>
        <strong>Diagnostic\u00A0:</strong> ${report.patient.clinicalDiagnosis}
      </td>
    </tr>
  </table>

  <div class="section-title">1. Mesures Angulaires et Déficits Bilatéraux</div>
  <table class="metric-table">
    <thead>
      <tr>
        <th>Mouvement Analysé</th>
        <th>Côté Sain</th>
        <th>Côté Atteint</th>
        <th>Déficit</th>
        <th>Indice de Symétrie</th>
      </tr>
    </thead>
    <tbody>
      ${measurementRows}
    </tbody>
  </table>

  <div class="section-title">2. Évaluation de la Dyskinésie Scapulaire (Classification de Kibler)</div>
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 13px; margin-bottom: 16px;">
    <strong>Grade Kibler\u00A0:</strong> <span class="badge ${report.dyskinesis.kiblerGrade !== 'Normal' ? 'badge-alert' : ''}">${report.dyskinesis.kiblerGrade}</span><br>
    <strong>Signe du moignon d\u2019épaule (Shrug Sign)\u00A0:</strong> ${report.dyskinesis.shrugSignPositive ? `<span class="badge badge-alert">POSITIF (dès ${report.dyskinesis.shrugSignOnsetAngleDegrees || 45}&deg;)</span>` : 'Négatif'}<br>
    <strong>Dysrythmie excentrique (abaissement)\u00A0:</strong> ${report.dyskinesis.eccentricDysrhythmia ? 'Présente' : 'Absente'}<br>
    <strong>Décollement scapulaire (Winging)\u00A0:</strong> ${report.dyskinesis.wingingObserved ? 'Présent' : 'Absent'}
  </div>

  <div class="section-title">3. Conclusions Cliniques & Orientations Thérapeutiques</div>
  <ul style="font-size: 13px; padding-left: 20px;">
    ${conclusionsList}
  </ul>

  <div class="section-title">4. Objectifs de Rééducation Programmés</div>
  <ul style="font-size: 13px; padding-left: 20px;">
    ${planList}
  </ul>

  <div class="footer">
    Document édité le ${report.patient.date} via Workout Vision On-Device Kinematics &middot; Conforme CNIL/RGPD (zéro transfert vidéo externe).
  </div>
</body>
</html>
  `.trim();
}
