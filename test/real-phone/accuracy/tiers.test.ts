// npx vitest run (runs by default; no switch)
// The lift tiers follow the evidence. Rule: PLAN.md, "Lift tiers" (28 September 2026): a lift is Beta when it is
// counted on committed evidence and no build clip of the lift fails; made a gate by David on 3 October ("a lift that
// fails it cannot keep it"). Status: convention (David's rule), not a counting threshold.
//   A lift is 'beta' iff it is not a press (bench and overhead press decide nothing, PLAN.md, 30 September; sets.ts
//   decides()), it has at least one of David's labelled sets, and every one of them counts exactly: none off, none
//   refused. A lift with no set of David's may be Beta on dataset evidence recorded in DATASET_EVIDENCE below.
// David's sets are the labelled build sets npm run scoreboard counts (labelledSets(): test/real-phone/sets-*/ and
// landmarks/), counted by the live core as the scoreboard does. The table is written to tiers.txt; it holds no run
// date, so a run that changes nothing leaves the file unchanged. Nothing here moves a count or a parameter.
// A lift with a set of David's but no entry in TIERS (none today)
// is held to the same rule, with the tier the app gives it (offer.js tierOf: Experimental when offered), so its sets are
// listed and a disagreement fails here too (WP0.2 of docs/SPEC-production.md).
import { expect, test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { TIERS } from '../../../src/lib/liftTiers';
import { tierOf } from '../../../src/lib/offer';
import { decides, labelledSets } from './sets';

// Dataset evidence for a lift with no set of David's (PLAN.md, Lift tiers). Kept for traceability: squat now has
// David's sets-29sep/squat_7, which counts exactly, so it is Beta under the main rule too.
const DATASET_EVIDENCE: Record<string, string> = {
  squat: 'MM-Fit, all 64 sets through the counter at dfe4d43 (27 September 2026): 60 exact, 63 within one (test/real-phone/mmfit/results.json); measured on an older core',
};

test('every lift tier follows the evidence of David\'s labelled sets', () => {
  const { sets, unreadable } = labelledSets();
  expect(unreadable).toEqual([]);
  const rows: string[] = [], wrong: string[] = [];
  const outside = [...new Set(sets.map(s => s.lift))].filter(lift => !Object.hasOwn(TIERS, lift)).sort();
  const lifts: [string, string][] = [...Object.entries(TIERS), ...outside.map(lift => [lift, tierOf(lift) ?? 'not offered'] as [string, string])];
  for (const [lift, tier] of lifts) {
    const own = sets.filter(s => s.lift === lift).map(s => {
      const r = summarizeCount(s.wl, s.ts, s.lift);
      const count = r.refused ? 'refused' : r.count;
      return { name: s.name, label: s.label, count, exact: count === s.label };
    });
    const exact = own.filter(s => s.exact).length, refused = own.filter(s => s.count === 'refused').length;
    const press = !decides(lift);
    let rule: 'beta' | 'experimental', why: string;
    if (press) { rule = 'experimental'; why = 'press: measured, decides nothing (PLAN.md)'; }
    else if (own.length && exact === own.length) { rule = 'beta'; why = 'every set of David\'s counts exactly'; }
    else if (own.length) { rule = 'experimental'; why = `${own.length - exact} of David's sets not exact`; }
    else if (DATASET_EVIDENCE[lift]) { rule = 'beta'; why = `no set of David's; dataset: ${DATASET_EVIDENCE[lift]}`; }
    else { rule = 'experimental'; why = 'no evidence'; }
    if (rule !== tier) wrong.push(`${lift}: TIERS says ${tier}, the evidence gives ${rule}`);
    const from = Object.hasOwn(TIERS, lift) ? '' : '  (not in TIERS: the tier offer.js gives)';
    rows.push(`${rule === tier ? '  ' : '!!'} ${lift.padEnd(18)} ${tier.padEnd(13)} rule ${rule.padEnd(13)} sets ${own.length}  exact ${exact}  refused ${refused}  ${why}${from}`);
    for (const s of own) rows.push(`      ${s.name}  label ${s.label}  count ${s.count}${s.exact ? '' : '  (not exact)'}`);
    if (DATASET_EVIDENCE[lift] && own.length) rows.push(`      dataset, for traceability: ${DATASET_EVIDENCE[lift]}`);
  }
  const head = 'Lift tiers against the evidence (test/real-phone/accuracy/tiers.test.ts; rule: PLAN.md Lift tiers, 28 September; David, 3 October). '
    + 'Columns: lift, TIERS (src/lib/liftTiers.js; for a lift not in it, offer.js tierOf), what the rule gives, David\'s labelled sets, exact, refused. "!!" marks a disagreement.';
  const text = [head, ...rows].join('\n') + '\n';
  writeFileSync(resolve(__dirname, 'tiers.txt'), text);
  expect(wrong, text).toEqual([]);
});
