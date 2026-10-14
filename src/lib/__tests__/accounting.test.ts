import { describe, it, expect } from 'vitest';
import {
  RATES, simulateCoachMonth, isValidSiret, eiName, invoiceMissing, buildInvoice, invoiceLines, receiptsCsv, localIsoDate, euros,
} from '../accounting';

// A SIRET made up for the tests: 14 digits whose Luhn key holds, matching no company we know of.
const SIRET = '12345678901237';
const COACH = { name: 'Camille Martin', siret: SIRET, address: '1 rue de l’Exemple, 69001 Lyon', cartePro: '06912ED0001' };
const CLIENT = { name: 'Alex Durand', address: '2 rue de l’Exemple, 69002 Lyon' };
const ITEM = { description: 'Séance de coaching individuel (1 h)', quantity: 4, unitPrice: 55 };

describe('the simulator of a month (honesty pass of 14 October 2026, ACC-1 to ACC-6)', () => {
  it('takes 25.6 % + 0.2 % of turnover, the rates read on 14 October 2026, and nothing hidden', () => {
    expect(RATES.ssiBnc).toBe(0.256);
    expect(RATES.cfp).toBe(0.002);
    const m = simulateCoachMonth({ sessionPrice: 50, sessionsPerMonth: 40, rent: 650 });
    expect(m.turnover).toBe(2000);
    expect(m.contributions).toBe(516);
    expect(m.costs).toBe(650);
    expect(m.incomeTax).toBeNull(); // income tax depends on the household: not computed
    // The tiles add up: 2000 - 516 - 650.
    expect(m.estimate).toBe(834);
  });
  it('adds the 2.2 % versement libératoire only when chosen, and the break-even follows the same rule', () => {
    const m = simulateCoachMonth({ sessionPrice: 50, sessionsPerMonth: 40, rent: 650, versementLiberatoire: true });
    expect(m.incomeTax).toBe(44);
    expect(m.estimate).toBe(2000 - 516 - 650 - 44);
    // 650 / (50 × (1 - 0.258 - 0.022)) = 18.06: 19 sessions.
    expect(m.breakEvenSessions).toBe(19);
    expect(simulateCoachMonth({ sessionPrice: 50, sessionsPerMonth: 40, rent: 650 }).breakEvenSessions).toBe(18);
    expect(simulateCoachMonth({ sessionPrice: 50, sessionsPerMonth: 40 }).breakEvenSessions).toBe(0);
  });
  it('warns past the VAT franchise (37 500 / 41 250 €) and the micro-BNC ceiling (83 600 €) over a year', () => {
    expect(simulateCoachMonth({ sessionPrice: 50, sessionsPerMonth: 40 }).warnings).toEqual([]);
    expect(simulateCoachMonth({ sessionPrice: 80, sessionsPerMonth: 40 }).warnings).toEqual(['vat-base']); // 38 400
    expect(simulateCoachMonth({ sessionPrice: 90, sessionsPerMonth: 40 }).warnings).toEqual(['vat-increased']); // 43 200
    expect(simulateCoachMonth({ sessionPrice: 150, sessionsPerMonth: 50 }).warnings).toEqual(['vat-increased', 'micro-ceiling']); // 90 000
  });
});

describe('the invoice: no identity default, refused while a required field is empty (INV-1 to INV-5)', () => {
  it('checks the SIRET key (Luhn), and refuses the code’s old made-up SIRET', () => {
    expect(isValidSiret(SIRET)).toBe(true);
    expect(isValidSiret('123 456 789 01237')).toBe(true);
    expect(isValidSiret('842 918 203 00018')).toBe(false);
    expect(isValidSiret('00000000000000')).toBe(false);
    expect(isValidSiret('1234')).toBe(false);
  });
  it('says what is missing, and builds nothing until it is there', () => {
    const empty = { coach: {}, client: {}, items: [{ description: '', quantity: 1, unitPrice: 0 }], serviceDate: '' };
    expect(invoiceMissing(empty)).toEqual(['coachName', 'siret', 'coachAddress', 'cartePro', 'clientName', 'clientAddress', 'description', 'price', 'serviceDate']);
    expect(buildInvoice(empty, 'F-2026-0001')).toBeNull();
    const full = { coach: COACH, client: CLIENT, items: [ITEM], serviceDate: '2026-10-14', issueDate: '2026-10-14' };
    expect(invoiceMissing(full)).toEqual([]);
    expect(buildInvoice(full, '')).toBeNull();
  });
  it('prints only what the coach typed, the EI mention, the franchise line and one payment term', () => {
    const inv = buildInvoice({ coach: COACH, client: CLIENT, items: [ITEM], serviceDate: '2026-10-13', issueDate: '2026-10-14' }, 'F-2026-0001');
    expect(inv).not.toBeNull();
    if (!inv) return;
    expect(inv.coach.legalName).toBe('EI Camille Martin');
    expect(inv.total).toBe(220);
    expect(inv.mentions).toContain('TVA non applicable, art. 293 B du CGI');
    expect(inv.mentions).toContain('Paiement à réception de la facture.');
    expect(inv.dueDate).toBe('2026-10-14');
    // A consumer: no 40 € indemnity, no penalty line.
    expect(inv.mentions.some(m => m.includes('40'))).toBe(false);
    const text = invoiceLines(inv).join('\n');
    expect(text).toContain('FACTURE N° F-2026-0001');
    expect(text).toContain('SIRET\u00A0: 123 456 789 01237');
    expect(text).not.toMatch(/842 918 203|MACSF|Basic-Fit|ED-75-2023-09418|Coach Thomas/);
    expect(text).not.toContain('Assurance'); // not typed, not printed
    expect(text).not.toContain('TTC');
  });
  it('gives a business client the penalties, the 40 € indemnity and the discount line, and a due date at 30 days', () => {
    const inv = buildInvoice({ coach: COACH, client: { ...CLIENT, kind: 'professionnel' }, items: [ITEM], serviceDate: '2026-10-14', issueDate: '2026-10-14', payment: 'days30' }, 'F-2026-0002');
    expect(inv?.dueDate).toBe('2026-11-13');
    expect(inv?.mentions.some(m => m.includes('D441-5'))).toBe(true);
    expect(inv?.mentions.some(m => m.includes('L441-10'))).toBe(true);
    expect(inv?.mentions.some(m => m.startsWith('Escompte'))).toBe(true);
  });
  it('adds EI once', () => {
    expect(eiName('Camille Martin')).toBe('EI Camille Martin');
    expect(eiName('Camille Martin EI')).toBe('Camille Martin EI');
    expect(eiName('')).toBe('');
  });
});

describe('dates and amounts as a French invoice writes them', () => {
  it('dates in the phone’s own time zone, not UTC', () => {
    expect(localIsoDate(new Date(2026, 9, 14, 0, 30))).toBe('2026-10-14');
  });
  it('writes euros with a decimal comma and no-break spaces', () => {
    expect(euros(1234.5)).toBe('1 234,50 €');
    expect(euros(-516, true, 0)).toBe('−516 €');
    expect(euros(1234.5, false)).toBe('€1,234.50');
  });
});

describe('the receipts book (INV-6)', () => {
  it('exports money received only, with a byte-order mark, ";" and a decimal comma; an empty book is its header', () => {
    const csv = receiptsCsv([{ paidOn: '2026-10-15', number: 'F-2026-0001', client: 'Alex Durand', nature: 'Séance', amount: 55.5, mode: 'virement' }]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('2026-10-15;F-2026-0001;"Alex Durand";"Séance";55,50;Virement');
    expect(receiptsCsv([]).split('\r\n')).toHaveLength(1);
  });
});

// Second review of 14 October 2026: the credit note, and rates written from RATES.
describe('the credit note (avoir)', () => {
  it('names the invoice it cancels, keeps its amounts and the franchise line', async () => {
    const { buildInvoice, buildCreditNote, creditNoteLines } = await import('../accounting');
    const inv = buildInvoice({
      coach: { name: 'Camille Martin', siret: '12345678901237', address: '1 rue de l’Exemple, 69001 Lyon', cartePro: '06912ED0001' },
      client: { name: 'Alex Durand', address: '2 rue B, 69002 Lyon' },
      items: [{ description: 'Séance de coaching individuel', quantity: 2, unitPrice: 50 }],
      serviceDate: '2026-10-13', issueDate: '2026-10-14',
    }, 'F-2026-0003');
    const cn = buildCreditNote(inv!, 'A-2026-0001', '2026-10-15')!;
    expect(cn).toMatchObject({ kind: 'avoir', number: 'A-2026-0001', cancels: 'F-2026-0003', total: 100 });
    const text = creditNoteLines(cn).join('\n');
    expect(text).toContain('AVOIR N° A-2026-0001');
    expect(text).toContain('Annule la facture n° F-2026-0003 du 14/10/2026');
    expect(text).toContain('EI Camille Martin');
    expect(text).toContain('TVA non applicable, art. 293 B du CGI');
    expect(text).not.toContain('—');
  });
  it('writes the rates from the table', async () => {
    const { ratePct, RATES } = await import('../accounting');
    expect(ratePct(RATES.ssiBnc)).toBe('25,6 %');
    expect(ratePct(RATES.cfp)).toBe('0,2 %');
    expect(ratePct(RATES.versementLiberatoire, false)).toBe('2.2%');
  });
});
