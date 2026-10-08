// LPHASE_EXPORT=<folder> [LPHASE_TRAIN=<RepCount train-split landmark folder, default repcount-train/>] [LPHASE_LIBRARY=<rendered motion library folder>] npx vitest run --no-cache test/real-phone/learned-phase/export.test.ts
// Writes the training and evaluation data of the learned phase counter for train.py: <folder>/index.json (one entry per
// set: suite, name, group, class, label, role, fold, frames, rep bounds in grid frames) and <folder>/joints.f32 (every
// set's 15 Hz joints, data.js resampleJoints, concatenated). What it never writes: David's stored sets and real videos
// (the exams, read only by learned-phase.test.ts in JS) and every held-out half (scripts/public/split.mjs).
// Roles: train (RepCount-A train split, every set), eval (RepCount-A test and validation build half: never trained on),
// cv (Countix, MM-Fit, CF-Rep build halves, synthetic and occlusion sets: two folds by group, each fold model trained on
// the other fold only); with LPHASE_LIBRARY, train also holds the motion library's rendered sets (synth/motions/, run.mjs
// output: every catalogue exercise posed by hand, never a person's set).
// With LPHASE_PROGRESS=1, also <folder>/progress.f32: per set, T floats on the joints' 15 Hz grid, the progress of the
// set's motion spec (data.js progressOnGrid, sgc.js specProgress; NaN where absent, and throughout for a set without a
// spec), and each index entry's offset into it (progress) and its spec key (spec). The spec (spec-of.ts): a public
// set's lift, or for RepCount-A (train split and build half) its class's catalogue key; the synthetic and occlusion
// sets' params.exercise; the motion library's own params.spec. Image landmarks where the bench reads them too.
import { expect, test } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, openSync, writeSync, closeSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { HZ, foldOf, groupOf, progressOnGrid, resampleJoints } from './data.js';
import { specFor, specOfSet } from './spec-of';

const OUT = process.env.LPHASE_EXPORT;
const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());
const PUB = resolve(__dirname, '../public');
test.skipIf(!OUT)('export learned-phase data', () => {
  mkdirSync(OUT!, { recursive: true });
  const index: any[] = [];
  const fd = openSync(resolve(OUT!, 'joints.f32'), 'w');
  const PROG = process.env.LPHASE_PROGRESS === '1';
  const fp = PROG ? openSync(resolve(OUT!, 'progress.f32'), 'w') : -1;
  let offset = 0, poffset = 0;
  const add = (e: any, wl: any[], ts: number[], reps: [number, number][] | null, spec: any = null, image: any[] | null = null) => {
    const r = resampleJoints(wl, ts);
    if (r.T < 15) return;
    const bounds = reps ? reps.map(([s, e2]) => [(s - r.t0) * HZ, (e2 - r.t0) * HZ]) : null;
    writeSync(fd, Buffer.from(r.joints.buffer, r.joints.byteOffset, r.joints.byteLength));
    const extra: any = {};
    if (PROG) {
      const p = progressOnGrid({ wl, ts, image }, spec, r.t0, r.T);
      writeSync(fp, Buffer.from(p.buffer, p.byteOffset, p.byteLength));
      Object.assign(extra, { progress: poffset, spec: spec?.key ?? null, progressSeen: p.filter(Number.isFinite).length / r.T });
      poffset += p.length;
    }
    index.push({ ...e, T: r.T, offset, bounds, ...extra });
    offset += r.joints.length;
  };
  // RepCount-A train split (fetch-repcount-lance.sh's loop on the train split with WV_PUBLIC_OUT, videos deleted).
  // Default: the 111 train-split sets fetched on 8 October (repcount-train/sets/, all of them training data).
  const TR = process.env.LPHASE_TRAIN ?? resolve(__dirname, 'repcount-train');
  for (const half of ['sets', 'build', 'holdout']) {
    const dir = resolve(TR, half);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort()) {
      const d = gz(resolve(dir, f));
      if (d.source !== 'train') continue;
      add({ suite: 'repcount-train', name: `repcount-train/${d.id}`, group: `repcount:${d.id}`, cls: d.class, label: d.count, role: 'train', fold: -1 }, d.worldLandmarks, d.timestamps, d.reps, PROG ? specOfSet('repcount-train', d.lift, d.class) : null, d.imageXY ?? null);
    }
  }
  for (const ds of ['repcount', 'countix', 'mmfit', 'cfrep']) {
    const dir = resolve(PUB, ds, 'build');
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort()) {
      const d = gz(resolve(dir, f));
      if (d.admitted === false || d.split !== 'build') continue;
      const reps = Array.isArray(d.reps) && d.reps.length === d.count && d.count > 0 ? d.reps : null;
      const g = groupOf(ds, d.id);
      add({ suite: ds, name: `public/${ds}/build/${f}`, group: g, cls: d.class ?? d.lift, label: d.count, role: ds === 'repcount' ? 'eval' : 'cv', fold: ds === 'repcount' ? -1 : foldOf(g) }, d.worldLandmarks, d.timestamps, reps, PROG ? specOfSet(ds, d.lift, d.class) : null, d.imageXY ?? null);
    }
  }
  for (const [suite, dir] of [['synthetic', '../synth/sets'], ['occlusion', '../occlusion/sets']]) {
    const D = resolve(__dirname, dir);
    for (const f of readdirSync(D).filter(f => f.endsWith('.json.gz')).sort()) {
      const r = gz(resolve(D, f)), lift = r.params.lift ?? r.params.exercise;
      const g = groupOf(suite, lift);
      add({ suite, name: `${suite}/${f}`, group: g, cls: lift, label: r.reps.length, role: 'cv', fold: foldOf(g) }, r.worldLandmarks, r.timestamps, r.reps.map((p: any) => [p.start, p.end]), PROG ? specFor(r.params.exercise) : null);
    }
  }
  // The motion library (synth/motions/README.md), rendered by run.mjs from library.mjs's matrix: training data only.
  const LIB = process.env.LPHASE_LIBRARY;
  if (LIB) for (const f of readdirSync(LIB, { recursive: true }).map(String).filter(f => f.endsWith('.json.gz')).sort()) {
    const r = gz(resolve(LIB, f)), key = r.params.spec?.key ?? r.params.exercise;
    add({ suite: 'library', name: `library/${f}`, group: `library:${key}`, cls: key, label: r.reps.length, role: 'train', fold: -1 }, r.worldLandmarks, r.timestamps, r.reps.map((p: any) => [p.start, p.end]), PROG ? (r.params.spec ?? specFor(key)) : null);
  }
  closeSync(fd);
  if (PROG) closeSync(fp);
  writeFileSync(resolve(OUT!, 'index.json'), JSON.stringify(index));
  const tally: Record<string, number> = {};
  for (const e of index) tally[`${e.suite} ${e.role}${e.fold >= 0 ? ` fold${e.fold}` : ''}`] = (tally[`${e.suite} ${e.role}${e.fold >= 0 ? ` fold${e.fold}` : ''}`] ?? 0) + 1;
  console.log(tally, 'frames', offset / 52);
  if (PROG) {
    const ps: Record<string, string> = {};
    for (const suite of [...new Set(index.map(e => e.suite))]) {
      const g = index.filter(e => e.suite === suite), w = g.filter(e => e.spec);
      ps[suite] = `${w.length} of ${g.length} sets with a spec, progress on ${(100 * w.reduce((a, e) => a + e.progressSeen * e.T, 0) / Math.max(1, w.reduce((a, e) => a + e.T, 0))).toFixed(0)}% of their frames`;
    }
    console.log('progress', ps, 'floats', poffset);
  }
  expect(index.length).toBeGreaterThan(0);
}, 1800000);
