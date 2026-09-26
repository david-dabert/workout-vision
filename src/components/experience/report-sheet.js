// The words of the coach's report. The sheet on screen and the PDF both read
// them from here, so what the visitor sees is what the coach receives.

const NBSP = ' ';
const clean = s => (s || '').normalize('NFC').replace(/\s+/g, ' ').trim();

export const NAME_MAX = 60;
export const NOTES_MAX = 1000;

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
 */
export function reportSheet({ lang, date, client, coach, notes, liftName, count, counted, arm, source }) {
  const fr = lang === 'fr';
  const colon = fr ? `${NBSP}: ` : ': ';
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
