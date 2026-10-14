// The invoice and the contract of the coach's office as a PDF, on the session report's paper (pdf-kit.js: the same A5
// sheet, type and colours), loaded with jsPDF on demand (CoachAccounting.jsx, CoachSuite.jsx), and shared through
// the phone's share sheet as the programme's PDF is (Pro.jsx). Before (INV-7), "Imprimer / PDF" called window.print()
// with no print rule: the whole dark screen was printed. Whether the share sheet works in the Home Screen app is
// David's check on his iPhone (R3). Presentation only: the words are the invoice's and the contract's own lines.
import { PAGE_H, COLUMN, MARGIN, COLOR, pdfDoc } from '../experience/pdf-kit';

const BODY = 10, LEAD = 1.5, TITLE = 20;

/**
 * A document of lines: the first is its title (serif), "Article …" lines are heads (medium), an empty line is a gap.
 * Returns a PDF Blob.
 */
export function documentPdf({ title, lines, fr = true }) {
  const { doc, write, lines: wrap, drawLine, paint } = pdfDoc({ title, fr });
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

/** A file name without spaces or accents: facture-F-2026-0001.pdf, contrat-camille-martin.pdf. */
export const pdfFileName = (stem) => `${String(stem).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'document'}.pdf`;
