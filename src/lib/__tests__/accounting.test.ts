import { describe, it, expect } from 'vitest';
import {
  calculateCoachAccounting,
  generateFrenchInvoice,
  exportLivreRecettesCsv,
  calculateCoachAnnualPl,
} from '../accounting';

describe('Coach Freelance Accounting & Basic-Fit Rent Simulator', () => {
  it('calculates correct Micro-BNC charges and take-home pay with €650 Basic-Fit rent', () => {
    // 40 sessions at 50 € = 2000 € gross
    const result = calculateCoachAccounting({
      monthlyRent: 650,
      regime: 'micro',
      averageSessionPrice: 50,
      monthlySessionsCount: 40,
      otherMonthlyExpenses: 50,
    });

    expect(result.grossRevenueHt).toBe(2000);
    expect(result.gymRent).toBe(650);
    // URSSAF + CFP = 21.1% + 0.2% = 21.3% of 2000 = 426 €
    expect(result.socialContributions).toBe(426);
    expect(result.tvaCollected).toBe(0);
    expect(result.netTakeHomePay).toBeGreaterThan(700);
    expect(result.netTakeHomePay).toBeLessThan(850);
    // Break-even for €650 rent: 650 / (50 * (1 - 0.213)) = 650 / 39.35 = ~17 sessions
    expect(result.breakEvenSessionsForRent).toBe(17);
  });

  it('calculates correct EI Réel deductions where €650 rent is deducted before social charges', () => {
    const result = calculateCoachAccounting({
      monthlyRent: 650,
      regime: 'reel',
      averageSessionPrice: 60,
      monthlySessionsCount: 50, // 3000 € gross
      otherMonthlyExpenses: 150, // total expenses = 800 €
    });

    expect(result.grossRevenueHt).toBe(3000);
    expect(result.tvaCollected).toBe(600); // 20%
    expect(result.tvaDeductible).toBe(160); // 20% of 800
    expect(result.netTvaDue).toBe(440);
    expect(result.socialContributions).toBe(880);
    expect(result.netTakeHomePay).toBeGreaterThan(1000);
  });

  it('generates legally compliant French invoice with mandatory EI prefix, Art. 293 B CGI, and Sports Code mentions', () => {
    const invoice = generateFrenchInvoice({
      invoiceNumber: 'FAC-2026-0042',
      coach: {
        name: 'Thomas Martin',
        siret: '123 456 789 00012',
        address: '12 Rue de la République, 75011 Paris',
        gymFacility: 'Basic-Fit Paris République',
        cartePro: 'ED-75-2023-09418',
        rcpPro: 'MACSF Sport N° 4920184',
      },
      client: {
        name: 'Alexandre Dupont',
      },
      regime: 'micro',
      items: [
        { description: 'Séance de Coaching Individuel (1h)', quantity: 4, unitPriceHt: 55 },
        { description: 'Bilan Biomécanique & Postural WorkoutVision', quantity: 1, unitPriceHt: 60 },
      ],
    });

    expect(invoice.invoiceNumber).toBe('FAC-2026-0042');
    expect(invoice.coach.legalName).toBe('EI Thomas Martin'); // Décret 2022-725 mandatory EI prefix
    expect(invoice.totalHt).toBe(280);
    expect(invoice.tvaRate).toBe(0);
    expect(invoice.totalTtc).toBe(280);
    expect(invoice.legalMentions).toContain('TVA non applicable, art. 293 B du CGI');
    expect(invoice.legalMentions.some(m => m.includes('ED-75-2023-09418'))).toBe(true);
    expect(invoice.legalMentions.some(m => m.includes('40'))).toBe(true); // Indemnité 40 €
  });

  it('generates compliant Livre des Recettes CSV file', () => {
    const entries = [
      {
        date: '2026-10-01',
        invoiceNumber: 'F-2026-001',
        clientName: 'Alexandre Dupont',
        naturePrestation: 'Pack 10 Séances Coaching Basic-Fit',
        montantHt: 500,
        modeReglement: 'Virement' as const,
      },
      {
        date: '2026-10-05',
        invoiceNumber: 'F-2026-002',
        clientName: 'Sophie Martin',
        naturePrestation: 'Séance Coaching 1h',
        montantHt: 50,
        modeReglement: 'Carte Bancaire' as const,
      },
    ];

    const csv = exportLivreRecettesCsv(entries);
    expect(csv).toContain('Date;N° Facture;Nom Client;Nature Prestation;Montant Encaissé (€);Mode de Règlement');
    expect(csv).toContain('2026-10-01;F-2026-001;"Alexandre Dupont";"Pack 10 Séances Coaching Basic-Fit";500.00;Virement');
    expect(csv).toContain('2026-10-05;F-2026-002;"Sophie Martin";"Séance Coaching 1h";50.00;Carte Bancaire');
  });

  it('projects 12-month annual P&L incorporating seasonal fitness trends', () => {
    const pl = calculateCoachAnnualPl({
      monthlyRent: 650,
      averageSessionPrice: 50,
      monthlySessionsCount: 40,
    });

    expect(pl.length).toBe(12);
    expect(pl[0].monthName).toBe('Janvier');
    expect(pl[8].monthName).toBe('Septembre');
    // September (La rentrée) is peak month factor 1.35
    expect(pl[8].seasonFactor).toBe(1.35);
    expect(pl[8].sessionsCount).toBe(54); // 40 * 1.35
    // August is vacation slump factor 0.60
    expect(pl[7].seasonFactor).toBe(0.60);
    expect(pl[7].sessionsCount).toBe(24); // 40 * 0.60
    // Every month deducts the €650 Basic-Fit rent
    expect(pl.every(m => m.gymRent === 650)).toBe(true);
  });
});
