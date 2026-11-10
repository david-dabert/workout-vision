import { describe, it, expect } from 'vitest';
import { generatePessacDossierHtml } from '../../../lib/kine/pessacDossierExport';

describe('Lumbopelvic rhythm in Pessac Clinic dossier & replay integration', () => {
  it('injects lumbopelvic stability index and butt-wink fault status into Pessac lumbar dossier', () => {
    const htmlWithFault = generatePessacDossierHtml('lumbar', {
      nom: 'Bernard',
      prenom: 'Julien',
      dynamicTelemetry: {
        lumbopelvicStabilityIndex: 58,
        buttWinkFault: true,
        barbellTiltDeg: 5.4,
        barbellTiltFault: true,
      },
    });

    expect(htmlWithFault).toContain('58\u00A0% LSI (Rétroversion/Butt Wink)');
    expect(htmlWithFault).toContain('5.4\u00A0° (Asymétrie/Couple)');
    expect(htmlWithFault).not.toContain('\u2014');

    const htmlNeutral = generatePessacDossierHtml('lumbar', {
      nom: 'Lambert',
      prenom: 'Sophie',
      dynamicTelemetry: {
        lumbopelvicStabilityIndex: 94,
        buttWinkFault: false,
      },
    });

    expect(htmlNeutral).toContain('94\u00A0% LSI (Neutre)');
    expect(htmlNeutral).not.toContain('\u2014');
  });

  it('contains zero em-dashes across all dossier specialties when telemetry is populated', () => {
    for (const spec of ['lumbar', 'knee', 'shoulder', 'hip', 'ankle']) {
      const html = generatePessacDossierHtml(spec, {
        dynamicTelemetry: {
          lumbopelvicStabilityIndex: 90,
          buttWinkFault: false,
          kineticSequencingIndex: 88,
          hipShootFault: false,
          valgusDeg: 4.8,
          symmetryIndex: 96,
        },
      });
      expect(html).not.toContain('\u2014');
    }
  });
});
