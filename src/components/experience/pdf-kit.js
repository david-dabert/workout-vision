// What every PDF of the app shares: an A5 page of paper in the app's own type, set as a browser sets the sheet on
// screen. The session report (report-pdf.js) and the coach's programme (programme-pdf.js) both build on it, so the
// two read as one family. One CSS pixel of the sheet is one point of the page.
import { jsPDF } from 'jspdf';
import { FONTS } from './pdf-fonts/fonts';
import { PAPER } from './palette';

export const PAGE_W = 419.53, PAGE_H = 595.28;          // A5, in points
export const COLUMN = 310;                               // the sheet's text column on a 390 px phone
export const MARGIN = (PAGE_W - COLUMN) / 2;
export const GAP = 12;                                   // .sheet { gap }
export const COLOR = PAPER;
export const FACE = { serif: 'InstrumentSerif-Regular', sans: 'Geist-Regular', sansMedium: 'Geist-Medium', mono: 'GeistMono-Regular' };
const SANS_CSS = 'Geist, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

// Greedy lines, breaking where a browser would: at spaces, and after a hyphen
// between two letters. A word wider than the line is cut between letters, as
// overflow-wrap: anywhere does. The no-break spaces (U+00A0, U+202F) belong to the
// word, as in a browser, so "17 %" (with U+00A0) never parts (audit of 6 October).
const BREAK = /[^\S  ]/, PARTS = /[^\S  ]+|[\S  ]+/g, ALL_BREAK = /^[^\S  ]+$/;
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

/**
 * A new A5 document with the app's fonts, and the tools that set text on it as a browser would.
 * title: the file's title (no app is named, not even in the file's properties: David, 29 September); fr: its language.
 */
export function pdfDoc({ title, fr }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a5', compress: true, putOnlyUsedFonts: true });
  for (const [key, font] of Object.entries(FONTS)) {
    doc.addFileToVFS(font.file, font.data);
    doc.addFont(font.file, FACE[key], 'normal', 'normal', 'Identity-H');
  }
  doc.setProperties({ title });
  doc.setLanguage(fr ? 'fr-FR' : 'en-GB');
  const upper = s => s.toLocaleUpperCase(fr ? 'fr-FR' : 'en-GB');

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

  return { doc, upper, metric, set, baseline, width, write, lines, drawLine, paint, covered };
}
