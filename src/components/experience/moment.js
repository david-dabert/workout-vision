// The line said once a set is saved: earned, never invented (R8). It speaks only of a count the person confirmed or
// corrected, and compares it only with their own earlier sets of the same lift that someone confirmed (progress.js
// confirmed): a record beaten, a record equalled, the first set of a lift, or, otherwise, a short coach's line.
// Never on a refused set, never on a count left unanswered. Copy awaits David's approval (R10); the coach's lines
// are convention (French gym speech, no source).
import { confirmed } from './progress';

const COACH = {
  fr: ['Propre. On enchaîne.', 'Série validée.', 'Solide. Respirez, puis la suivante.', 'Bien tenu jusqu’au bout.'],
  en: ['Clean. Keep it going.', 'Set done.', 'Solid. Breathe, then the next one.', 'Held well to the end.'],
};

/**
 * n: the reps saved; before: this lift's earlier sets (any order); nth: this set's rank among the lift's sets;
 * kept: true when the person confirmed or corrected the count. Returns { kind, text } or null.
 */
export function momentLine({ n, before, nth = 1, fr = false, kept = true }) {
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
  const lines = COACH[fr ? 'fr' : 'en'];
  return { kind: 'coach', text: lines[(Math.max(1, nth) - 1) % lines.length] };
}
