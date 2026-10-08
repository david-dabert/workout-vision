// LPHASE=1 [LPHASE_MODELS=<folder>] [LPHASE_TXT=<file>] [LPHASE_READOUT=density|phase] [LPHASE_VARIANTS=<folder>] npx vitest run --no-cache test/real-phone/learned-phase/learned-phase.test.ts
// The learned phase counter (model.js, JS inference of the weights train.py wrote) against the core and PSC on every
// labelled dataset on disk, build halves only, with strict held-out reading: a Countix, MM-Fit, CF-Rep, synthetic or
// occlusion set is read by the fold model that was not trained on its fold (model-<fold>.json); RepCount-A build
// (test and validation splits) and David's sets (13 real videos, 20 stored sets) by the model trained on every
// training set (model-all.json), which never saw them. Also: the learned count as a selector between core, PSC and the
// motion rhythm; its inference cost. Writes lphase.txt; with LPHASE_VARIANTS, core.json, learned.json and
// selector.json in the format of scripts/compare-variants.mjs. A benchmark, not a gate.
import { expect, test } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { motionCount } from '../../../src/lib/counting/motionRhythm.js';
import { labelledSets, videoSets } from '../accuracy/sets';
import { pscCount } from '../../../src/lib/counting/psc.js';
import { foldOf, groupOf } from './data.js';
import { learnedCount, loadModel } from './model.js';

type Item = { suite: string; name: string; id: string; cls: string; lift: string | null; label: number; wl: any[]; ts: number[]; image: any[] | null; motion?: any; appRefused?: boolean; model: string };
const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());
const PUB = resolve(__dirname, '../public');
const flat = (frames: any[]) => frames.map(f => (f ? f.flatMap((p: any) => [p.x, p.y]) : null));

function load(): Item[] {
  const items: Item[] = [];
  for (const ds of ['repcount', 'countix', 'mmfit', 'cfrep']) {
    const dir = resolve(PUB, ds, 'build');
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort()) {
      const d = gz(resolve(dir, f));
      if (d.admitted === false || d.split !== 'build') continue;
      items.push({ suite: ds, name: `public/${ds}/build/${f}`, id: d.id, cls: d.class ?? d.lift, lift: d.lift ?? null, label: d.count, wl: d.worldLandmarks, ts: d.timestamps, image: d.imageXY ?? null, model: ds === 'repcount' ? 'all' : String(foldOf(groupOf(ds, d.id))) });
    }
  }
  for (const s of videoSets().sets) {
    const d = gz(resolve(__dirname, '..', s.name));
    items.push({ suite: 'real video', name: s.name, id: s.name, cls: s.lift, lift: s.lift, label: s.label, wl: s.wl, ts: s.ts, image: d.imageLandmarks ? flat(d.imageLandmarks) : null, motion: s.motion, appRefused: s.appRefused, model: 'all' });
  }
  for (const s of labelledSets().sets) items.push({ suite: 'stored sets', name: s.name, id: s.name, cls: s.lift, lift: s.lift, label: s.label, wl: s.wl, ts: s.ts, image: null, model: 'all' });
  for (const [suite, dir] of [['synthetic', '../synth/sets'], ['occlusion', '../occlusion/sets']]) {
    const D = resolve(__dirname, dir);
    for (const f of readdirSync(D).filter(f => f.endsWith('.json.gz')).sort()) {
      const r = gz(resolve(D, f)), lift = r.params.lift ?? r.params.exercise;
      items.push({ suite, name: `${suite}/${f}`, id: f, cls: lift, lift, label: r.reps.length, wl: r.worldLandmarks, ts: r.timestamps, image: null, motion: r.occlusion?.motion ? { ...r.occlusion.motion } : undefined, model: String(foldOf(groupOf(suite, lift))) });
    }
  }
  return items;
}

const err = (c: any, l: number) => (typeof c === 'number' ? Math.abs(c - l) : Infinity);
const tally = (xs: { c: any; l: number }[]) => {
  const n = xs.length, ex = xs.filter(x => err(x.c, x.l) === 0).length, w1 = xs.filter(x => err(x.c, x.l) <= 1).length, b3 = xs.filter(x => err(x.c, x.l) >= 3).length;
  const pct = (k: number) => (n ? Math.round((100 * k) / n) : 0);
  return { n, ex, w1, b3, s: `${ex} (${pct(ex)}%) / ${w1} (${pct(w1)}%) / ${b3} (${pct(b3)}%)` };
};

test.skipIf(!process.env.LPHASE)('learned phase counter against core and PSC', () => {
  const MD = process.env.LPHASE_MODELS ?? resolve(__dirname, 'models');
  const READ = (process.env.LPHASE_READOUT ?? 'density') as 'density' | 'phase';
  const models: Record<string, any> = {};
  for (const k of ['0', '1', 'all']) models[k] = loadModel(JSON.parse(readFileSync(resolve(MD, `model-${k}.json`), 'utf8')));
  const items = load();
  expect(items.length).toBeGreaterThan(0);
  const res = new Map<Item, any>();
  let ms = 0, secs = 0;
  for (const it of items) {
    const t0 = performance.now();
    const L = learnedCount(models[it.model], it.wl, it.ts);
    const dt = performance.now() - t0;
    if (it.model === 'all') { ms += dt; secs += it.ts[it.ts.length - 1] - it.ts[0]; }
    let core: any = 'no counter';
    if (it.lift && liftDefinition(it.lift)) {
      const c = summarizeCount(it.wl, it.ts, it.lift);
      core = it.appRefused || c.refused ? 'refused' : c.count;
    }
    const psc = pscCount(it, {}).count;
    let rhythm: number | null = null;
    if (it.motion?.frames?.length === it.ts.length) {
      const frames = it.motion.frames.map((b: string) => Buffer.from(b, 'base64'));
      const m = motionCount({ frames, w: it.motion.grid, h: it.motion.grid, timestamps: it.ts }, { roi: [0, 0, 1, 1], alternating: !!(it.lift && liftDefinition(it.lift)?.bothSides) });
      rhythm = m.period ? m.count : null;
    }
    const learned = L ? L[READ] : null;
    // Selector: of the core and PSC, the count nearer the learned one (the core on a tie or when the learned count is
    // missing); with the rhythm too where it exists.
    const near = (cands: (number | null | string)[]) => {
      const ok = cands.filter(c => typeof c === 'number') as number[];
      if (!ok.length || learned === null) return typeof cands[0] === 'number' ? cands[0] : (ok[0] ?? null);
      return ok.reduce((b, c) => (Math.abs(c - learned) < Math.abs(b - learned) ? c : b));
    };
    // Two controls that need no learned model: PSC only where the core refuses (fill); and the selector only where both
    // count (a refusal stays a refusal): they split the selector's effect into filling refusals and choosing.
    const fill = typeof core === 'number' ? core : (typeof psc === 'number' ? psc : core);
    const selBoth = typeof core === 'number' && typeof psc === 'number' ? near([core, psc]) : core;
    res.set(it, { L, learned, core, psc, rhythm, sel: near([core, psc]), sel3: near([core, psc, rhythm]), fill, selBoth });
  }
  const R = (i: Item) => res.get(i);
  const day = new Date().toISOString().slice(0, 10);
  const m0 = models.all;
  const lines = [`Learned phase counter (test/real-phone/learned-phase/), readout "${READ}", against the core (summarizeCount) and PSC (psc.js), ${day}. Build halves only.`,
    `Model: ${m0.meta.trainSets} training sets (${m0.meta.trainSuites.join(', ')}), ${m0.bytes} bytes of float16 weights, ${m0.dil.length} dilated blocks of ${m0.C} channels.`,
    `JS inference (model.js, this machine, Node): ${(ms / Math.max(secs, 1) * 60).toFixed(0)} ms per minute of recording (features + forward + readout).`,
    'Cells: exact / within 1 / off by 3+ (a refusal or no count is off by 3+). Held out: cv suites by the fold model not trained on their fold; RepCount-A and David\'s sets by the model trained on all training sets.', '',
    '| Dataset | Sets | Learned | PSC | Core (mapped) | Learned on mapped | PSC on mapped | Selector core/PSC on mapped | Control: PSC where core refuses | Control: selector where both count | Mapped |', '|---|---:|---|---|---|---|---|---|---|---|---:|'];
  const suites = [...new Set(items.map(i => i.suite))];
  for (const s of suites) {
    const g = items.filter(i => i.suite === s), m = g.filter(i => R(i).core !== 'no counter');
    const t = (xs: Item[], k: string) => tally(xs.map(i => ({ c: R(i)[k], l: i.label }))).s;
    lines.push(`| ${s} | ${g.length} | ${t(g, 'learned')} | ${t(g, 'psc')} | ${m.length ? t(m, 'core') : '-'} | ${m.length ? t(m, 'learned') : '-'} | ${m.length ? t(m, 'psc') : '-'} | ${m.length ? t(m, 'sel') : '-'} | ${m.length ? t(m, 'fill') : '-'} | ${m.length ? t(m, 'selBoth') : '-'} | ${m.length} |`);
  }
  lines.push('', 'Readouts (exact / within 1 / off by 3+): density = round(summed rate / 15); phase = reps whose middle is passed while inside a rep.', '| Dataset | density | phase | both agree: n, exact | disagree: n, density exact |', '|---|---|---|---|---|');
  for (const s of suites) {
    const g = items.filter(i => i.suite === s && R(i).L);
    const ag = g.filter(i => R(i).L.density === R(i).L.phase), dg = g.filter(i => R(i).L.density !== R(i).L.phase);
    lines.push(`| ${s} | ${tally(g.map(i => ({ c: R(i).L.density, l: i.label }))).s} | ${tally(g.map(i => ({ c: R(i).L.phase, l: i.label }))).s} | ${ag.length}, ${ag.filter(i => R(i).L.density === i.label).length} | ${dg.length}, ${dg.filter(i => R(i).L.density === i.label).length} |`);
  }
  lines.push('', 'Confidence: learned exact where the summed rate lies within 0.25 of a whole number and both readouts agree ("sure"), against the rest.', '| Dataset | sure: n, exact | rest: n, exact |', '|---|---|---|');
  for (const s of suites) {
    const g = items.filter(i => i.suite === s && R(i).L);
    const sure = g.filter(i => Math.abs(R(i).L.densityRaw - Math.round(R(i).L.densityRaw)) < 0.25 && R(i).L.density === R(i).L.phase);
    const rest = g.filter(i => !sure.includes(i));
    const pc = (xs: Item[]) => `${xs.length}, ${xs.filter(i => R(i).learned === i.label).length}${xs.length ? ` (${Math.round(100 * xs.filter(i => R(i).learned === i.label).length / xs.length)}%)` : ''}`;
    lines.push(`| ${s} | ${pc(sure)} | ${pc(rest)} |`);
  }
  lines.push('', 'Per class (exact / within 1 / off by 3+):', '| Dataset, class | Sets | Learned | PSC | Core |', '|---|---:|---|---|---|');
  for (const s of ['repcount', 'countix', 'mmfit', 'cfrep', 'synthetic', 'occlusion']) {
    const g = items.filter(i => i.suite === s);
    for (const cls of [...new Set(g.map(i => i.cls))].sort()) {
      const c = g.filter(i => i.cls === cls), mapped = c.filter(i => R(i).core !== 'no counter');
      lines.push(`| ${s} ${cls} | ${c.length} | ${tally(c.map(i => ({ c: R(i).learned, l: i.label }))).s} | ${tally(c.map(i => ({ c: R(i).psc, l: i.label }))).s} | ${mapped.length ? tally(mapped.map(i => ({ c: R(i).core, l: i.label }))).s : 'no counter'} |`);
    }
  }
  // Selector on the sets where core and PSC disagree: does the learned count point at the right one?
  lines.push('', 'Selector where the core and PSC both count and disagree: picks the right one / the core right / PSC right / neither.', '| Dataset | Disagree | Selector exact | Core exact | PSC exact | Neither |', '|---|---:|---:|---:|---:|---:|');
  for (const s of suites) {
    const g = items.filter(i => i.suite === s && typeof R(i).core === 'number' && typeof R(i).psc === 'number' && R(i).core !== R(i).psc);
    if (!g.length) continue;
    lines.push(`| ${s} | ${g.length} | ${g.filter(i => R(i).sel === i.label).length} | ${g.filter(i => R(i).core === i.label).length} | ${g.filter(i => R(i).psc === i.label).length} | ${g.filter(i => R(i).core !== i.label && R(i).psc !== i.label).length} |`);
  }
  for (const s of ['real video', 'stored sets']) {
    const g = items.filter(x => x.suite === s);
    lines.push('', `${s} (exam), set by set: label | learned (density, phase, summed rate) | core | PSC${s === 'real video' ? ' | rhythm | selector core/PSC | selector core/PSC/rhythm' : ' | selector core/PSC'}`);
    for (const i of g) {
      const r = R(i);
      lines.push(`- ${i.name}: ${i.label} | ${r.learned} (${r.L?.density}, ${r.L?.phase}, ${r.L?.densityRaw.toFixed(2)}) | ${r.core} | ${r.psc}${s === 'real video' ? ` | ${r.rhythm} | ${r.sel} | ${r.sel3}` : ` | ${r.sel}`}`);
    }
    const t = (k: string) => tally(g.map(i => ({ c: R(i)[k], l: i.label }))).s;
    lines.push(`  Totals: learned ${t('learned')}; core ${t('core')}; PSC ${t('psc')}${s === 'real video' ? `; rhythm ${t('rhythm')}; selector core/PSC ${t('sel')}; selector core/PSC/rhythm ${t('sel3')}` : `; selector core/PSC ${t('sel')}`}.`);
    const oracle = g.filter(i => [R(i).core, R(i).psc, ...(s === 'real video' ? [R(i).rhythm] : [])].includes(i.label)).length;
    lines.push(`  Oracle (one of core, PSC${s === 'real video' ? ', rhythm' : ''} exact): ${oracle} of ${g.length}.`);
  }
  const text = lines.join('\n') + '\n';
  writeFileSync(process.env.LPHASE_TXT ?? resolve(__dirname, 'lphase.txt'), text);
  process.stdout.write(text);
  if (process.env.LPHASE_VARIANTS) {
    const dir = process.env.LPHASE_VARIANTS;
    mkdirSync(dir, { recursive: true });
    const half = (name: string) => (parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'publicA' : 'publicB');
    const out: Record<string, Record<string, any>> = { core: {}, learned: {}, selector: {}, fill: {}, selBoth: {} };
    for (const i of items) {
      const r = R(i);
      if (r.core === 'no counter' || i.suite === 'occlusion' || i.suite === 'real video' || i.suite === 'repcount') continue;
      const suite = i.suite === 'stored sets' ? 'david' : i.suite === 'synthetic' ? 'synthetic' : half(i.name);
      for (const [k, c] of [['core', r.core], ['learned', r.learned ?? 'refused'], ['selector', r.sel ?? 'refused'], ['fill', r.fill ?? 'refused'], ['selBoth', r.selBoth ?? 'refused']]) out[k][i.name] = { suite, lift: i.lift, label: i.label, count: c };
    }
    for (const k of Object.keys(out)) writeFileSync(resolve(dir, `${k}.json`), JSON.stringify({ sets: out[k] }));
  }
}, 3_600_000);
