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
    expect(htmlDefault).toContain('4.8°');

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
});
