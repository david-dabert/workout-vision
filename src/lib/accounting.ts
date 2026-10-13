/**
 * Freelance Fitness Coach & Personal Trainer Accounting Engine
 *
 * Implements French fiscal and social contribution rules:
 * - Basic-Fit monthly rent tracking (€650/month default)
 * - Micro-entreprise (BNC) URSSAF social charges (21.1% default, 23.1% without ACRE)
 * - Franchise en base de TVA (Art. 293 B du CGI) vs. EI Réel / Société (20% TVA)
 * - Break-even session threshold calculator
 * - French legal compliant invoice generator (Art. L441-9 Code de Commerce & Art. 242 nonies A CGI)
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
    siret: string;
    address: string;
    email?: string;
    phone?: string;
    gymFacility?: string;
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

export const DEFAULT_BUSINESS_CONFIG: BusinessConfig = {
  gymBrand: 'Basic-Fit',
  monthlyRent: 650,
  regime: 'micro',
  urssafRate: 0.211,
  cfpRate: 0.002,
  averageSessionPrice: 50,
  monthlySessionsCount: 40,
  otherMonthlyExpenses: 80, // RC Pro, apps, gear
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
 * Generates a legally compliant French invoice according to Art. L441-9 Code de Commerce.
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

  const legalMentions: string[] = [];

  if (regime === 'micro') {
    // Obligatory mention for micro-entrepreneurs exempt from TVA
    legalMentions.push('TVA non applicable, art. 293 B du CGI');
  }

  // Statutory French payment & late fee mentions
  legalMentions.push('Paiement à réception par virement bancaire ou carte bancaire.');
  legalMentions.push('Pénalités de retard applicables de plein droit en cas de retard de paiement au taux de 3 fois le taux d’intérêt légal.');
  legalMentions.push('Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement\u00A0: 40\u00A0€ (Art. D441-5 C. com.).');

  return {
    invoiceNumber: data.invoiceNumber || `F-${new Date().getFullYear()}-001`,
    issueDate,
    dueDate,
    coach: {
      name: data.coach.name || 'Coach Indépendant',
      siret: data.coach.siret || 'En cours d’immatriculation',
      address: data.coach.address || 'France',
      email: data.coach.email,
      phone: data.coach.phone,
      gymFacility: data.coach.gymFacility || 'Basic-Fit',
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
