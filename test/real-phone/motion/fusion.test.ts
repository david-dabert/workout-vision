// The motion rhythm as a safety net (src/lib/counting/fusion.js, 7 October; TRIED.md). For every set that holds motion
// frames: the skeleton's count (summarizeCount, the app's counter), the rhythm count (motionRhythm.js), and the fused
// proposal (fuseCounts): the rhythm's number to confirm where the skeleton refused or saw the body in under 80 % of the
// samples, a "to confirm" mark where the two disagree, else the skeleton's count untouched. Prints, per dataset, exact
// counts (skeleton alone, fused proposal), exact counts lost, sets newly off by 3 or more, and how the "to confirm" mark
// catches the skeleton's wrong counts (recall) and marks its exact ones (false alarms). Writes fusion.txt.
//
// Datasets: David's 13 real videos (test/real-phone/sets-07oct-video/, labels his, R1); the 68 occluded synthetic sets
// (test/real-phone/occlusion/sets/, exact truth); the stored scoreboard sets (labelledSets(): landmarks only, no
// frames, so the net cannot run there and they are listed as such); and, when MOTION_CAPTURES=<folder> names a folder
// of test/real-phone/motion/capture.mjs files (MM-Fit w19, held outside the repository), those too (the capture
// records the skeleton's count and coverage, not the landmarks).
// A benchmark, not a gate: it fails only on malformed files. Runs only when asked: FUSION=1 npx vitest run test/real-phone/motion/fusion.test.ts
import { expect, test } from 'vitest';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { motionCount } from '../../../src/lib/counting/motionRhythm.js';
import { fuseCounts } from '../../../src/lib/counting/fusion.js';
import { labelledSets, videoSets } from '../accuracy/sets';

type Row = { set: string; label: number; skeleton: number | null; coverage: number; rhythm: number | null; period: number | null; conf: number | null; fused: number | null; toConfirm: boolean; reason: string | null };
const pad = (s: unknown, n: number) => String(s).padEnd(n);
const grid = (motion: { grid: number; frames: string[] }, ts: number[], lift: string) => {
  const frames = motion.frames.map(b => Buffer.from(b, 'base64'));
  expect(frames.length).toBe(ts.length);
  return motionCount({ frames, w: motion.grid, h: motion.grid, timestamps: ts }, { roi: [0, 0, 1, 1], alternating: !!liftDefinition(lift)?.bothSides });
};
const row = (set: string, label: number, skel: { count: number; refused: boolean }, coverage: number, m: { count: number; period: number | null; confidence: number } | null): Row => {
  const f = fuseCounts(skel, coverage, m);
  return { set, label, skeleton: skel.refused ? null : skel.count, coverage, rhythm: m ? m.count : null, period: m?.period ?? null, conf: m ? m.confidence : null, fused: f.count, toConfirm: f.toConfirm, reason: f.reason };
};

function summary(name: string, rs: Row[]) {
  const err = (x: number | null, l: number) => (x === null ? Infinity : Math.abs(x - l));
  const exact = (k: 'skeleton' | 'fused' | 'rhythm') => rs.filter(r => err(r[k], r.label) === 0).length;
  const off3 = (k: 'skeleton' | 'fused') => rs.filter(r => r[k] !== null && err(r[k], r.label) >= 3).length;
  const lost = rs.filter(r => err(r.skeleton, r.label) === 0 && err(r.fused, r.label) !== 0);
  const newly3 = rs.filter(r => r.fused !== null && err(r.fused, r.label) >= 3 && !(r.skeleton !== null && err(r.skeleton, r.label) >= 3));
  const counted = rs.filter(r => r.skeleton !== null);
  const wrong = counted.filter(r => r.skeleton !== r.label), right = counted.filter(r => r.skeleton === r.label);
  const caught = wrong.filter(r => r.toConfirm).length, alarms = right.filter(r => r.toConfirm).length;
  const refused = rs.filter(r => r.skeleton === null);
  const proposed = refused.filter(r => r.fused !== null);
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '-');
  return {
    lost: lost.length, newly3: newly3.length, alarms, right: right.length,
    text: `[${name}] ${rs.length} sets. Exact: skeleton ${exact('skeleton')}, fused proposal ${exact('fused')}, rhythm alone ${exact('rhythm')}. ` +
      `Off by 3+: skeleton ${off3('skeleton')}, fused ${off3('fused')}; refused by the skeleton ${refused.length}, of which ${proposed.length} get a rhythm number to confirm (${proposed.filter(r => r.fused === r.label).length} exact). ` +
      `Exact lost ${lost.length}${lost.length ? ` (${lost.map(r => r.set).join(', ')})` : ''}; newly off by 3+ ${newly3.length}${newly3.length ? ` (${newly3.map(r => r.set).join(', ')})` : ''}. ` +
      `To confirm: ${rs.filter(r => r.toConfirm).length} sets; skeleton wrong counts flagged ${caught} of ${wrong.length} (recall ${pct(caught, wrong.length)}); false alarms ${alarms} of ${right.length} skeleton-exact sets (${pct(alarms, right.length)}).`,
  };
}

test.skipIf(!process.env.FUSION)('the rhythm as a safety net: skeleton alone against the fused proposal', () => {
  const groups: Record<string, Row[]> = {};
  // David's real videos (the app's own read; a read the app refused as partial is a refusal of the skeleton).
  const video = videoSets();
  expect(video.unreadable).toEqual([]);
  groups['real video, 7 October'] = video.sets.map(s => {
    const c = summarizeCount(s.wl, s.ts, s.lift);
    const skel = s.appRefused ? { count: 0, refused: true } : { count: c.count, refused: !!c.refused };
    return row(s.name.split('/').at(-1)!.replace(/\.json\.gz$/, ''), s.label, skel, s.wl.filter(Boolean).length / s.wl.length, s.motion ? grid(s.motion, s.ts, s.lift) : null);
  });
  // The occluded synthetic sets.
  const OCC = resolve(__dirname, '../occlusion/sets');
  groups['occlusion bench (synthetic)'] = readdirSync(OCC).filter(f => f.endsWith('.json.gz')).sort().map(f => {
    const r = JSON.parse(gunzipSync(readFileSync(resolve(OCC, f))).toString()), lift = r.params.lift ?? r.params.exercise;
    const c = summarizeCount(r.worldLandmarks, r.timestamps, lift);
    return row(f.replace(/\.json\.gz$/, ''), r.reps.length, { count: c.count, refused: !!c.refused }, r.worldLandmarks.filter(Boolean).length / r.timestamps.length, grid(r.occlusion.motion, r.timestamps, lift));
  });
  // MM-Fit (and any other capture.mjs file), outside the repository.
  const caps = process.env.MOTION_CAPTURES;
  if (caps && existsSync(caps)) {
    groups['MM-Fit w19 captures'] = readdirSync(caps).filter(f => f.endsWith('.json')).sort().map(f => {
      const d = JSON.parse(readFileSync(resolve(caps, f), 'utf8'));
      const frames = d.frames.map((b: string) => Buffer.from(b, 'base64'));
      const m = motionCount({ frames, w: d.w, h: d.h, timestamps: d.timestamps, boxes: d.boxes }, { alternating: !!liftDefinition(d.lift)?.bothSides });
      return row(f.replace(/\.json$/, ''), d.label, { count: d.skeleton ?? 0, refused: !!d.refused }, d.seen / d.n, m);
    });
  }
  // The stored scoreboard sets: landmarks only. Without frames the rhythm cannot run: the skeleton's count stands.
  const stored = labelledSets().sets;
  groups['stored scoreboard sets (no frames)'] = stored.map(s => {
    const c = summarizeCount(s.wl, s.ts, s.lift);
    return row(s.name, s.label, { count: c.count, refused: !!c.refused }, s.wl.filter(Boolean).length / s.wl.length, null);
  });
  const lines = [
    `Rhythm safety net (src/lib/counting/fusion.js, off in the app), ${new Date().toISOString().slice(0, 10)}. skel: the app's counter (refused: none);`,
    'pose: samples with a pose; rhythm: motionRhythm.js on the stored 24 x 24 pose-region frames (MM-Fit: 128 px frames and boxes);',
    'fused: the number the app would propose; confirm: the set would be marked to confirm (R8), with its reason.',
  ];
  const sums: ReturnType<typeof summary>[] = [];
  for (const [name, rs] of Object.entries(groups)) {
    lines.push('', name, `${pad('set', 52)}${pad('label', 6)}${pad('skel', 8)}${pad('pose', 6)}${pad('rhythm', 7)}${pad('period', 7)}${pad('conf', 6)}${pad('fused', 7)}confirm`);
    if (!name.startsWith('stored')) for (const r of rs) lines.push(`${pad(r.set, 52)}${pad(r.label, 6)}${pad(r.skeleton ?? 'refused', 8)}${pad(Math.round(100 * r.coverage) + '%', 6)}${pad(r.rhythm ?? '-', 7)}${pad(r.period ?? '-', 7)}${pad(r.conf ?? '-', 6)}${pad(r.fused ?? 'none', 7)}${r.toConfirm ? `yes (${r.reason})` : ''}`);
    else lines.push(`(${rs.length} sets, not listed: no motion frames are stored with them, so the net leaves every count as the skeleton gives it)`);
    const s = summary(name, rs);
    sums.push(s);
    lines.push(s.text);
  }
  const text = lines.join('\n') + '\n';
  if (!process.env.MOTION_CAPTURES_NO_WRITE) writeFileSync(resolve(__dirname, 'fusion.txt'), text);
  process.stdout.write(text);
}, 120000);
