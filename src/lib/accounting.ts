/**
 * The coach's office (CoachSuite.jsx, Comptabilité): a simulator of a micro-entrepreneur's month, and the invoice
 * model, both for an éducateur sportif in micro-BNC under the VAT franchise.
 *
 * Honesty pass of 14 October 2026 (wave 2B, ACC-1 to ACC-6, INV-1 to INV-6): no identity defaults (the code's fake
 * SIRET, carte pro and insurer are gone); an invoice is refused while a required field is empty, and says which; the
 * rates come from the dated table below; the réel / SASU branch, the made-up income tax (8 % of 66 %, 5 %), the hidden
 * 80 € of costs, the SMIC target and the seasonal factors are gone (each UNSOURCED); one rule for the month and the year.
 * This is a simulator, not an accountant: every screen that shows it says so.
 */

/**
 * The rates and thresholds, as found on official domains on 14 October 2026 (search results; the pages themselves were
 * not opened by us). Status: literature. Check them by hand before relying on them, and again every 1 January and
 * 1 July. Professions libérales non réglementées affiliated to the SSI only (not CIPAV); ACRE is not computed.
 */
export const RATES = Object.freeze({
  /** The day these values were read. */
  readOn: '2026-10-14',
  /** Micro-entrepreneur, BNC, liberal profession under the SSI: social contribution on turnover, from 1 January 2026.
   *  Source: urssaf.fr (taux de cotisations des micro-entrepreneurs). Status: literature (page not opened by us). */
  ssiBnc: 0.256,
  ssiBncFrom: '2026-01-01',
  /** Contribution à la formation professionnelle, liberal professions: 0.2 % of turnover. Source: urssaf.fr.
   *  Status: literature (page not opened by us). */
  cfp: 0.002,
  /** Versement libératoire de l'impôt sur le revenu, BNC: 2.2 % of turnover, open when the household's 2024 reference
   *  income is at most 29 315 € per part (2026 limit). Source: impots.gouv.fr. Status: literature (page not opened). */
  versementLiberatoire: 0.022,
  versementLiberatoireIncomeLimitPerPart: 29315,
  /** The year of the reference income that limit applies to; shown under the toggle (CoachAccounting.jsx). */
  versementLiberatoireIncomeYear: 2024,
  /** Micro-BNC turnover ceiling for 2026 to 2028. Source: economie.gouv.fr; BOFiP BOI-BAREME-000044.
   *  Status: literature (page not opened by us). */
  microBncCeiling: 83600,
  /** VAT franchise for services since 1 January 2025: 37 500 € (base) and 41 250 € (increased) of yearly turnover.
   *  Source: CGI art. 293 B; BOFiP BOI-TVA-DECLA-40-10-10. Status: literature (pages not opened by us). */
  vatFranchiseBase: 37500,
  vatFranchiseIncreased: 41250,
});

const round2 = (x: number) => Math.round(x * 100) / 100;
const positive = (x: unknown) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Number(x) : 0);

export interface MonthInput {
  sessionPrice: number;
  sessionsPerMonth: number;
  rent?: number;
  otherCosts?: number;
  versementLiberatoire?: boolean;
}

export type YearWarning = 'vat-base' | 'vat-increased' | 'micro-ceiling';

export interface MonthSimulation {
  turnover: number;
  ssi: number;
  cfp: number;
  contributions: number;
  /** Only with the versement libératoire chosen; otherwise null: income tax depends on the household. */
  incomeTax: number | null;
  costs: number;
  /** Turnover minus contributions, costs and (with the versement libératoire) its tax. */
  estimate: number;
  /** Sessions a month that cover the rent and the other costs, by the same rule; 0 when there are none. */
  breakEvenSessions: number;
  yearTurnover: number;
  warnings: YearWarning[];
}

/** One month at the coach's own values, and the same month twelve times. Nothing here is measured: it is arithmetic
 *  on the values typed, with the rates of RATES. */
export function simulateCoachMonth(input: MonthInput): MonthSimulation {
  const price = positive(input.sessionPrice), sessions = positive(input.sessionsPerMonth);
  const turnover = round2(price * sessions);
  const ssi = round2(turnover * RATES.ssiBnc), cfp = round2(turnover * RATES.cfp);
  const contributions = round2(ssi + cfp);
  const incomeTax = input.versementLiberatoire ? round2(turnover * RATES.versementLiberatoire) : null;
  const costs = round2(positive(input.rent) + positive(input.otherCosts));
  const estimate = round2(turnover - contributions - costs - (incomeTax ?? 0));
  const keptPerSession = price * (1 - RATES.ssiBnc - RATES.cfp - (input.versementLiberatoire ? RATES.versementLiberatoire : 0));
  const breakEvenSessions = costs <= 0 ? 0 : keptPerSession > 0 ? Math.ceil(costs / keptPerSession - 1e-9) : Infinity;
  const yearTurnover = round2(turnover * 12);
  const warnings: YearWarning[] = [];
  if (yearTurnover > RATES.vatFranchiseIncreased) warnings.push('vat-increased');
  else if (yearTurnover > RATES.vatFranchiseBase) warnings.push('vat-base');
  if (yearTurnover > RATES.microBncCeiling) warnings.push('micro-ceiling');
  return { turnover, ssi, cfp, contributions, incomeTax, costs, estimate, breakEvenSessions, yearTurnover, warnings };
}

/** A date as YYYY-MM-DD in the phone's own time zone (an invoice dated in UTC was a day early after midnight in France). */
export function localIsoDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A YYYY-MM-DD date as a French invoice writes it (14/10/2026), or as English does (14 Oct 2026). */
export function paperDate(iso: string, fr = true): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  if (fr) return `${m[3]}/${m[2]}/${m[1]}`;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** An amount as French writes it, 1 234,50 € (narrow and plain no-break spaces), or English, €1,234.50; digits: 2
 *  on paper, 0 for the simulator's round figures. A negative amount takes the minus sign. */
export function euros(x: number, fr = true, digits = 2): string {
  const v = digits ? round2(Number(x) || 0) : Math.round(Number(x) || 0);
  const sign = v < 0 ? '−' : '';
  const abs = Math.abs(v);
  if (!fr) return `${sign}€${abs.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  const [int, dec] = abs.toFixed(digits).split('.');
  return `${sign}${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${dec ? `,${dec}` : ''} €`;
}

/**
 * Whether a SIRET is well formed: 14 digits whose Luhn key holds (INSEE's check for SIREN and SIRET; status:
 * convention, rule not fetched here). Fourteen times the same digit is refused. La Poste's establishments follow
 * another rule and are refused; no coach is one.
 */
export function isValidSiret(raw: string): boolean {
  const s = String(raw || '').replace(/\s+/g, '');
  if (!/^\d{14}$/.test(s) || /^(\d)\1{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = Number(s[13 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

/** The name with the mention "EI" the Code de commerce asks of an individual entrepreneur before or after it (décret
 *  2022-725, art. R123-237 C. com.; status: literature, text not opened by us), unless it is already there. */
export function eiName(name: string): string {
  const n = String(name || '').trim();
  if (!n) return '';
  return /(^|\s)EI(\s|$)|entrepreneur individuel/i.test(n) ? n : `EI ${n}`;
}

export interface CoachIdentity {
  name?: string;
  siret?: string;
  address?: string;
  cartePro?: string;
  rcpPro?: string;
  gym?: string;
  mediator?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export type ClientKind = 'particulier' | 'professionnel';
export type PaymentTerm = 'reception' | 'days30';

export interface InvoiceInput {
  coach: CoachIdentity;
  client: { name?: string; address?: string; kind?: ClientKind };
  items: InvoiceItem[];
  serviceDate?: string;
  issueDate?: string;
  payment?: PaymentTerm;
}

/** The fields an invoice cannot be issued without, in the order the screen lists them. */
export type MissingField = 'coachName' | 'siret' | 'coachAddress' | 'cartePro' | 'clientName' | 'clientAddress' | 'description' | 'price' | 'serviceDate';

export interface Invoice {
  number: string;
  issueDate: string;
  serviceDate: string;
  dueDate: string;
  payment: PaymentTerm;
  coach: { name: string; legalName: string; siret: string; address: string; cartePro: string; rcpPro: string; gym: string };
  client: { name: string; address: string; kind: ClientKind };
  items: InvoiceItem[];
  total: number;
  mentions: string[];
}

const text = (s?: string) => String(s || '').trim();

/**
 * What an invoice still lacks, or [] when it can be issued. Required: the coach's name, a SIRET whose key holds, the
 * coach's address and carte professionnelle (no paid coaching without it, L212-11 Code du sport as the audit had it;
 * text not opened by us), the client's name and address, what was sold, a price and the date of the service
 * (art. 242 nonies A, annexe II CGI; L441-9 C. com.; status: literature, texts not opened by us).
 */
export function invoiceMissing(input: InvoiceInput): MissingField[] {
  const out: MissingField[] = [];
  if (!text(input.coach?.name)) out.push('coachName');
  if (!isValidSiret(text(input.coach?.siret))) out.push('siret');
  if (!text(input.coach?.address)) out.push('coachAddress');
  if (!text(input.coach?.cartePro)) out.push('cartePro');
  if (!text(input.client?.name)) out.push('clientName');
  if (!text(input.client?.address)) out.push('clientAddress');
  const items = input.items || [];
  if (!items.length || items.some(i => !text(i.description))) out.push('description');
  if (!items.length || items.some(i => !(Number(i.quantity) > 0) || !(Number(i.unitPrice) > 0))) out.push('price');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(input.serviceDate))) out.push('serviceDate');
  return out;
}

/**
 * The invoice of a micro-entrepreneur under the VAT franchise, or null while a required field is missing
 * (invoiceMissing) or without a number. number: the next of the phone's sequence (coachStorage.issueInvoiceNumber),
 * never reused. Mentions (status: literature, texts not opened by us): "TVA non applicable, art. 293 B du CGI"; one
 * payment term; for a business client only, the late-payment penalties (L441-10 C. com.), the 40 € recovery
 * indemnity (D441-5 C. com.) and the discount line (L441-9 C. com.). The carte pro and the insurance are printed as
 * the coach typed them, the insurance and the place of work only when typed.
 */
export function buildInvoice(input: InvoiceInput, number: string): Invoice | null {
  if (!number || invoiceMissing(input).length) return null;
  const issueDate = input.issueDate || localIsoDate();
  const payment: PaymentTerm = input.payment === 'days30' ? 'days30' : 'reception';
  let dueDate = issueDate;
  if (payment === 'days30') {
    const [y, m, d] = issueDate.split('-').map(Number);
    dueDate = localIsoDate(new Date(y, m - 1, d + 30));
  }
  const kind: ClientKind = input.client.kind === 'professionnel' ? 'professionnel' : 'particulier';
  const items = input.items.map(i => ({ description: text(i.description), quantity: Number(i.quantity), unitPrice: round2(Number(i.unitPrice)) }));
  const total = round2(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  // French copy below: awaiting David's approval (R10).
  const mentions = ['TVA non applicable, art. 293 B du CGI'];
  mentions.push(payment === 'reception'
    ? 'Paiement à réception de la facture.'
    : `Paiement à 30 jours, au plus tard le ${paperDate(dueDate)}.`);
  if (kind === 'professionnel') {
    mentions.push('Pénalités de retard\u00A0: trois fois le taux d’intérêt légal (art. L441-10 du Code de commerce).');
    mentions.push('Indemnité forfaitaire pour frais de recouvrement\u00A0: 40\u00A0€ (art. D441-5 du Code de commerce).');
    mentions.push('Escompte pour paiement anticipé\u00A0: néant.');
  }
  return {
    number, issueDate, serviceDate: text(input.serviceDate), dueDate, payment,
    coach: {
      name: text(input.coach.name), legalName: eiName(text(input.coach.name)), siret: text(input.coach.siret).replace(/\s+/g, ''),
      address: text(input.coach.address), cartePro: text(input.coach.cartePro), rcpPro: text(input.coach.rcpPro), gym: text(input.coach.gym),
    },
    client: { name: text(input.client.name), address: text(input.client.address), kind },
    items, total, mentions,
  };
}

/** The SIRET as it is printed: 3 3 3 5 digits. */
export const siretText = (s: string) => String(s || '').replace(/\s+/g, '').replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, '$1 $2 $3 $4');

/** The invoice as plain text, line by line: what "Copier le texte" puts on the clipboard and the PDF sets. French
 *  only: the invoice is a French document. French copy awaiting David's approval (R10). */
export function invoiceLines(inv: Invoice): string[] {
  const lines = [
    `FACTURE N° ${inv.number}`,
    `Date d’émission\u00A0: ${paperDate(inv.issueDate)}`,
    `Date de la prestation\u00A0: ${paperDate(inv.serviceDate)}`,
    '',
    inv.coach.legalName,
    `SIRET\u00A0: ${siretText(inv.coach.siret)}`,
    inv.coach.address,
    `Carte professionnelle d’éducateur sportif n° ${inv.coach.cartePro}`,
  ];
  if (inv.coach.rcpPro) lines.push(`Assurance responsabilité civile professionnelle\u00A0: ${inv.coach.rcpPro}`);
  if (inv.coach.gym) lines.push(`Lieu d’exercice\u00A0: ${inv.coach.gym}`);
  lines.push('', `Client\u00A0: ${inv.client.name}`, inv.client.address, '');
  for (const i of inv.items) lines.push(`${i.description}\u00A0: ${i.quantity} × ${euros(i.unitPrice)} = ${euros(i.quantity * i.unitPrice)}`);
  lines.push('', `Total à payer (TVA non applicable)\u00A0: ${euros(inv.total)}`, '', ...inv.mentions);
  return lines;
}

/**
 * A credit note (avoir) that cancels an issued invoice in full (second review of 14 October 2026, INV-3: an issued
 * invoice could be neither cancelled nor corrected). The invoice is kept as issued, never deleted or renumbered; the
 * avoir has its own number in its own sequence (A-2026-0001…, coachStorage.issueCreditNoteNumber) and names the
 * invoice it cancels. Status: convention (French invoicing practice; UNSOURCED here, to check with the accountant).
 * Only an invoice not yet paid is cancelled this way: a refund is not handled.
 */
export interface CreditNote {
  kind: 'avoir';
  number: string;
  issueDate: string;
  cancels: string;
  cancelsDate: string;
  coach: Invoice['coach'];
  client: Invoice['client'];
  items: InvoiceItem[];
  total: number;
  mentions: string[];
}

export function buildCreditNote(inv: Invoice, number: string, issueDate: string = localIsoDate()): CreditNote | null {
  if (!inv || !number) return null;
  // French copy: awaiting David's approval (R10).
  return {
    kind: 'avoir', number, issueDate, cancels: inv.number, cancelsDate: inv.issueDate,
    coach: { ...inv.coach }, client: { ...inv.client }, items: inv.items.map(i => ({ ...i })), total: inv.total,
    mentions: [`Avoir annulant la facture n° ${inv.number} du ${paperDate(inv.issueDate)}.`, 'TVA non applicable, art. 293 B du CGI'],
  };
}

/** The credit note as plain text, line by line, as invoiceLines does for an invoice. French awaiting David's approval. */
export function creditNoteLines(cn: CreditNote): string[] {
  const lines = [
    `AVOIR N° ${cn.number}`,
    `Date d’émission\u00A0: ${paperDate(cn.issueDate)}`,
    `Annule la facture n° ${cn.cancels} du ${paperDate(cn.cancelsDate)}`,
    '',
    cn.coach.legalName,
    `SIRET\u00A0: ${siretText(cn.coach.siret)}`,
    cn.coach.address,
    `Carte professionnelle d’éducateur sportif n° ${cn.coach.cartePro}`,
  ];
  if (cn.coach.rcpPro) lines.push(`Assurance responsabilité civile professionnelle\u00A0: ${cn.coach.rcpPro}`);
  if (cn.coach.gym) lines.push(`Lieu d’exercice\u00A0: ${cn.coach.gym}`);
  lines.push('', `Client\u00A0: ${cn.client.name}`, cn.client.address, '');
  for (const i of cn.items) lines.push(`${i.description}\u00A0: ${i.quantity} × ${euros(i.unitPrice)} = ${euros(i.quantity * i.unitPrice)}`);
  lines.push('', `Montant de l’avoir (TVA non applicable)\u00A0: ${euros(cn.total)}`, '', ...cn.mentions);
  return lines;
}

/** A rate as the screen writes it, from RATES (so the words cannot drift from the arithmetic): 25,6 % or 25.6%. */
export function ratePct(rate: number, fr = true): string {
  const v = Math.round(rate * 1000) / 10;
  return fr ? `${String(v).replace('.', ',')}\u00A0%` : `${v}%`;
}

export type PaymentMode = 'virement' | 'carte' | 'cheque' | 'especes';
export const PAYMENT_MODES: PaymentMode[] = ['virement', 'carte', 'cheque', 'especes'];
export const PAYMENT_MODE_FR: Record<PaymentMode, string> = { virement: 'Virement', carte: 'Carte bancaire', cheque: 'Chèque', especes: 'Espèces' };

export interface ReceiptRow {
  paidOn: string;
  number: string;
  client: string;
  nature: string;
  amount: number;
  mode: PaymentMode;
}

/**
 * The receipts book as CSV, for a spreadsheet set in French: a byte-order mark so the accents survive, ";" between
 * fields and a decimal comma. Only money actually received goes in (micro-BNC: the receipts of the year, CGI art.
 * 102 ter as the audit had it; status: literature, text not opened by us). An empty book gives the header alone.
 */
export function receiptsCsv(rows: ReceiptRow[]): string {
  const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const header = 'Date d’encaissement;N° de facture;Client;Nature de la prestation;Montant encaissé (€);Mode de règlement';
  const lines = rows.map(r => [r.paidOn, r.number, q(r.client), q(r.nature), round2(r.amount).toFixed(2).replace('.', ','), PAYMENT_MODE_FR[r.mode] || r.mode].join(';'));
  return '\uFEFF' + [header, ...lines].join('\r\n');
}
