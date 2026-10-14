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
