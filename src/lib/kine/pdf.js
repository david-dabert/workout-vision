// The physiotherapist's documents, on the app's paper (components/experience/pdf-kit.js): the patient's exercise
// sheet, with the QR code of the programme's link, the note d'honoraires, and a patient's follow-up sheet. Loaded on demand (KineWorkspace.jsx).
// The note's legal mentions are those a French physiotherapist's note of fees carries: the practitioner's identity and
// RPPS/ADELI number, the patient, the date, each act and its fee, the total, and the exemption from VAT of medical
// care (Code général des impôts, article 261-4-1°). Source: CGI art. 261-4-1°. Status: literature.
import QRCode from 'qrcode';
import { pdfDoc, PAGE_W, PAGE_H, MARGIN, COLUMN, COLOR } from '../../components/experience/pdf-kit';
import { exerciseById } from './library';
import { sessionWithin } from './store';
import { TOLERANCE_DEG, TOLERANCE_SHARE } from '../reference/compare';
import { COPY, JOINT_NAMES } from '../../components/reference/reference-copy';

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

const pctText = (x, fr) => (x == null ? '–' : `${Math.round(x * 100)}${fr ? '\u00A0%' : '%'}`);

/**
 * A patient's follow-up sheet (FollowUp.jsx): per exercise, each attempt received with its verdict, share within
 * tolerance and range reached per measure, and positions held; the first and last shares; the tolerance said to be
 * provisional (R8).
 */
export function followUpPdf(patient, { lang = 'fr', practitioner = {} }) {
  const fr = lang === 'fr';
  const names = JOINT_NAMES[fr ? 'fr' : 'en'];
  const nameOf = m => (Object.hasOwn(names, m) ? names[m] : m);
  const k = pdfDoc({ title: fr ? `Suivi · ${patient.name}` : `Follow-up · ${patient.name}`, fr });
  const { doc } = k;
  k.paint();
  let y = MARGIN;
  const newPageIfNeeded = need => { if (y + need > PAGE_H - MARGIN) { doc.addPage(); k.paint(); y = MARGIN; } };
  k.write(k.upper(fr ? 'Suivi du patient' : 'Patient follow-up'), MARGIN, y, 'mono', 7, 1.4, COLOR.ash, 1.2);
  y += 16;
  k.write(patient.name || (fr ? 'Patient sans nom' : 'Unnamed patient'), MARGIN, y, 'serif', 22, 1.1, COLOR.ink);
  y += 30;
  const who = [practitioner.name, practitioner.title, practitioner.phone].filter(Boolean).join(' · ');
  if (who) y = textBlock(k, who, MARGIN, y, COLUMN, 8.5, COLOR.ash) + 2;
  y = textBlock(k, fr ? `Édité le ${day(null, fr)}.` : `Printed on ${day(null, fr)}.`, MARGIN, y, COLUMN, 8.5, COLOR.ash) + 10;
  const verdict = v => (v === 'match' ? (fr ? 'Conforme à la référence' : 'Matches the reference') : v === 'revise' ? (fr ? 'À revoir' : 'To revise') : (fr ? 'Pas de verdict' : 'No verdict'));
  for (const { id, sessions } of patient.exercises) {
    const e = exerciseById(id);
    if (!e) continue;
    newPageIfNeeded(70);
    doc.setDrawColor(COLOR.rule); doc.setLineWidth(0.5); doc.line(MARGIN, y, MARGIN + COLUMN, y);
    y += 10;
    k.write(e[fr ? 'fr' : 'en'].title, MARGIN, y, 'sansMedium', 11, 1.3, COLOR.ink);
    y += 16;
    const dated = sessions.filter(s => s.date);
    const first = dated.length > 1 ? sessionWithin(dated[0]) : null, last = dated.length > 1 ? sessionWithin(dated.at(-1)) : null;
    if (first != null && last != null) {
      y = textBlock(k, fr ? `Point le plus faible\u00A0: ${pctText(first, fr)} du geste dans la tolérance au premier essai, ${pctText(last, fr)} au dernier (${sessions.length} essais).` : `Weakest point: ${pctText(first, fr)} of the movement within tolerance at the first attempt, ${pctText(last, fr)} at the last (${sessions.length} attempts).`, MARGIN, y, COLUMN, 9, COLOR.count) + 4;
    }
    for (const s of sessions) {
      newPageIfNeeded(20 + 13 * (s.joints.length + (s.holds.length ? 1 : 0)));
      const date = s.date ? new Date(s.date).toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–';
      k.write(`${date} · ${verdict(s.verdict)}`, MARGIN, y, 'sansMedium', 9, 1.4, COLOR.ink);
      y += 13;
      for (const j of s.joints) {
        y = textBlock(k, `${nameOf(j.name)}\u00A0: ${fr ? 'dans la tolérance' : 'within tolerance'} ${pctText(j.within, fr)}, ${fr ? 'amplitude atteinte' : 'range reached'} ${pctText(j.range == null ? null : Math.min(j.range, 9.99), fr)}`, MARGIN + 8, y, COLUMN - 8, 8.5, COLOR.ink);
      }
      if (s.holds.length) {
        const held = s.holds.filter(h => h.status === 'held').length;
        y = textBlock(k, fr ? `${held}/${s.holds.length} positions tenues` : `${held}/${s.holds.length} positions held`, MARGIN + 8, y, COLUMN - 8, 8.5, COLOR.ash);
      }
      y += 6;
    }
    y += 6;
  }
  newPageIfNeeded(30);
  textBlock(k, fr ? `Mesures de l’application, comparées au geste de référence du kinésithérapeute. La tolérance (${TOLERANCE_DEG} degrés, ${pctText(TOLERANCE_SHARE, true)} du geste) est provisoire\u00A0: elle n’est pas encore fixée sur des essais de patients.` : `The app’s measures, compared with the physiotherapist’s reference movement. The tolerance (${TOLERANCE_DEG} degrees, ${pctText(TOLERANCE_SHARE, false)} of the movement) is provisional: it is not yet set on patients’ attempts.`, MARGIN, y, COLUMN, 7.5, COLOR.ash);
  return doc;
}

/**
 * The report of one attempt, for the patient to keep or share (KinePatient.jsx): the exercise, who and when, the
 * verdict and why, what share of the movement it rests on, still frames of the attempt with the comparison drawn on
 * them, each measure's figures, the positions held and the pace. report: lib/kine/report.js reportOf. stills:
 * [{ data, w, h, caption }] (JPEG data URLs), none for a report printed again later. What is not measured is not
 * claimed: the tolerance is said to be provisional, and the report not a diagnosis (R8).
 */
export function attemptPdf(report, { lang = 'fr', stills = [] } = {}) {
  const fr = lang === 'fr';
  const c = COPY[fr ? 'fr' : 'en'];
  const names = JOINT_NAMES[fr ? 'fr' : 'en'];
  const nameOf = m => (Object.hasOwn(names, m) ? names[m] : m);
  const e = exerciseById(report.id);
  const title = e ? e[fr ? 'fr' : 'en'].title : report.id;
  const k = pdfDoc({ title: fr ? `Rapport · ${title}` : `Report · ${title}`, fr });
  const { doc } = k;
  k.paint();
  let y = MARGIN;
  const newPageIfNeeded = need => { if (y + need > PAGE_H - MARGIN) { doc.addPage(); k.paint(); y = MARGIN; } };
  const rule = () => { doc.setDrawColor(COLOR.rule); doc.setLineWidth(0.5); doc.line(MARGIN, y, MARGIN + COLUMN, y); y += 10; };
  // A heading never ends a page: it goes over with what follows it (need: its height and the first item's).
  const head = (text, need = 70) => { newPageIfNeeded(need); rule(); k.write(k.upper(text), MARGIN, y, 'mono', 7, 1.4, COLOR.ash, 1.2); y += 14; };
  const when = report.date ? new Date(report.date).toLocaleString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  k.write(k.upper(fr ? 'Rapport d’essai' : 'Attempt report'), MARGIN, y, 'mono', 7, 1.4, COLOR.ash, 1.2);
  y += 16;
  y = textBlock(k, title, MARGIN, y, COLUMN, 20, COLOR.ink, 1.15) + 4;
  const who = [report.patient, when].filter(Boolean).join(' · ');
  if (who) y = textBlock(k, who, MARGIN, y, COLUMN, 9, COLOR.ink) + 2;
  if (report.kine) y = textBlock(k, fr ? `Comparé au geste de référence de ${report.kine}, kinésithérapeute.` : `Compared with the reference movement of ${report.kine}, physiotherapist.`, MARGIN, y, COLUMN, 8.5, COLOR.ash) + 2;
  y += 8;

  // The verdict and its reasons.
  const verdict = report.verdict === 'match' ? c.match : report.verdict === 'revise' ? c.revise : c.refused;
  k.write(verdict, MARGIN, y, 'serif', 24, 1.15, COLOR.count);
  y += 32;
  const joint = name => report.joints.find(j => j.name === name);
  for (const r of report.reasons) {
    const [kind, name] = r.split(':');
    const j = joint(name);
    let line = null;
    if (kind === 'off' && j?.worst) line = c.off(nameOf(name), j.within, { atSec: j.worst.atSec, reference: j.worst.ref, attempt: j.worst.att });
    else if (kind === 'range' && j) line = c.range(nameOf(name), j.range);
    else if (kind === 'unseen') line = c.refusedWhy(nameOf(name));
    else if (kind === 'reference-unseen') line = c.refUnseen;
    if (line) { newPageIfNeeded(24); y = textBlock(k, `· ${line}`, MARGIN, y, COLUMN, 9, COLOR.ink) + 2; }
  }
  if (report.judged != null && report.judged < 0.95) y = textBlock(k, c.partial(report.judged), MARGIN, y + 2, COLUMN, 8.5, COLOR.ash) + 2;
  y += 8;

  // Still frames of the attempt, side by side, each with its caption.
  if (stills.length) {
    head(fr ? 'L’essai, image par image' : 'The attempt, frame by frame', 260);
    const gap = 10, n = stills.length, colW = (COLUMN - gap * (n - 1)) / n;
    const hMax = Math.min(220, Math.max(...stills.map(s => (colW * s.h) / s.w)));
    newPageIfNeeded(hMax + 40);
    let bottom = y;
    stills.forEach((s, i) => {
      const x = MARGIN + i * (colW + gap);
      const w = Math.min(colW, (hMax * s.w) / s.h), h = (w * s.h) / s.w;
      try { doc.addImage(s.data, 'JPEG', x, y, w, h, undefined, 'FAST'); } catch { /* an image the PDF cannot take is left out */ }
      const end = textBlock(k, s.caption, x, y + h + 4, colW, 7.5, COLOR.ink, 1.35);
      bottom = Math.max(bottom, end);
    });
    y = bottom + 4;
    y = textBlock(k, fr ? 'Trait plein\u00A0: votre squelette, tel que l’appli l’estime\u00A0; en doré, une articulation hors de la tolérance à ce moment. Pointillés\u00A0: le squelette du geste de référence, posé sur votre tronc.' : 'Solid line: your skeleton as the app estimates it; in gold, a joint out of tolerance at that moment. Dashes: the reference movement’s skeleton, laid on your trunk.', MARGIN, y, COLUMN, 7.5, COLOR.ash) + 8;
  }

  // Each measure's figures.
  if (report.verdict !== 'refused' && report.joints.length) {
    head(c.joints, 90);
    for (const j of report.joints) {
      newPageIfNeeded(40);
      k.write(nameOf(j.name), MARGIN, y, 'sansMedium', 9.5, 1.4, COLOR.ink);
      y += 14;
      const cells = [[c.within, pctText(j.within, fr)], [c.gap, j.gap == null ? '–' : `${Math.round(j.gap)}°`]];
      if (j.range != null) cells.push([c.reached, pctText(Math.min(j.range, 9.99), fr)]);
      const cw = COLUMN / cells.length;
      cells.forEach(([label, value], i) => {
        k.write(value, MARGIN + i * cw, y, 'serif', 15, 1.2, COLOR.count);
        textBlock(k, label, MARGIN + i * cw, y + 20, cw - 8, 7, COLOR.ash, 1.3);
      });
      y += 44;
    }
  }

  // The positions the reference holds.
  if (report.holds.length) {
    head(c.holds);
    report.holds.forEach((h, i) => {
      newPageIfNeeded(30);
      const status = h.status === 'held' ? c.holdOk : h.status === 'short' ? c.holdShort : c.holdOff;
      k.write(`${c.holdRow(i)} · ${status}`, MARGIN, y, 'sansMedium', 9, 1.4, h.status === 'held' ? COLOR.ink : COLOR.count);
      y += 13;
      y = textBlock(k, `${c.holdRef(h.ref, h.refSec)} · ${c.holdAtt(h.att, h.attSec)}`, MARGIN, y, COLUMN, 8.5, COLOR.ash) + 4;
    });
    y += 4;
  }

  // The pace.
  if (report.tempo != null) {
    head(c.tempo);
    y = textBlock(k, `${c.tempoValue(report.attSec, report.refSec)} · ${c.tempoSub(report.tempo)}`, MARGIN, y, COLUMN, 9, COLOR.ink) + 8;
  }

  newPageIfNeeded(60);
  rule();
  y = textBlock(k, c.note(TOLERANCE_DEG), MARGIN, y, COLUMN, 7.5, COLOR.ash) + 3;
  textBlock(k, fr ? 'Mesures estimées par l’application WorkoutVision à partir de la vidéo, dans le plan de l’image. Ce rapport aide à suivre l’exercice\u00A0; il n’est pas un diagnostic. Votre vidéo est restée sur votre téléphone.' : 'Measures estimated by the WorkoutVision app from the video, in the picture’s plane. This report helps follow the exercise; it is not a diagnosis. Your video stayed on your phone.', MARGIN, y, COLUMN, 7.5, COLOR.ash);
  return doc;
}
