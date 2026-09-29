// Step 3, the account of a counted set: what the app measured, one tip for the next session and a word
// of encouragement, in the words David approved on 29 September (test/real-phone/growth-step3/texts.md).
// Pure functions of the counted reps, so the result screen and the tests read the same numbers.

const NB = ' ';
const whole = reps => (reps || []).filter(r => !r.clipped);
const mean = xs => xs.reduce((a, x) => a + x, 0) / xs.length;

// A rep under 85 % of the set's median range carries the ▾ mark (1-based numbers).
// Status: experimental, UNSOURCED threshold set by David (texts.md, "seuil de 85 %, expérimental").
export const SHORT_RATIO = 0.85;
export function shortReps(reps) {
  const w = whole(reps);
  if (w.length < 2) return [];
  const sorted = w.map(r => r.romDegrees).sort((a, b) => a - b), m = sorted.length >> 1;
  const median = sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
  return w.filter(r => r.romDegrees < SHORT_RATIO * median).map(r => r.index);
}

// The average tempo, eccentric-pause-concentric-pause, in whole seconds as tempo is written.
// The pause at the turn is what a rep lasts beyond its two phases; the pause between reps sits
// where the lift rests, after the eccentric phase when the lift starts with the concentric one
// (a curl) and after the concentric phase when it starts with the eccentric one (a squat).
// A phase that took place reads at least 1 (convention: tempo is written in whole seconds).
export function averageTempo(reps, first) {
  const w = whole(reps);
  if (!w.length) return null;
  const phase = x => (x > 0 ? Math.max(1, Math.round(x)) : 0);
  const conc = mean(w.map(r => r.concentricSec)), ecc = mean(w.map(r => r.eccentricSec));
  const turn = mean(w.map(r => Math.max(0, r.endTime - r.startTime - r.concentricSec - r.eccentricSec)));
  const gaps = w.slice(1).map((r, i) => Math.max(0, r.startTime - w[i].endTime));
  const between = gaps.length ? mean(gaps) : 0;
  const [afterEcc, afterConc] = first === 'eccentric' ? [turn, between] : [between, turn];
  return [phase(ecc), Math.round(afterEcc), phase(conc), Math.round(afterConc)];
}

// From four whole reps: how much longer the last two reps' concentric phase took than the first two's,
// in whole percent (negative: faster). App measure; what it means is in the tempo note (source 5).
export function slowdown(reps) {
  const w = whole(reps);
  if (w.length < 4) return null;
  const a = mean(w.slice(0, 2).map(r => r.concentricSec)), b = mean(w.slice(-2).map(r => r.concentricSec));
  return a > 0 ? Math.round((b / a - 1) * 100) : null;
}

export function ordinal(n, fr) {
  if (fr) return n === 1 ? '1re' : `${n}e`;
  const t = n % 100, u = n % 10;
  return `${n}${t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'}`;
}

const list = (ns, fr) => (ns.length === 1 ? `${ns[0]}` : `${ns.slice(0, -1).join(', ')} ${fr ? 'et' : 'and'} ${ns[ns.length - 1]}`);
// Inside a sentence the name is a common noun: "série de curl biceps". It keeps its case when it holds
// another capital (a catalogue name, an acronym) or starts with a proper adjective (review 01 of step 3).
const PROPER = /^(romanian|bulgarian|arnold|zottman|jefferson|pallof|nordic|russian|copenhagen|landmine|smith|spider|scott|larsen|kroc|meadows|pendlay|yates|jm|z)\b/i;
const inSentence = name => (/\s\p{Lu}|^\p{Lu}\p{Lu}/u.test(name) || PROPER.test(name) ? name : name.charAt(0).toLocaleLowerCase('fr') + name.slice(1));
// French elides before a vowel and before the mute h of haltère; an exercise's h is otherwise aspirated
// (hip thrust, hack squat).
const de = name => (/^([aeiouyàâéèêëîïôûü]|halt)/i.test(name) ? `d’${name}` : `de ${name}`);

/**
 * The account of the set (A), the tip (B) and the encouragement (C). Values the result already shows
 * (the count, the name, the duration, the average range and duration) are not repeated (David, 29 September).
 * previous: the reps kept on the last saved set of this exercise, or null; nth: this set's rank in the history,
 * or null when the history could not be read, and then no encouragement rather than a false rank.
 */
export function setAccount({ reps, first, fr, name, count, previous, nth }) {
  const lines = [];
  const tempo = averageTempo(reps, first);
  if (tempo) lines.push(fr ? `Tempo moyen${NB}: ${tempo.join('-')}.` : `Average tempo: ${tempo.join('-')}.`);
  const short = shortReps(reps);
  if (short.length === 1) lines.push(fr ? `La répétition ${short[0]} a été plus courte que les autres.` : `Rep ${short[0]} was shorter than the others.`);
  else if (short.length > 1) lines.push(fr ? `Les répétitions ${list(short, true)} ont été plus courtes que les autres.` : `Reps ${list(short, false)} were shorter than the others.`);
  const p = slowdown(reps);
  if (p !== null) {
    lines.push(p === 0
      ? (fr ? 'Vos deux dernières répétitions ont été aussi rapides que les deux premières.' : 'Your last two reps were as fast as your first two.')
      : fr ? `Vos deux dernières répétitions ont été ${Math.abs(p)}${NB}% plus ${p > 0 ? 'lentes' : 'rapides'} que les deux premières.`
        : `Your last two reps were ${Math.abs(p)}% ${p > 0 ? 'slower' : 'faster'} than your first two.`);
  }
  if (Number.isFinite(previous)) {
    const d = count - previous, n = Math.abs(d);
    lines.push(d === 0
      ? (fr ? 'Autant que votre dernière série.' : 'As many as your last set.')
      : fr ? `${n} répétition${n > 1 ? 's' : ''} de ${d > 0 ? 'plus' : 'moins'} que votre dernière série.`
        : `${n} ${d > 0 ? 'more' : 'fewer'} rep${n > 1 ? 's' : ''} than your last set.`);
  }
  // Convention (David's approved copy): one tip only.
  const tip = short.length
    ? (fr ? 'La prochaine fois, visez la même amplitude sur toutes les répétitions.' : 'Next time, aim for the same range on every rep.')
    : (fr ? 'Quand toutes vos répétitions restent amples et contrôlées, ajoutez une répétition ou un peu de charge.' : 'When all your reps stay full and controlled, add a rep or a little weight.');
  // Convention (David's approved copy).
  const cheer = !Number.isFinite(nth) ? null : fr
    ? `${ordinal(nth, true)} série ${de(inSentence(name))} dans votre historique. La régularité fera le reste.`
    : `Your ${ordinal(nth, false)} set of ${inSentence(name)} in your history. Consistency will do the rest.`;
  return { lines, tip, cheer, short };
}
