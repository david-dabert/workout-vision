// Card 065's eval, fixed in the card before its first run: shown as sure as the app ships (sure.ts, on every phone),
// then with the uncounted cycles asking too (uncounted.js, card 065's rule, failed; read by no screen). Bench only,
// decides nothing; no sealed set and no held-out half is read. SURE_ASKS=1 SURE_ASKS_OUT=<file>.
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { summarizeCount, withBodyCheck, withProposal } from '../../../src/lib/coreAnalysis';
import { UNCOUNTED_CYCLES_ASK, uncountedCycles } from './uncounted.js';
import { benchSets, countInWindow, decides, labelledSets, publicSets, videoSets } from '../accuracy/sets';
import { appOutcome } from '../accuracy/outcome.mjs';
import { sureRow } from '../accuracy/sure';

type R = { suite: string; name: string; err: number; sure: boolean; asks: boolean };
const app = (lift: string, wl: any[], ts: number[], il: any) => {
  const c: any = summarizeCount(wl, ts, lift, undefined, il ?? undefined);
  return withBodyCheck(withProposal({ ...c, worldLandmarks: wl, timestamps: ts, imageLandmarks: il ?? null }, lift), lift);
};

test.skipIf(!process.env.SURE_ASKS)('card 065: uncounted cycles asking', () => {
  const rows: R[] = [];
  const push = (suite: string, name: string, res: any, row: ReturnType<typeof sureRow> | null) => {
    if (!row || row.err === null) return;
    rows.push({ suite, name, err: row.err, sure: !row.flagged && !row.moved, asks: uncountedCycles(res.smoothedAngles, res.timestamps, res.reps) >= UNCOUNTED_CYCLES_ASK });
  };
  for (const s of labelledSets().sets.filter(s => decides(s.lift))) { const r = app(s.lift, s.wl, s.ts, s.il ?? null); push('David', s.name, r, sureRow(r, s.lift, s.label)); }
  for (const s of videoSets().sets) {
    const o = appOutcome(s) as { now: number | 'refused' };
    if (s.appRefused || o.now === 'refused') continue;
    const r = app(s.lift, s.wl, s.ts, s.il); push('David video', s.name, r, sureRow(r, s.lift, s.label, () => o.now as number));
  }
  for (const s of publicSets('build').sets.filter(s => decides(s.lift))) {
    const c: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
    if (c.refused) continue;
    const r = withBodyCheck({ ...c, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: s.il ?? null }, s.lift);
    push(s.dataset === 'countix-whole' ? 'public build, Countix whole clips' : 'public build', s.name, r, sureRow(r, s.lift, s.label, x => countInWindow(x.reps, s.window)));
  }
  for (const s of benchSets('repcount', 'build').sets) {
    if (!s.lift || !decides(s.lift)) continue;
    const c: any = summarizeCount(s.wl, s.ts, s.lift, undefined, undefined);
    if (c.refused) continue;
    const r = withBodyCheck({ ...c, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: null }, s.lift);
    push('RepCount-A build (confirmation)', s.name, r, sureRow(r, s.lift, s.label));
  }
  const pct = (k: number, n: number) => (n ? (100 * k / n).toFixed(1) : '0.0');
  const part = (xs: R[]) => { const e = xs.filter(r => r.err === 0).length, b = xs.filter(r => r.err >= 3); return `${xs.length} shown as sure, ${e} exact (${pct(e, xs.length)} %), ${b.length} off by 3 or more`; };
  const out: string[] = [`Card 065, run of ${new Date().toISOString().slice(0, 10)}. Counted sets that decide, per suite: as the app ships, then with the uncounted cycles (>= ${UNCOUNTED_CYCLES_ASK}) asking too.`, ''];
  // The scoreboard's public population (public-scoreboard.test.ts): both public suites together, card 065's criterion.
  for (const r of rows.filter(r => r.suite.startsWith('public build'))) rows.push({ ...r, suite: 'public, as the scoreboard reads it (card 065 criterion)' });
  for (const suite of [...new Set(rows.map(r => r.suite))]) {
    const xs = rows.filter(r => r.suite === suite), now = xs.filter(r => r.sure), next = now.filter(r => !r.asks);
    out.push(`${suite}: ${xs.length} counted. As the app ships: ${part(now)}. With the rule: ${part(next)}. Turned to asked: ${now.length - next.length} (${now.filter(r => r.asks && r.err === 0).length} exact, ${now.filter(r => r.asks && r.err >= 3).length} off by 3 or more).`);
    for (const r of now.filter(r => r.asks || r.err >= 3)) out.push(`  ${r.asks ? 'asked now' : 'still sure'}: ${r.name}, off by ${r.err}`);
  }
  writeFileSync(process.env.SURE_ASKS_OUT ?? 'sure-asks.txt', out.join('\n') + '\n');
}, 600_000);
