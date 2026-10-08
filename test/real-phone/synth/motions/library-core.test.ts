// LIBRARY_DIR=<run.mjs output of library.mjs's matrix> [LIBRARY_TXT=<file>] npx vitest run --no-cache test/real-phone/synth/motions/library-core.test.ts
// The motion library as an exam of the app's counting on every catalogue exercise (README.md): each rendered set
// counted as the app counts it (coreAnalysis.js: summarizeCount, then withProposal's PSC number on a refusal), against
// the reps rendered. A rendered body is not a person: these figures bound what the counting does in clean conditions,
// exercise by exercise, and point at catalogue settings to check (an exercise its own clean sets never count right).
// Writes LIBRARY_TXT (default: library-core.txt in LIBRARY_DIR). Bench only: no gate, nothing in the app reads it.
import { expect, test } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount, withProposal } from '../../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../../src/lib/counting/core';

const DIR = process.env.LIBRARY_DIR;
test.skipIf(!DIR)('motion library: the app counting every catalogue exercise on rendered sets', () => {
  const files = readdirSync(DIR!, { recursive: true }).map(String).filter(f => f.endsWith('.json.gz')).sort();
  const per = new Map<string, { n: number; exact: number; within1: number; off3: number; refused: number; proposed: number; proposedExact: number; noCounter: boolean }>();
  for (const f of files) {
    const r = JSON.parse(gunzipSync(readFileSync(resolve(DIR!, f))).toString());
    const key: string = r.params.spec?.key ?? r.params.exercise, truth: number = r.reps.length;
    const e = per.get(key) ?? { n: 0, exact: 0, within1: 0, off3: 0, refused: 0, proposed: 0, proposedExact: 0, noCounter: !liftDefinition(key) };
    per.set(key, e);
    e.n++;
    if (e.noCounter) continue;
    const res = withProposal({ ...summarizeCount(r.worldLandmarks, r.timestamps, key), worldLandmarks: r.worldLandmarks, timestamps: r.timestamps }, key);
    if (res.refused) {
      e.refused++; e.off3++;
      if (res.proposal) { e.proposed++; if (res.proposal.count === truth) e.proposedExact++; }
      continue;
    }
    const d = Math.abs(res.count - truth);
    if (d === 0) e.exact++;
    if (d <= 1) e.within1++;
    if (d >= 3) e.off3++;
  }
  const rows = [...per.entries()].sort(([a], [b]) => a.localeCompare(b));
  const counted = rows.filter(([, e]) => !e.noCounter), sum = (k: keyof typeof rows[0][1]) => counted.reduce((s, [, e]) => s + (e[k] as number), 0);
  const lines = [
    `Motion library: the app's counting (summarizeCount, PSC proposal on refusals) on ${files.length} rendered sets of ${rows.length} exercises.`,
    `Exercises with a counter: ${counted.length}, sets ${sum('n')}: exact ${sum('exact')}, within 1 ${sum('within1')}, off by 3+ or refused ${sum('off3')}, refused ${sum('refused')} (PSC proposed ${sum('proposed')}, exact ${sum('proposedExact')}).`,
    `Exercises without a counter in the catalogue: ${rows.length - counted.length} (${rows.filter(([, e]) => e.noCounter).map(([k]) => k).join(', ')}).`,
    `Exercises whose clean sets are never counted exactly: ${counted.filter(([, e]) => e.exact === 0).map(([k]) => k).join(', ') || 'none'}.`,
    '',
    '| Exercise | Sets | Exact | Within 1 | Off 3+ or refused | Refused | PSC proposed / exact |',
    '|---|---:|---:|---:|---:|---:|---|',
    ...counted.map(([k, e]) => `| ${k} | ${e.n} | ${e.exact} | ${e.within1} | ${e.off3} | ${e.refused} | ${e.proposed} / ${e.proposedExact} |`),
  ];
  writeFileSync(process.env.LIBRARY_TXT ?? resolve(DIR!, 'library-core.txt'), lines.join('\n') + '\n');
  process.stdout.write(lines.slice(0, 4).join('\n') + '\n');
  expect(files.length).toBeGreaterThan(0);
}, 3_600_000);
