// The invoice and the contract of the coach's office as a PDF, on the session report's paper (pdf-kit.js: the same A5
// sheet, type and colours), loaded with jsPDF on demand (CoachAccounting.jsx, CoachSuite.jsx), and shared through
// the phone's share sheet as the programme's PDF is (Pro.jsx). Before (INV-7), "Imprimer / PDF" called window.print()
// with no print rule: the whole dark screen was printed. Whether the share sheet works in the Home Screen app is
// David's check on his iPhone (R3). Presentation only: the words are the invoice's and the contract's own lines.
import { PAGE_H, COLUMN, MARGIN, GAP, COLOR, pdfDoc } from '../experience/pdf-kit';
import { euros, paperDate, siretText } from '../../lib/accounting';

const BODY = 10, LEAD = 1.5, TITLE = 20;

// euros() (accounting.ts) separates thousands with a narrow no-break space (U+202F), which the Geist fonts lack:
// write() set "1 500,00 €" as "15 00,00 €" (final check of 14 October 2026). On paper the separator is the plain
// no-break space (U+00A0), which the fonts have; every string goes through it before it is measured, wrapped or set.
const paper = s => String(s).replace(/\u202F/g, '\u00A0');
function officeDoc(opts) {
  const kit = pdfDoc(opts);
  return {
    ...kit,
    width: (s, ...a) => kit.width(paper(s), ...a),
    write: (s, ...a) => kit.write(paper(s), ...a),
    lines: (s, ...a) => kit.lines(paper(s), ...a),
    drawLine: (s, ...a) => kit.drawLine(paper(s), ...a),
  };
}

/**
 * A document of lines: the first is its title (serif), "Article …" lines are heads (medium), an empty line is a gap.
 * Returns a PDF Blob.
 */
export function documentPdf({ title, lines, fr = true }) {
  const { doc, write, lines: wrap, drawLine, paint } = officeDoc({ title, fr });
  paint();
  let y = MARGIN;
  const bottom = PAGE_H - MARGIN;
  const room = h => { if (y + h > bottom) { doc.addPage('a5'); paint(); y = MARGIN; } };
  const [head, ...rest] = lines;
  for (const line of wrap(head || title, TITLE, COLUMN).lines) { room(TITLE * 1.15); write(line, MARGIN, y, 'serif', TITLE, 1.15, COLOR.ink); y += TITLE * 1.15; }
  y += 10;
  doc.setDrawColor(COLOR.rule); doc.setLineWidth(1); doc.line(MARGIN, y, MARGIN + COLUMN, y);
  y += 12;
  for (const line of rest) {
    if (!line) { y += BODY * 0.8; continue; }
    const heading = /^Article \d/.test(line);
    const block = wrap(line, BODY, COLUMN);
    for (const part of block.lines) {
      room(BODY * LEAD);
      if (heading && !block.raster) write(part, MARGIN, y, 'sansMedium', BODY, LEAD, COLOR.ink);
      else drawLine(part, block.raster, MARGIN, y, BODY, LEAD, COLOR.ink);
      y += BODY * LEAD;
    }
  }
  return doc.output('blob');
}

/**
 * An invoice or a credit note (avoir) as a sheet with a table (second review of 14 October 2026: the PDF was a bare list
 * of lines, unlike the paper on screen, and the number in the title's serif read "000l"). The kind and the date on the
 * header line; the number in the sans, whose 1 cannot be taken for an l; the dates; the coach and the client side by
 * side; designation, quantity, price and total in columns, figures to the right; the total; the mentions. The same
 * words as invoiceLines / creditNoteLines (accounting.ts), French; awaiting David's approval (R10).
 */
export function invoicePdf(inv) {
  const avoir = inv.kind === 'avoir';
  const kind = avoir ? 'Avoir' : 'Facture';
  const { doc, upper, width, write, baseline, lines: wrap, drawLine, paint } = officeDoc({ title: `${kind} ${inv.number}`, fr: true });
  paint();
  let y = MARGIN;
  const bottom = PAGE_H - MARGIN;
  const right = MARGIN + COLUMN;
  const room = h => { if (y + h > bottom) { doc.addPage('a5'); paint(); y = MARGIN; } };
  const rule = (color = COLOR.rule) => { doc.setDrawColor(color); doc.setLineWidth(1); doc.line(MARGIN, y + 0.5, right, y + 0.5); };
  const label = (s, x, top) => write(upper(s), x, top, 'mono', 9, 1.5, COLOR.ash, 9 * 0.14);
  const flushRight = (s, xr, top, key, size, color) => write(s, xr - width(s, key, size), top, key, size, 1.4, color);

  // The header line: the kind on the left, the issue date on the right.
  write(upper(kind), MARGIN, y, 'mono', 9.5, 1.5, COLOR.ash, 9.5 * 0.2);
  const day = paperDate(inv.issueDate);
  write(day, right - width(day, 'mono', 9.5, 9.5 * 0.2), y, 'mono', 9.5, 1.5, COLOR.ash, 9.5 * 0.2);
  y += 9.5 * 1.5 + GAP;
  write(kind, MARGIN, y, 'serif', 30, 1.05, COLOR.ink);
  y += 30 * 1.05 + 2;
  write(`N° ${inv.number}`, MARGIN, y, 'sansMedium', 14, 1.4, COLOR.ink);
  y += 14 * 1.4 + GAP;

  // Labelled pairs, two to a row: the dates, or the invoice a credit note cancels.
  const w2 = (COLUMN - 8) / 2;
  const pairs = avoir
    ? [['Date d’émission', paperDate(inv.issueDate)], ['Annule la facture', `${inv.cancels} du ${paperDate(inv.cancelsDate)}`]]
    : [['Date d’émission', paperDate(inv.issueDate)], ['Date de la prestation', paperDate(inv.serviceDate)]];
  const pairBlocks = pairs.map(([, v]) => wrap(v, 11.5, w2));
  pairs.forEach(([name], i) => {
    const x = MARGIN + i * (w2 + 8);
    label(name, x, y);
    pairBlocks[i].lines.forEach((line, k) => drawLine(line, pairBlocks[i].raster, x, y + 13.5 + k * 16, 11.5, 1.4, COLOR.ink));
  });
  y += 13.5 + 16 * Math.max(...pairBlocks.map(b => b.lines.length)) + GAP;

  // The two parties side by side.
  const coachLines = [inv.coach.legalName, `SIRET\u00A0: ${siretText(inv.coach.siret)}`, inv.coach.address, `Carte professionnelle n° ${inv.coach.cartePro}`,
    ...(inv.coach.rcpPro ? [`Assurance RC pro\u00A0: ${inv.coach.rcpPro}`] : []), ...(inv.coach.gym ? [`Lieu d’exercice\u00A0: ${inv.coach.gym}`] : [])];
  const clientLines = [inv.client.name, inv.client.address];
  const party = arr => arr.filter(Boolean).flatMap((s, k) => { const b = wrap(s, 10, w2); return b.lines.map(line => ({ line, raster: b.raster, first: k === 0 })); });
  const parties = [['Prestataire', party(coachLines)], ['Client', party(clientLines)]];
  const partyH = 13.5 + 14.5 * Math.max(...parties.map(([, l]) => l.length));
  room(partyH);
  parties.forEach(([name, rows], i) => {
    const x = MARGIN + i * (w2 + 8);
    label(name, x, y);
    rows.forEach((r, k) => drawLine(r.line, r.raster, x, y + 13.5 + k * 14.5, 10, 1.45, r.first ? COLOR.ink : COLOR.ash));
  });
  y += partyH + GAP;

  // The table: designation (42 %), quantity (10 %), unit price (24 %), total (24 %), figures flush right. At 19 % a
  // column was narrower than "12 345,00 €" and the price ran into the total (final check of 14 October 2026); at 24 %
  // up to 99 999,99 € fits with room to spare, and a longer figure is set smaller to stay in its column (cell()).
  const widths = [COLUMN * 0.42, COLUMN * 0.1, COLUMN * 0.24, COLUMN * 0.24];
  const colX = k => MARGIN + widths.slice(0, k).reduce((a, b) => a + b, 0);
  const colR = k => colX(k) + widths[k];
  room(30);
  rule();
  y += 6;
  label('Désignation', colX(0), y);
  ['Qté', 'Prix', 'Total'].forEach((h, i) => { const t = upper(h); write(t, colR(i + 1) - width(t, 'mono', 9, 9 * 0.14), y, 'mono', 9, 1.5, COLOR.ash, 9 * 0.14); });
  y += 13.5 + 5;
  rule();
  for (const it of inv.items) {
    const name = wrap(it.description, 10.5, widths[0] - 8);
    const h = 8 + name.lines.length * 10.5 * 1.4 + 8;
    room(h);
    const top = y + 8;
    name.lines.forEach((line, k) => drawLine(line, name.raster, colX(0), top + k * 10.5 * 1.4, 10.5, 1.4, COLOR.ink));
    const cell = (s, k) => { let z = 10.5; while (z > 6 && width(s, 'sans', z) > widths[k] - 8) z -= 0.5; flushRight(s, colR(k), top + baseline('sans', 10.5, 1.4, 0) - baseline('sans', z, 1.4, 0), 'sans', z, COLOR.ink); };
    cell(String(it.quantity), 1);
    cell(euros(it.unitPrice), 2);
    cell(euros(it.quantity * it.unitPrice), 3);
    y += h;
    rule(COLOR.rowRule);
  }
  y += 10;

  // The total, its words on the left and the amount on the right.
  room(24);
  const totalWords = avoir ? 'Montant de l’avoir (TVA non applicable)' : 'Total à payer (TVA non applicable)';
  const amount = euros(inv.total);
  const words = wrap(totalWords, 10.5, COLUMN - width(amount, 'sansMedium', 15) - 16);
  words.lines.forEach((line, k) => drawLine(line, words.raster, MARGIN, y + 2 + k * 10.5 * 1.4, 10.5, 1.4, COLOR.ink));
  flushRight(amount, right, y, 'sansMedium', 15, COLOR.ink);
  y += Math.max(15 * 1.4, words.lines.length * 10.5 * 1.4) + GAP;

  // The mentions, quiet.
  for (const m of inv.mentions) {
    const block = wrap(m, 9, COLUMN);
    for (const line of block.lines) { room(9 * 1.5); drawLine(line, block.raster, MARGIN, y, 9, 1.5, COLOR.ash); y += 9 * 1.5; }
    y += 3;
  }
  return doc.output('blob');
}

/** A file name without spaces or accents: facture-F-2026-0001.pdf, contrat-camille-martin.pdf. */
export const pdfFileName = (stem) => `${String(stem).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'document'}.pdf`;
