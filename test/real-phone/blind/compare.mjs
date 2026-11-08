// The comparator of the blind scoreboard (npm run scoreboard:blind; Phase 6 of David's order of 6 November 2026).
// Each blind set's outcome now (the live core's count, or 'refused') is held against its label (the blind count,
// CLAUDE.md R1) and against the count the base branch's baseline holds for it (scoreboard-baseline.json, blindCounts
// and testerBlindCounts), set by set. The gate is stricter than R2's tally, which only asks that the exact total not
// fall: here no single set may move away from its label, become refused, become off by 3 or more, or leave.
// A set new since the baseline is shown and gated from the next change on. Bench and overhead press sets are measured
// and decide nothing (PLAN.md; decides() in test/real-phone/accuracy/sets.ts).

/** 'exact', 'refused', 'catastrophic' (off by 3 or more: R2) or 'off +k' / 'off -k'. */
export const verdict = (count, label) => (count === 'refused' ? 'refused'
  : count === label ? 'exact'
  : Math.abs(count - label) >= 3 ? 'catastrophic'
  : `off ${count > label ? '+' : ''}${count - label}`);

const err = (count, label) => (count === 'refused' ? Infinity : Math.abs(count - label));

/**
 * sets: [{ name, lift, label }]; before: the baseline's counts by name; now: the live outcomes by name (a whole number
 * or 'refused'); decides(lift): whether the set's lift decides. Returns one row per set and the tallies over the sets
 * that decide: exact, catastrophic, refused and the refusal rate, and the names that fail the gate.
 */
export function compareBlind(sets, before, now, decides = () => true) {
  const out = { rows: [], n: 0, decide: 0, exact: 0, catastrophic: 0, refused: 0, refusalRate: null, added: [], regressed: [], newlyCatastrophic: [], missing: [] };
  for (const s of sets) {
    const b = before[s.name], c = now[s.name];
    if (c === undefined) throw new Error(`no outcome for ${s.name}`);
    const row = { name: s.name, label: s.label, before: b ?? null, now: c, verdict: verdict(c, s.label), beforeVerdict: b === undefined ? 'new' : verdict(b, s.label), decides: decides(s.lift), added: b === undefined, regressed: false, newlyCatastrophic: false };
    out.rows.push(row);
    out.n++;
    if (!row.decides) continue;
    out.decide++;
    if (row.verdict === 'exact') out.exact++;
    if (row.verdict === 'catastrophic') out.catastrophic++;
    if (row.verdict === 'refused') out.refused++;
    if (row.added) { out.added.push(s.name); continue; }
    // A set regresses when its error grows, or when it gave a count and is now refused (third audit, C31).
    row.regressed = c === 'refused' ? b !== 'refused' : b !== 'refused' && err(c, s.label) > err(b, s.label);
    // It becomes catastrophic when it is now off by 3 or more and was not: closer before, or refused before.
    row.newlyCatastrophic = row.verdict === 'catastrophic' && (b === 'refused' || err(b, s.label) < 3);
    if (row.regressed) out.regressed.push(s.name);
    if (row.newlyCatastrophic) out.newlyCatastrophic.push(s.name);
  }
  // A set of the baseline no longer on disk fails: a set is never dropped quietly (scoreboard.test.ts, the same rule).
  const names = new Set(sets.map(s => s.name));
  out.missing = Object.keys(before).filter(name => !names.has(name));
  out.refusalRate = out.decide ? out.refused / out.decide : null;
  return out;
}

/** What fails the gate, one line per set; empty when the gate passes. */
export function gateFailures(result) {
  return [
    ...result.regressed.map(name => `REGRESSED ${name}`),
    ...result.newlyCatastrophic.map(name => `NEWLY CATASTROPHIC ${name}`),
    ...result.missing.map(name => `MISSING ${name} (in the baseline, not on disk)`),
  ];
}
