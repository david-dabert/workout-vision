// npm run scoreboard:public      (SCOREBOARD_UPDATE=1 once a change is accepted)
// CLAUDE.md R2 on public labelled sets (David, 30 September): the live core's count on every set of the
// build half of each public dataset, against its human label and against the counts last accepted
// (public-baseline.json), per dataset and lift. It fails if fewer sets are exact than before, or if a set
// becomes off by 3 or more. David's own sets keep their own gate (scoreboard.test.ts), unchanged.
import { expect, test } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { countInWindow, publicSets } from './sets';

const BASELINE = resolve(__dirname, 'public-baseline.json');
const off = (c: number | string, label: number) => (c === 'refused' ? Infinity : Math.abs((c as number) - label));

test.skipIf(!process.env.SCOREBOARD)('public scoreboard', () => {
  const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')).counts : {};
  const { sets, unreadable, missing: absent, notScored } = publicSets('build');
  const live: Record<string, number | string> = {}, groups = new Map<string, { n: number; exact: number; one: number; bad: number; refused: number }>();
  const rows: string[] = [];
  let exactNow = 0, exactBefore = 0, became = 0, added = 0;
  for (const s of sets) {
    const r = summarizeCount(s.wl, s.ts, s.lift);
    const now = r.refused ? 'refused' : countInWindow(r.reps, s.window), before = base[s.name];
    live[s.name] = now;
    const key = `${s.dataset} ${s.lift}`, g = groups.get(key) ?? { n: 0, exact: 0, one: 0, bad: 0, refused: 0 };
    g.n++; if (now === 'refused') g.refused++; else if (off(now, s.label) === 0) g.exact++; else if (off(now, s.label) === 1) g.one++; else if (off(now, s.label) >= 3) g.bad++;
    groups.set(key, g);
    if (before === undefined) { added++; continue; }
    if (off(now, s.label) === 0) exactNow++;
    if (off(before, s.label) === 0) exactBefore++;
    // A set that becomes off by 3 or more, or refused, where it was not before.
    if (off(now, s.label) >= 3 && off(before, s.label) < 3) { became++; rows.push(`BECAME OFF BY 3+  ${s.name}  label ${s.label}  before ${before}  now ${now}`); }
    else if (now !== before) rows.push(`-> ${s.name}  label ${s.label}  before ${before}  now ${now}`);
  }
  const missing = Object.keys(base).filter(n => !(n in live));
  const table = ['| Dataset, lift | Sets | Exact | Off by 1 | Off by 3+ | Refused |', '|---|---:|---:|---:|---:|---:|',
    ...[...groups].sort().map(([k, g]) => `| ${k} | ${g.n} | ${g.exact} | ${g.one} | ${g.bad} | ${g.refused} |`)];
  const n = sets.length, exact = [...groups.values()].reduce((a, g) => a + g.exact, 0);
  const head = `Public scoreboard ${new Date().toISOString().slice(0, 10)}: ${n} build sets, ${exact} exact (${n ? Math.round((100 * exact) / n) : 0}%). Of the ${n - added} in the baseline, ${exactNow} exact now, ${exactBefore} before; ${became} became off by 3 or more${added ? `; ${added} new since` : ''}.`;
  const text = [head, '', ...table, '', ...rows, ...missing.map(m => `MISSING ${m}`), ...absent.map(m => `MISSING ${m} (recorded as written, no file)`), ...unreadable.map(u => `UNREADABLE ${u}`),
    ...(notScored.length ? ['', `Not scored (${notScored.length}), each with its reason:`, ...notScored] : [])].join('\n') + '\n';
  writeFileSync(resolve(__dirname, 'public-scoreboard.txt'), text);
  process.stdout.write(text);
  expect(exactNow).toBeGreaterThanOrEqual(exactBefore);
  expect(became).toBe(0);
  expect(missing).toEqual([]);
  expect(absent).toEqual([]);
  expect(unreadable).toEqual([]);
  if (process.env.SCOREBOARD_UPDATE) writeFileSync(BASELINE, JSON.stringify({ note: `The counts last accepted (${new Date().toISOString().slice(0, 10)}), measured on the live core by npm run scoreboard:public, not typed.`, counts: live }, null, 2) + '\n');
}, 1_800_000);
