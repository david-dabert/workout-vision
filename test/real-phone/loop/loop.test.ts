// LOOP_OUT=<dir> [LOOP_SUITES=david,video,publicA,publicB,synthetic,repcount,occlusion] npx vitest run --no-cache test/real-phone/loop/loop.test.ts
// The loop counter (loop.js) on every labelled build set on disk, beside the core as the app counts (bench only; the
// app imports none of it; measured, decides nothing). Writes <dir>/rows-<suites>.json: per set its suite, lift, label,
// the core's count, whether the app shows that count as sure today (sure.ts sureRow, as flag.test.ts reads it), and the
// loop's count with its certificate (least distance-to-noise ratio, distance of the turns from a whole number), so the
// certificate's thresholds can be read without counting again. The holdout halves are not opened.
import { test } from 'vitest';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { summarizeCount, withBodyCheck, withProposal } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { ROOT, benchSets, countInWindow, labelledSets, publicSets, videoSets } from '../accuracy/sets';
import { sureRow } from '../accuracy/sure';
// @ts-expect-error: a JavaScript module without types
import { loopCount } from './loop.js';

const SUITES = (process.env.LOOP_SUITES ?? 'david,video,publicA,publicB,synthetic,repcount,occlusion').split(',');
const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());
// The public build halves as compare-variants reads them (robust-state.test.ts half).
const half = (name: string) => (parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'publicA' : 'publicB');

test.skipIf(!process.env.LOOP_OUT)('the loop counter on every labelled build set', () => {
  const rows: Record<string, any> = {};
  const put = (name: string, suite: string, lift: string, label: number, wl: any[], ts: number[], il: any[] | null, xy: any[] | null, window?: [number, number], appRefused = false) => {
    if (!SUITES.includes(suite)) return;
    const countOf = window ? (x: any) => countInWindow(x.reps ?? [], window) : (x: any) => x.count;
    const c: any = summarizeCount(wl, ts, lift);
    const app = appRefused ? null : withBodyCheck(withProposal({ ...c, worldLandmarks: wl, timestamps: ts, imageLandmarks: il, imageXY: xy }, lift), lift);
    const core = appRefused || c.refused ? 'refused' : countOf(c);
    const s = app ? sureRow(app, lift, label, countOf) : { err: null, flagged: false, moved: false };
    const appSure = s.err !== null && !s.flagged && !s.moved;
    const t0 = performance.now();
    const l: any = appRefused ? { refused: true, why: 'app refused', count: 0, sure: false } : loopCount(wl, ts, null);
    const loop = l.refused ? 'refused' : window ? countInWindow(l.reps ?? [], window) : l.count;
    // Both end rules, scored as the counts are (in the labelled window for a public set).
    const rule = (k: string) => (l.refused || !l.rules ? { count: 'refused', ambiguous: null } : { count: window ? countInWindow(l.rules[k].reps, window) : l.rules[k].count, ambiguous: l.rules[k].ambiguous });
    rows[name] = { suite, lift, label, core, appSure, loop, why: l.why ?? null, minRatio: l.minRatio ?? null, head: l.head ?? null, tail: l.tail ?? null, ambiguous: l.ambiguous ?? null, rest: rule('rest'), round: rule('round'),
      turns: l.turns ?? null, period: l.period ?? null, rhythm: l.rhythm ?? null, comp: l.comp ?? null, halved: l.halved ?? null, fromCrossings: l.fromCrossings ?? null, ms: Math.round(performance.now() - t0) };
  };
  for (const s of labelledSets().sets) put(s.name, 'david', s.lift, s.label, s.wl, s.ts, gz(resolve(ROOT, s.name)).imageLandmarks ?? null, null);
  for (const s of videoSets().sets as any[]) put(s.name, 'video', s.lift, s.label, s.wl, s.ts, s.il ?? null, null, undefined, s.appRefused);
  for (const s of publicSets('build').sets) put(s.name, half(s.name), s.lift, s.label, s.wl, s.ts, null, null, s.window);
  for (const s of benchSets('repcount', 'build').sets) if (s.lift && liftDefinition(s.lift)) put(s.name, 'repcount', s.lift, s.label, s.wl, s.ts, null, s.image);
  for (const [suite, dir] of [['synthetic', '../synth/sets'], ['occlusion', '../occlusion/sets']] as const) {
    if (!SUITES.includes(suite)) continue;
    const D = resolve(__dirname, dir);
    for (const f of readdirSync(D).filter(f => f.endsWith('.json.gz')).sort()) {
      const r = gz(resolve(D, f)), lift = suite === 'synthetic' ? r.params?.exercise ?? r.lift : r.params.lift ?? r.params.exercise;
      put(`${suite === 'synthetic' ? 'synth' : suite}/${f}`, suite, lift, r.reps.length, r.worldLandmarks, r.timestamps, null, null);
    }
  }
  mkdirSync(process.env.LOOP_OUT!, { recursive: true });
  writeFileSync(resolve(process.env.LOOP_OUT!, `rows-${SUITES.join('-')}.json`), JSON.stringify(rows) + '\n');
}, 7_200_000);
