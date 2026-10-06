// The session report's PDF: the sheet on the report screen, set on an A5 page in the
// app's own type. One CSS pixel of the sheet is one point of the page, and the
// measures below are the sheet's own (Report.css), so the two read alike.
import { PAGE_H, COLUMN, MARGIN, GAP, COLOR, pdfDoc, wrapText } from './pdf-kit';
import { repStrokes, waveGeometry } from './wave';
import { partialIn } from './tempo';

const SHORT_MARK = '▾';                          // report-sheet.js: after a short rep's range

// The line breaking is the kit's (pdf-kit.js), kept here under its old name for the report's tests.
export { wrapText };

/** Builds the PDF of one report sheet (see reportSheet). Synchronous, so the share stays within the tap. */
export function reportPdf(sheet) {
  // The report names no app (David, 29 September), not even in the file's properties.
  const { doc, upper, width, write, lines, drawLine, paint, baseline } = pdfDoc({ title: sheet.title, fr: sheet.fr });
  paint();
  let y = MARGIN;
  // Every page keeps a footer for the experimental notice and the page number (drawn last, footers()).
  const FOOTER = 22;
  const room = () => PAGE_H - MARGIN - FOOTER - y;
  // Once the measures have begun, every new page opens with the experimental label, so no page shows a measure
  // without it (R8; audit of 3 October: a long set's table ran onto pages without it).
  let measuresBegun = false;
  // The experimental notice now closes every page in its footer (footers()), so a new page opens on its content
  // (David's iPhone, 5 October: the notice heading each page read as debris). measuresBegun is kept for that rule.
  // Each page's notice is set as the page is finished, the page number once the count of pages is known (end).
  const FOOT_Y = PAGE_H - MARGIN - 12, NUM_W = 40;
  const footer = () => {
    if (!sheet.experimental) return;
    const block = lines(sheet.experimental, 8.5, COLUMN - NUM_W);
    drawLine(block.lines[0], block.raster, MARGIN, FOOT_Y, 8.5, 1.5, COLOR.ash);
  };
  const newPage = () => { footer(); doc.addPage('a5'); paint(); y = MARGIN; };
  const rule = () => { doc.setDrawColor(COLOR.rule); doc.setLineWidth(1); doc.line(MARGIN, y + 0.5, MARGIN + COLUMN, y + 0.5); };
  const label = (text, x, top) => write(upper(text), x, top, 'mono', 9, 1.5, COLOR.ash, 9 * 0.16);

  // Brand and date: mono 9.5, tracked 0.2 em, in capitals, on one baseline.
  const track = 9.5 * 0.2, date = upper(sheet.date);
  if (sheet.brand) write(upper(sheet.brand), MARGIN, y, 'mono', 9.5, 1.5, COLOR.ash, track);
  write(date, MARGIN + COLUMN - width(date, 'mono', 9.5, track), y, 'mono', 9.5, 1.5, COLOR.ash, track);
  y += 9.5 * 1.5 + GAP;

  // Title: serif 30, set solid.
  write(sheet.title, MARGIN, y, 'serif', 30, 1, COLOR.ink);
  y += 30 + GAP;

  // What the user filled in about themselves, two to a row, in two columns 8 apart; nothing when
  // nothing was filled in (step 1: no coach is assumed). The count's details are set the same way.
  const colW = (COLUMN - 8) / 2;
  const pairs = (items, per = 2) => {
    const w = (COLUMN - 8 * (per - 1)) / per;
    for (let r = 0; r < items.length; r += per) {
      // A label wider than its column ("COUNTED BY THE APP" in three) wraps there, as the sheet's does.
      const row = items.slice(r, r + per).map(([name, value]) => ({ heads: wrapText(upper(name), w, t => width(t, 'mono', 9, 9 * 0.16)), block: lines(value, 12, w) }));
      const headH = 13.5 * Math.max(...row.map(c => c.heads.length));
      if (room() < headH + 18 * Math.max(...row.map(c => c.block.lines.length)) && y > MARGIN) newPage();
      row.forEach(({ heads, block }, i) => {
        const x = MARGIN + i * (w + 8);
        heads.forEach((h, k) => write(h, x, y + k * 13.5, 'mono', 9, 1.5, COLOR.ash, 9 * 0.16));
        block.lines.forEach((line, k) => drawLine(line, block.raster, x, y + headH + k * 18, 12, 1.5, COLOR.ink));
      });
      y += headH + 18 * Math.max(...row.map(c => c.block.lines.length)) + GAP;
    }
  };
  pairs(sheet.people);

  // The count: a rule, then the numeral and its words on one baseline.
  rule();
  const top = y + 1 + 12;
  const numW = width(sheet.count, 'serif', 58);
  const bNum = baseline('serif', 58, 0.9, 0), bWord = baseline('sansMedium', 13, 1.5, 0), above = Math.max(bNum, bWord);
  write(sheet.count, MARGIN, top + above - bNum, 'serif', 58, 0.9, COLOR.count);
  const wx = MARGIN + numW + 12, wordTop = top + above - bWord;
  write(sheet.word, wx, wordTop, 'sansMedium', 13, 1.5, COLOR.ink);
  const lift = lines(sheet.lift, 12, COLUMN - numW - 12);
  lift.lines.forEach((line, k) => drawLine(line, lift.raster, wx, wordTop + 19.5 + k * 18, 12, 1.5, COLOR.ash));
  // The coach's target, for a set filmed from a programme: in ink under the exercise, as on the sheet (.sh-planned).
  const planned = sheet.planned ? lines(sheet.planned, 12, COLUMN - numW - 12) : null;
  const plannedTop = wordTop + 19.5 + 18 * lift.lines.length + 2;
  planned?.lines.forEach((line, k) => drawLine(line, planned.raster, wx, plannedTop + k * 18, 12, 1.5, COLOR.ink));
  const wordsEnd = planned ? plannedTop + 18 * planned.lines.length : wordTop + 19.5 + 18 * lift.lines.length;
  y = Math.max(top + above - bNum + 58 * 0.9, wordsEnd) + GAP;

  // The opener: sans 13 in ink, as .sh-opener, the caption of the count under it (critic, 30 September).
  if (sheet.opener) {
    const block = lines(sheet.opener, 13, COLUMN);
    block.lines.forEach(line => { drawLine(line, block.raster, MARGIN, y, 13, 1.5, COLOR.ink); y += 13 * 1.5; });
    y += GAP;
  }

  // What the app counted, when the visitor corrected it, and the arm it followed.
  const sheetLine = text => {
    const block = lines(text, 12, COLUMN);
    block.lines.forEach(line => { if (room() < 18 && y > MARGIN) newPage(); drawLine(line, block.raster, MARGIN, y, 12, 1.5, COLOR.ash); y += 18; });
    y += GAP;
  };
  // How the count was made, labelled like the people (report-sheet.js, details).
  pairs(sheet.details || [], 3);
  // The set's two figures, set like the count: a rule, two columns, a label in capitals over a serif value in gold.
  if (sheet.stats?.length) {
    const H = 1 + 12 + 13.5 + 4 + 26;
    if (room() < H && y > MARGIN) newPage();
    rule();
    y += 1 + 12;
    sheet.stats.forEach(([name, value], i) => {
      const x = MARGIN + i * (colW + 8);
      label(name, x, y);
      write(value, x, y + 13.5 + 4, 'serif', 26, 1, COLOR.count);
    });
    y += 13.5 + 4 + 26 + GAP;
  }
  measuresBegun = true;

  // The wave (wave.js), as on the report screen: the measured angle as a hairline, each rep over it in the
  // count's colour, its return lighter, a cut or partial rep in ash.
  if (sheet.wave) {
    const H = 60, label = upper(sheet.fr ? `Angle ${sheet.wave.jointWord}` : `${sheet.wave.jointWord} angle`);
    if (room() < 13.5 + 16.5 + 8 + H && y > MARGIN) newPage();
    write(label, MARGIN, y, 'mono', 9, 1.5, COLOR.ash, 9 * 0.12);
    y += 13.5;
    // The key shows the two strokes themselves, as the sheet does (RepWave.jsx).
    const keyOut = sheet.fr ? 'aller' : 'out', keyBack = sheet.fr ? 'retour' : 'back', mid = y + 16.5 / 2;
    doc.setLineWidth(2); doc.setDrawColor(COLOR.count); doc.line(MARGIN, mid, MARGIN + 14, mid);
    write(keyOut, MARGIN + 19, y, 'sans', 11, 1.5, COLOR.ash);
    const bx = MARGIN + 19 + width(keyOut, 'sans', 11) + 14;
    doc.setDrawColor(COLOR.waveBack); doc.line(bx, mid, bx + 14, mid);
    write(keyBack, bx + 19, y, 'sans', 11, 1.5, COLOR.ash);
    y += 16.5 + 8;
    const ref = sheet.wave.reference;
    const geo = waveGeometry({ angles: sheet.wave.a, timestamps: sheet.wave.t, rest: sheet.wave.rest, width: COLUMN, height: H, pad: 2, include: ref ? [ref.lo, ref.hi] : null });
    // The reference band (reference-ranges.js), faint, behind the wave; unlabelled, as on the screen.
    if (geo && ref) { const a = geo.y(ref.lo), b = geo.y(ref.hi); doc.setFillColor(COLOR.rowRule); doc.rect(MARGIN, y + Math.min(a, b), COLUMN, Math.abs(b - a), 'F'); }
    const draw = (strokes, color, w) => {
      doc.setDrawColor(color); doc.setLineWidth(w);
      for (const s of strokes) for (let k = 1; k < s.length; k++) doc.line(MARGIN + s[k - 1][0], y + s[k - 1][1], MARGIN + s[k][0], y + s[k][1]);
    };
    if (geo) {
      draw(geo.strokes(), COLOR.rule, 0.75);
      const reps = sheet.wave.reps, partial = partialIn(reps);
      repStrokes(geo, reps, { first: sheet.wave.first, isPartial: partial }).forEach((s, i) => {
        const r = reps[i], a = geo.index(r.startTime), b = geo.index(r.endTime);
        if (!s.whole) { doc.setLineDashPattern([2, 3], 0); draw(geo.strokes(a, b), COLOR.ash, 1); doc.setLineDashPattern([], 0); return; }
        const leave = sheet.wave.first === 'concentric' ? r.concentricSec : r.eccentricSec, turn = geo.index(r.startTime + leave);
        draw(geo.strokes(a, turn), COLOR.count, 1.6);
        draw(geo.strokes(turn, b), COLOR.waveBack, 1.6);
      });
    }
    y += H + GAP;
  }

  // The reps table: Rep (14%, "REPÈRE" after a correction), Tempo (29%), Range (21%), Peak (18%), Mean (18%): wide enough that no
  // heading runs into the next ("RÉP.TEMPO", "AMPLITUDEPIC" on David's report of 29 September).
  // With collapsed borders each row holds half of the 1 px rule above it and
  // below it: the heading row is 6 + 13.5 + 6 + 0.5 high, a rep's row
  // 0.5 + 5 + 17.25 + 5 + 0.5, and the table ends half a rule below its last
  // line. A row that does not fit opens a page, which repeats the heading.
  if (sheet.rows?.length) {
    const widths = [COLUMN * 0.14, COLUMN * 0.29, COLUMN * 0.21, COLUMN * 0.18, COLUMN * 0.18];
    const colX = k => MARGIN + widths.slice(0, k).reduce((a, b) => a + b, 0);
    const HEAD = 26, ROW = 24;
    const hline = (at, color) => { doc.setDrawColor(color); doc.setLineWidth(1); doc.line(MARGIN, at, MARGIN + COLUMN, at); };
    const heading = () => {
      sheet.columns.forEach((c, k) => write(upper(c), colX(k), y + 6, 'mono', 9, 1.5, COLOR.ash, 9 * 0.12));
      hline(y + HEAD, COLOR.rule);
      y += HEAD;
    };
    // The table stays whole when a fresh page holds it, rather than leaving a row or two behind.
    const whole = HEAD + ROW * sheet.rows.length + 0.5, BODY = PAGE_H - 2 * MARGIN - FOOTER;
    if ((room() < whole && whole <= BODY || room() < HEAD + ROW + 0.5) && y > MARGIN) newPage();
    heading();
    sheet.rows.forEach(row => {
      if (room() < ROW + 0.5) { newPage(); heading(); }
      row.forEach((v, k) => {
        const top = y + 0.5 + (ROW - 1 - 17.25) / 2;
        if (!v.endsWith(SHORT_MARK)) { write(v, colX(k), top, 'mono', 11.5, 1.5, COLOR.ink); return; }
        // The short-rep mark: the mono face has no ▾ and jsPDF dropped it (audit of 6 October), so it is drawn,
        // a small triangle in the text's colour after the value, its point on the baseline.
        const t = v.slice(0, -SHORT_MARK.length), x = colX(k) + width(t, 'mono', 11.5), base = baseline('mono', 11.5, 1.5, top);
        write(t, colX(k), top, 'mono', 11.5, 1.5, COLOR.ink);
        const w = 11.5 * 0.5, h = 11.5 * 0.42;
        doc.setFillColor(COLOR.ink);
        doc.triangle(x, base - h, x + w, base - h, x + w / 2, base, 'F');
      });
      hline(y + ROW, COLOR.rowRule);
      y += ROW;
    });
    y += 0.5 + GAP;
  }
  // The table's two marks, as footnotes under it, small.
  const notesUnder = [sheet.shortRepNote, sheet.partialRepNote].filter(Boolean).join('     ');
  if (notesUnder) {
    if (room() < 15 && y > MARGIN) newPage();
    y -= GAP - 4;
    const nb = lines(notesUnder, 10, COLUMN);
    drawLine(nb.lines[0], nb.raster, MARGIN, y, 10, 1.5, COLOR.ash);
    y += 15 + GAP;
  }
  // What the figures do not say, one item per line (Luc, 29 September).
  (sheet.more || []).forEach(sheetLine);
  // The key to the measures (report-sheet.js, measureGuide), as the sheet shows it: the table's headings as terms, in
  // small capitals and the count's gold, the definitions in ink, and the tempo's four phases drawn as boxes.
  if (sheet.guide) {
    const g = sheet.guide, TERM = COLUMN * 0.27, TEXT_X = MARGIN + TERM + 10, TEXT_W = COLUMN - TERM - 10, LH = 12.5 * 1.45;
    const BOX_H = 44, BOX_GAP = 6;
    const need = text => lines(text, 12.5, TEXT_W).lines.length * LH;
    // The key stays whole when a fresh page holds it.
    const whole = 1 + 13 + 13.5 + 10 + need(g.tempo.text) + 8 + BOX_H + 9 + g.items.reduce((a, i) => a + Math.max(need(i.text), wrapText(upper(i.term), TERM, t => width(t, 'mono', 9, 9 * 0.06)).length * 13.5) + 9, 0);
    if (room() < whole && y > MARGIN) newPage();
    doc.setDrawColor(COLOR.rule); doc.setLineWidth(1); doc.line(MARGIN, y, MARGIN + COLUMN, y);
    y += 13;
    write(upper(g.title), MARGIN, y, 'mono', 9, 1.5, COLOR.ash, 9 * 0.16);
    y += 13.5 + 10;
    // A term longer than its column ("TEMPS SOUS TENSION") wraps there, as the sheet's does, and never runs into its text.
    const row = (term, text, after = 0) => {
      const block = lines(text, 12.5, TEXT_W);
      const termLines = wrapText(upper(term), TERM, s => width(s, 'mono', 9, 9 * 0.06)), TERM_LH = 13.5;
      const h = Math.max(block.lines.length * LH, termLines.length * TERM_LH);
      if (room() < h + after && y > MARGIN) newPage();
      termLines.forEach((t, k) => write(t, MARGIN, y + 3 + k * TERM_LH, 'mono', 9, 1.5, COLOR.count, 9 * 0.06));
      block.lines.forEach((line, k) => drawLine(line, block.raster, TEXT_X, y + k * LH, 12.5, 1.45, COLOR.ink));
      y += h;
    };
    row(g.tempo.term, g.tempo.text, 8 + BOX_H);
    y += 8;
    const n = g.tempo.example.length, boxW = (TEXT_W - BOX_GAP * (n - 1)) / n;
    g.tempo.example.forEach(([digit, label], k) => {
      const x = TEXT_X + k * (boxW + BOX_GAP);
      doc.setDrawColor(COLOR.rule); doc.setLineWidth(1); doc.roundedRect(x, y, boxW, BOX_H, 9, 9, 'S');
      write(digit, x + (boxW - width(digit, 'serif', 24)) / 2, y + 5, 'serif', 24, 1, COLOR.count);
      const cap = upper(label);
      write(cap, x + (boxW - width(cap, 'mono', 8, 8 * 0.08)) / 2, y + 29, 'mono', 8, 1.2, COLOR.ash, 8 * 0.08);
    });
    y += BOX_H + 9;
    g.items.forEach(i => { row(i.term, i.text); y += 9; });
    y += GAP - 9;
  }

  // Notes, when the user wrote any, then the foot. The notes label keeps its first line, and the
  // foot never stands alone on a page: it takes the last two lines of notes with it.
  const foot = sheet.foot ? wrapText(sheet.foot, COLUMN, s => width(s, 'sans', 10)) : [];
  const footH = foot.length ? GAP + 1 + 10 + 15 * foot.length : 0;
  if (sheet.notes) {
    const notes = lines(sheet.notes, 12.5, COLUMN), NL = 12.5 * 1.5;
    const need = i => { const left = notes.lines.length - i; return left <= 2 ? left * NL + footH : NL; };
    if (room() < 13.5 + 4 + need(0) && y > MARGIN) newPage();
    label(sheet.notesLabel, MARGIN, y);
    y += 13.5 + 4;
    notes.lines.forEach((line, i) => {
      if (room() < need(i) && y > MARGIN) newPage();
      drawLine(line, notes.raster, MARGIN, y, 12.5, 1.5, COLOR.ink);
      y += NL;
    });
  } else if (room() < footH && y > MARGIN) newPage();
  if (foot.length) {
    y += GAP;
    rule();
    y += 1 + 10;
    foot.forEach(line => { write(line, MARGIN, y, 'sans', 10, 1.5, COLOR.ash); y += 15; });
  }

  // The last page's notice, then every page's number when there are several.
  footer();
  const pages = doc.getNumberOfPages();
  if (pages > 1) for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const num = `${p} / ${pages}`;
    write(num, MARGIN + COLUMN - width(num, 'mono', 8.5, 8.5 * 0.1), FOOT_Y, 'mono', 8.5, 1.5, COLOR.ash, 8.5 * 0.1);
  }
  return doc.output('blob');
}
