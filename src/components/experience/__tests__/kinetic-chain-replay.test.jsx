import { describe, it, expect } from 'vitest';
import { generatePessacDossierHtml } from '../../../lib/kine/pessacDossierExport';

describe('Kinetic chain sequencing in Pessac Clinic dossier & replay integration', () => {
  it('injects kinetic chain sequencing telemetry and hip shoot fault status into Pessac lumbar dossier', () => {
    const htmlWithFault = generatePessacDossierHtml('lumbar', {
      nom: 'Dupont',
      prenom: 'Alexandre',
      dynamicTelemetry: {
        kineticSequencingIndex: 62,
        hipShootFault: true,
      },
    });

    expect(htmlWithFault).toContain('62\u00A0% KSEI');
    expect(htmlWithFault).toContain('Décrochage pelvien (Positif)');
    expect(htmlWithFault).not.toContain('\u2014');

    const htmlOptimal = generatePessacDossierHtml('lumbar', {
      nom: 'Martin',
      prenom: 'Claire',
      dynamicTelemetry: {
        kineticSequencingIndex: 91,
        hipShootFault: false,
      },
    });

    expect(htmlOptimal).toContain('91\u00A0% KSEI');
    expect(htmlOptimal).toContain('Négative (Verrouillée)');
    expect(htmlOptimal).not.toContain('\u2014');
  });

  it('contains zero em-dashes in generated dossier markup across all specialties', () => {
    for (const spec of ['lumbar', 'knee', 'shoulder', 'hip', 'ankle']) {
      const html = generatePessacDossierHtml(spec, {
        dynamicTelemetry: {
          kineticSequencingIndex: 88,
          hipShootFault: false,
          valgusDeg: 5.2,
          symmetryIndex: 94,
        },
      });
      expect(html).not.toContain('\u2014');
    }
  });
});
