import { describe, it, expect } from 'vitest';
import { generateCoachingContract } from '../coachContracts';

describe('French Legal Coaching Contract Generator', () => {
  it('generates fully compliant coaching contract with mandatory EI prefix, 24h cancellation, and sports card', () => {
    const contract = generateCoachingContract({
      contractNumber: 'CTR-2026-789',
      issueDate: '2026-10-13',
      coach: {
        name: 'Thomas Martin',
        siret: '842 918 203 00018',
        address: '12 Boulevard Voltaire, 75011 Paris',
        cartePro: 'ED-75-2023-09418',
        rcpPro: 'MACSF Sport Pro N° 4920184',
        gymFacility: 'Basic-Fit Paris République',
      },
      client: {
        name: 'Alexandre Dupont',
        email: 'alexandre.dupont@example.com',
      },
      packageType: 'carnet_10',
      sessionsCount: 10,
      totalPriceEur: 500,
      validityMonths: 6,
    });

    expect(contract.contractNumber).toBe('CTR-2026-789');
    expect(contract.contractText).toContain('EI Thomas Martin'); // Décret 2022-725
    expect(contract.contractText).toContain('842 918 203 00018'); // SIRET
    expect(contract.contractText).toContain('ED-75-2023-09418'); // Carte Pro DRAJES
    expect(contract.contractText).toContain('MACSF Sport Pro N° 4920184'); // RCP Pro
    expect(contract.contractText).toContain('Basic-Fit Paris République');
    expect(contract.contractText).toContain('500 € TTC');
    expect(contract.contractText).toContain('24 heures'); // Politique d'annulation 24h
    expect(contract.contractText).toContain('RGPD');
    expect(contract.htmlContent).toContain('EI Thomas Martin');
  });
});
