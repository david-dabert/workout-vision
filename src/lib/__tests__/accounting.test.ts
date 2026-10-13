import { describe, it, expect } from 'vitest';
import { calculateCoachAccounting, generateFrenchInvoice } from '../accounting';

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
    // Net take home = 2000 - 426 - tax (~105.6) - 700 expenses = ~768.4 €
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
    // Operating profit = 3000 - 800 = 2200 €
    // Social contributions on operating profit = 40% of 2200 = 880 €
    expect(result.socialContributions).toBe(880);
    expect(result.netTakeHomePay).toBeGreaterThan(1000);
  });

  it('generates legally compliant French invoice with Art. 293 B CGI mention for Micro-BNC', () => {
    const invoice = generateFrenchInvoice({
      invoiceNumber: 'FAC-2026-0042',
      coach: {
        name: 'Thomas Coach',
        siret: '123 456 789 00012',
        address: '12 Rue de la République, 75011 Paris',
        gymFacility: 'Basic-Fit Paris République',
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
    expect(invoice.totalHt).toBe(280); // 4 * 55 + 60 = 280
    expect(invoice.tvaRate).toBe(0);
    expect(invoice.totalTva).toBe(0);
    expect(invoice.totalTtc).toBe(280);
    expect(invoice.legalMentions).toContain('TVA non applicable, art. 293 B du CGI');
    expect(invoice.legalMentions.some(m => m.includes('40'))).toBe(true); // Indemnité 40 €
  });

  it('generates 20% TVA invoice for EI Réel', () => {
    const invoice = generateFrenchInvoice({
      invoiceNumber: 'FAC-2026-0105',
      coach: {
        name: 'Thomas Coach Pro',
      },
      client: {
        name: 'SARL Fitness Group',
      },
      regime: 'reel',
      items: [
        { description: 'Programme Mensuel & Suivi Cinématique', quantity: 1, unitPriceHt: 200 },
      ],
    });

    expect(invoice.totalHt).toBe(200);
    expect(invoice.tvaRate).toBe(0.20);
    expect(invoice.totalTva).toBe(40);
    expect(invoice.totalTtc).toBe(240);
    expect(invoice.legalMentions).not.toContain('TVA non applicable, art. 293 B du CGI');
  });
});
