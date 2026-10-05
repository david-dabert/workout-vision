// The line said once a set is saved: earned, never invented (R8). It speaks only of a count the person confirmed or
// corrected, and compares it only with their own earlier sets of the same lift that someone confirmed (progress.js
// confirmed): a record beaten, a record equalled, the first set of a lift; otherwise nothing, the saved card already thanks.
// Never on a refused set, never on a count left unanswered. The app measures a count, not how well a set was done:
// no line judges the execution ("Propre", "Bien tenu jusqu'au bout" did, and were removed after Astra's review of
// 5 October, R8). Copy awaits David's approval (R10).
import { confirmed } from './progress';

/**
 * n: the reps saved; before: this lift's earlier sets (any order);
 * kept: true when the person confirmed or corrected the count. Returns { kind, text } or null.
 */
export function momentLine({ n, before, fr = false, kept = true }) {
  if (!kept || !Number.isFinite(n) || n <= 0 || !Array.isArray(before)) return null;
  const past = before.filter(w => confirmed(w) && w.reps > 0);
  if (!past.length) {
    return { kind: 'first', text: fr ? 'Première série enregistrée. C’est parti.' : 'First set saved. Here we go.' };
  }
  const best = Math.max(...past.map(w => w.reps));
  if (n > best) {
    return { kind: 'record', text: fr ? `Record : ${n}. Votre meilleur était ${best}.` : `Personal best: ${n}. Your best was ${best}.` };
  }
  if (n === best) {
    return { kind: 'equal', text: fr ? `${n}, votre meilleur égalé.` : `${n}, your best equalled.` };
  }
  return null;
}
