// npm run scoreboard      (SCOREBOARD_UPDATE=1 npm run scoreboard once a change is accepted)
// CLAUDE.md R2: every change that can move a count is measured before and after. The live core's count on
// every labelled set on disk, set by set, against its label and against the counts last accepted
// (scoreboard-baseline.json). It fails if fewer sets are exact than before, or if any set is off by 3 or
// more. Build sets only (David's sets of 29 September and the five build clips): no exam set exists yet,
// and nothing here may tune a parameter. Runs only when asked, so a plain npm test changes no file.
import { expect, test } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { labelledSets } from './sets';

const BASELINE = resolve(__dirname, 'scoreboard-baseline.json');

const verdict = (count: number | string, label: number) => (count === 'refused' ? 'refused' : count === label ? 'exact' : Math.abs((count as number) - label) >= 3 ? 'catastrophic' : `off ${(count as number) > label ? '+' : ''}${(count as number) - label}`);

test.skipIf(!process.env.SCOREBOARD)('scoreboard', () => {
  const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const rows: string[] = [], live: Record<string, number | string> = {};
  // The gate compares the sets both runs hold: a set added since cannot hide a regression (review, 30 September).
  let exactNow = 0, exactBefore = 0, catastrophic = 0, n = 0, added = 0;
  const { sets, unreadable } = labelledSets();
  for (const s of sets) {
    const r = summarizeCount(s.wl, s.ts, s.lift);
    const now = r.refused ? 'refused' : r.count, before = base.counts[s.name];
    live[s.name] = now; n++;
    const v = verdict(now, s.label), vb = before === undefined ? 'new' : verdict(before, s.label);
    if (before === undefined) added++;
    else { if (v === 'exact') exactNow++; if (vb === 'exact') exactBefore++; }
    if (v === 'catastrophic') catastrophic++;
    rows.push(`${now === before ? '  ' : '->'} ${s.name}  label ${s.label}  before ${before ?? '-'} (${vb})  now ${now} (${v})`);
  }
  // A set of the baseline no longer on disk is named, and fails the gate: a set is never dropped quietly.
  const missing = Object.keys(base.counts).filter(name => !(name in live));
  for (const name of missing) rows.push(`MISSING ${name}  (in the baseline, not on disk)`);
  for (const name of unreadable) rows.push(`UNREADABLE ${name}  (not gzip JSON, or no lift, whole count or landmarks)`);
  const kept = n - added;
  const head = `Scoreboard ${new Date().toISOString().slice(0, 10)}: of the ${kept} sets in the baseline, ${exactNow} exact now, ${exactBefore} before; ${catastrophic} catastrophic${added ? `; ${added} set${added > 1 ? 's' : ''} new since` : ''}. Build sets only; no exam set yet. "->" marks a set whose count moved.`;
  const text = [head, ...rows].join('\n') + '\n';
  writeFileSync(resolve(__dirname, 'scoreboard.txt'), text);
  process.stdout.write(text);
  // R2: a change ships only if the exact count does not decrease and no set becomes catastrophic.
  expect(exactNow).toBeGreaterThanOrEqual(exactBefore);
  expect(catastrophic).toBe(0);
  expect(missing).toEqual([]);
  expect(unreadable).toEqual([]);
  // Only a change that passes the gate is recorded as accepted (review, 30 September).
  if (process.env.SCOREBOARD_UPDATE) writeFileSync(BASELINE, JSON.stringify({ note: `The counts last accepted (${new Date().toISOString().slice(0, 10)}), measured by npm run scoreboard on the live core, not typed. npm run scoreboard compares the live core with these; SCOREBOARD_UPDATE=1 npm run scoreboard records the live counts once a change passes the gate (CLAUDE.md R2).`, counts: live }, null, 2) + '\n');
});
