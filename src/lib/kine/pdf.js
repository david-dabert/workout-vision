// The physiotherapist's two documents, on the app's paper (components/experience/pdf-kit.js): the patient's exercise
// sheet, with the QR code of the programme's link, and the note d'honoraires. Loaded on demand (KineWorkspace.jsx).
// The note's legal mentions are those a French physiotherapist's note of fees carries: the practitioner's identity and
// RPPS/ADELI number, the patient, the date, each act and its fee, the total, and the exemption from VAT of medical
// care (Code général des impôts, article 261-4-1°). Source: CGI art. 261-4-1°. Status: literature.
import QRCode from 'qrcode';
import { pdfDoc, PAGE_W, PAGE_H, MARGIN, COLUMN, COLOR } from '../../components/experience/pdf-kit';
import { exerciseById } from './library';

const euro = (n, fr) => new Intl.NumberFormat(fr ? 'fr-FR' : 'en-GB', { style: 'currency', currency: 'EUR' }).format(n || 0);
const day = (iso, fr) => {
  const d = iso ? new Date(`${iso}T12:00:00`) : new Date();
  return d.toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

function textBlock(k, text, x, top, w, size, color, lh = 1.45) {
  const { lines, raster } = k.lines(text, size, w);
  lines.forEach((line, i) => k.drawLine(line, raster, x, top + i * size * lh, size, lh, color));
  return top + lines.length * size * lh;
}

function qrDraw(doc, link, x, y, side) {
  const qr = QRCode.create(link, { errorCorrectionLevel: 'L' });
  const n = qr.modules.size, cell = side / (n + 8);
  doc.setFillColor(COLOR.ink);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.modules.get(r, c)) doc.rect(x + (c + 4) * cell, y + (r + 4) * cell, cell, cell, 'F');
}

/** The patient's sheet: the programme's exercises, Olivier's steps, the dosage and the physiotherapist's notes. */
export function programmePdf(p, { lang = 'fr', link }) {
  const fr = lang === 'fr';
  const k = pdfDoc({ title: fr ? 'Programme d’exercices' : 'Exercise programme', fr });
  const { doc } = k;
  k.paint();
  let y = MARGIN;
  const newPageIfNeeded = need => { if (y + need > PAGE_H - MARGIN) { doc.addPage(); k.paint(); y = MARGIN; } };
  k.write(k.upper(fr ? 'Programme d’exercices' : 'Exercise programme'), MARGIN, y, 'mono', 7, 1.4, COLOR.ash, 1.2);
  y += 16;
  k.write(p.patient || (fr ? 'Votre programme' : 'Your programme'), MARGIN, y, 'serif', 26, 1.1, COLOR.ink);
  y += 34;
  const who = [p.kine?.name, p.kine?.phone, p.kine?.email].filter(Boolean).join(' · ');
  if (who) y = textBlock(k, who, MARGIN, y, COLUMN - 100, 8.5, COLOR.ash) + 4;
  y = textBlock(k, fr ? `${p.perDay} fois par jour, pendant ${p.weeks} semaine${p.weeks > 1 ? 's' : ''}.` : `${p.perDay} times a day, for ${p.weeks} week${p.weeks > 1 ? 's' : ''}.`, MARGIN, y, COLUMN - 100, 9.5, COLOR.ink) + 6;
  if (link) {
    try { qrDraw(doc, link, PAGE_W - MARGIN - 86, MARGIN - 6, 86); } catch { /* a link too long for a code still works */ }
  }
  if (p.note) y = textBlock(k, p.note, MARGIN, y, COLUMN, 9, COLOR.ink) + 8;
  y = Math.max(y, MARGIN + 96);
  p.items.forEach((it, i) => {
    const e = exerciseById(it.id);
    if (!e) return;
    const t = e[fr ? 'fr' : 'en'];
    newPageIfNeeded(90);
    doc.setDrawColor(COLOR.rule); doc.setLineWidth(0.5); doc.line(MARGIN, y, MARGIN + COLUMN, y);
    y += 10;
    k.write(`${i + 1}. ${t.title}`, MARGIN, y, 'sansMedium', 11, 1.3, COLOR.ink);
    y += 16;
    k.write(fr ? `${it.sets} séries de ${it.reps} répétitions` : `${it.sets} sets of ${it.reps} repetitions`, MARGIN, y, 'serif', 14, 1.2, COLOR.count);
    y += 20;
    y = textBlock(k, t.position, MARGIN, y, COLUMN, 8.5, COLOR.ash) + 2;
    if (e.side && it.side && it.side !== e.side) y = textBlock(k, fr ? `Côté à travailler\u00A0: ${it.side === 'left' ? 'gauche' : 'droit'}.` : `Side to work: ${it.side}.`, MARGIN, y, COLUMN, 8.5, COLOR.count) + 2;
    t.steps.forEach((s, n) => { newPageIfNeeded(14); y = textBlock(k, `${n + 1}. ${s}`, MARGIN + 6, y, COLUMN - 6, 8.5, COLOR.ink); });
    if (it.note) { newPageIfNeeded(24); y = textBlock(k, (fr ? 'Conseil\u00A0: ' : 'Advice: ') + it.note, MARGIN, y + 4, COLUMN, 8.5, COLOR.count); }
    y += 10;
  });
  newPageIfNeeded(30);
  textBlock(k, fr ? 'Scannez le code pour ouvrir le programme avec les vidéos, et filmer vos essais\u00A0: l’appli les compare au geste de référence. Vos vidéos restent sur votre téléphone.' : 'Scan the code to open the programme with the videos and film your attempts: the app compares them with the reference movement. Your videos stay on your phone.', MARGIN, y, COLUMN, 7.5, COLOR.ash);
  return doc;
}

/** The note d'honoraires: practitioner, patient, acts and fees, total, VAT exemption. */
export function invoicePdf(inv, { lang = 'fr' }) {
  const fr = lang === 'fr';
  const k = pdfDoc({ title: fr ? `Note d’honoraires ${inv.number}` : `Invoice ${inv.number}`, fr });
  const { doc } = k;
  k.paint();
  let y = MARGIN;
  k.write(k.upper(fr ? 'Note d’honoraires' : 'Invoice'), MARGIN, y, 'mono', 7, 1.4, COLOR.ash, 1.2);
  k.write(`N° ${inv.number}`, PAGE_W - MARGIN - k.width(`N° ${inv.number}`, 'mono', 8), y, 'mono', 8, 1.4, COLOR.ash);
  y += 18;
  const pr = inv.practitioner || {};
  k.write(pr.name || '', MARGIN, y, 'serif', 22, 1.1, COLOR.ink);
  y += 28;
  const prLines = [pr.title, pr.address, [pr.phone, pr.email].filter(Boolean).join(' · '), pr.rpps ? `RPPS / ADELI\u00A0: ${pr.rpps}` : '', pr.siret ? `SIRET\u00A0: ${pr.siret}` : ''].filter(Boolean);
  prLines.forEach(l => { y = textBlock(k, l, MARGIN, y, COLUMN, 8.5, COLOR.ash); });
  y += 14;
  k.write(k.upper(fr ? 'Patient' : 'Patient'), MARGIN, y, 'mono', 7, 1.4, COLOR.ash, 1.2);
  k.write(k.upper(fr ? 'Date' : 'Date'), MARGIN + 200, y, 'mono', 7, 1.4, COLOR.ash, 1.2);
  y += 12;
  k.write(inv.patient || '', MARGIN, y, 'sansMedium', 10.5, 1.3, COLOR.ink);
  k.write(day(inv.date, fr), MARGIN + 200, y, 'sansMedium', 10.5, 1.3, COLOR.ink);
  y += 26;
  doc.setDrawColor(COLOR.rule); doc.setLineWidth(0.5); doc.line(MARGIN, y, MARGIN + COLUMN, y);
  y += 8;
  let total = 0;
  for (const line of inv.lines || []) {
    const amount = Number(line.amount) || 0;
    total += amount;
    const a = euro(amount, fr);
    const top = y;
    y = textBlock(k, line.label || '', MARGIN, y, COLUMN - 80, 9.5, COLOR.ink);
    k.write(a, MARGIN + COLUMN - k.width(a, 'sans', 9.5), top, 'sans', 9.5, 1.45, COLOR.ink);
    y += 4;
    doc.setDrawColor(COLOR.rowRule); doc.line(MARGIN, y, MARGIN + COLUMN, y);
    y += 6;
  }
  y += 6;
  const t = euro(total, fr);
  k.write(fr ? 'Total' : 'Total', MARGIN, y, 'sansMedium', 11, 1.3, COLOR.ink);
  k.write(t, MARGIN + COLUMN - k.width(t, 'serif', 20), y - 6, 'serif', 20, 1.2, COLOR.count);
  y += 30;
  if (inv.paid) y = textBlock(k, fr ? `Acquittée le ${day(inv.date, fr)}${inv.method ? ` par ${inv.method}` : ''}.` : `Paid on ${day(inv.date, fr)}${inv.method ? ` by ${inv.method}` : ''}.`, MARGIN, y, COLUMN, 9, COLOR.ink) + 4;
  textBlock(k, fr ? 'TVA non applicable, article 261-4-1° du Code général des impôts.' : 'VAT not applicable (French tax code, article 261-4-1°).', MARGIN, y, COLUMN, 8, COLOR.ash);
  return doc;
}
