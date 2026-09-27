// The words of the coach's report. The sheet on screen and the PDF both read
// them from here, so what the visitor sees is what the coach receives.

const NBSP = '\u00A0';
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
 * Per-rep tempo: lowering, bottom pause, lifting, top pause.
 * Lowering = eccentric phase; lifting = concentric phase.
 * The two pauses depend on which phase comes first:
 *   eccentric first → bottom pause = working pause, top pause = rest gap
 *   concentric first → top pause = working pause, bottom pause = rest gap
 * Working pause = total rep time minus both phases.
 * Rest gap = time from this rep's end to the next rep's start (0 for the last rep).
 */
function repTempo(r, nextStart, first) {
  const total = r.endTime - r.startTime;
  const workPause = Math.max(0, total - r.concentricSec - r.eccentricSec);
  const restGap = nextStart != null ? Math.max(0, nextStart - r.endTime) : 0;
  if (first === 'eccentric') {
    return { lowering: r.eccentricSec, bottom: workPause, lifting: r.concentricSec, top: restGap };
  }
  return { lowering: r.eccentricSec, bottom: restGap, lifting: r.concentricSec, top: workPause };
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
 * @param {'concentric'|'eccentric'} [o.first]  which phase leaves the rest end
 * @param {Array} [o.reps]       the app's reps with step 3c boundaries
 * @param {object} [o.previousSet]  the previous saved set of the same lift
 * @param {number} [o.previousSet.count]
 * @param {Array} [o.previousSet.reps]
 * @param {Date} [o.previousSet.date]
 */
export function reportSheet({ lang, date, client, coach, notes, liftName, count, counted, arm, source, reps, first, previousSet }) {
  const fr = lang === 'fr';
  const colon = fr ? `${NBSP}: ` : ': ';
  const sec = x => `${decimal(x, fr)}${NBSP}s`;
  const measures = setMeasures(reps);
  const wholeReps = (reps || []).filter(r => !r.clipped);
  const allReps = reps || [];
  const liftFirst = first || 'concentric';

  // Short rep: range under 85% of the set's median.
  const ranges = wholeReps.map(r => r.romDegrees).sort((a, b) => a - b);
  const medianRange = ranges.length ? ranges[Math.floor(ranges.length / 2)] : 0;
  const shortThreshold = medianRange * 0.85;
  const isShort = r => !r.clipped && r.romDegrees < shortThreshold;
  const hasShort = allReps.some(isShort);

  // Per-rep tempo in coach notation: whole seconds, pause under 0.5 reads 0.
  const tempoSec = v => String(Math.round(v));
  const tempoStr = t => [t.lowering, t.bottom, t.lifting, t.top].map(tempoSec).join('-');

  // Build rows: Rep | Tempo | Range | Peak | Mean
  const rows = allReps.map((r, i) => {
    if (r.clipped) return [String(i + 1), '…', `${Math.round(r.romDegrees)}°`, '…', '…'];
    const nextStart = i + 1 < allReps.length ? allReps[i + 1].startTime : null;
    const t = repTempo(r, nextStart, liftFirst);
    const range = `${Math.round(r.romDegrees)}°${isShort(r) ? `${NBSP}▾` : ''}`;
    return [String(i + 1), tempoStr(t), range, String(Math.round(r.peakSpeed || 0)), String(Math.round(r.meanSpeed || 0))];
  });

  // Summary lines
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

    // Set tempo: average of each phase across whole reps.
    if (wholeReps.length) {
      const avg = { lowering: 0, bottom: 0, lifting: 0, top: 0 };
      wholeReps.forEach((r, i) => {
        const nextStart = i + 1 < wholeReps.length ? wholeReps[i + 1].startTime : null;
        const t = repTempo(r, nextStart, liftFirst);
        avg.lowering += t.lowering; avg.bottom += t.bottom; avg.lifting += t.lifting; avg.top += t.top;
      });
      const n = wholeReps.length;
      avg.lowering /= n; avg.bottom /= n; avg.lifting /= n; avg.top /= n;
      summary += ` · Tempo${colon}${tempoStr(avg)}`;
    }

    // Duration change: average of last two minus average of first two.
    if (wholeReps.length >= 4) {
      const dur = r => r.endTime - r.startTime;
      const firstAvg = (dur(wholeReps[0]) + dur(wholeReps[1])) / 2;
      const lastAvg = (dur(wholeReps[wholeReps.length - 2]) + dur(wholeReps[wholeReps.length - 1])) / 2;
      const diff = lastAvg - firstAvg;
      const sign = diff < -0.05 ? MINUS : diff > 0.05 ? '+' : '';
      summary += fr
        ? ` · ${fr ? 'Durée' : 'Duration'}${colon}${sign}${decimal(Math.abs(diff), fr)}${NBSP}s du début à la fin`
        : ` · Duration${colon}${sign}${decimal(Math.abs(diff), false)}${NBSP}s from start to end`;
    }

    // Previous set comparison.
    if (previousSet && previousSet.reps?.length) {
      const prevWhole = previousSet.reps.filter(r => !r.clipped);
      if (prevWhole.length) {
        const prevDate = previousSet.date instanceof Date ? previousSet.date : new Date(previousSet.date);
        const day = prevDate.toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' });
        const prevAvgRange = Math.round(prevWhole.reduce((s, r) => s + r.romDegrees, 0) / prevWhole.length);
        const prevAvgDur = prevWhole.reduce((s, r) => s + (r.endTime - r.startTime), 0) / prevWhole.length;
        summary += fr
          ? ` · Série du ${day}${colon}${previousSet.count}${NBSP}rép., amplitude moy. ${prevAvgRange}°, durée moy. ${decimal(prevAvgDur, fr)}${NBSP}s`
          : ` · Set of ${day}${colon}${previousSet.count}${NBSP}reps, avg range ${prevAvgRange}°, avg duration ${decimal(prevAvgDur, false)}${NBSP}s`;
      }
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
      ? (fr ? `Compté par l'app${colon}${counted}. Corrigé${colon}${count}.` : `Counted by the app${colon}${counted}. Corrected${colon}${count}.`)
      : '',
    arm: arm === 'left' || arm === 'right'
      ? (fr ? 'Bras suivi' : 'Arm tracked') + colon + (arm === 'left' ? (fr ? 'gauche' : 'left') : (fr ? 'droit' : 'right'))
      : '',
    // Tempo replaces time and phases; peak and mean angular speed in °/s.
    columns: fr ? ['Rép.', 'Tempo', 'Amplitude', 'Pic', 'Moy.'] : ['Rep', 'Tempo', 'Range', 'Peak', 'Mean'],
    rows,
    summary,
    shortRepNote: hasShort ? (fr ? '▾ amplitude courte' : '▾ short rep') : '',
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
