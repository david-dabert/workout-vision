/**
 * kinePrescription.ts
 *
 * Asynchronous Clinical Prescription & Telerehabilitation Protocol.
 * Co-designed for practitioners (Client Zéro: Monsieur Lamine, Paris).
 *
 * Enforces zero-video telemetry transmission: no video frames or landmark streams
 * leave the device. Only objective clinical indicators (ROM, bilateral symmetry %,
 * shrug sign count, and compliance) are summarized.
 */

export interface PrescribedExercise {
  exerciseId: string;
  name: string;
  nameFr: string;
  targetSets: number;
  targetReps: number;
  targetRomDegrees: number;
  tempoCadence?: {
    eccentricSeconds: number;
    pauseSeconds: number;
    concentricSeconds: number;
  };
  bilateralComparison: boolean;
}

export interface Prescription {
  prescriptionId: string;
  accessCode: string;
  practitionerName: string;
  practitionerId: string;
  patientId: string;
  patientInitials: string;
  diagnosis: string;
  frequencyPerWeek: number;
  createdAt: string;
  validUntil: string;
  exercises: PrescribedExercise[];
}

export interface SessionTelemetryPayload {
  sessionId: string;
  prescriptionId: string;
  completedAt: string;
  exerciseId: string;
  completedSets: number;
  completedReps: number;
  maxRomDegrees: number;
  bilateralSymmetryPct: number;
  shrugSignCount: number;
  eccentricControlScore: number; // 0 to 1
  painRatingEva: number; // 0 to 10
}

export interface ClinicalExecutiveSummary {
  prescriptionId: string;
  patientInitials: string;
  practitionerName: string;
  diagnosis: string;
  evaluatedSessionsCount: number;
  targetWeeklySessions: number;
  complianceRatePct: number;
  meanRomDegrees: number;
  romGainDegrees: number;
  meanSymmetryPct: number;
  totalShrugSignsObserved: number;
  clinicalStatus: 'RECOVERING_OPTIMAL' | 'MODERATE_PROGRESS' | 'COMPENSATION_ALERT' | 'NON_COMPLIANT';
  actionableNotesFr: string;
  actionableNotesEn: string;
}

/**
 * Creates a validated prescription instance.
 */
export function createPrescription(params: {
  accessCode: string;
  practitionerName: string;
  practitionerId: string;
  patientId: string;
  patientInitials: string;
  diagnosis: string;
  frequencyPerWeek: number;
  exercises: PrescribedExercise[];
  validDays?: number;
}): Prescription {
  const now = new Date();
  const validUntil = new Date(now.getTime() + (params.validDays || 30) * 86400000);

  return {
    prescriptionId: `rx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    accessCode: params.accessCode.toUpperCase().trim(),
    practitionerName: params.practitionerName,
    practitionerId: params.practitionerId,
    patientId: params.patientId,
    patientInitials: params.patientInitials.toUpperCase(),
    diagnosis: params.diagnosis,
    frequencyPerWeek: params.frequencyPerWeek,
    createdAt: now.toISOString(),
    validUntil: validUntil.toISOString(),
    exercises: params.exercises,
  };
}

/**
 * Verifies if an access code matches a prescription and is within validity window.
 */
export function verifyPrescriptionCode(code: string, prescription: Prescription): boolean {
  if (!code || !prescription) return false;
  const normalized = code.toUpperCase().trim();
  if (normalized !== prescription.accessCode) return false;

  const validUntilTime = new Date(prescription.validUntil).getTime();
  return Date.now() <= validUntilTime;
}

/**
 * Generates an executive clinical summary from accumulated session telemetry.
 */
export function generateClinicalExecutiveSummary(
  prescription: Prescription,
  telemetryLogs: SessionTelemetryPayload[]
): ClinicalExecutiveSummary {
  const filtered = telemetryLogs.filter(t => t.prescriptionId === prescription.prescriptionId);
  const sessionCount = filtered.length;
  const compliance = Math.min(100, Math.round((sessionCount / prescription.frequencyPerWeek) * 100));

  if (sessionCount === 0) {
    return {
      prescriptionId: prescription.prescriptionId,
      patientInitials: prescription.patientInitials,
      practitionerName: prescription.practitionerName,
      diagnosis: prescription.diagnosis,
      evaluatedSessionsCount: 0,
      targetWeeklySessions: prescription.frequencyPerWeek,
      complianceRatePct: 0,
      meanRomDegrees: 0,
      romGainDegrees: 0,
      meanSymmetryPct: 0,
      totalShrugSignsObserved: 0,
      clinicalStatus: 'NON_COMPLIANT',
      actionableNotesFr: 'Aucune séance enregistrée cette semaine. Observance nulle.',
      actionableNotesEn: 'No sessions recorded this week. Zero compliance.',
    };
  }

  const roms = filtered.map(s => s.maxRomDegrees);
  const meanRom = Math.round(roms.reduce((a, b) => a + b, 0) / roms.length);
  const initialRom = roms[0];
  const latestRom = roms[roms.length - 1];
  const romGain = Math.round(latestRom - initialRom);

  const symmetries = filtered.map(s => s.bilateralSymmetryPct);
  const meanSymmetry = Math.round(symmetries.reduce((a, b) => a + b, 0) / symmetries.length);

  const totalShrugs = filtered.reduce((acc, s) => acc + s.shrugSignCount, 0);

  let status: 'RECOVERING_OPTIMAL' | 'MODERATE_PROGRESS' | 'COMPENSATION_ALERT' | 'NON_COMPLIANT' = 'MODERATE_PROGRESS';
  if (totalShrugs > 5 || meanSymmetry < 70) {
    status = 'COMPENSATION_ALERT';
  } else if (compliance >= 80 && romGain >= 10 && meanSymmetry >= 85) {
    status = 'RECOVERING_OPTIMAL';
  }

  let notesFr = `Observance excellente (${compliance}%). Gain d\u2019amplitude de +${romGain}\u00B0 sans compensation motrice majeure.`;
  let notesEn = `Excellent compliance (${compliance}%). ROM gain of +${romGain}\u00B0 without major motor compensation.`;

  if (status === 'COMPENSATION_ALERT') {
    notesFr = `Alerte compensation\u00A0: ${totalShrugs} signes du moignon d\u2019épaule détectés avec asymétrie (${meanSymmetry}%). Risque de surmenage du trapèze supérieur. Réduire la résistance.`;
    notesEn = `Compensation alert: ${totalShrugs} shoulder shrug signs observed with asymmetry (${meanSymmetry}%). Risk of upper trapezius overuse. Reduce load.`;
  }

  return {
    prescriptionId: prescription.prescriptionId,
    patientInitials: prescription.patientInitials,
    practitionerName: prescription.practitionerName,
    diagnosis: prescription.diagnosis,
    evaluatedSessionsCount: sessionCount,
    targetWeeklySessions: prescription.frequencyPerWeek,
    complianceRatePct: compliance,
    meanRomDegrees: meanRom,
    romGainDegrees: romGain,
    meanSymmetryPct: meanSymmetry,
    totalShrugSignsObserved: totalShrugs,
    clinicalStatus: status,
    actionableNotesFr: notesFr,
    actionableNotesEn: notesEn,
  };
}
