// The progress of each exercise in the history: its sets in time order, the reps of the last
// sets, and the personal bests. Pure functions of the saved sets, so the history screen and the
// tests read the same numbers. Only what a set stores is used: the count the user kept (reps,
// after any correction, never what the app counted) and, where one was entered, the load.
// No projection, no estimated maximum, no grade (CLAUDE.md R8).
import { setTime } from './sets';

// How many of the last sets the reps line shows. Status: experimental, UNSOURCED (fits the
// history's row on a 375 px phone, not a training rule).
export const TREND_SETS = 8;

export const liftKey = w => w.exercise || w.exerciseKey;

// The load, in kg, as the manual log saves it in "weight"; it saves 0 when none was entered,
// and the counted sets save none, so only a positive number is a load. No version of the app
// saves a "load" field.
export const storedLoad = w => (typeof w.weight === 'number' && Number.isFinite(w.weight) && w.weight > 0 ? w.weight : null);

// A record is taken by beating it, not by equalling it: on a tie the set that reached it first
// keeps it. Status: convention (how gym and sport records are kept).
const better = (value, best) => !best || value > best.value;

function bestsOf(sets) {
  let reps = null, load = null;
  const byLoad = new Map();
  for (const w of sets) {
    // A set of no reps (a clip corrected to 0) lifted nothing: it holds no record.
    if (!(w.reps > 0)) continue;
    if (better(w.reps, reps)) reps = { value: w.reps, id: w.id };
    const kg = storedLoad(w);
    if (kg === null) continue;
    if (better(kg, load)) load = { value: kg, reps: w.reps, id: w.id };
    const at = byLoad.get(kg) || { load: kg, sets: 0, best: null };
    at.sets += 1;
    if (better(w.reps, at.best)) at.best = { value: w.reps, id: w.id };
    byLoad.set(kg, at);
  }
  // A best at a load means something only once that load was lifted twice.
  const atLoad = [...byLoad.values()].filter(a => a.sets > 1).sort((a, b) => b.load - a.load)
    .map(a => ({ load: a.load, reps: a.best.value, id: a.best.id }));
  return { reps, load, atLoad };
}

/**
 * Per exercise, the exercise trained last first: { key, sets (oldest first), first, trend, bests }.
 * first: the exercise has a single set, and then there is no trend and no best (bests is null).
 * trend: the reps of the last TREND_SETS sets, oldest first.
 * bests: { reps: {value, id} or null, load: {value, reps, id} or null, atLoad: [{load, reps, id}] }.
 */
export function exerciseProgress(sets) {
  const groups = new Map();
  for (const w of sets || []) {
    const key = liftKey(w);
    if (!key || !Number.isFinite(w.reps)) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w);
  }
  const out = [];
  for (const [key, list] of groups) {
    const ordered = [...list].sort((a, b) => setTime(a) - setTime(b));
    const first = ordered.length === 1;
    out.push({
      key, sets: ordered, first,
      trend: first ? [] : ordered.slice(-TREND_SETS).map(w => w.reps),
      bests: first ? null : bestsOf(ordered),
    });
  }
  return out.sort((a, b) => setTime(b.sets.at(-1)) - setTime(a.sets.at(-1)));
}

/** The sets that hold a record, by id: the kinds they hold, among 'reps', 'load' and 'atLoad'. */
export function recordsOf(progress) {
  const out = new Map();
  const add = (id, kind) => { if (!out.has(id)) out.set(id, []); if (!out.get(id).includes(kind)) out.get(id).push(kind); };
  for (const { bests } of progress) {
    if (!bests) continue;
    if (bests.reps) add(bests.reps.id, 'reps');
    if (bests.load) add(bests.load.id, 'load');
    for (const a of bests.atLoad) add(a.id, 'atLoad');
  }
  return out;
}

// The words of the bests, in test/real-phone/swarm/copy-A.md for David's approval (R10).
const NB = '\u00A0';
const kg = (x, fr) => `${x.toLocaleString(fr ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 2 })}${NB}kg`;
const reps = (n, fr) => (fr ? `${n}${NB}répétition${n > 1 ? 's' : ''}` : `${n}${NB}rep${n === 1 ? '' : 's'}`);

/** The words of each best, in the order the history shows them. */
export function bestLines(bests, fr) {
  const lines = [];
  if (bests.reps) lines.push(fr ? `Record${NB}: ${reps(bests.reps.value, true)}` : `Best: ${reps(bests.reps.value, false)}`);
  if (bests.load) lines.push(fr ? `Charge max${NB}: ${kg(bests.load.value, true)} × ${bests.load.reps}` : `Heaviest: ${kg(bests.load.value, false)} × ${bests.load.reps}`);
  // A best at the heaviest load held by the same set would say the same thing twice.
  for (const a of bests.atLoad) if (a.id !== bests.load?.id || a.load !== bests.load.value) lines.push(fr ? `Record à ${kg(a.load, true)}${NB}: ${reps(a.reps, true)}` : `Best at ${kg(a.load, false)}: ${reps(a.reps, false)}`);
  return lines;
}
