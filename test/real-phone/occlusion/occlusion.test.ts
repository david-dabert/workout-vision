// Occluded synthetic sets (7 October 2026; README.md here). Clean synthetic bodies proved too easy (the backward pass
// read 8 of 8 synthetic sets and 0 of 5 of David's real videos), so the renderer (test/real-phone/synth/synth.js,
// P.occlude) adds what goes wrong on his videos: a barbell plate in front of the torso, a rack upright between camera
// and body, a dim, noisy, blurred picture, a second person in frame. Each set went through the app's own pose path
// (detectPoseImage, crop retry on, backward pass off) in Chromium; sets/ holds its landmarks, the per-frame pose box,
// whether the pose found is the lifter, and the frames of the pose region shrunk to 24 x 24 gray (the motion bench's
// input, motionRhythm.js).
//
// A benchmark, not a gate: it prints the table and writes occlusion.txt, and fails only when the files are not what
// run.mjs writes (a set without its occlusion record, frames and samples out of step). No count is held to a bar:
// these sets are synthetic and their failures were designed, so a count bar here would gate on the renderer, not on
// the app's behaviour on real footage. OCC_DIR=<folder> reads another folder (and writes nothing).
import { expect, test } from 'vitest';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { motionCount } from '../../../src/lib/counting/motionRhythm.js';

// WV_CORE_BENCH='{"zWeight":0.5}' (7 October): the survey techniques of src/lib/counting/survey.ts, switched for this
// run only (research; the app never sets it).
if (process.env.WV_CORE_BENCH) (globalThis as any).__WV_CORE_BENCH__ = JSON.parse(process.env.WV_CORE_BENCH);
const DIR = process.env.OCC_DIR || resolve(__dirname, 'sets');
const read = (f: string) => JSON.parse(gunzipSync(readFileSync(resolve(DIR, f))).toString());
const CONDITIONS = ['clean', 'plate', 'rack', 'dim', 'person', 'gym'];
const pad = (s: unknown, n: number) => String(s).padEnd(n);
const pct = (x: number) => `${Math.round(100 * x)}%`;

type Row = { id: string; cond: string; lift: string; view: number; truth: number; coverage: number; wrong: number | null; skeleton: number | null; motion: number; alt: string };

test('occluded synthetic sets: pose coverage, skeleton count and motion count against the truth', () => {
  const files = readdirSync(DIR).filter(f => f.endsWith('.json.gz')).sort();
  expect(files.length).toBeGreaterThan(0);
  const rows: Row[] = [];
  for (const f of files) {
    const r = read(f), p = r.params, o = r.occlusion;
    const n = r.timestamps.length;
    // The files are what run.mjs writes with P.occlude: one record per sample.
    expect(o, f).toBeTruthy();
    expect(o.boxes.length, f).toBe(n);
    // onTarget only where a second person stands in the scene.
    expect(!!o.onTarget, f).toBe(!!p.occlude?.person);
    if (o.onTarget) expect(o.onTarget.length, f).toBe(n);
    expect(o.motion.frames.length, f).toBe(n);
    const lift = p.lift ?? p.exercise;
    const c = summarizeCount(r.worldLandmarks, r.timestamps, lift);
    const g = o.motion.grid;
    const frames = o.motion.frames.map((b: string) => Buffer.from(b, 'base64'));
    expect(frames[0].length, f).toBe(g * g);
    const m = motionCount({ frames, w: g, h: g, timestamps: r.timestamps }, { roi: [0, 0, 1, 1], alternating: !!liftDefinition(lift)?.bothSides });
    const seen = r.worldLandmarks.filter(Boolean).length;
    rows.push({
      id: f.replace(/\.json\.gz$/, ''), cond: p.id.split('-').at(-1), lift, view: p.view, truth: r.reps.length,
      coverage: seen / n, wrong: o.onTarget ? o.onTarget.filter((x: boolean | null) => x === false).length : null,
      skeleton: c.refused ? null : c.count, motion: m.count,
      alt: m.alternation ? `${m.alternation.antiPhase ? 'x2' : '--'} ${m.alternation.phase ?? '-'}` : '',
    });
  }
  const err = (x: number | null, t: number) => (x === null ? Infinity : Math.abs(x - t));
  const lines = [
    'Occluded synthetic sets (7 October 2026). Rendered by test/real-phone/synth/run.mjs (matrix-*.json here) at 360 x 640, 15 fps,',
    "2.7 m, through the app's pose path (crop retry on, backward pass off), headless Chromium with SwiftShader.",
    "pose = samples with a pose; other = of those, poses nearer the second person's hips than the lifter's (sets with a",
    'second person only; - elsewhere);',
    'skel = summarizeCount (refused: no count); motion = motionRhythm.js on the stored 24 x 24 region frames (alt: the',
    'alternating rule, x2 when the halves move in turn, and their phase); truth = reps rendered.',
    '',
    `${pad('set', 46)}${pad('pose', 6)}${pad('other', 7)}${pad('skel', 9)}${pad('motion', 8)}${pad('truth', 7)}alt`,
    ...rows.map(r => `${pad(r.id, 46)}${pad(pct(r.coverage), 6)}${pad(r.wrong ?? '-', 7)}${pad(r.skeleton ?? 'refused', 9)}${pad(r.motion, 8)}${pad(r.truth, 7)}${r.alt}`),
    '',
    'By condition (all lifts, views and bodies): sets; mean pose coverage; skeleton exact / off by 3 or more (refused counted',
    'there); motion exact / off by 3 or more; sets where the pose found was the second person on some sample.',
  ];
  for (const cond of CONDITIONS) {
    const rs = rows.filter(r => r.cond === cond);
    if (!rs.length) continue;
    const cov = rs.reduce((s, r) => s + r.coverage, 0) / rs.length;
    const k = (pick: (r: Row) => number | null, test: (e: number) => boolean) => rs.filter(r => test(err(pick(r), r.truth))).length;
    lines.push(`  ${pad(cond, 8)}${pad(rs.length, 4)}pose ${pad(pct(cov), 6)}skeleton ${k(r => r.skeleton, e => e === 0)} / ${pad(k(r => r.skeleton, e => e >= 3), 4)}` +
      `motion ${k(r => r.motion, e => e === 0)} / ${pad(k(r => r.motion, e => e >= 3), 4)}read the other person ${rs.filter(r => (r.wrong ?? 0) > 0).length}`);
  }
  // Each occluder against the clean render of the same body, lift and view (same seed, same timeline).
  lines.push('', 'Against the clean render of the same body, lift and view: skeleton error grew / stayed / shrank; motion the same.');
  for (const cond of CONDITIONS.slice(1)) {
    const pairs = rows.filter(r => r.cond === cond).map(r => [rows.find(c => c.cond === 'clean' && c.id === r.id.replace(/-[a-z]+$/, '-clean')), r] as const).filter(([c]) => c);
    if (!pairs.length) continue;
    const cmp = (pick: (r: Row) => number | null) => {
      let up = 0, same = 0, down = 0;
      for (const [c, r] of pairs) { const a = err(pick(c!), c!.truth), b = err(pick(r), r.truth); if (b > a) up++; else if (b < a) down++; else same++; }
      return `${up} / ${same} / ${down}`;
    };
    lines.push(`  ${pad(cond, 8)}${pad(pairs.length, 4)}skeleton ${pad(cmp(r => r.skeleton), 12)}motion ${cmp(r => r.motion)}`);
  }
  const all = (pick: (r: Row) => number | null, test: (e: number) => boolean) => rows.filter(r => test(err(pick(r), r.truth))).length;
  lines.push('', `All ${rows.length} sets: skeleton exact ${all(r => r.skeleton, e => e === 0)}, off by 3 or more or refused ${all(r => r.skeleton, e => e >= 3)}; ` +
    `motion exact ${all(r => r.motion, e => e === 0)}, off by 3 or more ${all(r => r.motion, e => e >= 3)}; ` +
    `either exact ${rows.filter(r => err(r.skeleton, r.truth) === 0 || err(r.motion, r.truth) === 0).length}.`);
  const text = lines.join('\n') + '\n';
  if (!process.env.OCC_DIR) writeFileSync(resolve(__dirname, 'occlusion.txt'), text);
  process.stdout.write(text);
}, 180_000); // 68 sets, a motion count each (about 15 s here)
