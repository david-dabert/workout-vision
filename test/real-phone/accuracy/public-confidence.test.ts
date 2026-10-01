// ACCURACY=1 npx vitest run test/real-phone/accuracy/public-confidence.test.ts
// Does the core know when it is wrong? Its confidence is the share of samples with a pose on the counted
// side (src/lib/counting/core.ts): a measure of visibility, not of the count. On each public dataset's
// build half, the sets are grouped by that value (bands cut at values, never inside a tie), with how many
// are exact and within one rep (inside the labelled window where there is one; the confidence of a whole
// clip covers the whole clip). A set the core refuses, and a set whose angle moved too little to count
// (confidence 0), are shown on their own lines. CLAUDE.md R8 needs the low bands to hold the wrong counts.
// Diagnostic only; no counting change.
import { expect, test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { countInWindow, publicSets } from './sets';

const BANDS: [string, (c: number) => boolean][] = [
  ['0 (angle moved too little to count)', c => c === 0], ['0.5 to 0.9', c => c > 0 && c < 0.9], ['0.9 to 0.99', c => c >= 0.9 && c < 1], ['1 (pose on every sample)', c => c === 1],
];

test.skipIf(!process.env.ACCURACY)('does the core know when it is wrong', () => {
  const { sets, unreadable, missing } = publicSets('build');
  expect(unreadable).toEqual([]);
  expect(missing).toEqual([]);
  expect(sets.length).toBeGreaterThan(0);
  const by = new Map<string, { refused: number; rows: { conf: number; off: number }[] }>();
  for (const s of sets) {
    const r = summarizeCount(s.wl, s.ts, s.lift);
    const e = by.get(s.dataset) ?? { refused: 0, rows: [] };
    if (r.refused) e.refused++;
    else e.rows.push({ conf: r.confidence, off: Math.abs(countInWindow(r.reps, s.window) - s.label) });
    by.set(s.dataset, e);
  }
  const lines = [`Does the core know when it is wrong, ${new Date().toISOString().slice(0, 10)}: public build half, by the core's confidence (the share of samples with a pose).`, '',
    '| Dataset | Confidence | Sets | Exact | Within one |', '|---|---|---:|---:|---:|'];
  for (const [ds, e] of [...by].sort()) {
    lines.push(`| ${ds} | refused | ${e.refused} | | |`);
    for (const [name, inBand] of BANDS) {
      const part = e.rows.filter(r => inBand(r.conf));
      lines.push(`| ${ds} | ${name} | ${part.length} | ${part.filter(r => r.off === 0).length} | ${part.filter(r => r.off <= 1).length} |`);
    }
    expect(BANDS.reduce((a, [, f]) => a + e.rows.filter(r => f(r.conf)).length, 0)).toBe(e.rows.length);
  }
  writeFileSync(resolve(__dirname, 'public-confidence.txt'), lines.join('\n') + '\n');
  process.stdout.write(lines.join('\n') + '\n');
}, 1_800_000);
