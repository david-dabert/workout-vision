// LIFT=1 npx vitest run test/real-phone/lift/lift.test.ts
// The count from the lifted skeleton (lift.ts) against the count from the world landmarks, on every labelled set
// that stores image landmarks: David's stored and video sets (labels his, R1), RepCount-A's build half and its
// train split (dataset labels). Bench only: measured, decides nothing; writes lift.txt.
import { test } from 'vitest';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { jointRange } from '../../../src/lib/counting/core';
import { ROOT, decides, labelledSets, videoSets, benchSets } from '../accuracy/sets';
import { liftSet, type LiftMode } from './lift';
const MODE = (process.env.LIFT_MODE ?? 'geometry') as LiftMode;

type Row = { group: string; name: string; lift: string; label: number; before: number | null; after: number | null; range: [number, number]; aspect?: [number, number] };
const read = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());
const counted = (r: any) => (r.refused ? null : r.count);

function row(group: string, name: string, lift: string, label: number, wl: any[], ts: number[], image: any[], frame?: { width: number; height: number }): Row {
  const { frames, info } = liftSet(wl, image, MODE, frame && process.env.LIFT_TRUE_ASPECT ? frame.width / frame.height : undefined);
  return {
    group, name, lift, label,
    before: counted(summarizeCount(wl, ts, lift)), after: counted(summarizeCount(frames, ts, lift)),
    range: [jointRange(wl, ts, lift), jointRange(frames, ts, lift)],
    ...(frame ? { aspect: [frame.width / frame.height, info.aspect] as [number, number] } : {}),
  };
}

test.skipIf(!process.env.LIFT)('the lifted skeleton\'s count against the world landmarks\' count', () => {
  const rows: Row[] = [];
  for (const s of labelledSets().sets) {
    if (!decides(s.lift)) continue;
    const d = read(resolve(ROOT, s.name));
    if (d.imageLandmarks) rows.push(row('David, stored', s.name, s.lift, s.label, s.wl, s.ts, d.imageLandmarks, d.frame ?? d.metadata));
  }
  for (const s of videoSets().sets as any[]) {
    if (!decides(s.lift) || !s.il) continue;
    const d = read(resolve(ROOT, s.name));
    rows.push(row('David, video', s.name, s.lift, s.label, s.wl, s.ts, s.il, d.frame ?? d.metadata));
  }
  for (const s of benchSets('repcount').sets) if (s.lift && decides(s.lift) && s.image) rows.push(row('RepCount-A build', s.name, s.lift, s.label, s.wl, s.ts, s.image));
  const train = resolve(ROOT, 'learned-phase/repcount-train/sets');
  if (existsSync(train)) for (const f of readdirSync(train).filter(f => f.endsWith('.json.gz')).sort()) {
    const d = read(resolve(train, f));
    if (d.lift && decides(d.lift) && d.imageXY && Number.isInteger(d.count)) rows.push(row('RepCount-A train', `learned-phase/repcount-train/sets/${f}`, d.lift, d.count, d.worldLandmarks, d.timestamps, d.imageXY));
  }
  const err = (c: number | null, l: number) => (c === null ? null : Math.abs(c - l));
  const tally = (rs: Row[], k: 'before' | 'after') => {
    const e = rs.map(r => err(r[k], r.label));
    return `exact ${e.filter(x => x === 0).length}, off 1-2 ${e.filter(x => x !== null && x >= 1 && x <= 2).length}, off 3+ ${e.filter(x => x !== null && x >= 3).length}, refused ${e.filter(x => x === null).length}`;
  };
  const med = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
  const out = [`Mode ${MODE}. The lifted skeleton (lift.ts) against the world landmarks: count per set, label, |error|. Measured, decides nothing.`, ''];
  for (const g of [...new Set(rows.map(r => r.group))]) {
    const rs = rows.filter(r => r.group === g);
    out.push(`${g}, ${rs.length} sets`, `  world:  ${tally(rs, 'before')}`, `  lifted: ${tally(rs, 'after')}`);
    const gain = rs.filter(r => err(r.after, r.label) === 0 && err(r.before, r.label) !== 0).length, loss = rs.filter(r => err(r.before, r.label) === 0 && err(r.after, r.label) !== 0).length;
    const newBad = rs.filter(r => (err(r.after, r.label) ?? 0) >= 3 && (err(r.before, r.label) ?? 0) < 3).length;
    out.push(`  exact gained ${gain}, exact lost ${loss}, newly off by 3+ ${newBad}; joint range lifted / world, median ${med(rs.filter(r => r.range[0] > 0).map(r => r.range[1] / r.range[0])).toFixed(2)}`);
    const asp = rs.filter(r => r.aspect).map(r => Math.abs(r.aspect![1] / r.aspect![0] - 1));
    if (asp.length) out.push(`  aspect ratio estimated from the set against the file's frame size: median error ${(100 * med(asp)).toFixed(1)} %, worst ${(100 * Math.max(...asp)).toFixed(1)} %`);
    out.push('');
  }
  out.push('Per set: group, set, lift, label, world count, lifted count, joint range world -> lifted (degrees)');
  for (const r of rows) if (r.before !== r.after || r.group.startsWith('David')) out.push(`${r.group}  ${r.name}  ${r.lift}  ${r.label}  ${r.before ?? 'refused'}  ${r.after ?? 'refused'}  ${r.range[0].toFixed(0)} -> ${r.range[1].toFixed(0)}`);
  writeFileSync(resolve(__dirname, `lift${MODE === 'geometry' ? '' : `-${MODE}`}${process.env.LIFT_TRUE_ASPECT ? '-true-aspect' : ''}.txt`), out.join('\n') + '\n');
}, 1_800_000);
