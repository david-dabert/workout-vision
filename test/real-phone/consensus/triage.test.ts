// TRIAGE=<out.txt> npx vitest run --no-cache test/real-phone/consensus/triage.test.ts
// Why the public count falls short (bench only, decides nothing). On the public build halves the error is an undercount
// by 1 on 255 of 1,064 sets and by 2 on 83, against 47 overcounts by 1 (consensus bench, 20 October 2026). For each
// undercounted set, the trace is read against the core's own thresholds: a first excursion the video opens inside and
// the core did not count (head), a last one it ends inside (tail), excursions that left the rest and reached part of the
// way to the working threshold without crossing it (shallow, by how far they got), excursions that crossed it but were
// not counted (lost), and counted reps far longer than the set's median (merged). Tallied per half and per lift.
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { countInWindow, publicSets } from '../accuracy/sets';

type Exc = { from: number; to: number; peak: number; counted: boolean };

test.skipIf(!process.env.TRIAGE)('why the public count falls short', () => {
  const half = (name: string) => (parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'A' : 'B');
  const tally: Record<string, Record<string, number>> = {};
  const bump = (k: string, c: string) => { (tally[k] ??= {})[c] = ((tally[k] ??= {})[c] ?? 0) + 1; };
  const lines: string[] = [];
  let sets = 0, under = 0;
  for (const s of publicSets('build').sets) {
    const def = liftDefinition(s.lift); if (!def) continue;
    const why: any[] = [];
    (globalThis as any).__WV_CORE_BENCH__ = { tailWhy: why };
    const r: any = summarizeCount(s.wl, s.ts, s.lift);
    (globalThis as any).__WV_CORE_BENCH__ = undefined;
    if (r.refused) continue;
    const count = s.window ? countInWindow(r.reps ?? [], s.window) : r.count;
    sets++;
    if (count >= s.label) continue;
    under++;
    const restsLow = def.rest === 'low';
    const sm: (number | null)[] = r.smoothedAngles, ts: number[] = s.ts;
    // Work-ward axis: w grows toward the working end whatever the lift's rest.
    const w = (a: number) => (restsLow ? a : -a);
    const restLine = w(restsLow ? r.lowThreshold : r.highThreshold), workLine = w(restsLow ? r.highThreshold : r.lowThreshold);
    const span = workLine - restLine;
    const [t0, t1] = s.window ?? [ts[0], ts[ts.length - 1]];
    const reps: { startTime: number; endTime: number }[] = (r.reps ?? []).filter((p: any) => p.endTime > t0 && p.startTime < t1);
    const inRep = (t: number) => reps.some(p => t >= p.startTime - 0.05 && t <= p.endTime + 0.05);
    // Excursions above the rest line, inside the scored window.
    const exc: Exc[] = [];
    let cur: Exc | null = null;
    for (let i = 0; i < sm.length; i++) {
      const a = sm[i]; if (a === null || ts[i] < t0 || ts[i] > t1) { if (cur) { exc.push(cur); cur = null; } continue; }
      const above = w(a) > restLine;
      if (above) { if (!cur) cur = { from: i, to: i, peak: w(a), counted: false }; cur.to = i; cur.peak = Math.max(cur.peak, w(a)); }
      else if (cur) { exc.push(cur); cur = null; }
    }
    if (cur) exc.push(cur);
    for (const e of exc) e.counted = inRep((ts[e.from] + ts[e.to]) / 2) || inRep(ts[e.from]) || inRep(ts[e.to]);
    const first = sm.findIndex((a, i) => a !== null && ts[i] >= t0), last = sm.length - 1 - [...sm].reverse().findIndex((a, i) => a !== null && ts[sm.length - 1 - i] <= t1);
    const cats: string[] = [];
    const durs = reps.map(p => p.endTime - p.startTime).sort((a, b) => a - b);
    const med = durs.length ? durs[Math.floor(durs.length / 2)] : 0;
    const uncounted = exc.filter(e => !e.counted);
    for (const e of uncounted) {
      const share = (e.peak - restLine) / span, dur = ts[e.to] - ts[e.from];
      const atHead = e.from === first && first >= 0, atTail = e.to === last && last >= 0;
      if (share >= 1) {
        cats.push(atHead ? 'head, reached work' : atTail ? 'tail, reached work' : dur < 0.5 ? 'lost: crossed work, under 0.5 s' : 'lost: crossed work, not counted');
        // Detail of the tail: how far back it came (share of the way from its peak to the rest line), seconds from its
        // last sample past the working line to the end, its duration, and the set's median counted rep.
        if (atTail && why.length) {
          // The core's own tail rule on this set (the last side it judged): which of its conditions refused the rep.
          const q = why[why.length - 1], fails: string[] = [];
          if (!q.whole) fails.push(q.duration < q.minSec ? 'whole: duration under minSec' : q.rom < q.minRom ? 'whole: rom under minRom' : 'whole: not bounded');
          if (q.window > 2) fails.push('return window over 2 s');
          if (q.returned < 0.7 && !q.stoppedAtWork) {
            if (!q.reachedWork) fails.push('stopped: never at work');
            else {
              if (!q.seenToEnd) fails.push('stopped: pose not seen to the end');
              if (!q.deepEnough) fails.push(q.cycles < 2 ? 'stopped: fewer than 2 reps to set the depth' : 'stopped: not 0.85 as deep');
              if (q.opensHeldAtWork) fails.push('stopped: video opened holding the working end');
              if (q.afterWork > 0.6) fails.push('stopped: last at work over 0.6 s before the end');
              if (q.hold > 1.5) fails.push('stopped: at work over 1.5 s');
            }
          }
          if (!fails.length) fails.push(q.returned >= 0.7 || q.stoppedAtWork ? 'rule passed (another side judged?)' : 'none identified');
          for (const f of fails) bump('tail why (core rule)', f);
          bump('tail why: conditions failing', String(Math.min(3, fails.length)));
        }
        if (atTail) {
          let lastWork = e.from;
          for (let i = e.from; i <= e.to; i++) if (sm[i] !== null && w(sm[i]!) >= workLine) lastWork = i;
          const endW = w(sm[e.to]!), returned = (e.peak - endW) / (e.peak - restLine);
          const b = (x: number, edges: number[]) => { for (const k of edges) if (x < k) return `<${k}`; return `>=${edges[edges.length - 1]}`; };
          bump('tail detail: returned share', b(returned, [0.1, 0.3, 0.5, 0.7, 0.9]));
          bump('tail detail: s after last at-work sample', b(ts[e.to] - ts[lastWork], [0.2, 0.6, 1, 1.5, 2]));
          bump('tail detail: excursion s / median counted rep s', med ? b(dur / med, [0.3, 0.5, 0.8, 1.2, 2]) : 'no counted rep');
        }
        if (!atHead && !atTail && dur < 0.5) bump('lost under 0.5 s detail: excursion s / median counted rep s', med ? (dur / med < 0.3 ? '<0.3' : dur / med < 0.5 ? '<0.5' : dur / med < 0.8 ? '<0.8' : '>=0.8') : 'no counted rep');
      }
      else if (share >= 0.5) cats.push(atHead ? 'head, shallow 50-100 %' : atTail ? 'tail, shallow 50-100 %' : 'shallow 50-100 %');
      else if (share >= 0.25) cats.push('shallow 25-50 %');
    }
    for (const p of reps) if (med && p.endTime - p.startTime > 1.8 * med) cats.push('merged: rep over 1.8x median');
    if (!cats.length) cats.push('no uncounted excursion seen');
    const h = half(s.name);
    for (const c of new Set(cats)) { bump(`half ${h}`, c); bump(`lift ${s.lift}`, c); bump('all', c); }
    bump('all', `missing ${Math.min(3, s.label - count)}`);
    lines.push(`${h}  ${s.name}  ${s.lift}  label ${s.label}  count ${count}  ${cats.join('; ')}`);
  }
  const out = [`Public build sets counted ${sets}, undercounted ${under}. Each undercounted set is tallied once per category it shows.`, ''];
  for (const k of Object.keys(tally).sort()) out.push(k, ...Object.entries(tally[k]).sort((a, b) => b[1] - a[1]).map(([c, n]) => `  ${String(n).padStart(4)}  ${c}`), '');
  out.push('Per set:', ...lines);
  writeFileSync(process.env.TRIAGE!, out.join('\n') + '\n');
  process.stdout.write(out.slice(0, out.indexOf('Per set:')).join('\n') + '\n');
}, 1_800_000);
