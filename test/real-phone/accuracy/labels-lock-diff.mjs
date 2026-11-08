// Phase 6 of David's order of 6 November 2026, point 3: "CI verifies that no existing line in labels.lock is modified
// or removed without an explicit ruling from David." A line of the base branch's test/real-phone/labels.lock (the
// SHA-256, the label and the path of one labelled set; labels-lock.test.ts writes it) that the change's lock no longer
// holds word for word is a violation, unless test/real-phone/label-rulings.json records David's ruling for that very
// line and the line it becomes (now), or null when he rules that the set goes; the change must then hold exactly that
// (review of 8 November 2026: a ruling to relabel a set let it be deleted, or take any other label). A line added is
// free: a new set is locked as it comes. Comment lines (#) carry no label and are not locked.
// Limit, stated so nobody reads more into it: every agent commits and posts under David's account, so no check in the
// repository can tell his ruling from an entry an agent wrote; this one makes the change visible, in CI and in the
// diff, and requires the entry to quote him with its date and its source (CLAUDE.md R1, R12: a label that seems wrong
// is reported to David, who decides). Read by scripts/check-labels-lock.mjs in CI.

/** The lock's label lines, trailing spaces dropped, comments and empty lines left out. */
export const dataLines = text => String(text ?? '').split('\n').map(l => l.trimEnd()).filter(l => l && !l.startsWith('#'));
/** The path a lock line names (its third field). */
export const lockPath = line => String(line).trim().split(/\s+/)[2] ?? null;

const oneLine = s => typeof s === 'string' && dataLines(s).length === 1 && !s.includes('\n');
const isRuling = r => !!r && typeof r === 'object'
  && typeof r.line === 'string' && dataLines(r.line).length === 1
  && (r.now === null || oneLine(r.now))
  && typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
  && typeof r.ruling === 'string' && r.ruling.trim() !== ''
  && typeof r.source === 'string' && r.source.trim() !== '';

/** What is wrong with the rulings file, one line per entry; empty when every entry is whole. */
export function rulingProblems(rulings) {
  if (!rulings || !Array.isArray(rulings.rulings)) return ['label-rulings.json holds no "rulings" list'];
  return rulings.rulings.flatMap((r, i) => (isRuling(r) ? [] : [`ruling ${i + 1} needs line (one lock line, word for word), now (the line it becomes, or null when the set goes), date (YYYY-MM-DD), ruling (David's words) and source`]));
}

/**
 * The base lock's lines that the head lock no longer holds and that no whole ruling covers: { line, path, now }, now
 * being the head's line for the same path (a changed SHA-256 or label), or null (the set's line is gone). A ruling
 * covers its line only when the head holds exactly the line it names (now), or, for now: null, no line for that path.
 */
export function lockViolations(baseText, headText, rulings) {
  const head = dataLines(headText);
  const held = new Set(head);
  const byPath = new Map(head.map(l => [lockPath(l), l]));
  const covered = line => (Array.isArray(rulings?.rulings) ? rulings.rulings : []).filter(isRuling)
    .some(r => dataLines(r.line)[0] === line && (r.now === null ? !byPath.has(lockPath(line)) : held.has(dataLines(r.now)[0])));
  return dataLines(baseText)
    .filter(line => !held.has(line) && !covered(line))
    .map(line => ({ line, path: lockPath(line), now: byPath.get(lockPath(line)) ?? null }));
}
