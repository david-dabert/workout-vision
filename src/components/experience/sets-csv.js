// The saved sets as two spreadsheet files, for a coach or an expert: one row per set, and one row per
// measured rep. Pure functions of what storage holds; every figure is one the app already shows,
// read through the functions that show it (sets.js, progress.js, set-account.js, report-sheet.js),
// so the spreadsheet and the screens never disagree. No new metric (CLAUDE.md R8). A field a set
// does not store is left empty, never guessed. The files leave the phone only through the user's
// own share or download. The words are in test/real-phone/swarm/copy-export.md for David (R10).
import { liftDefinition } from '../../lib/counting/core';
import { exerciseName } from './exercise-info';
import { countedBy, setTime } from './sets';
import { confirmed, storedLoad, liftKey } from './progress';
import { setMeasures, setTempo } from './report-sheet';

// Spreadsheets (Excel above all) read a UTF-8 file as UTF-8 only when it starts with this mark.
export const BOM = '﻿';
const EOL = '\r\n'; // RFC 4180

// A spreadsheet reads numbers in the phone's locale: where the comma is the decimal mark (French
// Excel), fields are split on semicolons. The words follow the app's language; the separator and the
// decimal mark follow the phone's locale, where the file is opened (review, 30 September).
const commaLocale = locale => { try { return (1.5).toLocaleString(locale).includes(','); } catch { return false; } };
const format = (lang, locale = lang) => ({
  ...(commaLocale(locale) ? { sep: ';', dot: ',' } : { sep: ',', dot: '.' }),
  ...(lang === 'fr' ? { yes: 'oui', no: 'non' } : { yes: 'yes', no: 'no' }),
});

/** One field, quoted as RFC 4180 asks when it holds the separator, a quote or a line break. */
export function csvField(value, sep) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return s.includes(sep) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const table = (header, rows, sep) => BOM + [header, ...rows].map(r => r.map(v => csvField(v, sep)).join(sep) + EOL).join('');

// A number with a fixed count of decimals, in the file's decimal mark; empty when not a number.
const num = (x, digits, f) => (Number.isFinite(x) ? x.toFixed(digits).replace('.', f.dot) : '');
// A load as entered: 62.5 stays 62.5, 60 stays 60.
const kg = (x, f) => (x === null ? '' : String(Math.round(x * 100) / 100).replace('.', f.dot));

const pad = n => String(n).padStart(2, '0');
/** The phone's local time as a spreadsheet reads a date and time: 2026-09-30 14:05:00. */
function isoLocal(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const oldestFirst = sets => [...(sets || [])].sort((a, b) => setTime(a) - setTime(b));
const nameOf = (lang, name) => name || (w => exerciseName(liftKey(w), lang));
// Reps measured with step 3c's boundaries; older details are not shown anywhere (History.jsx).
const measuredReps = w => (w.repDetailsVersion === 2 && Array.isArray(w.repDetails) && w.repDetails.length ? w.repDetails : null);
// A set typed in by hand was never counted by the app.
const byHand = w => w.source === 'manual';

/**
 * One row per set, oldest first. lang: 'fr' or 'en'; name(set): the exercise's name as the screen
 * shows it (default: exercise-info.js in lang).
 */
export function setsCsv(sets, { lang, name, locale } = {}) {
  const f = format(lang, locale), fr = lang === 'fr', label = nameOf(lang, name);
  const header = fr
    ? ['Date', 'Exercice', 'Répétitions', 'Comptées par l’app', 'Corrigée', 'Confirmée', 'Charge (kg)', 'Durée (s)', 'Tempo moyen', 'Variation de vitesse concentrique (%)']
    : ['Date', 'Exercise', 'Reps', 'Counted by the app', 'Corrected', 'Confirmed', 'Load (kg)', 'Duration (s)', 'Average tempo', 'Concentric speed change (%)'];
  const rows = oldestFirst(sets).map(w => {
    const counted = byHand(w) ? null : countedBy(w);
    const reps = measuredReps(w);
    const tempo = reps && setTempo(reps, liftDefinition(liftKey(w))?.first);
    const change = reps && setMeasures(reps)?.speedChange;
    return [
      isoLocal(setTime(w)),
      label(w),
      w.reps,
      counted,
      counted === null ? '' : counted !== w.reps ? f.yes : f.no,
      confirmed(w) ? f.yes : f.no,
      kg(storedLoad(w), f),
      w.duration > 0 ? num(w.duration, 1, f) : '',
      tempo || '',
      Number.isFinite(change) ? String(change) : '',
    ];
  });
  return table(header, rows, f.sep);
}

/** One row per measured rep, sets oldest first; null when no set holds measured reps. */
export function repsCsv(sets, { lang, name, locale } = {}) {
  const f = format(lang, locale), fr = lang === 'fr', label = nameOf(lang, name);
  const header = fr
    ? ['Date de la série', 'Exercice', 'Rép.', 'Amplitude (°)', 'Concentrique (s)', 'Excentrique (s)', 'Vitesse max (°/s)', 'Vitesse moyenne (°/s)', 'Coupée par la vidéo']
    : ['Set date', 'Exercise', 'Rep', 'Range (°)', 'Concentric (s)', 'Eccentric (s)', 'Peak speed (°/s)', 'Mean speed (°/s)', 'Cut by the video'];
  const rows = [];
  for (const w of oldestFirst(sets)) {
    const reps = measuredReps(w);
    if (!reps) continue;
    const when = isoLocal(setTime(w)), lift = label(w);
    reps.forEach((r, i) => {
      // A rep the video cut is counted, its range shown, its times and speeds not (as in the report).
      const cut = !!r.clipped, whole = x => (cut ? null : x);
      rows.push([when, lift, Number.isFinite(r.index) ? r.index : i + 1, num(r.romDegrees, 0, f),
        num(whole(r.concentricSec), 2, f), num(whole(r.eccentricSec), 2, f),
        num(whole(r.peakSpeed), 0, f), num(whole(r.meanSpeed), 0, f), cut ? f.yes : f.no]);
    });
  }
  return rows.length ? table(header, rows, f.sep) : null;
}

/** The files to hand over: [{ name, text }], the reps file only when there are measured reps. */
export function exportFiles(sets, { lang, name, locale, now = new Date() } = {}) {
  const fr = lang === 'fr', day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const out = [{ name: `${fr ? 'series' : 'sets'}-${day}.csv`, text: setsCsv(sets, { lang, name, locale }) }];
  const reps = repsCsv(sets, { lang, name, locale });
  if (reps) out.push({ name: `${fr ? 'repetitions' : 'reps'}-${day}.csv`, text: reps });
  return out;
}
