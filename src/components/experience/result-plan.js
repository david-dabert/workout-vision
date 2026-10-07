// The result screen's plan (C4 of the design review, 7 October 2026, screen 05): for a set filmed from a programme,
// the day's sets of that exercise, the one on screen and the ones still planned. A planned value is never a measure:
// it carries the word "prévu" and is never drawn in the numeral's colour (R8). The low-confidence quick keys are
// centred on the plan, never on a count the app could not stand behind (screen 05b).
// Status: convention (the final direction's grammar of certainty; no specific source).

const localDay = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
const timeOf = w => new Date(w.createdAt ?? w.date).getTime();
const whole = n => Number.isInteger(n) && n > 0;

/** How a saved set's count was kept: typed by hand, corrected from the app's, or the app's confirmed. */
export function keptAs(w) {
  if (w?.source === 'manual') return 'typed';
  const app = w?.machineResult?.reps;
  if (w?.correctedResult || (Number.isFinite(app) && app !== w?.reps)) return 'corrected';
  return 'confirmed';
}

/**
 * The day so far for a planned set: the target and the sets of this programme's exercise saved today (oldest first),
 * the set on screen excluded (Result.jsx reads the sets before it saves). null without a plan, or before the sets are
 * read (the screen then names no set number rather than a wrong one).
 */
export function dayPlan({ planned, sets, lift, now = new Date() }) {
  if (!planned || !whole(planned.sets) || !whole(planned.reps) || !Array.isArray(sets)) return null;
  const today = localDay(now);
  const done = sets
    .filter(w => w?.planned?.programme === planned.programme && w.planned.item === planned.item
      && (w.exercise || w.exerciseKey) === lift && Number.isFinite(w.reps) && localDay(timeOf(w)) === today)
    .sort((a, b) => timeOf(a) - timeOf(b))
    .map(w => ({ reps: w.reps, kind: keptAs(w) }));
  return { sets: planned.sets, reps: planned.reps, done, index: done.length + 1 };
}

/**
 * The table's rows: the sets done, the set on screen (current: { n, kind }, kind one of confirmed, pending, corrected,
 * typed, yours), then one planned row per set still to do. Each row: { k, kind, n }.
 */
export function planRows(day, current) {
  if (!day) return [];
  const rows = day.done.map((d, i) => ({ k: i + 1, kind: d.kind, n: d.reps }));
  rows.push({ k: day.index, kind: current.kind, n: current.n });
  for (let k = day.index + 1; k <= day.sets; k++) rows.push({ k, kind: 'planned', n: day.reps });
  return rows;
}

/** Five quick keys centred on a number (the plan, else the person's previous set), never below 1; none without a centre. */
export function quickKeys(centre) {
  if (!whole(centre)) return [];
  const from = Math.max(1, Math.min(centre - 2, 95));
  return [0, 1, 2, 3, 4].map(i => from + i);
}
