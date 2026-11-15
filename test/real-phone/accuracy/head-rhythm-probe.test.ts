// Bench (15 November 2026; TRIED.md; PROBE=<output file> to run, decides nothing): shallow cycles before the first counted rep, kept when each falls one period before
// the next (the set's rhythm), as the edge re-read of 5 October asked (TRIED.md). Settings fixed before the run.
import { test } from 'vitest';
import { appendFileSync } from 'node:fs';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { countInWindow, decides, labelledSets, publicSets, videoSets } from './sets';
const log = (x: string) => appendFileSync(process.env.PROBE!, x + '\n');
const SHARE = Number(process.env.SHARE ?? 0.4), TOL = Number(process.env.TOL ?? 0.25);

/** Peak times of head cycles chained back from the first counted rep at the set's period. */
export function headChain(r: any, ts: number[], lift: string): number[] {
  if (r.refused || !r.reps || r.reps.length < 3) return [];
  const up = liftDefinition(lift)!.rest === 'low', a: (number | null)[] = r.smoothedAngles;
  const rest = up ? r.lowThreshold : r.highThreshold, work = up ? r.highThreshold : r.lowThreshold;
  const u = a.map(x => (x === null ? null : (x - rest) / (work - rest)));
  // Each counted rep's peak (furthest from rest) and the set's period (median gap between successive peaks).
  const peakOf = (t0: number, t1: number) => { let bi = -1; for (let i = 0; i < ts.length; i++) if (ts[i] >= t0 && ts[i] <= t1 && u[i] !== null && (bi < 0 || u[i]! > u[bi]!)) bi = i; return bi; };
  const peaks = r.reps.map((x: any) => peakOf(x.startTime, x.endTime)).filter((i: number) => i >= 0);
  if (peaks.length < 3) return [];
  const gaps = peaks.slice(1).map((p: number, k: number) => ts[p] - ts[peaks[k]]).sort((x: number, y: number) => x - y);
  const P = gaps[Math.floor(gaps.length / 2)];
  const amps = r.reps.map((x: any) => { let lo = Infinity, hi = -Infinity; for (let i = 0; i < ts.length; i++) if (ts[i] >= x.startTime && ts[i] <= x.endTime && u[i] !== null) { lo = Math.min(lo, u[i]!); hi = Math.max(hi, u[i]!); } return hi - lo; }).sort((x: number, y: number) => x - y);
  const A = amps[Math.floor(amps.length / 2)];
  const head = r.reps[0].startTime;
  // Local maxima before the first rep, with their prominence over the lowest point on each side up to the next higher peak.
  const cands: { i: number; prom: number }[] = [];
  for (let i = 1; i < ts.length - 1 && ts[i] < head; i++) {
    if (u[i] === null || u[i - 1] === null || u[i + 1] === null || !(u[i]! >= u[i - 1]! && u[i]! > u[i + 1]!)) continue;
    let l = Infinity, rr = Infinity;
    for (let k = i - 1; k >= 0 && u[k] !== null && u[k]! <= u[i]!; k--) l = Math.min(l, u[k]!);
    for (let k = i + 1; k < ts.length && u[k] !== null && u[k]! <= u[i]! && ts[k] <= head + 0.5 * P; k++) rr = Math.min(rr, u[k]!);
    const prom = u[i]! - Math.max(l === Infinity ? -Infinity : l, rr === Infinity ? -Infinity : rr);
    if (prom >= SHARE * A) cands.push({ i, prom });
  }
  const chain: number[] = [];
  let next = ts[peaks[0]];
  for (;;) {
    const c = cands.filter(c => Math.abs(next - ts[c.i] - P) <= TOL * P).sort((x, y) => y.prom - x.prom)[0];
    if (!c) break;
    chain.push(ts[c.i]); next = ts[c.i];
  }
  return chain;
}
test.skipIf(!process.env.PROBE)('head rhythm probe', () => {
  const tally = new Map<string, { n: number; gain: number; loss: number; moved: number }>();
  for (const s of publicSets('build').sets) {
    if (!decides(s.lift)) continue;
    const r: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
    const chain = headChain(r, s.ts, s.lift);
    const before = r.refused ? null : countInWindow(r.reps, s.window);
    const after = before === null ? null : before + chain.filter(t => !s.window || (t >= s.window[0] && t <= s.window[1])).length;
    const g = tally.get(s.dataset) ?? { n: 0, gain: 0, loss: 0, moved: 0 }; g.n++;
    if (after !== before) { g.moved++; if (after === s.label) g.gain++; if (before === s.label) g.loss++; log(`  ${s.name.split('/').slice(1).join('/')} ${s.lift} label ${s.label} ${before} -> ${after}`); }
    tally.set(s.dataset, g);
  }
  for (const [ds, g] of tally) log(`${ds}: ${g.n} sets, moved ${g.moved}, exact gained ${g.gain}, exact lost ${g.loss}`);
  let n = 0, gain = 0, loss = 0, moved = 0;
  for (const s of [...labelledSets().sets, ...videoSets().sets] as any[]) {
    if (!decides(s.lift)) continue;
    const r: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
    const k = headChain(r, s.ts, s.lift).length; n++;
    if (k) { moved++; if (r.count + k === s.label) gain++; if (r.count === s.label) loss++; log(`  David ${s.name} label ${s.label} ${r.count} -> ${r.count + k}`); }
  }
  log(`David: ${n} sets, moved ${moved}, exact gained ${gain}, exact lost ${loss}`);
}, 600000);
