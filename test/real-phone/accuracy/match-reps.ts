// Counted reps against labelled reps, one to one: a counted rep matches the labelled rep it overlaps most,
// if it covers at least half of it (a rep counted in the right place, not merely the right number).
// Each labelled rep is found, or missed as the first, the last or one in the middle; each counted rep
// with no labelled rep is extra.
export type Span = [number, number];
export type RepMatch = { found: number; missedFirst: boolean; missedLast: boolean; missedMiddle: number; extra: number };

const overlap = ([a, b]: Span, [c, d]: Span) => Math.max(0, Math.min(b, d) - Math.max(a, c));

export function matchReps(labelled: Span[], counted: Span[]): RepMatch {
  const taken = new Set<number>(), found: boolean[] = labelled.map(() => false);
  // Largest overlaps first, so a counted rep goes to the labelled rep it covers best.
  const pairs = labelled.flatMap((l, i) => counted.map((c, j) => ({ i, j, o: overlap(l, c) })))
    .filter(p => p.o >= 0.5 * (labelled[p.i][1] - labelled[p.i][0])).sort((a, b) => b.o - a.o);
  for (const { i, j } of pairs) if (!found[i] && !taken.has(j)) { found[i] = true; taken.add(j); }
  const n = labelled.length;
  return {
    found: found.filter(Boolean).length,
    missedFirst: n > 0 && !found[0],
    missedLast: n > 1 && !found[n - 1],
    missedMiddle: found.slice(1, -1).filter(f => !f).length,
    extra: counted.length - taken.size,
  };
}
