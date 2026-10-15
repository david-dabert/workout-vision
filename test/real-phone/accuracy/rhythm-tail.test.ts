// RHYTHM=1 [TOL=0.25 REACH=0.5] npx vitest run test/real-phone/accuracy/rhythm-tail.test.ts
// Task of 15 October 2026 (edges-2026-10-15.md): a last rep the video stops on, counted only when it leaves rest one
// period after the last counted rep (the median gap between rep onsets, within TOL of it) and reaches REACH of the way
// to the working threshold. A post-process of the live core's result: the core is not changed. Measured, not shipped
// (TRIED.md, 15 October 2026). Runs only when asked.
import { test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { liftDefinition, countReps } from '../../../src/lib/counting/core';
import { labelledSets, videoSets, decides } from './sets';
import { sample, timestamps, jointFrame } from '../../../src/lib/counting/__tests__/synthetic';

const TOL = Number(process.env.TOL ?? 0.25), REACH = Number(process.env.REACH ?? 0.5);
function tail(r: any, ts: number[], lift: string): { add: number; why: string } {
  const def = liftDefinition(lift)!; if (r.reps.length < 3) return { add: 0, why: 'few reps' };
  const lo = r.lowThreshold, hi = r.highThreshold, rh = def.rest === 'high';
  const prog = (x: number) => (rh ? (hi - x) / (hi - lo) : (x - lo) / (hi - lo)); // 0 at rest threshold, 1 at working
  const a: (number | null)[] = r.smoothedAngles;
  const lastEnd = r.reps.at(-1).endTime;
  if (r.reps.at(-1).clipped) return { add: 0, why: 'last already clipped' };
  // last sample at rest after the last rep, then the open excursion to the end
  let restIdx = -1;
  for (let i = 0; i < a.length; i++) if (ts[i] >= lastEnd && a[i] !== null && prog(a[i]!) < 0) restIdx = i;
  if (restIdx < 0 || restIdx === a.length - 1) return { add: 0, why: 'ends at rest' };
  const onset = ts[restIdx + 1];
  let peak = -Infinity; for (let i = restIdx + 1; i < a.length; i++) if (a[i] !== null) peak = Math.max(peak, prog(a[i]!));
  const on = r.reps.map((p: any) => p.startTime); const gaps = on.slice(1).map((t: number, i: number) => t - on[i]).sort((x: number, y: number) => x - y);
  const P = gaps[Math.floor(gaps.length / 2)];
  const d = onset - on.at(-1);
  const inRhythm = Math.abs(d - P) <= TOL * P;
  return { add: inRhythm && peak >= REACH ? 1 : 0, why: `onset ${onset.toFixed(1)} expected ${(on.at(-1) + P).toFixed(1)} (P ${P.toFixed(2)}) reach ${peak.toFixed(2)}` };
}
const v = (c: number | string, l: number) => (c === 'refused' ? 'refused' : c === l ? 'exact' : Math.abs((c as number) - l) >= 3 ? 'CAT' : `off ${(c as number) - l}`);
test.skipIf(!process.env.RHYTHM)('rhythm tail', () => {
  const lines: string[] = [];
  const tally = (name: string, rows: { name: string; label: number; before: number | string; after: number | string; dec: boolean }[]) => {
    const d = rows.filter(r => r.dec);
    lines.push(`${name}: exact ${d.filter(r => r.before === r.label).length} -> ${d.filter(r => r.after === r.label).length} of ${d.length}; CAT after ${d.filter(r => v(r.after, r.label) === 'CAT').length}`);
    for (const r of rows) if (r.before !== r.after) lines.push(`  -> ${r.name} label ${r.label} ${r.before} -> ${r.after}${r.dec ? '' : ' (decides nothing)'}`);
  };
  for (const [name, sets] of [['stored', labelledSets().sets], ['video', videoSets().sets]] as const) {
    tally(name, (sets as any[]).map(s => { const r: any = summarizeCount(s.wl, s.ts, s.lift); const before = r.refused ? 'refused' : r.count; const t = r.refused ? { add: 0 } : tail(r, s.ts, s.lift); return { name: s.name, label: s.label, before, after: before === 'refused' ? before : (before as number) + t.add, dec: decides(s.lift) }; }));
  }
  const DIR = 'test/real-phone/synth/sets'; const rows: any[] = [];
  for (const f of readdirSync(DIR).filter(f => f.endsWith('.json.gz')).sort()) {
    const r = JSON.parse(gunzipSync(readFileSync(resolve(DIR, f))).toString()); const lift = r.params.exercise;
    const c: any = countReps(r.worldLandmarks, r.timestamps, lift);
    rows.push({ name: f, label: r.reps.length, before: c.count, after: c.count + tail(c, r.timestamps, lift).add, dec: true });
  }
  tally('synthetic', rows);
  // edges.test.ts's two concentric-first cut cases, rebuilt here
  for (const sps of [15, 30]) for (const { lift, joint, rest, work } of [{ lift: 'bicep_curl', joint: 'elbow', rest: 170, work: 50 }, { lift: 'lateral_raise', joint: 'shoulder', rest: 15, work: 100 }] as any[]) {
    const reps: any[] = [{ hold: rest, sec: 0.8 }]; for (let i = 0; i < 5; i++) reps.push({ to: work, sec: 1 }, { to: rest, sec: 1 }, { hold: rest, sec: 0.8 });
    const mid = (rest + work) / 2;
    for (const [k, extra] of [['cut half way back', [{ to: work, sec: 1 }, { hold: work, sec: 0.2 }, { to: mid, sec: 0.5 }]], ['cut before working end', [{ to: mid, sec: 0.5 }]]] as any[]) {
      const ang = sample([...reps, ...extra], rest, sps); const ts = timestamps(ang.length, sps);
      const c: any = countReps(ang.map((x: number) => jointFrame(joint, { left: x })), ts, lift); const t = tail(c, ts, lift);
      lines.push(`edges.test ${lift} ${sps} sps ${k}: ${c.count} -> ${c.count + t.add} (pinned 5) ${t.why}`);
    }
  }
  console.log(`TOL ${TOL} REACH ${REACH}\n` + lines.join('\n'));
});
