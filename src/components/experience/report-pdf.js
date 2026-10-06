// The session report's PDF: the sheet on the report screen, set on an A5 page in the
// app's own type. One CSS pixel of the sheet is one point of the page, and the
// measures below are the sheet's own (Report.css), so the two read alike.
import { jsPDF } from 'jspdf';
import { FONTS } from './pdf-fonts/fonts';
import { repStrokes, waveGeometry } from './wave';
import { partialIn } from './tempo';

const PAGE_W = 419.53, PAGE_H = 595.28;          // A5, in points
const COLUMN = 310;                               // the sheet's text column on a 390 px phone
const MARGIN = (PAGE_W - COLUMN) / 2;
const GAP = 12;                                   // .sheet { gap }
const COLOR = { paper: '#FBF7EF', ink: '#1D1812', ash: '#6B6256', rule: '#E4DCCD', rowRule: '#F0EADF', count: '#8A6630', waveBack: '#CDB68E' };
const FACE = { serif: 'InstrumentSerif-Regular', sans: 'Geist-Regular', sansMedium: 'Geist-Medium', mono: 'GeistMono-Regular' };
const SHORT_MARK = '▾';                          // report-sheet.js: after a short rep's range
const SANS_CSS = 'Geist, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

// Greedy lines, breaking where a browser would: at spaces, and after a hyphen
// between two letters. A word wider than the line is cut between letters, as
// overflow-wrap: anywhere does. The no-break spaces (U+00A0, U+202F) belong to the
// word, as in a browser, so "17\u00A0%" never parts (audit of 6 October).
const BREAK = /[^\S\u00A0\u202F]/, PARTS = /[^\S\u00A0\u202F]+|[\S\u00A0\u202F]+/g, ALL_BREAK = /^[^\S\u00A0\u202F]+$/;
export function wrapText(text, maxWidth, measure) {
  const out = [];
  const fit = (s) => { // the longest head of s, by characters, that fits the line
    const chars = [...s];
    let lo = 1, hi = chars.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (measure(chars.slice(0, mid).join('')) <= maxWidth) lo = mid; else hi = mid - 1; }
    return [chars.slice(0, lo).join(''), chars.slice(lo).join('')];
  };
  for (const para of text.split('\n')) {
    let line = '';
    const parts = (para.match(PARTS) || []).flatMap(p => BREAK.test(p) ? [p] : p.replace(/(\p{L})-(?=\p{L})/gu, '$1-\u0000').split('\u0000'));
    for (const part of parts) {
      if (ALL_BREAK.test(part)) { if (line) line += part; continue; }
      if (!line.trim() || measure(line + part) <= maxWidth) line += part;
      else { out.push(line.trimEnd()); line = part; }
      while (measure(line.trimEnd()) > maxWidth && [...line.trimEnd()].length > 1) {
        const [head, rest] = fit(line.trimEnd());
        out.push(head);
        line = rest;
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

// Each font's kerning, decoded once: the adjustment between two characters, in thousandths of the size.
const KERNING = {};
function kerning(key) {
  if (!(key in KERNING)) {
    const k = FONTS[key].kern;
    if (!k) KERNING[key] = null;
    else {
      const left = new Map(), right = new Map(), table = new Map();
      k.left.forEach((chars, i) => { for (const ch of chars) left.set(ch, i); });
      k.right.forEach((chars, i) => { for (const ch of chars) right.set(ch, i); });
      for (const [l, r, v] of k.table) table.set(l * 1024 + r, v);
      KERNING[key] = (a, b) => { const l = left.get(a), r = right.get(b); return l === undefined || r === undefined ? 0 : table.get(l * 1024 + r) || 0; };
    }
  }
  return KERNING[key];
}

/** Builds the PDF of one report sheet (see reportSheet). Synchronous, so the share stays within the tap. */
export function reportPdf(sheet) {
  const doc = new jsPDF({ unit: 'pt', format: 'a5', compress: true, putOnlyUsedFonts: true });
  for (const [key, font] of Object.entries(FONTS)) {
    doc.addFileToVFS(font.file, font.data);
    doc.addFont(font.file, FACE[key], 'normal', 'normal', 'Identity-H');
  }
  // The report names no app (David, 29 September), not even in the file's properties.
  doc.setProperties({ title: sheet.title });
  doc.setLanguage(sheet.fr ? 'fr-FR' : 'en-GB');
  const upper = s => s.toLocaleUpperCase(sheet.fr ? 'fr-FR' : 'en-GB');

  const metric = {};
  for (const key of Object.keys(FACE)) {
    doc.setFont(FACE[key], 'normal');
    const m = doc.getFont().metadata;
    metric[key] = { ascent: m.ascender / 1000, descent: -m.decender / 1000, font: m };
  }
  const set = (key, size, color) => { doc.setFont(FACE[key], 'normal'); doc.setFontSize(size); if (color) doc.setTextColor(color); };
  // Where a browser puts the baseline in a line box of height lh × size whose top is `top`:
  // ascent and descent rounded to whole pixels, then half the leading, rounded down, above.
  const baseline = (key, size, lh, top) => {
    const a = Math.round(metric[key].ascent * size), d = Math.round(metric[key].descent * size);
    return top + Math.floor((lh * size - a - d) / 2) + a;
  };

  // Widths and text as a browser sets them: with the font's kerning, and letter-spacing after every character.
  function width(text, key, size, track = 0) {
    set(key, size);
    const kern = kerning(key), c = [...text];
    let k = 0;
    if (kern) for (let i = 1; i < c.length; i++) k += kern(c[i - 1], c[i]);
    return doc.getTextWidth(text) + k * size / 1000 + track * c.length;
  }
  function write(text, x, top, key, size, lh, color, track = 0) {
    set(key, size, color);
    const base = baseline(key, size, lh, top), kern = !track && kerning(key);
    if (!kern) { doc.text(text, x, base, track ? { charSpace: track } : undefined); return; }
    const c = [...text];
    let from = 0, dx = 0;
    for (let i = 1; i <= c.length; i++) {
      const k = i < c.length ? kern(c[i - 1], c[i]) : 0;
      if (!k && i < c.length) continue;
      const run = c.slice(from, i).join('');
      doc.text(run, x + dx, base);
      dx += doc.getTextWidth(run) + k * size / 1000;
      from = i;
    }
  }

  // jsPDF stops at the first character its font lacks, so text with any such
  // character (an emoji, another script) is drawn by the browser instead, in
  // the same face, size and place, and set on the page as a picture of the line.
  const covered = text => [...text].every(ch => ch === '\n' || metric.sans.font.characterToGlyph(ch.codePointAt(0)) !== 0);
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  function lines(text, size, w) {
    if (covered(text) || !canvas) return { raster: false, lines: wrapText(text, w, s => width(s, 'sans', size)) };
    canvas.font = `400 ${size}px ${SANS_CSS}`;
    return { raster: true, lines: wrapText(text, w, s => canvas.measureText(s).width) };
  }
  function drawLine(line, raster, x, top, size, lh, color) {
    if (!line) return;
    if (!raster) { write(line, x, top, 'sans', size, lh, color); return; }
    const k = 4, c = document.createElement('canvas'), ctx = c.getContext('2d');
    ctx.font = `400 ${size}px ${SANS_CSS}`;
    const w = Math.ceil(ctx.measureText(line).width + 2);
    c.width = w * k; c.height = Math.ceil(lh * size * k);
    ctx.scale(k, k);
    ctx.font = `400 ${size}px ${SANS_CSS}`;
    ctx.fillStyle = color;
    ctx.fillText(line, 0, baseline('sans', size, lh, 0));
    doc.addImage(c.toDataURL('image/png'), 'PNG', x, top, w, c.height / k, undefined, 'FAST');
  }

  const paint = () => { doc.setFillColor(COLOR.paper); doc.rect(0, 0, PAGE_W, PAGE_H, 'F'); };
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
  y = Math.max(top + above - bNum + 58 * 0.9, wordTop + 19.5 + 18 * lift.lines.length) + GAP;

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
    const geo = waveGeometry({ angles: sheet.wave.a, timestamps: sheet.wave.t, rest: sheet.wave.rest, width: COLUMN, height: H, pad: 2 });
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
