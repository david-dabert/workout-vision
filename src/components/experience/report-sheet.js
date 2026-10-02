// The words of the session report. The sheet on screen and the PDF both read
// them from here, so what the visitor sees is what the reader receives.
import { setOpener } from './set-opener';
import { isShortIn, speedChange } from './set-account';
import { decimal, repTempo, setTempo } from './tempo';
import { MEASURES_SHOWN, SPEED_CHANGE_SHOWN, experimentalLabel } from './measures';
import { sidesLines } from './sides-line';

export { setTempo };

const NBSP = '\u00A0';
const clean = s => (s || '').normalize('NFC').replace(/\s+/g, ' ').trim();

export const NAME_MAX = 60;
export const NOTES_MAX = 1000;

const MINUS = '\u2212';
// One decimal, with the comma in French: 1,2 s.
export { decimal } from './tempo';

/**
 * What a set measured, from its whole reps (a rep the recording cut is counted but
 * not measured): the time under tension (the reps' lengths,
 * pauses at the working end included, rests between reps not), and how the
 * concentric speed changed from the first two reps to the last two. The concentric speed
 * of a rep is its range over its concentric time, in degrees per second; the
 * change is the share by which the mean of the last two differs from the mean of
 * the first two (velocity loss within a set: Sánchez-Medina and González-Badillo,
 * Med Sci Sports Exerc 2011, measured there on the bar). Fewer than four reps give
 * no change.
 */
export function setMeasures(all) {
  const reps = (all || []).filter(r => !r.clipped);
  if (!reps.length) return null;
  const tut = reps.reduce((sum, r) => sum + (r.endTime - r.startTime), 0);
  return { tut, speedChange: speedChange(all) };
}


/**
 * The per-rep table as the report prints it: Rep | Tempo | Range | Peak | Mean (peak and mean
 * angular speed in °/s). The result screen shows the same rows to an expert (level.js).
 */
export function repTable({ reps, first, fr }) {
  const allReps = reps || [];
  const liftFirst = first || 'concentric';
  // Short rep: range under 85% of the set's median, by the rule the result screen and the
  // opener use (set-account.js), so the three never disagree on an even number of reps.
  const isShort = isShortIn(reps);
  // Per-rep tempo in coach notation: moving phases (lowering, lifting) to the tenth, so a 0.6 s
  // lift reads 0,6 and not 1; pauses (bottom, top) in whole seconds.
  const phase = v => decimal(v, fr);
  const pause = v => String(Math.round(v));
  const tempoStr = t => [phase(t.lowering), pause(t.bottom), phase(t.lifting), pause(t.top)].join('-');
  const rows = allReps.map((r, i) => {
    if (r.clipped) return [String(i + 1), '…', `${Math.round(r.romDegrees)}°`, '…', '…'];
    const nextStart = i + 1 < allReps.length ? allReps[i + 1].startTime : null;
    const t = repTempo(r, nextStart, liftFirst);
    const range = `${Math.round(r.romDegrees)}°${isShort(r) ? `${NBSP}▾` : ''}`;
    return [String(i + 1), tempoStr(t), range, String(Math.round(r.peakSpeed || 0)), String(Math.round(r.meanSpeed || 0))];
  });
  const columns = fr ? ['Rép.', 'Tempo', 'Amplitude', 'Pic', 'Moy.'] : ['Rep', 'Tempo', 'Range', 'Peak', 'Mean'];
  return { columns, rows, tempoStr };
}

// The concentric speed change (setMeasures) as the report writes it; '' when there is none.
function speedLine(c, fr) {
  if (c === null || c === undefined) return '';
  const colon = fr ? `${NBSP}: ` : ': ';
  const signed = c < 0 ? `${MINUS}${-c}` : c > 0 ? `+${c}` : '0';
  return fr ? `Vitesse concentrique${colon}${signed}${NBSP}% du début à la fin` : `Concentric speed${colon}${signed}% from start to end`;
}

/** The report's line on the set's concentric speed change, or '' under four whole reps. */
export const speedChangeLine = (reps, fr) => speedLine(setMeasures(reps)?.speedChange ?? null, fr);

/**
 * @param {object} o
 * @param {'fr'|'en'} o.lang
 * @param {Date} o.date          when the set was recorded
 * @param {string} [o.name]      the user's name, optional
 * @param {''|'alone'|'friend'|'coach'} [o.context]  whom the user trained with, if they said
 * @param {string} [o.partner]   the friend's or the coach's name, optional
 * @param {''|'beginner'|'intermediate'|'expert'} [o.level]
 * @param {string} o.notes
 * @param {string} o.liftName
 * @param {number} o.count       the number the visitor confirmed or corrected
 * @param {number} [o.counted]   the number the app counted, when it differs
 * @param {'left'|'right'} [o.arm]
 * @param {'elbow'|'shoulder'|'knee'|'hip'} [o.joint]  the joint that counts the lift (core.ts)
 * @param {'concentric'|'eccentric'} [o.first]  which phase leaves the rest end
 * @param {Array} [o.reps]       the app's reps with step 3c boundaries
 * @param {object} [o.previousSet]  the previous saved set of the same lift
 * @param {number} [o.previousSet.count]
 * @param {Array} [o.previousSet.reps]
 * @param {Date} [o.previousSet.date]
 */

export function reportSheet({ lang, date, name, context, partner, level, notes, liftName, count, counted, arm, joint = 'elbow', source, reps, first, previousSet, sides = null, lift = '', measures: shown = MEASURES_SHOWN }) {
  const fr = lang === 'fr';
  const colon = fr ? `${NBSP}: ` : ': ';
  const sec = x => `${decimal(x, fr)}${NBSP}s`;
  const measures = setMeasures(reps);
  const wholeReps = (reps || []).filter(r => !r.clipped);
  const allReps = reps || [];
  const liftFirst = first || 'concentric';

  // Without validated measures (measures.js): no per-rep table, no short-rep mark, and of the
  // summary only the previous set's count.
  const hasShort = shown && allReps.some(isShortIn(reps));
  const { columns, rows } = shown ? repTable({ reps, first: liftFirst, fr }) : { columns: [], rows: [] };
  // After a correction the rows are the marks the app detected, not the reps the user saved.
  if (shown && counted != null && counted !== count && columns.length) columns[0] = fr ? 'Repère' : 'Mark';

  // Summary: one item per line, as a client who is not a coach reads it (Luc, 29 September).
  const summary = [];
  if (!shown && previousSet && Number.isFinite(previousSet.count)) {
    const prevDate = previousSet.date instanceof Date ? previousSet.date : new Date(previousSet.date);
    const day = prevDate.toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' });
    summary.push(fr ? `Série du ${day}${colon}${previousSet.count}${NBSP}rép.` : `Set of ${day}${colon}${previousSet.count}${NBSP}reps`);
  }
  if (measures && shown) {
    summary.push((fr ? 'Temps sous tension' : 'Time under tension') + colon + sec(measures.tut));
    const speed = SPEED_CHANGE_SHOWN ? speedLine(measures.speedChange, fr) : '';
    if (speed) summary.push(speed);

    // Set tempo: average of each phase across whole reps (setTempo, which the spreadsheet uses too).
    const tempo = setTempo(reps, liftFirst);
    if (tempo) summary.push(`Tempo${colon}${tempo}`);

    // Duration change: average of last two minus average of first two. The same first-two against
    // last-two comparison as the speed change, from the same boundaries: unsaid with it (SPEED_CHANGE_SHOWN).
    if (SPEED_CHANGE_SHOWN && wholeReps.length >= 4) {
      const dur = r => r.endTime - r.startTime;
      const firstAvg = (dur(wholeReps[0]) + dur(wholeReps[1])) / 2;
      const lastAvg = (dur(wholeReps[wholeReps.length - 2]) + dur(wholeReps[wholeReps.length - 1])) / 2;
      const diff = lastAvg - firstAvg;
      const sign = diff < -0.05 ? MINUS : diff > 0.05 ? '+' : '';
      summary.push(fr
        ? `Durée${colon}${sign}${decimal(Math.abs(diff), fr)}${NBSP}s du début à la fin`
        : `Duration${colon}${sign}${decimal(Math.abs(diff), false)}${NBSP}s from start to end`);
    }

    // Left against right, for a set filmed from the front (sides-line.js): the two ranges, then what a gap means.
    const lr = sidesLines(sides, fr, lift);
    if (lr) summary.push(lr.line, lr.note);

    // Previous set comparison.
    if (previousSet && previousSet.reps?.length) {
      const prevWhole = previousSet.reps.filter(r => !r.clipped);
      if (prevWhole.length) {
        const prevDate = previousSet.date instanceof Date ? previousSet.date : new Date(previousSet.date);
        const day = prevDate.toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' });
        const prevAvgRange = Math.round(prevWhole.reduce((s, r) => s + r.romDegrees, 0) / prevWhole.length);
        const prevAvgDur = prevWhole.reduce((s, r) => s + (r.endTime - r.startTime), 0) / prevWhole.length;
        summary.push(fr
          ? `Série du ${day}${colon}${previousSet.count}${NBSP}rép., amplitude moy. ${prevAvgRange}°, durée moy. ${decimal(prevAvgDur, fr)}${NBSP}s`
          : `Set of ${day}${colon}${previousSet.count}${NBSP}reps, avg range ${prevAvgRange}°, avg duration ${decimal(prevAvgDur, false)}${NBSP}s`);
      }
    }
  }

  return {
    fr,
    // No brand: the report names no app (David, 29 September).
    brand: '',
    date: date.toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    title: fr ? 'Rapport de séance' : 'Session report',
    // One sentence that sums up the set (set-opener.js); none on an unknown count. The result screen carries none: its numeral and account say it.
    opener: setOpener({ reps, fr, count, counted, measures: shown }) || '',
    // Only what the user filled in (step 1, 29 September 2026): no coach is assumed.
    people: people({ fr, name, context, partner, level }),
    count: String(count),
    word: fr ? (count <= 1 ? 'répétition' : 'répétitions') : (count === 1 ? 'rep' : 'reps'),
    lift: liftName,
    corrected: counted != null && counted !== count
      ? (fr ? `Compté par l'app${colon}${counted}. Corrigé${colon}${count}.` : `Counted by the app${colon}${counted}. Corrected${colon}${count}.`)
      : '',
    arm: arm === 'left' || arm === 'right'
      // The tracked limb follows the joint that counts the lift: arm, leg (knee) or side (hip).
      ? (joint === 'knee' ? (fr ? 'Jambe suivie' : 'Leg tracked') : joint === 'hip' ? (fr ? 'Côté suivi' : 'Side tracked') : (fr ? 'Bras suivi' : 'Arm tracked'))
        + colon + (arm === 'left' ? (fr ? 'gauche' : 'left') : fr ? (joint === 'knee' ? 'droite' : 'droit') : 'right')
      : '',
    // Tempo replaces time and phases; peak and mean angular speed in °/s.
    columns,
    rows,
    summary,
    shortRepNote: hasShort ? (fr ? '▾ amplitude courte' : '▾ short rep') : '',
    // Beside every measure printed, while none is validated (measures.js).
    experimental: shown && (rows.length > 0 || (measures && summary.length > 0)) ? experimentalLabel(fr) : '',
    notesLabel: 'Notes',
    notes: (notes || '').normalize('NFC').replace(/\r\n?/g, '\n').trim(),
    // The report names no app (David, 29 September: the name is not final, and the tool spreads by being useful).
    foot: '',
  };
}

const CONTEXT = {
  alone: ['En solo', 'Alone'],
  friend: ['En binôme', 'With a friend'],
  coach: ['Avec un coach', 'With a coach'],
};
const PARTNER = { friend: ['Partenaire', 'Friend'], coach: ['Coach', 'Coach'] };
const LEVEL = { beginner: ['Débutant', 'Beginner'], intermediate: ['Intermédiaire', 'Intermediate'], expert: ['Confirmé', 'Expert'] };

/** The sheet's people and level, as [label, value] pairs, in the order the form asks for them. */
function people({ fr, name, context, partner, level }) {
  const k = fr ? 0 : 1, out = [];
  if (clean(name)) out.push([fr ? 'Nom' : 'Name', clean(name)]);
  if (CONTEXT[context]) out.push([fr ? 'Entraînement' : 'Training', CONTEXT[context][k]]);
  if (PARTNER[context] && clean(partner)) out.push([PARTNER[context][k], clean(partner)]);
  if (LEVEL[level]) out.push([fr ? 'Niveau' : 'Level', LEVEL[level][k]]);
  return out;
}

// An ASCII file name anyone can read in any mail or chat: rapport-seance-camille-martin-2026-09-26.pdf
const LETTERS = { æ: 'ae', œ: 'oe', ø: 'o', ß: 'ss', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ı: 'i' };
export function reportFileName({ lang, date, name }) {
  let slug = clean(name).toLowerCase().replace(/[æœøßłđðþı]/g, c => LETTERS[c])
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (slug.length > 40) { const cut = slug.slice(0, 41).lastIndexOf('-'); slug = slug.slice(0, cut > 0 ? cut : 40); }
  const pad = n => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return [lang === 'fr' ? 'rapport-seance' : 'session-report', slug, day].filter(Boolean).join('-') + '.pdf';
}
