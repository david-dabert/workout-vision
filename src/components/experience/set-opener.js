// The opener: one plain sentence at the top of the result and of the report that sums up the set.
// It measures nothing new: the count, and what set-account.js already derives from the reps (the
// short reps, the slowdown). Wording awaiting David's approval (test/real-phone/swarm/copy-C.md).
import { shortReps, slowdown } from './set-account';

const reps = (n, fr) => (fr ? `${n} répétition${n > 1 ? 's' : ''}` : `${n} rep${n === 1 ? '' : 's'}`);

/**
 * count: the number the user kept (the app's count until they correct it); counted: what the app
 * counted, when it did (a set entered by hand has none). Returns null where the screen shows no count
 * (rule 8): a refused set, or a count that is not known.
 */
export function setOpener({ reps: all, fr, count, counted, refused }) {
  if (refused || !Number.isInteger(count) || count < 0) return null;
  // The user's count: the reps the app measured belong to another count, so they are not described.
  if (Number.isFinite(counted) && counted !== count) {
    if (!count) return fr ? 'Vous n’avez compté aucune répétition.' : 'You counted no reps.';
    return fr ? `Vous avez compté ${reps(count, true)}.` : `You counted ${reps(count, false)}.`;
  }
  if (!count) return fr ? 'Aucune répétition comptée.' : 'No reps counted.';
  const whole = (all || []).filter(r => !r.clipped);
  // One fact, the first that holds: the short reps (the tip is about them), then the slowdown.
  // Status: the thresholds are set-account.js's (85 %, experimental; four whole reps); none is added here.
  const short = shortReps(all);
  if (short.length) {
    const k = short.length;
    return fr
      ? `${reps(count, true)}, dont ${k === 1 ? 'une plus courte' : `${k} plus courtes`} que les autres.`
      : `${reps(count, false)}, ${k === 1 ? 'one' : k} of them shorter than the others.`;
  }
  const p = slowdown(all);
  if (p !== null) {
    return fr
      ? `${reps(count, true)}, les deux dernières ${p > 0 ? 'plus lentes que' : p < 0 ? 'plus rapides que' : 'aussi rapides que'} les deux premières.`
      : `${reps(count, false)}, the last two ${p > 0 ? 'slower than' : p < 0 ? 'faster than' : 'as fast as'} the first two.`;
  }
  if (whole.length >= 2) return fr ? `${reps(count, true)}, aucune plus courte que les autres.` : `${reps(count, false)}, none shorter than the others.`;
  if (count === 1) return fr ? 'Série d’une répétition.' : 'A set of one rep.';
  return fr ? `Série de ${reps(count, true)}.` : `A set of ${reps(count, false)}.`;
}
