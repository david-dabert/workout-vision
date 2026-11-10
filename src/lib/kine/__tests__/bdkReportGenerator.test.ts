import { describe, it, expect } from 'vitest';
import {
  calculateMobilityMetric,
  compileBdkReport,
  generateBdkPrintHtml,
  type BdkPatientData,
  type BdkPractitionerData,
} from '../bdkReportGenerator';

describe('BDK Report Generator (Monsieur Lamine Paris Protocol)', () => {
  const dummyPractitioner: BdkPractitionerData = {
    name: 'Monsieur Lamine',
    title: 'Masseur-Kinésithérapeute D.E.',
    clinicName: 'Cabinet de Kinésithérapie du Sport : Paris',
    city: 'Paris',
    rppsNumber: '10004928172',
  };

  const dummyPatient: BdkPatientData = {
    patientInitials: 'D.D.',
    dominantSide: 'right',
    affectedSide: 'right',
    clinicalDiagnosis: 'Conflit sous-acromial avec dyskinésie scapulaire',
    date: '2026-11-10',
  };

  it('accurately calculates deficit degrees, deficit percentage, and symmetry index', () => {
    // Healthy: 160 deg, Affected: 120 deg -> Deficit: 40 deg (25%), Symmetry: 75%
    const metric = calculateMobilityMetric(
      'Abduction gléno-humérale',
      'Glenohumeral Abduction',
      160,
      120
    );

    expect(metric.healthySideRomDegrees).toBe(160);
    expect(metric.affectedSideRomDegrees).toBe(120);
    expect(metric.deficitDegrees).toBe(40);
    expect(metric.deficitPercent).toBe(25);
    expect(metric.symmetryIndexPercent).toBe(75);
  });

  it('compiles BDK report with automatic clinical conclusions on positive shrug sign', () => {
    const measurements = [
      calculateMobilityMetric('Abduction', 'Abduction', 160, 110),
      calculateMobilityMetric('Rotation Externe', 'External Rotation', 80, 50),
    ];

    const report = compileBdkReport({
      practitioner: dummyPractitioner,
      patient: dummyPatient,
      measurements,
      dyskinesis: {
        kiblerGrade: 'Grade II',
        shrugSignPositive: true,
        shrugSignOnsetAngleDegrees: 40,
        eccentricDysrhythmia: true,
        wingingObserved: true,
      },
    });

    expect(report.clinicalConclusionsFr.some(c => c.includes('Signe du moignon'))).toBe(true);
    expect(report.clinicalConclusionsFr.some(c => c.includes('Grade II'))).toBe(true);
    expect(report.therapeuticPlanFr.some(p => p.includes('serratus anterior'))).toBe(true);
  });

  it('generates well-formatted HTML containing practitioner and patient metadata', () => {
    const measurements = [
      calculateMobilityMetric('Abduction', 'Abduction', 160, 110),
    ];

    const report = compileBdkReport({
      practitioner: dummyPractitioner,
      patient: dummyPatient,
      measurements,
      dyskinesis: {
        kiblerGrade: 'Grade I',
        shrugSignPositive: false,
        eccentricDysrhythmia: false,
        wingingObserved: false,
      },
    });

    const html = generateBdkPrintHtml(report);
    expect(html).toContain('Monsieur Lamine');
    expect(html).toContain('D.D.');
    expect(html).toContain('160&deg;');
    expect(html).toContain('110&deg;');
  });
});
