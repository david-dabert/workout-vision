// The words of the coach's report. The sheet on screen and the PDF both read
// them from here, so what the visitor sees is what the coach receives.

const NBSP = ' ';
const clean = s => (s || '').normalize('NFC').replace(/\s+/g, ' ').trim();

export const NAME_MAX = 60;
export const NOTES_MAX = 1000;

const MINUS = '\u2212';
// One decimal, with the comma in French: 1,2 s.
export const decimal = (x, fr) => (fr ? x.toFixed(1).replace('.', ',') : x.toFixed(1));

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
  let speedChange = null;
  if (reps.length >= 4) {
    const speed = r => (r.concentricSec > 0 ? r.romDegrees / r.concentricSec : null);
    const pair = [reps[0], reps[1], reps[reps.length - 2], reps[reps.length - 1]].map(speed);
    if (pair.every(v => v !== null)) {
      const first = (pair[0] + pair[1]) / 2, last = (pair[2] + pair[3]) / 2;
      speedChange = Math.round(((last - first) / first) * 100);
    }
  }
  return { tut, speedChange };
}

/**
 * @param {object} o
 * @param {'fr'|'en'} o.lang
 * @param {Date} o.date          when the set was recorded
 * @param {string} o.client
 * @param {string} o.coach
 * @param {string} o.notes
 * @param {string} o.liftName
 * @param {number} o.count       the number the visitor confirmed or corrected
 * @param {number} [o.counted]   the number the app counted, when it differs
 * @param {'left'|'right'} [o.arm]
 * @param {Array<{startTime:number,endTime:number,romDegrees:number,concentricSec:number,eccentricSec:number}>} [o.reps]
 *   the app's reps, when their details were measured with step 3c's boundaries
 */
export function reportSheet({ lang, date, client, coach, notes, liftName, count, counted, arm, source, reps }) {
  const fr = lang === 'fr';
  const colon = fr ? `${NBSP}: ` : ': ';
  const sec = x => `${decimal(x, fr)}${NBSP}s`;
  const measures = setMeasures(reps);
  let summary = '';
  if (measures) {
    summary = (fr ? 'Temps sous tension' : 'Time under tension') + colon + sec(measures.tut);
    const c = measures.speedChange;
    if (c !== null) {
      const signed = c < 0 ? `${MINUS}${-c}` : c > 0 ? `+${c}` : '0';
      summary += fr
        ? ` · Vitesse concentrique${colon}${signed}${NBSP}% du début à la fin`
        : ` · Concentric speed${colon}${signed}% from start to end`;
    }
  }
  return {
    fr,
    brand: 'Workout Vision',
    date: date.toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    title: fr ? 'Rapport de séance' : 'Session report',
    clientLabel: 'Client',
    coachLabel: 'Coach',
    client: clean(client) || '…',
    coach: clean(coach) || '…',
    count: String(count),
    word: fr ? (count <= 1 ? 'répétition' : 'répétitions') : (count === 1 ? 'rep' : 'reps'),
    lift: liftName,
    corrected: counted != null && counted !== count
      ? (fr ? `Compté par l’app${colon}${counted}. Corrigé${colon}${count}.` : `Counted by the app${colon}${counted}. Corrected${colon}${count}.`)
      : '',
    arm: arm === 'left' || arm === 'right'
      ? (fr ? 'Bras suivi' : 'Arm tracked') + colon + (arm === 'left' ? (fr ? 'gauche' : 'left') : (fr ? 'droit' : 'right'))
      : '',
    // Concentric and eccentric, not up and down: a pulldown's concentric phase brings the bar down.
    columns: fr ? ['Rép.', 'Durée', 'Amplitude', 'Conc.', 'Exc.'] : ['Rep', 'Time', 'Range', 'Conc.', 'Ecc.'],
    // A rep the recording cut keeps its number and range; its times read "…".
    rows: (reps || []).map((r, i) => r.clipped
      ? [String(i + 1), '…', `${Math.round(r.romDegrees)}°`, '…', '…']
      : [String(i + 1), sec(r.endTime - r.startTime), `${Math.round(r.romDegrees)}°`, sec(r.concentricSec), sec(r.eccentricSec)]),
    summary,
    notesLabel: 'Notes',
    notes: (notes || '').normalize('NFC').replace(/\r\n?/g, '\n').trim() || '…',
    foot: source === 'manual'
      ? (fr ? 'Saisie manuelle sur le téléphone. Version de test. Aucun score de forme.' : 'Entered manually on the phone. Test version. No form score.')
      : fr
      ? 'Comptage automatique sur le téléphone. Version de test. Aucun score de forme.'
      : 'Counted automatically on the phone. Test version. No form score.',
  };
}

// An ASCII file name the coach can read in any mail or chat: rapport-seance-camille-martin-2026-09-26.pdf
const LETTERS = { æ: 'ae', œ: 'oe', ø: 'o', ß: 'ss', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ı: 'i' };
export function reportFileName({ lang, date, client }) {
  let slug = clean(client).toLowerCase().replace(/[æœøßłđðþı]/g, c => LETTERS[c])
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (slug.length > 40) { const cut = slug.slice(0, 41).lastIndexOf('-'); slug = slug.slice(0, cut > 0 ? cut : 40); }
  const pad = n => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return [lang === 'fr' ? 'rapport-seance' : 'session-report', slug, day].filter(Boolean).join('-') + '.pdf';
}
