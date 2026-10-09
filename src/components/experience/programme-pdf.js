// The coach's programme as a PDF, in the session report's design (report-pdf.js, through pdf-kit.js): the same A5
// paper, the same type, the same header line, title, labelled pairs, rules and footer. One table: the exercise and its
// cue, the target set like the report's count (serif, gold), the rest. Loaded with jsPDF, on demand (Pro.jsx).
import { PAGE_H, COLUMN, MARGIN, GAP, COLOR, pdfDoc, wrapText } from './pdf-kit';
import { exerciseName } from './exercise-info';
import { PRO } from './pro-copy';
import { fileSlug } from './report-sheet';
import QRCode from 'qrcode';

/**
 * The QR code of the programme's link, for a client handed the PDF (printed, or on another screen) to open it in the
 * app with the phone's camera (BACKLOG, 6 October: "a QR code on the PDF"). Error correction L, as the link carries
 * no redundancy of its own to lose. Drawn QR_SIDE points wide (34 mm) at the top right, beside the title, so the sheet
 * keeps its pages. Null without a link, or when the link needs more than QR_MAX_VERSION: past it the modules fall
 * under 0.4 mm, which a phone's camera reads poorly on paper; its link still works. Measured 9 October: 1 to 16
 * exercises, with or without the same short cue on each, give versions 9 to 13 (links of 208 to 402 characters);
 * long, varied cues weigh more. Both UNSOURCED, convention (common print guidance puts a module at 0.4 mm and up).
 */
export const QR_MAX_VERSION = 15;
export const QR_SIDE = 96;
export function programmeQr(link) {
  if (!link) return null;
  try {
    const qr = QRCode.create(link, { errorCorrectionLevel: 'L' });
    if (qr.version > QR_MAX_VERSION) return null;
    return { size: qr.modules.size, version: qr.version, dark: (row, col) => !!qr.modules.get(row, col) };
  } catch {
    return null;
  }
}

const NBSP = ' ';

/** The words and numbers the PDF sets, apart from the drawing, so the tests can read them. */
export function programmeSheet(programme, { lang, date }) {
  const fr = lang === 'fr', c = PRO[fr ? 'fr' : 'en'];
  return {
    fr,
    kicker: c.pdfKicker,
    date: date.toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    title: programme.title,
    people: [...(programme.who ? [[c.pdfWho, programme.who]] : []), [c.pdfCount, String(programme.items.length)]],
    columns: c.pdfColumns,
    rows: programme.items.map((item, i) => ({
      index: String(i + 1).padStart(2, '0'),
      name: exerciseName(item.key, fr ? 'fr' : 'en'),
      note: item.note || '',
      target: `${item.sets}${NBSP}×${NBSP}${item.reps}`,
      rest: c.restText(item.rest),
    })),
    noteLabel: c.pdfNote,
    note: programme.note || '',
    qrLabel: c.pdfQrLabel,
    foot: c.pdfFoot,
  };
}

/** programme-<who or title>-2026-10-06.pdf, ASCII, as the report's file is named (report-sheet.js). */
export function programmeFileName(programme, { lang, date }) {
  const slug = fileSlug(programme.who || programme.title);
  const pad = n => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return [PRO[lang === 'fr' ? 'fr' : 'en'].fileName, slug, day].filter(Boolean).join('-') + '.pdf';
}

/**
 * Builds the PDF of a programme. Synchronous, so the share stays within the tap. `link`, the programme's link as the
 * coach shares it (Pro.jsx), adds its QR code at the top right; without one the sheet is as before.
 */
export function programmePdf(programme, { lang, date = new Date(), link = null }) {
  const sheet = programmeSheet(programme, { lang, date });
  const qr = programmeQr(link);
  const { doc, upper, width, write, lines, drawLine, paint } = pdfDoc({ title: sheet.title, fr: sheet.fr });
  paint();
  let y = MARGIN;
  const FOOTER = 22, FOOT_Y = PAGE_H - MARGIN - 12;
  const room = () => PAGE_H - MARGIN - FOOTER - y;
  const newPage = () => { doc.addPage('a5'); paint(); y = MARGIN; };
  const rule = (color = COLOR.rule) => { doc.setDrawColor(color); doc.setLineWidth(1); doc.line(MARGIN, y + 0.5, MARGIN + COLUMN, y + 0.5); };
  const track = 9.5 * 0.2;

  // The header line, as the report's: here the kind of sheet on the left, the date on the right.
  write(upper(sheet.kicker), MARGIN, y, 'mono', 9.5, 1.5, COLOR.ash, track);
  const day = upper(sheet.date);
  write(day, MARGIN + COLUMN - width(day, 'mono', 9.5, track), y, 'mono', 9.5, 1.5, COLOR.ash, track);
  y += 9.5 * 1.5 + GAP;

  // The programme's QR code (programmeQr) at the top right, ink on the paper with a quiet zone of 4 modules, its label
  // under it; the title and the labelled pairs take the column beside it.
  const top = y, side = qr ? COLUMN - QR_SIDE - 14 : COLUMN;
  if (qr) {
    const unit = QR_SIDE / (qr.size + 8), left = MARGIN + COLUMN - QR_SIDE, x0 = left + 4 * unit, y0 = top + 4 * unit;
    doc.setFillColor(COLOR.ink);
    for (let r = 0; r < qr.size; r++) {
      // One rectangle per run of dark modules in the row.
      for (let c = 0; c < qr.size;) {
        if (!qr.dark(r, c)) { c++; continue; }
        let end = c;
        while (end < qr.size && qr.dark(r, end)) end++;
        doc.rect(x0 + c * unit, y0 + r * unit, (end - c) * unit, unit, 'F');
        c = end;
      }
    }
    const label = upper(sheet.qrLabel), track = 8.5 * 0.14;
    // Set flush with the column's right edge, as the date above it: the label is wider than the code.
    write(label, MARGIN + COLUMN - width(label, 'mono', 8.5, track), top + QR_SIDE + 4, 'mono', 8.5, 1.5, COLOR.ash, track);
  }

  // The title: serif 30, set solid; a long title takes more lines at the same size.
  const titleLines = wrapText(sheet.title, side, s => width(s, 'serif', 30));
  titleLines.forEach(line => { write(line, MARGIN, y, 'serif', 30, 1.05, COLOR.ink); y += 30 * 1.05; });
  y += GAP - 30 * 0.05;

  // For whom, and how many exercises: labelled pairs, two to a row, as the report's people.
  const w2 = (side - 8) / 2;
  const row = sheet.people.map(([name, value]) => ({ name, block: lines(value, 12, w2) }));
  const pairH = 13.5 + 18 * Math.max(...row.map(r => r.block.lines.length));
  row.forEach(({ name, block }, i) => {
    const x = MARGIN + i * (w2 + 8);
    write(upper(name), x, y, 'mono', 9, 1.5, COLOR.ash, 9 * 0.16);
    block.lines.forEach((line, k) => drawLine(line, block.raster, x, y + 13.5 + k * 18, 12, 1.5, COLOR.ink));
  });
  y += pairH + GAP;
  if (qr) y = Math.max(y, top + QR_SIDE + 4 + 8.5 * 1.5 + GAP);

  // The table: index (8%), exercise and cue (44%), sets × reps (30%), rest (18%). The heading as the report's table's,
  // each exercise's row as tall as its name and cue, a light rule under each; a row that does not fit opens a page,
  // which repeats the heading.
  const widths = [COLUMN * 0.08, COLUMN * 0.44, COLUMN * 0.3, COLUMN * 0.18];
  const colX = k => MARGIN + widths.slice(0, k).reduce((a, b) => a + b, 0);
  // A heading wider than its column wraps there, as the report's labels do, and never runs into the next.
  const heads = sheet.columns.map((c, k) => (c ? wrapText(upper(c), widths[k] - 6, t => width(t, 'mono', 9, 9 * 0.12)) : []));
  const HEAD = 12 + 13.5 * Math.max(1, ...heads.map(h => h.length));
  const heading = () => {
    rule();
    y += 1;
    heads.forEach((h, k) => h.forEach((line, i) => write(line, colX(k), y + 6 + i * 13.5, 'mono', 9, 1.5, COLOR.ash, 9 * 0.12)));
    y += HEAD - 1;
    rule();
    y += 1;
  };
  const nameW = widths[1] - 10;
  const rowsOut = sheet.rows.map(r => ({ ...r, nameBlock: lines(r.name, 13, nameW), noteBlock: r.note ? lines(r.note, 10.5, nameW) : null }));
  const heightOf = r => 10 + r.nameBlock.lines.length * 13 * 1.4 + (r.noteBlock ? 3 + r.noteBlock.lines.length * 10.5 * 1.45 : 0) + 10;
  if (room() < HEAD + heightOf(rowsOut[0]) && y > MARGIN) newPage();
  heading();
  for (const r of rowsOut) {
    const h = Math.max(heightOf(r), 44);
    if (room() < h) { newPage(); heading(); }
    const top = y + 10;
    write(r.index, colX(0), top + 1, 'mono', 10, 1.4, COLOR.ash, 10 * 0.08);
    r.nameBlock.lines.forEach((line, k) => drawLine(line, r.nameBlock.raster, colX(1), top + k * 13 * 1.4, 13, 1.4, COLOR.ink));
    if (r.noteBlock) {
      const noteTop = top + r.nameBlock.lines.length * 13 * 1.4 + 3;
      r.noteBlock.lines.forEach((line, k) => drawLine(line, r.noteBlock.raster, colX(1), noteTop + k * 10.5 * 1.45, 10.5, 1.45, COLOR.ash));
    }
    // The target, set like the report's figures: serif, in the count's gold; the rest in ink.
    write(r.target, colX(2), top - 2, 'serif', 20, 1, COLOR.count);
    const rest = lines(r.rest, 11.5, widths[3]);
    rest.lines.forEach((line, k) => drawLine(line, rest.raster, colX(3), top + 1 + k * 11.5 * 1.4, 11.5, 1.4, COLOR.ink));
    y += h;
    doc.setDrawColor(COLOR.rowRule); doc.setLineWidth(1); doc.line(MARGIN, y - 0.5, MARGIN + COLUMN, y - 0.5);
  }
  y += GAP;

  // The general note, labelled as the report's notes; then the foot, which never stands alone on a page.
  const foot = wrapText(sheet.foot, COLUMN, s => width(s, 'sans', 10));
  const footH = GAP + 1 + 10 + 15 * foot.length;
  if (sheet.note) {
    const block = lines(sheet.note, 12.5, COLUMN), NL = 12.5 * 1.5;
    const need = i => { const left = block.lines.length - i; return left <= 2 ? left * NL + footH : NL; };
    if (room() < 13.5 + 4 + need(0) && y > MARGIN) newPage();
    write(upper(sheet.noteLabel), MARGIN, y, 'mono', 9, 1.5, COLOR.ash, 9 * 0.16);
    y += 13.5 + 4;
    block.lines.forEach((line, i) => {
      if (room() < need(i) && y > MARGIN) newPage();
      drawLine(line, block.raster, MARGIN, y, 12.5, 1.5, COLOR.ink);
      y += NL;
    });
  } else if (room() < footH && y > MARGIN) newPage();
  y += GAP;
  rule();
  y += 1 + 10;
  foot.forEach(line => { write(line, MARGIN, y, 'sans', 10, 1.5, COLOR.ash); y += 15; });

  // Every page's number when there are several, where the report puts it.
  const pages = doc.getNumberOfPages();
  if (pages > 1) for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const num = `${p} / ${pages}`;
    write(num, MARGIN + COLUMN - width(num, 'mono', 8.5, 8.5 * 0.1), FOOT_Y, 'mono', 8.5, 1.5, COLOR.ash, 8.5 * 0.1);
  }
  return doc.output('blob');
}
