// The one thing said about a set after the first try (card 010, cards/010-first-word-after-a-set.md; David, 12 November
// 2026: "something that they cannot get anywhere else unless they hire a coach or a physio").
//
// It is built from what the app measures and shows today, and from nothing else (R8, gate 7): the range of each rep and
// the time of its lifting and lowering phases (tempo.js). A closed list of observations, each a rule on those numbers;
// the first that holds, in the list's order, is the one said. When none holds, the app says what it measured.
// No word speaks of posture, risk, load or effort: none of those is measured.
//
// It states what the set looked like, not what to do about it: no advice is given on these numbers (R9; "what to do
// next" is not a kept promise, STATE.md). Checked on David's labelled sets by test/real-phone/accuracy/first-word.test.ts,
// which recomputes each rule and fails if one word covers 80 % of the sets or more.
//
// Thresholds: all UNSOURCED, convention chosen on 12 November 2026, status experimental. A rep is read only when the
// video holds it whole and each moving phase lasts 0.2 s or more (tempo.js MIN_PHASE_SEC); a set with fewer than four
// such reps gets only what was measured.
import { MIN_PHASE_SEC } from './tempo';

const MIN_REPS = 4;
/** A rep is shorter than the others under this share of the set's median range. UNSOURCED, experimental. */
export const SHORT_REP_RATIO = 0.75;
/** The range fell when the last third's mean is under this share of the first third's. UNSOURCED, experimental. */
export const RANGE_FELL_RATIO = 0.85;
/** The range held when the last third's mean is at least this share of the first third's. UNSOURCED, experimental. */
export const RANGE_HELD_RATIO = 0.95;
/** The lowering is quick when its median time is under this share of the lifting's. UNSOURCED, experimental. */
export const QUICK_LOWERING_RATIO = 0.7;
/** The rhythm is steady when the reps' durations vary by less than this (coefficient of variation). UNSOURCED, experimental. */
export const STEADY_CV = 0.15;

const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = xs => { const a = [...xs].sort((p, q) => p - q), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

/** The numbers the words are read from: the whole, timed reps and what they measure. */
export function wordFacts(reps) {
  const whole = (reps || []).filter(r => !r.clipped && r.concentricSec >= MIN_PHASE_SEC && r.eccentricSec >= MIN_PHASE_SEC);
  if (whole.length < MIN_REPS) return { whole: whole.length };
  const rom = whole.map(r => r.romDegrees);
  const third = Math.max(1, Math.floor(whole.length / 3));
  const dur = whole.map(r => r.endTime - r.startTime), d = mean(dur);
  const mid = median(rom);
  return {
    whole: whole.length,
    shortReps: rom.map((x, i) => (x < SHORT_REP_RATIO * mid ? i + 1 : 0)).filter(Boolean),
    firstRange: mean(rom.slice(0, third)),
    lastRange: mean(rom.slice(-third)),
    lowering: median(whole.map(r => r.eccentricSec)),
    lifting: median(whole.map(r => r.concentricSec)),
    durationCv: Math.sqrt(mean(dur.map(x => (x - d) ** 2))) / d,
  };
}

const enough = f => f.whole >= MIN_REPS;

/**
 * The closed list, in the order a coach would say them: a rep unlike the others first, then how the range moved, then
 * the tempo. `rep` is the number of the one short rep, counted among the reps the video holds whole.
 */
export const FIRST_WORDS = Object.freeze([
  {
    key: 'one_short',
    holds: f => enough(f) && f.shortReps.length === 1,
    fr: ({ rep }) => `Une seule répétition sort du lot : la ${rep}${rep === 1 ? 're' : 'e'} a été nettement plus courte que les autres.`,
    en: ({ rep }) => `One rep stands apart: rep ${rep} was clearly shorter than the others.`,
  },
  {
    key: 'range_fell',
    holds: f => enough(f) && f.lastRange < RANGE_FELL_RATIO * f.firstRange,
    fr: () => 'Vos dernières répétitions ont perdu de l’amplitude par rapport aux premières.',
    en: () => 'Your last reps lost range compared with your first ones.',
  },
  {
    key: 'lowering_quick',
    holds: f => enough(f) && f.lowering < QUICK_LOWERING_RATIO * f.lifting,
    fr: () => 'Vous redescendez nettement plus vite que vous ne montez.',
    en: () => 'You lower clearly faster than you lift.',
  },
  {
    key: 'range_held',
    holds: f => enough(f) && f.lastRange >= RANGE_HELD_RATIO * f.firstRange,
    fr: () => 'Votre amplitude a tenu de la première à la dernière répétition.',
    en: () => 'Your range held from the first rep to the last.',
  },
  {
    key: 'steady',
    holds: f => enough(f) && f.durationCv < STEADY_CV,
    fr: () => 'Votre rythme est resté régulier d’une répétition à l’autre.',
    en: () => 'Your rhythm stayed even from one rep to the next.',
  },
  {
    key: 'measured',
    holds: () => true,
    fr: () => 'L’appli a mesuré l’amplitude et le tempo de chaque répétition, sans rien relever de particulier.',
    en: () => 'The app measured the range and tempo of each rep, and found nothing that stood out.',
  },
]);

/** The word said about a set: its key, its sentence in French and in English. */
export function firstWord(reps) {
  const f = wordFacts(reps);
  const w = FIRST_WORDS.find(x => x.holds(f));
  const args = { rep: f.shortReps?.[0] ?? 0 };
  return { key: w.key, fr: w.fr(args), en: w.en(args) };
}
