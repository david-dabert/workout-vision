import { afterEach, describe, expect, it, vi } from 'vitest';
import { generatePessacDossierHtml, exportPessacDossier } from '../../../lib/kine/pessacDossierExport';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Pessac Clinic 8-Pole Clinical Dossier Export', () => {
  const poles = ['shoulder', 'knee', 'lumbar', 'hip', 'ankle', 'cervical', 'hand', 'foot'];

  for (const pole of poles) {
    it(`generates a valid, complete BDK printable HTML for specialty ${pole}`, () => {
      const html = generatePessacDossierHtml(pole, {
        nom: 'Dupont',
        prenom: 'Alexandre',
        prescripteur: 'Dr. Martin',
        numDossier: 'PES-TEST-001',
      });

      // Header and clinic branding
      expect(html).toContain('Clinique de Kinésithérapie de Pessac');
      expect(html).toContain('Bilan Diagnostic Kinésithérapique');
      expect(html).toContain('PES-TEST-001');
      expect(html).toContain('Dupont Alexandre');

      // Medical compliance
      expect(html).toContain('Mesures Cinématiques Objectivées');
      expect(html).toContain('Fondement Scientifique &amp; Littérature Peer-Reviewed');
      expect(html).toContain('Visa du Médecin Prescripteur');
    });
  }

  it('triggers browser window print when exportPessacDossier is invoked', () => {
    const mockPrint = vi.fn();
    const mockFocus = vi.fn();
    const mockWrite = vi.fn();
    const mockClose = vi.fn();
    const mockOpen = vi.fn();

    const mockWindow = {
      document: {
        open: mockOpen,
        write: mockWrite,
        close: mockClose,
      },
      focus: mockFocus,
      print: mockPrint,
    };

    vi.stubGlobal('window', {
      open: vi.fn(() => mockWindow),
    });

    exportPessacDossier('knee', { nom: 'Test', prenom: 'Patient' });

    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(mockWrite).toHaveBeenCalled();
    expect(mockFocus).toHaveBeenCalled();
    expect(mockPrint).toHaveBeenCalled();
  });
});
