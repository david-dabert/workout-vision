// Bench (15 November 2026; TRIED.md; PROBE=<output file> to run, decides nothing): does a rise left open at the end, reaching the working threshold and left out of
// the count, mark the sets the app shows as sure and gets wrong?
import { test } from 'vitest';
import { appendFileSync } from 'node:fs';
const log = (x: string) => appendFileSync(process.env.PROBE!, x + '\n');
import { summarizeCount, withBodyCheck, withProposal } from '../../../src/lib/coreAnalysis';
import { openRise } from '../../../src/lib/fitness-tests';
import { liftDefinition } from '../../../src/lib/counting/core';
import { sureRow } from './sure';
import { countInWindow, decides, labelledSets, publicSets, videoSets } from './sets';

function tailOpen(r: any, ts: number[], lift: string) {
  if (r.refused || !r.smoothedAngles?.length) return null;
  const after = r.reps?.length ? r.reps.at(-1).endTime : -Infinity;
  return openRise(r.smoothedAngles, ts, r.lowThreshold, r.highThreshold, liftDefinition(lift)!.rest, after);
}
// The open rise's shape: how long the video stays at the working end after the rise reaches it, the rise's time from
// rest to the working threshold, and the gap from the last counted rep, against the set's median rep.
function shape(r: any, ts: number[], lift: string) {
  const o = tailOpen(r, ts, lift);
  if (!o) return null;
  const up = liftDefinition(lift)!.rest === 'low', a = r.smoothedAngles;
  const i0 = ts.findIndex(t => t >= o.startTime);
  let w = -1;
  for (let i = i0; i < a.length; i++) if (a[i] !== null && (up ? a[i] >= r.highThreshold : a[i] <= r.lowThreshold)) { w = i; break; }
  const durs = (r.reps ?? []).map((x: any) => x.endTime - x.startTime).sort((x: number, y: number) => x - y);
  const med = durs.length ? durs[Math.floor(durs.length / 2)] : NaN;
  const gap = r.reps?.length ? o.startTime - r.reps.at(-1).endTime : NaN;
  return { hold: ts.at(-1)! - ts[w], rise: ts[w] - o.startTime, med, gap, reps: durs.length };
}
const f = (x: number) => Number.isFinite(x) ? x.toFixed(2) : 'n/a';
type Row = { name: string; lift: string; label: number; scored: number | null; sure: boolean; err: number | null; tail: boolean };
function report(title: string, rows: Row[]) {
  const sure = rows.filter(r => r.err !== null && r.sure);
  const part = (g: Row[]) => {
    const e = g.filter(r => r.err === 0).length, under = g.filter(r => r.scored! < r.label).length, over = g.filter(r => r.scored! > r.label).length;
    return `${g.length}: ${e} exact (${g.length ? Math.round(100 * e / g.length) : 0}%), under ${under}, over ${over}, off by 3+ ${g.filter(r => r.err! >= 3).length}`;
  };
  log(`${title}: shown as sure ${part(sure)}; with an open tail ${part(sure.filter(r => r.tail))}; without ${part(sure.filter(r => !r.tail))}; open tail among all counted ${rows.filter(r => r.err !== null && r.tail).length}`);
}
test.skipIf(!process.env.PROBE)('open tail probe', () => {
  const pub: Row[] = [];
  for (const s of publicSets('build').sets) {
    if (!decides(s.lift)) continue;
    const r: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
    const row = sureRow(withBodyCheck({ ...r, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: s.il ?? null }, s.lift), s.lift, s.label, x => countInWindow(x.reps, s.window));
    const scored = r.refused ? null : countInWindow(r.reps, s.window);
    const sh = shape(r, s.ts, s.lift);
    if (sh && !row.flagged && !row.moved && row.err !== null) log(`  pub ${row.err === 0 ? 'EXACT' : 'wrong'} ${s.lift} label ${s.label} scored ${scored} hold ${f(sh.hold)} rise ${f(sh.rise)} med ${f(sh.med)} gap ${f(sh.gap)} reps ${sh.reps}`);
    pub.push({ name: s.name, lift: s.lift, label: s.label, scored, sure: !row.flagged && !row.moved, err: row.err, tail: r.tailOpen === true });
  }
  report('Public build, deciding', pub);
  for (const ds of ['countix', 'countix-whole', 'mmfit', 'cfrep']) report(`  ${ds}`, pub.filter(r => r.name.startsWith(`public/${ds}/`)));
  const dav: Row[] = [];
  const own = [...labelledSets().sets, ...videoSets().sets];
  for (const s of own as any[]) {
    if (!decides(s.lift)) continue;
    const c: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
    const r: any = withBodyCheck(withProposal({ ...c, refused: c.refused || !!s.appRefused, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: s.il ?? null }, s.lift), s.lift);
    const row = sureRow(r, s.lift, s.label);
    const t = c.tailOpen === true;
    dav.push({ name: s.name, lift: s.lift, label: s.label, scored: c.refused ? null : c.count, sure: !row.flagged && !row.moved, err: row.err, tail: t });
    const sh = shape(c, s.ts, s.lift);
    if (t) log(`  David open tail: ${s.name} label ${s.label} count ${c.count} sure ${!row.flagged && !row.moved}${sh ? ` hold ${f(sh.hold)} rise ${f(sh.rise)} med ${f(sh.med)} gap ${f(sh.gap)}` : ''}`);
  }
  report("David's sets and videos, deciding", dav);
}, 600000);
