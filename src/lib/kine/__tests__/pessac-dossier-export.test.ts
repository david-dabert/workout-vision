import { describe, it, expect } from 'vitest';
import { generatePessacDossierHtml, PESSAC_SPECIALTIES } from '../pessacDossierExport';

describe('Pessac 8-Pole Clinical Dossier Export', () => {
  it('defines all 8 clinical specialty poles', () => {
    expect(PESSAC_SPECIALTIES.length).toBe(8);
    const ids = PESSAC_SPECIALTIES.map(p => p.id);
    expect(ids).toContain('shoulder');
    expect(ids).toContain('knee');
    expect(ids).toContain('lumbar');
    expect(ids).toContain('hip');
    expect(ids).toContain('ankle');
    expect(ids).toContain('cervical');
    expect(ids).toContain('hand');
    expect(ids).toContain('foot');
  });

  it('generates clinical dossier HTML with default and dynamic telemetry metrics', () => {
    const htmlDefault = generatePessacDossierHtml('knee', { nom: 'Dupont', prenom: 'Jean' });
    expect(htmlDefault).toContain('Bilan Diagnostic Kinésithérapique');
    expect(htmlDefault).toContain('Dupont Jean');
    expect(htmlDefault).toContain('Valgus Dynamique Max');
    // The example values of SPECIALTY_META are never printed as a patient's; no prescriber is invented (R8).
    expect(htmlDefault).not.toContain('4.8°');
    expect(htmlDefault).toContain('Non mesuré');
    expect(htmlDefault).not.toContain('Dr. J. Martin');
    expect(htmlDefault).toContain('Aucune mesure n’a été réalisée pour ce bilan.');

    const htmlDynamic = generatePessacDossierHtml('knee', {
      nom: 'Dupont',
      prenom: 'Jean',
      dynamicTelemetry: {
        valgusDeg: 6.2,
        symmetryIndex: 94.5,
        flessumDeg: 0.5,
      },
    });

    expect(htmlDynamic).toContain('6.2°');
    expect(htmlDynamic).toContain('94.5\u00A0%');
    expect(htmlDynamic).toContain('0.5°');
  });

  it('generates shoulder dossier HTML with scapular dyskinesis dynamic telemetry', () => {
    const htmlShoulder = generatePessacDossierHtml('shoulder', {
      nom: 'Martin',
      prenom: 'Claire',
      dynamicTelemetry: {
        shrugDetected: true,
        eccentricDropDetected: true,
        scapularClassification: 'Grade II (Bord Médial)',
      },
    });

    expect(htmlShoulder).toContain('Martin Claire');
    expect(htmlShoulder).toContain('Positif (Haussement actif)');
    expect(htmlShoulder).toContain('Décrochage détecté');
    expect(htmlShoulder).toContain('Grade II (Bord Médial) (SDT)');
  });
});
