// The coach's programme as a PDF, the exercise sheet a client is handed, in the session report's design (report-pdf.js,
// through pdf-kit.js): the same A5 paper, the same type, the same header line, title, labelled pairs, rules and footer.
// One block per exercise (14 October 2026): the guide's drawings of its first and last poses, its name, its target set
// like the report's count (serif, gold) with the rest, the side and whether it is filmed beside it, and its cue.
// Loaded with jsPDF, on demand (Pro.jsx).
import { PAGE_H, COLUMN, MARGIN, GAP, COLOR, pdfDoc, wrapText } from './pdf-kit';
import { exerciseName } from './exercise-info';
import { PRO } from './pro-copy';
import { fileSlug } from './report-sheet';
import QRCode from 'qrcode';
import { gzipSync } from 'fflate';
import { compact, filmable, frequencyOf, holdOf, sideOf, toBase64url } from './programme';

// The drawings, made ready before the tap (sheet-drawings.js): Pro.jsx reaches them through this module, which it
// loads already, so they stay out of the first screen's code.
export { drawings } from './sheet-drawings';

/**
 * The programme's link payload, packed at once: "z" and the gzip of its compact JSON in base64url, or "j" and the
 * JSON itself when packing does not make it shorter, as encodeProgramme (programme.js) makes it over the browser's
 * CompressionStream, which only answers after the tap. fflate is jsPDF's own: the PDF kit carries it already. The
 * client's phone reads either gzip alike (DecompressionStream). Excellence hunt, 9 October 2026: a number typed, then
 * "Partager le PDF" in the same tap, built the sheet from the plain link, and the QR code fell off a cued programme.
 */
export function packNow(programme) {
  const json = new TextEncoder().encode(JSON.stringify(compact(programme)));
  const plain = 'j' + toBase64url(json), packed = 'z' + toBase64url(gzipSync(json, { level: 9 }));
  return packed.length < plain.length ? packed : plain;
}

/**
 * The QR code of the programme's link, for a client handed the PDF (printed, or on another screen) to open it in the
 * app with the phone's camera (BACKLOG, 6 October: "a QR code on the PDF"). Error correction L, as the link carries
 * no redundancy of its own to lose. Its modules are never under QR_MODULE_MIN (0.4 mm), which a phone's camera reads
 * poorly on paper. Up to QR_MAX_VERSION, drawn QR_SIDE points wide (34 mm) at the top right, beside the title, so a
 * short sheet keeps its one page; past it, at the end of the sheet with the foot, as wide as its modules need, up to
 * QR_BLOCK_MAX (71 mm). Null without a link, or for one too long for any code at that size (past version 37); its
 * link still works, and the coach is told (Pro.jsx). Measured 9 October with packed links: up to 24 exercises without
 * cues, versions 10 to 13; with a distinct short cue on each, 4 exercises give version 13, 7 give 16, 24 give 20.
 * Both sizes UNSOURCED, convention (common print guidance puts a module at 0.4 mm and up).
 */
export const QR_MAX_VERSION = 15;
export const QR_SIDE = 96;
const MM = 72 / 25.4;
export const QR_MODULE_MIN = 0.4 * MM, QR_BLOCK_MAX = 200;
// The block's modules, where its width allows: 0.45 mm, a margin over the floor. UNSOURCED, convention.
const QR_BLOCK_MODULE = 0.45 * MM;
export function programmeQr(link) {
  if (!link) return null;
  try {
    const qr = QRCode.create(link, { errorCorrectionLevel: 'L' });
    const size = qr.modules.size, span = size + 8; // the code and its quiet zone of 4 modules each side
    // At the top right only while 96 pt keeps the modules at 0.4 mm and up (version 14 at most: 0.418 mm; 15: 0.398).
    const top = qr.version <= QR_MAX_VERSION && QR_SIDE / span >= QR_MODULE_MIN - 1e-9;
    const side = top ? QR_SIDE : Math.min(QR_BLOCK_MAX, Math.max(QR_SIDE, span * QR_BLOCK_MODULE));
    if (side / span < QR_MODULE_MIN - 1e-9) return null;
    return { size, version: qr.version, side, top, dark: (row, col) => !!qr.modules.get(row, col) };
  } catch {
    return null;
  }
}

const NBSP = ' ';

/**
 * The words and numbers the PDF sets, so the tests can read them. drawings: Map from an exercise's key to its frames
 * ({ start, end, similar }, sheet-drawings.js, of), or to null; an exercise missing from it is printed without one.
 * Each row: its target (sets × reps, or sets × the hold), its details (rest, hold, side, and "without filming" for an
 * exercise the client does not film), whether it is filmed, its hold, its side, its drawing. The foot asks to film
 * each set when every exercise is filmed, each set but those marked when some are, and nothing when none is; the
 * drawings' credit goes with the foot when the sheet prints one.
 */
export function programmeSheet(programme, { lang, date, drawings = new Map() }) {
  const fr = lang === 'fr', c = PRO[fr ? 'fr' : 'en'];
  const frequency = frequencyOf(programme);
  const rows = programme.items.map((item, i) => {
    const hold = holdOf(item), side = sideOf(item), filmed = filmable(item), drawing = drawings.get(item.key) || null;
    return {
      index: String(i + 1).padStart(2, '0'),
      name: exerciseName(item.key, fr ? 'fr' : 'en'),
      note: item.note || '',
      target: hold ? c.holdTarget(item.sets, hold) : `${item.sets}${NBSP}×${NBSP}${item.reps}`,
      rest: c.restText(item.rest),
      details: c.pdfDetails(item.rest, hold, side, filmed),
      filmed, hold, side,
      drawing: drawing && (drawing.start || drawing.end) ? drawing : null,
    };
  });
  const filmed = rows.filter(r => r.filmed).length;
  return {
    fr,
    kicker: c.pdfKicker,
    date: date.toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    title: programme.title,
    people: [
      ...(programme.who ? [[c.pdfWho, programme.who]] : []), [c.pdfCount, String(programme.items.length)],
      ...(frequency ? [[c.pdfFrequency, c.frequency(frequency.times, frequency.per)]] : []),
    ],
    rows,
    noteLabel: c.pdfNote,
    note: programme.note || '',
    qrLabel: c.pdfQrLabel,
    foot: filmed === rows.length ? c.pdfFoot : filmed ? c.pdfFootSome : '',
    similar: c.pdfSimilar,
    credit: rows.some(r => r.drawing) ? c.pdfCredit : '',
  };
}

/** programme-<who or title>-2026-10-06.pdf, ASCII, as the report's file is named (report-sheet.js). */
export function programmeFileName(programme, { lang, date }) {
  const slug = fileSlug(programme.who || programme.title);
  const pad = n => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return [PRO[lang === 'fr' ? 'fr' : 'en'].fileName, slug, day].filter(Boolean).join('-') + '.pdf';
}

// An exercise's block (14 October 2026): its two drawings ART points square, ART_GAP apart, in a column ART_W wide,
// then the text column, ART_GUTTER further; PAD above and under; the index INDEX_W before the name. 64 pt is 22.6 mm,
// a drawing a client reads on an A5 sheet held in the hand. All UNSOURCED, convention.
const ART = 64, ART_GAP = 6, ART_W = 2 * ART + ART_GAP, ART_GUTTER = 14, PAD = 8, INDEX_W = 22;

/**
 * Builds the PDF of a programme. Synchronous, so the share stays within the tap: the drawings come made already
 * (`drawings`, sheet-drawings.js, of), and an exercise without one is printed without one. `link`, the programme's
 * link as the coach shares it (Pro.jsx), adds its QR code (programmeQr: at the top right, or with the foot at the
 * end); `qr`, that code when the caller has made it already. Without either, the sheet has no code.
 */
export function programmePdf(programme, { lang, date = new Date(), link = null, qr = programmeQr(link), drawings = new Map() }) {
  const sheet = programmeSheet(programme, { lang, date, drawings });
  const { doc, upper, width, write, lines, drawLine, paint, baseline } = pdfDoc({ title: sheet.title, fr: sheet.fr });
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

  // The programme's QR code (programmeQr), ink on the paper with a quiet zone of 4 modules: qr.side points wide, its
  // top left corner at (left, top).
  const drawQr = (left, top) => {
    const unit = qr.side / (qr.size + 8), x0 = left + 4 * unit, y0 = top + 4 * unit;
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
  };
  const qrLabel = upper(sheet.qrLabel), qrTrack = 8.5 * 0.14;
  // A small code at the top right, its label under it; the title and the labelled pairs take the column beside it.
  const top = y, beside = !!qr?.top, side = beside ? COLUMN - QR_SIDE - 14 : COLUMN;
  if (beside) {
    drawQr(MARGIN + COLUMN - QR_SIDE, top);
    // Set flush with the column's right edge, as the date above it: the label is wider than the code.
    write(qrLabel, MARGIN + COLUMN - width(qrLabel, 'mono', 8.5, qrTrack), top + QR_SIDE + 4, 'mono', 8.5, 1.5, COLOR.ash, qrTrack);
  }

  // The title: serif 30, set solid; a long title takes more lines at the same size.
  const titleLines = wrapText(sheet.title, side, s => width(s, 'serif', 30));
  titleLines.forEach(line => { write(line, MARGIN, y, 'serif', 30, 1.05, COLOR.ink); y += 30 * 1.05; });
  y += GAP - 30 * 0.05;

  // For whom, how many exercises and how often: labelled pairs, two to a row, as the report's people.
  const w2 = (side - 8) / 2;
  for (let first = 0; first < sheet.people.length; first += 2) {
    const row = sheet.people.slice(first, first + 2).map(([name, value]) => ({ name, block: lines(value, 12, w2) }));
    const pairH = 13.5 + 18 * Math.max(...row.map(r => r.block.lines.length));
    row.forEach(({ name, block }, i) => {
      const x = MARGIN + i * (w2 + 8);
      write(upper(name), x, y, 'mono', 9, 1.5, COLOR.ash, 9 * 0.16);
      block.lines.forEach((line, k) => drawLine(line, block.raster, x, y + 13.5 + k * 18, 12, 1.5, COLOR.ink));
    });
    y += pairH + GAP;
  }
  if (beside) y = Math.max(y, top + QR_SIDE + 4 + 8.5 * 1.5 + GAP);

  // One block per exercise: its drawings at the left, the text beside them (across the column without a drawing).
  // The text: the index, the name; the target set like the report's figures (serif, in the count's gold) with the
  // details beside it where they fit, else under it; the cue. A block is as tall as its drawings or its text, never
  // split across pages; a light rule under each, a rule over the first of each page.
  const TARGET = 18, TARGET_LH = 1.1, DETAIL = 11, DETAIL_LH = 1.4, NAME_LH = 13 * 1.4, NOTE_LH = 10.5 * 1.45, CAPTION_LH = 8.5 * 1.4;
  const detailDrop = baseline('serif', TARGET, TARGET_LH, 0) - baseline('sans', DETAIL, DETAIL_LH, 0);
  const blocks = sheet.rows.map(r => {
    const frames = r.drawing ? [r.drawing.start, r.drawing.end].filter(Boolean) : [];
    const x = frames.length ? MARGIN + ART_W + ART_GUTTER : MARGIN, w = MARGIN + COLUMN - x;
    const name = lines(r.name, 13, w - INDEX_W);
    const targetW = width(r.target, 'serif', TARGET), besideW = w - targetW - 10;
    const details = lines(r.details, DETAIL, besideW >= 70 ? besideW : w);
    const rowH = besideW >= 70
      ? Math.max(TARGET * TARGET_LH, detailDrop + details.lines.length * DETAIL * DETAIL_LH)
      : TARGET * TARGET_LH + 2 + details.lines.length * DETAIL * DETAIL_LH;
    const note = r.note ? lines(r.note, 10.5, w) : null;
    const caption = frames.length && r.drawing.similar ? wrapText(sheet.similar, ART_W, s => width(s, 'sans', 8.5)).slice(0, 2) : [];
    const textH = name.lines.length * NAME_LH + 3 + rowH + (note ? 3 + note.lines.length * NOTE_LH : 0);
    const artH = frames.length ? ART + (caption.length ? 4 + caption.length * CAPTION_LH : 0) : 0;
    return { r, frames, x, w, name, targetW, details, beside: besideW >= 70, rowH, note, caption, h: PAD + Math.max(artH, textH) + PAD };
  });
  const drawBlock = b => {
    const top = y + PAD;
    // The first pose in the first place, the last beside it; a frame that did not load leaves its place to the other.
    b.frames.forEach((f, k) => doc.addImage(f.data, f.format, MARGIN + k * (ART + ART_GAP), top, ART, ART, f.alias, 'FAST'));
    b.caption.forEach((line, k) => write(line, MARGIN, top + ART + 4 + k * CAPTION_LH, 'sans', 8.5, 1.4, COLOR.ash));
    write(b.r.index, b.x, top + 1, 'mono', 10, 1.4, COLOR.ash, 10 * 0.08);
    b.name.lines.forEach((line, k) => drawLine(line, b.name.raster, b.x + INDEX_W, top + k * NAME_LH, 13, 1.4, COLOR.ink));
    const rowTop = top + b.name.lines.length * NAME_LH + 3;
    write(b.r.target, b.x, rowTop, 'serif', TARGET, TARGET_LH, COLOR.count);
    const dx = b.beside ? b.x + b.targetW + 10 : b.x, dy = b.beside ? rowTop + detailDrop : rowTop + TARGET * TARGET_LH + 2;
    b.details.lines.forEach((line, k) => drawLine(line, b.details.raster, dx, dy + k * DETAIL * DETAIL_LH, DETAIL, DETAIL_LH, COLOR.ink));
    if (b.note) b.note.lines.forEach((line, k) => drawLine(line, b.note.raster, b.x, rowTop + b.rowH + 3 + k * NOTE_LH, 10.5, 1.45, COLOR.ash));
  };
  const opening = () => { rule(); y += 1; };
  if (room() < 1 + blocks[0].h && y > MARGIN) newPage();
  opening();
  for (const b of blocks) {
    if (room() < b.h) { newPage(); opening(); }
    drawBlock(b);
    y += b.h;
    doc.setDrawColor(COLOR.rowRule); doc.setLineWidth(1); doc.line(MARGIN, y - 0.5, MARGIN + COLUMN, y - 0.5);
  }
  y += GAP;

  // The general note, labelled as the report's notes; then the foot, which never stands alone on a page. A larger code
  // (past QR_MAX_VERSION) goes with the foot, at the left under its rule: its label and the foot's words beside it
  // where the column leaves them room, else under it. The drawings' credit closes the sheet, under the foot. The whole
  // end keeps to one page.
  const sansW = s => width(s, 'sans', 10);
  const wrapFoot = w => (sheet.foot ? wrapText(sheet.foot, w, sansW) : []);
  const foot = wrapFoot(COLUMN);
  const credit = sheet.credit ? wrapText(sheet.credit, COLUMN, s => width(s, 'sans', 8.5)) : [];
  const creditH = credit.length ? 4 + credit.length * CAPTION_LH : 0;
  const quiet = qr ? 4 * (qr.side / (qr.size + 8)) : 0;
  const textX = qr ? MARGIN + qr.side + 14 : MARGIN, textW = MARGIN + COLUMN - textX;
  const end = !qr || beside ? { kind: 'plain', h: 15 * foot.length }
    : textW >= 150 ? (() => { const words = wrapFoot(textW); return { kind: 'beside', words, h: Math.max(qr.side, quiet + 8.5 * 1.5 + 6 + 15 * words.length) }; })()
    : { kind: 'under', h: qr.side + 4 + 8.5 * 1.5 + GAP + 15 * foot.length };
  const footH = GAP + 1 + 10 + end.h + creditH;
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
  if (end.kind === 'beside') {
    drawQr(MARGIN, y);
    write(qrLabel, textX, y + quiet, 'mono', 8.5, 1.5, COLOR.ash, qrTrack);
    end.words.forEach((line, k) => write(line, textX, y + quiet + 8.5 * 1.5 + 6 + 15 * k, 'sans', 10, 1.5, COLOR.ash));
    y += end.h;
  } else {
    if (end.kind === 'under') {
      drawQr(MARGIN, y);
      write(qrLabel, MARGIN + quiet, y + qr.side + 4, 'mono', 8.5, 1.5, COLOR.ash, qrTrack);
      y += qr.side + 4 + 8.5 * 1.5 + GAP;
    }
    foot.forEach(line => { write(line, MARGIN, y, 'sans', 10, 1.5, COLOR.ash); y += 15; });
  }
  // The drawings' credit (CC BY-SA 4.0), on the sheet that prints them.
  if (credit.length) {
    y += 4;
    credit.forEach(line => { write(line, MARGIN, y, 'sans', 8.5, 1.4, COLOR.ash); y += CAPTION_LH; });
  }

  // Every page's number when there are several, where the report puts it.
  const pages = doc.getNumberOfPages();
  if (pages > 1) for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const num = `${p} / ${pages}`;
    write(num, MARGIN + COLUMN - width(num, 'mono', 8.5, 8.5 * 0.1), FOOT_Y, 'mono', 8.5, 1.5, COLOR.ash, 8.5 * 0.1);
  }
  return doc.output('blob');
}
