// npm run scoreboard:public      (SCOREBOARD_UPDATE=1 once a change is accepted)
// CLAUDE.md R2 on public labelled sets (David, 30 September): the live core's count on every set of the
// build half of each public dataset, against its human label and against the counts last accepted
// (public-baseline.json), per dataset and lift. It fails if fewer sets are exact than before, or if a set
// becomes off by 3 or more. David's own sets keep their own gate (scoreboard.test.ts), unchanged. Bench press and
// overhead press sets are measured, shown and kept in the baseline, and decide nothing (PLAN.md; decides() in sets.ts).
import { expect, test } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { benchSets, countInWindow, decides, doubtLine, PRESS_DECIDES_NOTHING, publicSets } from './sets';
import { liftDefinition } from '../../../src/lib/counting/core';

const BASELINE = resolve(__dirname, 'public-baseline.json');
const off = (c: number | string, label: number) => (c === 'refused' ? Infinity : Math.abs((c as number) - label));

// 95% Wilson score interval for a share k of n (Wilson EB, "Probable inference, the law of succession, and
// statistical inference", J Am Stat Assoc 1927;22(158):209-212). z = 1.96 for 95%. Status: literature.
// Printed only, decides nothing: the gate below is unchanged.
function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (!n) return [0, 0];
  const p = k / n, z2 = z * z, d = 1 + z2 / n;
  const mid = (p + z2 / (2 * n)) / d, half = (z / d) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return [Math.max(0, mid - half), Math.min(1, mid + half)];
}
const share = (k: number, n: number) => {
  const pct = (x: number) => Math.round(100 * x), [lo, hi] = wilson(k, n);
  return `${k} exact (${n ? pct(k / n) : 0}%, 95% Wilson ${pct(lo)}-${pct(hi)}%)`;
};

// The headline counts sets; Countix's 447 build clips are each read twice, cut to the labelled window (countix) and
// whole with the window beside it (countix-whole, same file name), so its two readings are not independent sets
// (audit of 6 October, action 12). These lines report each dataset alone, and Countix once per distinct clip.
// Rep error is total |count - label| over the labelled reps of the counted sets (refused sets have no count).
// Printed only, decides nothing.
function honestLines(sets: { name: string; dataset: string; label: number }[], live: Record<string, number | string>) {
  const exact = (name: string, label: number) => live[name] !== 'refused' && off(live[name], label) === 0;
  const lines = ['Per dataset, each counted by sets, press sets included as in the headline; 95% Wilson interval for the exact share; rep error = total |count - label| over the labelled reps of the counted sets:'];
  for (const ds of [...new Set(sets.map(s => s.dataset))].sort()) {
    const g = sets.filter(s => s.dataset === ds), counted = g.filter(s => live[s.name] !== 'refused');
    const err = counted.reduce((a, s) => a + off(live[s.name], s.label), 0), reps = counted.reduce((a, s) => a + s.label, 0);
    lines.push(`- ${ds}: ${g.length} sets, ${share(g.filter(s => exact(s.name, s.label)).length, g.length)}, ${g.length - counted.length} refused, rep error ${err} of ${reps} reps (${reps ? (100 * err / reps).toFixed(1) : 0}%).`);
  }
  const clip = (s: { name: string }) => s.name.split('/').pop()!;
  const cut = new Map(sets.filter(s => s.dataset === 'countix').map(s => [clip(s), s]));
  const whole = new Map(sets.filter(s => s.dataset === 'countix-whole').map(s => [clip(s), s]));
  const both = [...cut.keys()].filter(k => whole.has(k));
  if (both.length) {
    // A clip's file is <youtube id>_<start s, 6 digits>_<window start ms> (scripts/public/countix.mjs).
    const videos = new Set(both.map(k => k.replace(/_\d{6}_\d+\.json\.gz$/, ''))).size;
    const ex = (m: typeof cut, k: string) => exact(m.get(k)!.name, m.get(k)!.label);
    const b = both.filter(k => ex(cut, k) && ex(whole, k)).length, e = both.filter(k => ex(cut, k) || ex(whole, k)).length;
    lines.push(`Countix by distinct clip: ${both.length} labelled clips from ${videos} YouTube videos, each read twice (cut and whole)${cut.size + whole.size - 2 * both.length ? `, ${cut.size + whole.size - 2 * both.length} read once and left out here` : ''}: both readings ${share(b, both.length)}; either reading ${share(e, both.length)}.`);
  }
  return lines;
}

// RepCount-A (test/real-phone/public/repcount/, scripts/public/fetch-repcount-lance.sh), build half: every class, the live
// core's count where the class maps to a catalogue key with a counter, "no counter" otherwise. A benchmark for a
// class-agnostic counter (test/real-phone/psc/): printed only, decides nothing, enters no baseline.
function repCountSection() {
  const { sets, unreadable, missing, notScored, record } = benchSets('repcount', 'build');
  if (!Object.keys(record).length) return ['RepCount-A: no set on disk.'];
  const rows = new Map<string, { n: number; exact: number; one: number; bad: number; refused: number; mapped: boolean; lift: string | null }>();
  for (const s of sets) {
    const mapped = !!s.lift && !!liftDefinition(s.lift);
    const g = rows.get(s.cls) ?? { n: 0, exact: 0, one: 0, bad: 0, refused: 0, mapped, lift: s.lift };
    g.n++;
    if (mapped) {
      const r = summarizeCount(s.wl, s.ts, s.lift!);
      const e = r.refused ? Infinity : Math.abs(r.count - s.label);
      if (r.refused) g.refused++; else if (e === 0) g.exact++; else if (e === 1) g.one++;
      if (e >= 3) g.bad++;
    }
    rows.set(s.cls, g);
  }
  const all = Object.values(record), held = all.filter(r => r.split === 'holdout' && r.status === 'written').length;
  const counted = [...rows.values()].filter(g => g.mapped), n = counted.reduce((a, g) => a + g.n, 0), ex = counted.reduce((a, g) => a + g.exact, 0);
  return [
    `RepCount-A (Hugging Face lmms-lab-eval/repcounta-lance, test and validation splits; build half; benchmark only, decides nothing): ${sets.length} build sets of ${rows.size} classes; ${held} held out, unread; ${notScored.length} failed or left out. Core on the ${n} sets of classes with a counter: ${ex} exact (${n ? Math.round((100 * ex) / n) : 0}%). Off by 3+ counts refusals.`,
    '| Class | Catalogue key | Sets | Exact | Off by 1 | Off by 3+ | Refused |', '|---|---|---:|---:|---:|---:|---:|',
    ...[...rows].sort(([a], [b]) => a.localeCompare(b)).map(([c, g]) => g.mapped ? `| ${c} | ${g.lift} | ${g.n} | ${g.exact} | ${g.one} | ${g.bad} | ${g.refused} |` : `| ${c} | no counter | ${g.n} | - | - | - | - |`),
    ...missing.map(m => `MISSING ${m}`), ...unreadable.map(u => `UNREADABLE ${u}`),
    ...(notScored.length ? [`Not scored (${notScored.length}):`, ...notScored] : []),
  ];
}

test.skipIf(!process.env.SCOREBOARD)('public scoreboard', () => {
  // In CI, the base branch's counts (PUBLIC_BASE): a change cannot lower the bar by editing them (audit of 3 October).
  const from = process.env.PUBLIC_BASE || BASELINE;
  const base = existsSync(from) ? JSON.parse(readFileSync(from, 'utf8')).counts : {};
  const { sets, unreadable, missing: absent, notScored } = publicSets('build');
  const live: Record<string, number | string> = {}, groups = new Map<string, { n: number; exact: number; one: number; bad: number; refused: number }>();
  const rows: string[] = [], doubts: { flagged: boolean; err: number }[] = [];
  let exactNow = 0, exactBefore = 0, became = 0, added = 0, kept = 0;
  for (const s of sets) {
    const r = summarizeCount(s.wl, s.ts, s.lift);
    const now = r.refused ? 'refused' : countInWindow(r.reps, s.window), before = base[s.name];
    live[s.name] = now;
    if (r.doubt && now !== 'refused') doubts.push({ flagged: r.doubt.flagged, err: Math.abs((now as number) - s.label) });
    const key = `${s.dataset} ${s.lift}`, g = groups.get(key) ?? { n: 0, exact: 0, one: 0, bad: 0, refused: 0 };
    g.n++; if (now === 'refused') g.refused++; else if (off(now, s.label) === 0) g.exact++; else if (off(now, s.label) === 1) g.one++; else if (off(now, s.label) >= 3) g.bad++;
    groups.set(key, g);
    if (before === undefined) { added++; continue; }
    // A press set is shown like any other and moves no tally of the gate (PLAN.md: "measured but decide nothing").
    if (!decides(s.lift)) { if (now !== before) rows.push(`-> ${s.name}  label ${s.label}  before ${before}  now ${now}  ${PRESS_DECIDES_NOTHING}`); continue; }
    kept++;
    if (off(now, s.label) === 0) exactNow++;
    if (off(before, s.label) === 0) exactBefore++;
    // A set that becomes off by 3 or more, or refused, where it was not before.
    if (off(now, s.label) >= 3 && off(before, s.label) < 3) { became++; rows.push(`BECAME OFF BY 3+  ${s.name}  label ${s.label}  before ${before}  now ${now}`); }
    else if (now !== before) rows.push(`-> ${s.name}  label ${s.label}  before ${before}  now ${now}`);
  }
  const missing = Object.keys(base).filter(n => !(n in live));
  const table = ['| Dataset, lift | Sets | Exact | Off by 1 | Off by 3+ | Refused |', '|---|---:|---:|---:|---:|---:|',
    ...[...groups].sort().map(([k, g]) => `| ${k}${decides(k.split(' ')[1]) ? '' : ` ${PRESS_DECIDES_NOTHING}`} | ${g.n} | ${g.exact} | ${g.one} | ${g.bad} | ${g.refused} |`)];
  const n = sets.length, exact = [...groups.values()].reduce((a, g) => a + g.exact, 0);
  const head = `Public scoreboard ${new Date().toISOString().slice(0, 10)}: ${n} build sets, ${exact} exact (${n ? Math.round((100 * exact) / n) : 0}%). Of the ${kept} in the baseline that decide, ${exactNow} exact now, ${exactBefore} before; ${became} became off by 3 or more${added ? `; ${added} new since` : ''}. The ${n - added - kept} bench and overhead press sets are measured and decide nothing (PLAN.md).`;
  const text = [head, doubtLine(doubts), '', ...honestLines(sets, live), '', ...table, '', ...rows, ...missing.map(m => `MISSING ${m}`), ...absent.map(m => `MISSING ${m} (recorded as written, no file)`), ...unreadable.map(u => `UNREADABLE ${u}`),
    ...(notScored.length ? ['', `Not scored (${notScored.length}), each with its reason:`, ...notScored] : []), '', ...repCountSection()].join('\n') + '\n';
  writeFileSync(resolve(__dirname, 'public-scoreboard.txt'), text);
  process.stdout.write(text);
  expect(exactNow).toBeGreaterThanOrEqual(exactBefore);
  expect(became).toBe(0);
  expect(missing).toEqual([]);
  expect(absent).toEqual([]);
  expect(unreadable).toEqual([]);
  // In CI the committed baseline must hold the live counts, so a hand edit or a count change merged without
  // SCOREBOARD_UPDATE cannot move the bar the next change is compared with (third audit, C27).
  if (process.env.PUBLIC_BASE) expect(existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')).counts : {}).toEqual(live);
  if (process.env.SCOREBOARD_UPDATE) writeFileSync(BASELINE, JSON.stringify({ note: `The counts last accepted (${new Date().toISOString().slice(0, 10)}), measured on the live core by npm run scoreboard:public, not typed.`, counts: live }, null, 2) + '\n');
}, 1_800_000);
