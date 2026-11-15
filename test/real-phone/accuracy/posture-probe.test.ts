// Bench (15 November 2026; TRIED.md; PROBE=<output file> to run, decides nothing): does the torso's inclination tell an edge cycle that is a rep (inside the posture the
// counted reps keep) from a movement before or after the set? Settings fixed before the run: envelope = 5th-95th
// percentile of the inclination over the counted reps' samples, widened by MARGIN degrees; a cycle keeps the set's
// posture when SHARE of its seen samples lie inside.
import { test } from 'vitest';
import { appendFileSync } from 'node:fs';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { openRise } from '../../../src/lib/fitness-tests';
import { liftDefinition } from '../../../src/lib/counting/core';
import { headChain } from './head-rhythm-probe.test';
import { countInWindow, decides, labelledSets, publicSets, videoSets } from './sets';
const log = (x: string) => appendFileSync(process.env.PROBE!, x + '\n');
const MARGIN = Number(process.env.MARGIN ?? 15), SHARE = Number(process.env.PSHARE ?? 0.8);
function incl(f: any): number | null {
  if (!f) return null;
  const v = (i: number) => f[i] && (f[i].visibility ?? 1) >= 0.5 ? f[i] : null;
  const ls = v(11), rs = v(12), lh = v(23), rh = v(24);
  if (!ls || !rs || !lh || !rh) return null;
  const x = (ls.x + rs.x - lh.x - rh.x) / 2, y = (ls.y + rs.y - lh.y - rh.y) / 2, z = (ls.z + rs.z - lh.z - rh.z) / 2;
  const n = Math.hypot(x, y, z); if (!n) return null;
  return (Math.acos(Math.max(-1, Math.min(1, -y / n))) * 180) / Math.PI;  // 0 = upright (y down in MediaPipe world)
}
const q = (xs: number[], p: number) => { const v = [...xs].sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))]; };
function keeps(wl: any[], ts: number[], reps: any[], t0: number, t1: number) {
  const inside = (t: number) => reps.some((x: any) => t >= x.startTime && t <= x.endTime);
  const ref = ts.map((t, i) => (inside(t) ? incl(wl[i]) : null)).filter((x): x is number => x !== null);
  if (ref.length < 10) return { ok: true, share: NaN };
  const lo = q(ref, 0.05) - MARGIN, hi = q(ref, 0.95) + MARGIN;
  const cand = ts.map((t, i) => (t >= t0 && t <= t1 ? incl(wl[i]) : undefined)).filter(x => x !== undefined) as (number | null)[];
  const seen = cand.filter((x): x is number => x !== null);
  if (!seen.length) return { ok: false, share: 0 };
  const share = seen.filter(x => x >= lo && x <= hi).length / seen.length;
  return { ok: share >= SHARE, share };
}
test.skipIf(!process.env.PROBE)('posture probe', () => {
  const rows: string[] = [];
  const run = (who: string, s: any, window?: [number, number]) => {
    const r: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
    if (r.refused || !r.reps?.length) return;
    const count = window ? countInWindow(r.reps, window) : r.count;
    const after = r.reps.at(-1).endTime;
    const o = openRise(r.smoothedAngles, s.ts, r.lowThreshold, r.highThreshold, liftDefinition(s.lift)!.rest, after);
    if (o) { const k = keeps(s.wl, s.ts, r.reps, o.startTime, s.ts.at(-1)); rows.push(`tail ${who} ${count === s.label ? 'countRight' : count < s.label ? 'countShort' : 'countOver'} keeps=${k.ok} share=${k.share.toFixed(2)} ${s.name}`); }
    const chain = headChain(r, s.ts, s.lift);
    if (chain.length) { const k = keeps(s.wl, s.ts, r.reps, chain.at(-1)! - 1, r.reps[0].startTime); rows.push(`head ${who} ${count + chain.length === s.label ? 'chainRight' : count === s.label ? 'chainBreaks' : 'chainOther'} keeps=${k.ok} share=${k.share.toFixed(2)} ${s.name}`); }
  };
  for (const s of publicSets('build').sets) if (decides(s.lift)) run('pub', s, s.window);
  for (const s of [...labelledSets().sets, ...videoSets().sets] as any[]) if (decides(s.lift)) run('david', s);
  for (const r of rows) log(r);
}, 600000);
