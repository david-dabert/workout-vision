// HOLDOUT=1 npx vitest run test/real-phone/accuracy/public-holdout.test.ts
// The held-out half of the public sets (scripts/public/split.mjs), read only here, once a change has passed
// every gate on the build half: the live core's exact share per dataset and lift, written with its date and
// commit to public-holdout.txt. Nothing is tuned on these sets.
import { test } from 'vitest';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { publicSets } from './sets';

test.skipIf(!process.env.HOLDOUT)('public held-out half', () => {
  const groups = new Map<string, { n: number; exact: number; one: number }>();
  const { sets, unreadable, missing, notScored } = publicSets('holdout');
  for (const s of sets) {
    const r = summarizeCount(s.wl, s.ts, s.lift);
    const d = r.refused ? Infinity : Math.abs(r.count - s.label);
    const key = `${s.dataset} ${s.lift}`, g = groups.get(key) ?? { n: 0, exact: 0, one: 0 };
    g.n++; if (d === 0) g.exact++; if (d <= 1) g.one++;
    groups.set(key, g);
  }
  const commit = execSync('git rev-parse --short HEAD').toString().trim();
  const text = [`Public held-out half ${new Date().toISOString().slice(0, 10)} at ${commit}: ${sets.length} sets.`, '',
    '| Dataset, lift | Sets | Exact | Within one |', '|---|---:|---:|---:|',
    ...[...groups].sort().map(([k, g]) => `| ${k} | ${g.n} | ${g.exact} | ${g.one} |`),
    ...unreadable.map(u => `UNREADABLE ${u}`), ...missing.map(m => `MISSING ${m}`), ...(notScored.length ? ['', `Not scored (${notScored.length}):`, ...notScored] : [])].join('\n') + '\n';
  writeFileSync(resolve(__dirname, 'public-holdout.txt'), text);
  process.stdout.write(text);
});
