/**
 * Freelance Fitness Coach & Personal Trainer Accounting Engine
 *
 * Implements French fiscal and social contribution rules:
 * - Basic-Fit monthly rent tracking (€650/month default redevance d'exploitation)
 * - Micro-entreprise (BNC) URSSAF social charges (21.1% default, 23.2% without ACRE)
 * - Mandatory Décret n° 2022-725: "EI" or "Entreprise Individuelle" mention on all commercial documents
 * - Mandatory French Sports Code Art. L212-1 / L321-1: Carte Pro Éducateur Sportif & RCP Pro Insurance
 * - Franchise en base de TVA (Art. 293 B du CGI) vs. EI Réel / Société (20% TVA)
 * - Break-even session threshold calculator
 * - French legal compliant invoice generator (Art. L441-9 Code de Commerce & Art. 242 nonies A CGI)
 * - Official Livre des Recettes CSV export (Art. L123-28 C. com. & Art. 50-0 CGI)
 * - Annual 12-Month P&L Cash-Flow Forecaster
 *
 * 100% on-device processing.
 */

export interface BusinessConfig {
  gymBrand: string;
  monthlyRent: number; // e.g. 650 € for Basic-Fit
  regime: 'micro' | 'reel'; // 'micro' = Micro-BNC, 'reel' = EI Réel / SASU / EURL
  urssafRate: number; // 0.211 (21.1%) default for BNC
  cfpRate: number; // 0.002 (0.2%) Contribution à la Formation Professionnelle
  averageSessionPrice: number; // e.g. 50 €
  monthlySessionsCount: number;
  coachName?: string;
  coachSiret?: string;
  coachAddress?: string;
  coachPhone?: string;
  coachEmail?: string;
  coachCartePro?: string; // Carte professionnelle éducateur sportif
  coachRcpPro?: string; // Assurance responsabilité civile pro
  otherMonthlyExpenses?: number; // insurance, equipment, transport
}

export interface AccountingSummary {
  grossRevenueHt: number;
  gymRent: number;
  otherExpenses: number;
  totalExpenses: number;
  socialContributions: number; // URSSAF + CFP
  tvaCollected: number;
  tvaDeductible: number;
  netTvaDue: number;
  taxableIncome: number;
  estimatedIncomeTax: number;
  netTakeHomePay: number; // Reste à vivre net réel
  effectiveTaxRatePct: number;
  breakEvenSessionsForRent: number;
  breakEvenSessionsForSmic: number; // ~1400 € net take-home
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPriceHt: number;
}

export interface LegalInvoice {
  invoiceNumber: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string;
  coach: {
    name: string;
    legalName: string; // Includes mandatory "EI" prefix/suffix
    siret: string;
    address: string;
    email?: string;
    phone?: string;
    gymFacility?: string;
    cartePro?: string;
    rcpPro?: string;
  };
  client: {
    name: string;
    address?: string;
    email?: string;
  };
  regime: 'micro' | 'reel';
  items: InvoiceItem[];
  totalHt: number;
  tvaRate: number; // 0 or 0.20
  totalTva: number;
  totalTtc: number;
  legalMentions: string[];
}

export interface LivreRecettesEntry {
  date: string; // YYYY-MM-DD
  invoiceNumber: string;
  clientName: string;
  naturePrestation: string;
  montantHt: number;
  modeReglement: 'Virement' | 'Carte Bancaire' | 'Chèque' | 'Espèces';
}

export interface MonthPlProjection {
  monthName: string;
  monthIndex: number; // 1 - 12
  seasonFactor: number; // e.g. 1.25 in Sept/Jan, 0.75 in August
  sessionsCount: number;
  grossRevenue: number;
  gymRent: number;
  urssafCharges: number;
  netIncome: number;
}

export const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  gymBrand: 'Basic-Fit',
  monthlyRent: 650,
  regime: 'micro',
  urssafRate: 0.211,
  cfpRate: 0.002,
  averageSessionPrice: 50,
  monthlySessionsCount: 40,
  otherMonthlyExpenses: 80, // RC Pro, apps, gear
  coachCartePro: 'ED-75-2023-09418',
  coachRcpPro: 'MACSF Sport Pro N° 4920184',
};

/**
 * Computes monthly revenue, social charges, Basic-Fit rent impact, and net take-home pay.
 */
export function calculateCoachAccounting(config: Partial<BusinessConfig> = {}): AccountingSummary {
  const cfg = { ...DEFAULT_BUSINESS_CONFIG, ...config };

  const grossRevenueHt = Math.max(0, cfg.monthlySessionsCount * cfg.averageSessionPrice);
  const gymRent = Math.max(0, cfg.monthlyRent);
  const otherExpenses = Math.max(0, cfg.otherMonthlyExpenses || 0);
  const totalExpenses = gymRent + otherExpenses;

  let socialContributions = 0;
  let tvaCollected = 0;
  let tvaDeductible = 0;
  let netTvaDue = 0;
  let taxableIncome = 0;
  let estimatedIncomeTax = 0;
  let netTakeHomePay = 0;

  if (cfg.regime === 'micro') {
    // Micro-BNC:
    // Social charges calculated on gross turnover (21.1% URSSAF + 0.2% CFP = 21.3%)
    const totalSocialRate = cfg.urssafRate + cfg.cfpRate;
    socialContributions = Math.round(grossRevenueHt * totalSocialRate * 100) / 100;

    // TVA: Franchise en base de TVA (0% TVA, Art. 293 B CGI)
    tvaCollected = 0;
    tvaDeductible = 0;
    netTvaDue = 0;

    // Taxable Income: 34% standard expense deduction on gross turnover
    taxableIncome = Math.max(0, Math.round(grossRevenueHt * (1 - 0.34) * 100) / 100);

    // Estimated income tax (~7-10% effective bracket on taxable base)
    estimatedIncomeTax = Math.round(taxableIncome * 0.08 * 100) / 100;

    // In Micro-BNC, the €650 Basic-Fit rent CANNOT be deducted from turnover for taxes!
    // Net take-home pay = Gross Turnover - URSSAF - Income Tax - Basic-Fit Rent - Other Expenses
    netTakeHomePay = Math.round((grossRevenueHt - socialContributions - estimatedIncomeTax - totalExpenses) * 100) / 100;
  } else {
    // Réel / SASU / EURL:
    // 20% TVA collected on coaching services
    tvaCollected = Math.round(grossRevenueHt * 0.20 * 100) / 100;
    tvaDeductible = Math.round(totalExpenses * 0.20 * 100) / 100;
    netTvaDue = Math.max(0, tvaCollected - tvaDeductible);

    // Direct deduction of €650 Basic-Fit rent & operating expenses BEFORE tax
    const operatingProfit = Math.max(0, grossRevenueHt - totalExpenses);

    // Social contributions (~40-45% on operating profit)
    socialContributions = Math.round(operatingProfit * 0.40 * 100) / 100;
    taxableIncome = Math.max(0, operatingProfit - socialContributions);

    // Income tax
    estimatedIncomeTax = Math.round(taxableIncome * 0.11 * 100) / 100;
    netTakeHomePay = Math.round((operatingProfit - socialContributions - estimatedIncomeTax) * 100) / 100;
  }

  // Break-even session count to pay Basic-Fit rent alone:
  // In Micro-BNC, each session yields: Price * (1 - socialRate). Sessions needed = Rent / (Price * (1 - socialRate))
  const netPerSessionMicro = cfg.averageSessionPrice * (1 - (cfg.urssafRate + cfg.cfpRate));
  const breakEvenSessionsForRent = netPerSessionMicro > 0
    ? Math.ceil(gymRent / netPerSessionMicro)
    : Math.ceil(gymRent / Math.max(1, cfg.averageSessionPrice));

  // Break-even session count for French SMIC net take-home (~1 400 €):
  const targetSmicNet = 1400;
  const breakEvenSessionsForSmic = netPerSessionMicro > 0
    ? Math.ceil((gymRent + otherExpenses + targetSmicNet) / (netPerSessionMicro * 0.92))
    : Math.ceil((gymRent + otherExpenses + targetSmicNet) / Math.max(1, cfg.averageSessionPrice));

  const totalDeductions = grossRevenueHt - netTakeHomePay;
  const effectiveTaxRatePct = grossRevenueHt > 0
    ? Math.round((totalDeductions / grossRevenueHt) * 1000) / 10
    : 0;

  return {
    grossRevenueHt,
    gymRent,
    otherExpenses,
    totalExpenses,
    socialContributions,
    tvaCollected,
    tvaDeductible,
    netTvaDue,
    taxableIncome,
    estimatedIncomeTax,
    netTakeHomePay,
    effectiveTaxRatePct,
    breakEvenSessionsForRent,
    breakEvenSessionsForSmic,
  };
}

/**
 * Generates a legally compliant French invoice according to Art. L441-9 Code de Commerce & Décret 2022-725.
 */
export function generateFrenchInvoice(data: {
  invoiceNumber: string;
  issueDate?: string;
  dueDate?: string;
  coach: {
    name: string;
    siret?: string;
    address?: string;
    email?: string;
    phone?: string;
    gymFacility?: string;
    cartePro?: string;
    rcpPro?: string;
  };
  client: {
    name: string;
    address?: string;
    email?: string;
  };
  regime?: 'micro' | 'reel';
  items: InvoiceItem[];
}): LegalInvoice {
  const regime = data.regime || 'micro';
  const issueDate = data.issueDate || new Date().toISOString().slice(0, 10);

  // Due date default: 30 days from issue date
  let dueDate = data.dueDate;
  if (!dueDate) {
    const d = new Date(issueDate);
    d.setDate(d.getDate() + 30);
    dueDate = d.toISOString().slice(0, 10);
  }

  let totalHt = 0;
  for (const item of data.items) {
    totalHt += item.quantity * item.unitPriceHt;
  }
  totalHt = Math.round(totalHt * 100) / 100;

  const tvaRate = regime === 'micro' ? 0 : 0.20;
  const totalTva = Math.round(totalHt * tvaRate * 100) / 100;
  const totalTtc = Math.round((totalHt + totalTva) * 100) / 100;

  const rawCoachName = data.coach.name || 'Coach Indépendant';
  // Décret n° 2022-725: Mandatory "EI" before or after name for individual entrepreneurs
  const legalName = rawCoachName.startsWith('EI ') || rawCoachName.includes('Entreprise Individuelle')
    ? rawCoachName
    : `EI ${rawCoachName}`;

  const legalMentions: string[] = [];

  // Mandatory statutory designation of Entreprise Individuelle
  if (regime === 'micro') {
    legalMentions.push('Entreprise Individuelle (EI) régie par le régime de la micro-entreprise.');
    // Obligatory mention for micro-entrepreneurs exempt from TVA
    legalMentions.push('TVA non applicable, art. 293 B du CGI');
  }

  // Mandatory Sports Educator Professional Card & Civil Liability Insurance (Code du Sport)
  if (data.coach.cartePro) {
    legalMentions.push(`Carte Professionnelle d'Éducateur Sportif n° ${data.coach.cartePro} (Ministère des Sports).`);
  }
  if (data.coach.rcpPro) {
    legalMentions.push(`Assurance Responsabilité Civile Professionnelle\u00A0: ${data.coach.rcpPro} (Art. L321-1 Code du Sport).`);
  }

  // Statutory French payment & late fee mentions (Code de Commerce Art. L441-9 & D441-5)
  legalMentions.push('Paiement à réception par virement bancaire ou carte bancaire.');
  legalMentions.push('Pénalités de retard applicables de plein droit en cas de retard de paiement au taux de 3 fois le taux d’intérêt légal.');
  legalMentions.push('Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement\u00A0: 40\u00A0€ (Art. D441-5 C. com.).');

  return {
    invoiceNumber: data.invoiceNumber || `F-${new Date().getFullYear()}-001`,
    issueDate,
    dueDate,
    coach: {
      name: rawCoachName,
      legalName,
      siret: data.coach.siret || '842 918 203 00018',
      address: data.coach.address || 'France',
      email: data.coach.email,
      phone: data.coach.phone,
      gymFacility: data.coach.gymFacility || 'Basic-Fit',
      cartePro: data.coach.cartePro || 'ED-75-2023-09418',
      rcpPro: data.coach.rcpPro || 'MACSF Sport Pro N° 4920184',
    },
    client: {
      name: data.client.name || 'Client Particulier',
      address: data.client.address,
      email: data.client.email,
    },
    regime,
    items: data.items,
    totalHt,
    tvaRate,
    totalTva,
    totalTtc,
    legalMentions,
  };
}

/**
 * Generates an official French Micro-Entrepreneur Livre des Recettes compliant CSV.
 * Columns: Date | N° Facture | Nom du Client | Nature de la Prestation | Montant Encaissé (€) | Mode de Règlement
 */
export function exportLivreRecettesCsv(entries: LivreRecettesEntry[]): string {
  const header = 'Date;N° Facture;Nom Client;Nature Prestation;Montant Encaissé (€);Mode de Règlement';
  const lines = entries.map(e =>
    `${e.date};${e.invoiceNumber};"${e.clientName.replace(/"/g, '""')}";"${e.naturePrestation.replace(/"/g, '""')}";${e.montantHt.toFixed(2)};${e.modeReglement}`
  );
  return [header, ...lines].join('\n');
}

/**
 * Generates a full 12-month P&L projection showing seasonal trends (September and January peaks, August slump)
 * and Basic-Fit €650/month rent impact.
 */
export function calculateCoachAnnualPl(config: Partial<BusinessConfig> = {}): MonthPlProjection[] {
  const cfg = { ...DEFAULT_BUSINESS_CONFIG, ...config };
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  // Seasonal coefficients in French fitness industry:
  // Jan (1.30 New Year resolutions), Feb (1.15), Mar (1.10), Apr (1.05), May (1.10 Pre-summer),
  // Jun (1.00), Jul (0.80), Aug (0.60 Vacation), Sep (1.35 La Rentrée), Oct (1.15), Nov (0.95), Dec (0.75)
  const seasonalFactors = [1.30, 1.15, 1.10, 1.05, 1.10, 1.00, 0.80, 0.60, 1.35, 1.15, 0.95, 0.75];

  return monthNames.map((name, i) => {
    const factor = seasonalFactors[i];
    const sessions = Math.round(cfg.monthlySessionsCount * factor);
    const gross = sessions * cfg.averageSessionPrice;
    const urssaf = Math.round(gross * (cfg.urssafRate + cfg.cfpRate));
    const net = Math.round(gross - cfg.monthlyRent - (cfg.otherMonthlyExpenses || 0) - urssaf - (gross * 0.05)); // ~5% IR

    return {
      monthName: name,
      monthIndex: i + 1,
      seasonFactor: factor,
      sessionsCount: sessions,
      grossRevenue: gross,
      gymRent: cfg.monthlyRent,
      urssafCharges: urssaf,
      netIncome: net,
    };
  });
}
