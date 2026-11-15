// The line said once a set is saved: earned, never invented (R8). It speaks only of a count the person confirmed or
// corrected, and compares it only with their own earlier sets of the same lift that someone confirmed (progress.js
// confirmed): a record beaten, a record equalled, the first set of a lift, or under the record the record to beat.
// Never on a refused set, never on a count left unanswered. The app measures a count, not how well a set was done:
// no line judges the execution ("Propre", "Bien tenu jusqu'au bout" did, and were removed after Astra's review of
// 5 October, R8). Copy approved by David on 9 October 2026 (R10).
import { confirmed, storedLoad } from './progress';
import { formatLoadKg, parseLoadKg } from './saved-set';
import { RESULT } from './result-copy';

// Card 033 (15 November 2026): double progression for the next set to beat, from the person's own saved sets at the
// same load (keep the load and add one rep until repTop, then add loadStepKg and restart at repBottom).
// Accepted coaching practice; R9 status: convention (repBottom = 8, repTop = 12, loadStepKg = 2.5 kg are UNSOURCED
// conventions David may change).
export const DOUBLE_PROGRESSION = Object.freeze({ repBottom: 8, repTop: 12, loadStepKg: 2.5 });

function nextGoalTarget({ n, past, load }) {
  const currentLoad = parseLoadKg(load);
  if (currentLoad === null) return null;
  const atLoad = past.filter(w => {
    const wLoad = storedLoad(w);
    return wLoad !== null && Math.abs(wLoad - currentLoad) < 1e-9;
  });
  const bestAtLoad = Math.max(n, ...atLoad.map(w => w.reps));
  if (bestAtLoad >= DOUBLE_PROGRESSION.repTop) {
    return { reps: DOUBLE_PROGRESSION.repBottom, loadKg: Math.round((currentLoad + DOUBLE_PROGRESSION.loadStepKg) * 100) / 100 };
  }
  return { reps: bestAtLoad + 1, loadKg: currentLoad };
}

/**
 * n: the reps saved; before: this lift's earlier sets (any order);
 * kept: true when the person confirmed or corrected the count;
 * load: optional positive load (kg) saved for this set (card 032);
 * refused: true when the set was refused (no goal line shown, R8).
 * Returns { kind, text } or null.
 */
export function momentLine({ n, before, fr = false, kept = true, load = null, refused = false }) {
  if (!kept || refused || !Number.isFinite(n) || n <= 0 || !Array.isArray(before)) return null;
  const past = before.filter(w => confirmed(w) && w.reps > 0);
  const goal = nextGoalTarget({ n, past, load });
  if (goal) {
    return { kind: 'goal', text: (fr ? RESULT.fr : RESULT.en).nextGoal(goal.reps, formatLoadKg(goal.loadKg, fr)) };
  }
  if (!past.length) {
    return { kind: 'first', text: fr ? 'Première série enregistrée. C’est parti.' : 'First set saved. Here we go.' };
  }
  const best = Math.max(...past.map(w => w.reps));
  if (n > best) {
    return { kind: 'record', text: fr ? `Nouveau record : ${n}. L’ancien était ${best}.` : `Personal best: ${n}. Your best was ${best}.` };
  }
  if (n === best) {
    return { kind: 'equal', text: fr ? `${n}, vous égalez votre record.` : `${n}, your best equalled.` };
  }
  // Card 011 (14 November 2026): under the record, the record to beat next time, a count and nothing else: the reason
  // to film again tomorrow. Not a judgement of the set (R8). Status: convention.
  return { kind: 'below', text: fr ? `Votre record\u00a0: ${best}. À battre à la prochaine série.` : `Your best: ${best}. One to beat next set.` };
}
