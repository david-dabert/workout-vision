import { describe, it, expect } from 'vitest';
import {
  createPrescription,
  verifyPrescriptionCode,
  generateClinicalExecutiveSummary,
  type SessionTelemetryPayload,
} from '../kinePrescription';

describe('Kine Prescription Suite (Monsieur Lamine Client Zéro Protocol)', () => {
  const dummyRx = createPrescription({
    accessCode: 'LAMINE-402',
    practitionerName: 'Monsieur Lamine',
    practitionerId: 'kine_paris_01',
    patientId: 'pat_david_001',
    patientInitials: 'D.D.',
    diagnosis: 'Conflit sous-acromial & dyskinesie scapulaire',
    frequencyPerWeek: 3,
    exercises: [
      {
        exerciseId: 'rotation-externe',
        name: 'Shoulder External Rotation',
        nameFr: 'Rotation Externe Épaule',
        targetSets: 3,
        targetReps: 10,
        targetRomDegrees: 85,
        bilateralComparison: true,
      },
    ],
  });

  it('validates correct access code case-insensitively and rejects invalid codes', () => {
    expect(verifyPrescriptionCode('lamine-402', dummyRx)).toBe(true);
    expect(verifyPrescriptionCode('LAMINE-402', dummyRx)).toBe(true);
    expect(verifyPrescriptionCode('WRONG-999', dummyRx)).toBe(false);
    expect(verifyPrescriptionCode('', dummyRx)).toBe(false);
  });

  it('generates clinical summary with optimal progress on compliant, symmetric sessions', () => {
    const logs: SessionTelemetryPayload[] = [
      {
        sessionId: 's1',
        prescriptionId: dummyRx.prescriptionId,
        completedAt: '2026-11-02T10:00:00Z',
        exerciseId: 'rotation-externe',
        completedSets: 3,
        completedReps: 10,
        maxRomDegrees: 70,
        bilateralSymmetryPct: 88,
        shrugSignCount: 1,
        eccentricControlScore: 0.9,
        painRatingEva: 2,
      },
      {
        sessionId: 's2',
        prescriptionId: dummyRx.prescriptionId,
        completedAt: '2026-11-04T10:00:00Z',
        exerciseId: 'rotation-externe',
        completedSets: 3,
        completedReps: 10,
        maxRomDegrees: 76,
        bilateralSymmetryPct: 90,
        shrugSignCount: 0,
        eccentricControlScore: 0.92,
        painRatingEva: 1,
      },
      {
        sessionId: 's3',
        prescriptionId: dummyRx.prescriptionId,
        completedAt: '2026-11-06T10:00:00Z',
        exerciseId: 'rotation-externe',
        completedSets: 3,
        completedReps: 10,
        maxRomDegrees: 84,
        bilateralSymmetryPct: 92,
        shrugSignCount: 0,
        eccentricControlScore: 0.95,
        painRatingEva: 1,
      },
    ];

    const summary = generateClinicalExecutiveSummary(dummyRx, logs);
    expect(summary.complianceRatePct).toBe(100);
    expect(summary.romGainDegrees).toBe(14);
    expect(summary.meanSymmetryPct).toBe(90);
    expect(summary.clinicalStatus).toBe('RECOVERING_OPTIMAL');
  });

  it('triggers compensation alert when excessive shrug signs or low symmetry are recorded', () => {
    const logs: SessionTelemetryPayload[] = [
      {
        sessionId: 's1',
        prescriptionId: dummyRx.prescriptionId,
        completedAt: '2026-11-02T10:00:00Z',
        exerciseId: 'rotation-externe',
        completedSets: 3,
        completedReps: 10,
        maxRomDegrees: 60,
        bilateralSymmetryPct: 62,
        shrugSignCount: 8,
        eccentricControlScore: 0.5,
        painRatingEva: 4,
      },
    ];

    const summary = generateClinicalExecutiveSummary(dummyRx, logs);
    expect(summary.clinicalStatus).toBe('COMPENSATION_ALERT');
    expect(summary.actionableNotesFr).toContain('Alerte compensation');
  });
});
