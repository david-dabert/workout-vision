import { describe, it, expect } from 'vitest';
import { jsPDF } from 'jspdf';
import { invoicePdf } from './office-pdf';
import { buildInvoice, buildCreditNote } from '../../lib/accounting';

// Second review of 14 October 2026: the invoice PDF as a sheet with a table, the number in the sans.
async function drawn(run) {
  const texts = [];
  const hook = ['preProcessText', ({ text }) => { texts.push(Array.isArray(text) ? text.join('') : text); }];
  jsPDF.API.events.push(hook);
  let blob;
  try { blob = run(); } finally { jsPDF.API.events.splice(jsPDF.API.events.indexOf(hook), 1); }
  const pages = Buffer.from(await blob.arrayBuffer()).toString('latin1').match(/\/Type \/Page\b/g).length;
  return { text: texts.join(''), pages, blob };
}

const inv = buildInvoice({
  coach: { name: 'Camille Martin', siret: '12345678901237', address: '1 rue de l’Exemple, 69001 Lyon', cartePro: '06912ED0001' },
  client: { name: 'Alex Durand', address: '2 rue B, 69002 Lyon', kind: 'professionnel' },
  items: [{ description: 'Séance de coaching individuel', quantity: 2, unitPrice: 50 }],
  serviceDate: '2026-10-13', issueDate: '2026-10-14',
}, 'F-2026-0001');

describe('the invoice PDF', () => {
  it('sets the number, the dates, both parties, a table, the total and the mentions on one page', async () => {
    const { text, pages, blob } = await drawn(() => invoicePdf(inv));
    expect(blob.type).toBe('application/pdf');
    expect(pages).toBe(1);
    const flat = text.replace(/\s/g, '');
    for (const s of ['FACTURE', 'N°F-2026-0001', 'DATED’ÉMISSION', '14/10/2026', 'DATEDELAPRESTATION', '13/10/2026', 'PRESTATAIRE', 'EICamilleMartin', 'SIRET:12345678901237', 'CLIENT', 'AlexDurand', 'DÉSIGNATION', 'QTÉ', 'PRIX', 'TOTAL', 'Séancedecoachingindividuel', '50,00€', '100,00€', 'Totalàpayer(TVAnonapplicable)', 'TVAnonapplicable,art.293BduCGI', 'Pénalitésderetard']) expect(flat).toContain(s);
    expect(text).not.toMatch(/Workout ?Vision/i);
  });
  it('sets a credit note with the invoice it cancels', async () => {
    const cn = buildCreditNote(inv, 'A-2026-0001', '2026-10-15');
    const { text } = await drawn(() => invoicePdf(cn));
    const flat = text.replace(/\s/g, '');
    for (const s of ['AVOIR', 'N°A-2026-0001', 'ANNULELAFACTURE', 'F-2026-0001du14/10/2026', 'Montantdel’avoir(TVAnonapplicable)', '100,00€']) expect(flat).toContain(s);
  });
});

// Final check of 14 October 2026: euros() separates thousands with U+202F, which the Geist fonts lack, and the table
// drew "1 500,00 €" as "15 00,00 €", the quantity, price and total running into each other. Every run of text jsPDF
// sets is recorded with its place and width, to read the row back as the paper shows it.
async function runs(run) {
  const out = [];
  const hook = ['preProcessText', function ({ text, x, y }) {
    const s = Array.isArray(text) ? text.join('') : text;
    out.push({ s, x, x1: x + this.getTextWidth(s), y, glyphs: [...s].map(ch => this.getFont().metadata.characterToGlyph(ch.codePointAt(0))) });
  }];
  jsPDF.API.events.push(hook);
  try { run(); } finally { jsPDF.API.events.splice(jsPDF.API.events.indexOf(hook), 1); }
  return out;
}
// Runs on one baseline that touch (a kerned word is set in several runs) make one cell.
const cells = (rs, y) => rs.filter(r => Math.abs(r.y - y) < 0.01).sort((a, b) => a.x - b.x)
  .reduce((acc, r) => { const last = acc[acc.length - 1]; if (last && r.x - last.x1 < 1) { last.s += r.s; last.x1 = r.x1; } else acc.push({ ...r }); return acc; }, []);

describe('amounts of 1 000 € and more on paper', () => {
  const big = buildInvoice({
    coach: { name: 'Camille Martin', siret: '12345678901237', address: '1 rue de l’Exemple, 69001 Lyon', cartePro: '06912ED0001' },
    client: { name: 'Alex Durand', address: '2 rue B, 69002 Lyon', kind: 'professionnel' },
    items: [{ description: 'Carnet de 30 séances', quantity: 1, unitPrice: 1234.56 }, { description: 'Suivi annuel', quantity: 10, unitPrice: 1234.5 }],
    serviceDate: '2026-10-13', issueDate: '2026-10-14',
  }, 'F-2026-0002');
  for (const [name, make] of [['the invoice', () => invoicePdf(big)], ['its credit note', () => invoicePdf(buildCreditNote(big, 'A-2026-0002', '2026-10-15'))]]) {
    it(`${name} prints 1 234,56 € and 12 345,00 € whole, with a character the font has, in cells that do not overlap`, async () => {
      const { text } = await drawn(make);
      expect(text).not.toContain(' ');
      for (const s of ['1 234,56 €', '12 345,00 €', '13 579,56 €']) expect(text).toContain(s);
      const rs = await runs(make);
      expect(rs.filter(r => r.glyphs.includes(0)).map(r => r.s)).toEqual([]);
      for (const [first, qty, price, total] of [['Carnet', '1', '1 234,56 €', '1 234,56 €'], ['Suivi', '10', '1 234,50 €', '12 345,00 €']]) {
        const name = [...new Set(rs.map(r => r.y))].flatMap(y => cells(rs, y)).find(k => k.s.startsWith(first));
        expect(name).toBeTruthy();
        const figures = cells(rs, name.y).filter(k => k.x > name.x1);
        expect(figures.map(k => k.s)).toEqual([qty, price, total]);
        expect(figures[0].x - name.x1).toBeGreaterThanOrEqual(6);
        for (let i = 1; i < figures.length; i++) expect(figures[i].x - figures[i - 1].x1).toBeGreaterThanOrEqual(6);
      }
    });
  }
});
