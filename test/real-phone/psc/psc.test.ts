// PSC=1 npx vitest run --no-cache test/real-phone/psc/psc.test.ts
// The class-agnostic bench counter (psc.js) against the app's core, on every labelled dataset on disk, build halves
// only: RepCount-A (per class), Countix, MM-Fit, CF-Rep, David's 13 real videos (with the motion rhythm, stage G), his
// stored scoreboard sets, the 96 synthetic and 68 occlusion sets (stage G there too). Per dataset and per class: exact,
// within 1, off by 3 or more, for PSC alone and the core (where a catalogue key maps), and per stage. Writes psc.txt
// and, when PSC_VARIANTS=<folder>, core.json and psc.json in the format of scripts/compare-variants.mjs (suites david,
// publicA, publicB, synthetic: lifts the core counts only). A benchmark, not a gate: it fails only on malformed files.
import { expect, test } from 'vitest';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { motionCount } from '../../../src/lib/counting/motionRhythm.js';
import { labelledSets, videoSets } from '../accuracy/sets';
import { fusePsc, pscCount } from './psc.js';

type Item = { suite: string; name: string; cls: string; lift: string | null; label: number; wl: any[]; ts: number[]; image: any[] | null; motion?: any; appRefused?: boolean };
type Out = { psc: number | null; core: number | 'refused' | 'no counter'; v: Record<string, number | null>; confirm: boolean; fused?: { count: number | null; confident: boolean } };

const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());
const PUB = resolve(__dirname, '../public');
const flat = (frames: any[]) => frames.map(f => (f ? f.flatMap((p: any) => [p.x, p.y]) : null));

function load(): Item[] {
  const items: Item[] = [];
  for (const ds of ['repcount', 'countix', 'mmfit', 'cfrep']) {
    const dir = resolve(PUB, ds, 'build');
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort()) {
      const d = gz(resolve(dir, f));
      if (d.admitted === false) continue;
      items.push({ suite: ds, name: `public/${ds}/build/${f}`, cls: d.class ?? d.lift, lift: d.lift ?? null, label: d.count, wl: d.worldLandmarks, ts: d.timestamps, image: d.imageXY ?? null });
    }
  }
  for (const s of videoSets().sets) {
    const d = gz(resolve(__dirname, '..', s.name));
    items.push({ suite: 'real video', name: s.name, cls: s.lift, lift: s.lift, label: s.label, wl: s.wl, ts: s.ts, image: d.imageLandmarks ? flat(d.imageLandmarks) : null, motion: s.motion, appRefused: s.appRefused });
  }
  for (const s of labelledSets().sets) items.push({ suite: 'stored sets', name: s.name, cls: s.lift, lift: s.lift, label: s.label, wl: s.wl, ts: s.ts, image: null });
  for (const [suite, dir] of [['synthetic', '../synth/sets'], ['occlusion', '../occlusion/sets']]) {
    const D = resolve(__dirname, dir);
    for (const f of readdirSync(D).filter(f => f.endsWith('.json.gz')).sort()) {
      const r = gz(resolve(D, f)), lift = r.params.lift ?? r.params.exercise;
      items.push({ suite, name: `${suite}/${f}`, cls: lift, lift, label: r.reps.length, wl: r.worldLandmarks, ts: r.timestamps, image: null, motion: r.occlusion?.motion ? { ...r.occlusion.motion } : undefined });
    }
  }
  return items;
}

const VARIANTS: Record<string, any> = {
  'C duration/period': null,
  'B-F one pass': { stages: { twoPass: false } },
  'no D consensus': { stages: { D: false } },
  'no E segment': { stages: { E: false } },
  'world only': { useImage: false },
  'detrended': { stages: { detrend: true } },
};

function run(it: Item): Out {
  const full = pscCount(it, {});
  const v: Record<string, number | null> = { full: full.count };
  const whole = pscCount(it, { stages: { E: false } });
  v['C duration/period'] = whole.period ? Math.round((it.ts[it.ts.length - 1] - it.ts[0]) / whole.period) * (whole.alternating ? 2 : 1) : null;
  for (const [k, o] of Object.entries(VARIANTS)) if (o) v[k] = k === 'no E segment' ? whole.count : k === 'world only' && !it.image ? full.count : pscCount(it, o).count;
  let core: Out['core'] = 'no counter';
  if (it.lift && liftDefinition(it.lift)) {
    const c = summarizeCount(it.wl, it.ts, it.lift);
    core = it.appRefused || c.refused ? 'refused' : c.count;
  }
  let fused;
  if (it.motion?.frames?.length === it.ts.length) {
    const frames = it.motion.frames.map((b: string) => Buffer.from(b, 'base64'));
    const m = motionCount({ frames, w: it.motion.grid, h: it.motion.grid, timestamps: it.ts }, { roi: [0, 0, 1, 1], alternating: full.alternating });
    fused = fusePsc(full, m);
  }
  return { psc: full.count, core, v, confirm: full.confirm, fused };
}

const err = (c: any, l: number) => (typeof c === 'number' ? Math.abs(c - l) : Infinity);
const tally = (xs: { c: any; l: number }[]) => {
  const n = xs.length, ex = xs.filter(x => err(x.c, x.l) === 0).length, w1 = xs.filter(x => err(x.c, x.l) <= 1).length, b3 = xs.filter(x => err(x.c, x.l) >= 3).length;
  const pct = (k: number) => (n ? Math.round((100 * k) / n) : 0);
  return { n, ex, w1, b3, s: `${ex} (${pct(ex)}%) / ${w1} (${pct(w1)}%) / ${b3} (${pct(b3)}%)` };
};

test.skipIf(!process.env.PSC)('PSC against the core on every labelled dataset', () => {
  const items = load();
  expect(items.length).toBeGreaterThan(0);
  const res = new Map<Item, Out>();
  for (const it of items) res.set(it, run(it));
  const lines = [`PSC (test/real-phone/psc/psc.js), class-agnostic, against the core (summarizeCount), ${new Date().toISOString().slice(0, 10)}. Build halves only.`,
    'Cells: exact / within 1 / off by 3+ (a refusal or no count is off by 3+). core: only where a catalogue key maps; "no counter" otherwise.', ''];
  const suites = [...new Set(items.map(i => i.suite))];
  lines.push('| Dataset | Sets | PSC alone | Core (mapped sets) | PSC on the mapped sets | Mapped | PSC marked to confirm: exact / not |', '|---|---:|---|---|---|---:|---|');
  for (const s of suites) {
    const g = items.filter(i => i.suite === s), m = g.filter(i => res.get(i)!.core !== 'no counter');
    const conf = g.filter(i => res.get(i)!.confirm), sure = g.filter(i => !res.get(i)!.confirm);
    const cs = (xs: Item[]) => `${xs.filter(i => err(res.get(i)!.psc, i.label) === 0).length}/${xs.length}`;
    lines.push(`| ${s} | ${g.length} | ${tally(g.map(i => ({ c: res.get(i)!.psc, l: i.label }))).s} | ${m.length ? tally(m.map(i => ({ c: res.get(i)!.core, l: i.label }))).s : '-'} | ${m.length ? tally(m.map(i => ({ c: res.get(i)!.psc, l: i.label }))).s : '-'} | ${m.length} | confirm ${cs(conf)}, not ${cs(sure)} |`);
  }
  // PSC as a cross-check of the core (lifts the core counts): where the two agree, how often the core is exact; where
  // they disagree, how many of the core's wrong counts are caught (recall) and how many exact ones are flagged.
  lines.push('', 'PSC as a cross-check of the core (sets the core counts; a refusal counts as a disagreement):', '| Dataset | Counted by core | Agree | Core exact when agree | Disagree | Core wrong caught | Core exact flagged |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const s of suites) {
    const g = items.filter(i => typeof res.get(i)!.core === 'number');
    const m = g.filter(i => i.suite === s);
    if (!m.length) continue;
    const agree = m.filter(i => res.get(i)!.core === res.get(i)!.psc), dis = m.filter(i => res.get(i)!.core !== res.get(i)!.psc);
    const wrong = m.filter(i => res.get(i)!.core !== i.label), right = m.filter(i => res.get(i)!.core === i.label);
    const pc = (a: number, b: number) => (b ? `${a}/${b} (${Math.round((100 * a) / b)}%)` : '-');
    lines.push(`| ${s} | ${m.length} | ${agree.length} | ${pc(agree.filter(i => res.get(i)!.core === i.label).length, agree.length)} | ${dis.length} | ${pc(wrong.filter(i => res.get(i)!.core !== res.get(i)!.psc).length, wrong.length)} | ${pc(right.filter(i => res.get(i)!.core !== res.get(i)!.psc).length, right.length)} |`);
  }
  lines.push('', 'Per stage, PSC exact / within 1 / off by 3+ per dataset:', `| Dataset | ${['full', ...Object.keys(VARIANTS)].join(' | ')} |`, `|---|${['full', ...Object.keys(VARIANTS)].map(() => '---').join('|')}|`);
  for (const s of suites) {
    const g = items.filter(i => i.suite === s);
    lines.push(`| ${s} | ${['full', ...Object.keys(VARIANTS)].map(k => tally(g.map(i => ({ c: res.get(i)!.v[k], l: i.label }))).s).join(' | ')} |`);
  }
  lines.push('', 'Per class (RepCount-A build half; and the other public datasets by lift):', '| Dataset, class | Sets | PSC | Core | PSC marked to confirm |', '|---|---:|---|---|---:|');
  for (const s of ['repcount', 'countix', 'mmfit', 'cfrep', 'real video', 'stored sets']) {
    const g = items.filter(i => i.suite === s);
    for (const cls of [...new Set(g.map(i => i.cls))].sort()) {
      const c = g.filter(i => i.cls === cls), mapped = c.filter(i => res.get(i)!.core !== 'no counter');
      lines.push(`| ${s} ${cls} | ${c.length} | ${tally(c.map(i => ({ c: res.get(i)!.psc, l: i.label }))).s} | ${mapped.length ? tally(mapped.map(i => ({ c: res.get(i)!.core, l: i.label }))).s : 'no counter'} | ${c.filter(i => res.get(i)!.confirm).length} |`);
    }
  }
  // G: fusion where gray frames are stored.
  const withG = items.filter(i => res.get(i)!.fused);
  if (withG.length) {
    lines.push('', 'Stage G (motion rhythm fused), sets with stored gray frames:');
    for (const s of [...new Set(withG.map(i => i.suite))]) {
      const g = withG.filter(i => i.suite === s), conf = g.filter(i => res.get(i)!.fused!.confident);
      lines.push(`- ${s}: ${g.length} sets; PSC ${tally(g.map(i => ({ c: res.get(i)!.psc, l: i.label }))).s}; fused proposal ${tally(g.map(i => ({ c: res.get(i)!.fused!.count, l: i.label }))).s}; confident ${conf.length}, of them exact ${conf.filter(i => err(res.get(i)!.fused!.count, i.label) === 0).length}.`);
    }
  }
  // Set by set, the small suites.
  for (const s of ['real video', 'stored sets']) {
    lines.push('', `${s}, set by set: label, core, PSC (period s, signals), confirm`);
    for (const i of items.filter(x => x.suite === s)) { const r = res.get(i)!; lines.push(`- ${i.name}: ${i.label}, core ${r.core}, PSC ${r.psc}${r.confirm ? ' (to confirm)' : ''}${r.fused ? `, fused ${r.fused.count}${r.fused.confident ? ' confident' : ''}` : ''}`); }
  }
  const text = lines.join('\n') + '\n';
  writeFileSync(resolve(__dirname, 'psc.txt'), text);
  process.stdout.write(text);
  if (process.env.PSC_VARIANTS) {
    const dir = process.env.PSC_VARIANTS;
    mkdirSync(dir, { recursive: true });
    const half = (name: string) => (parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'publicA' : 'publicB');
    const core: Record<string, any> = {}, psc: Record<string, any> = {};
    for (const i of items) {
      const r = res.get(i)!;
      if (r.core === 'no counter' || i.suite === 'occlusion' || i.suite === 'real video') continue;
      const suite = i.suite === 'stored sets' ? 'david' : i.suite === 'synthetic' ? 'synthetic' : `${half(i.name)}`;
      const name = i.suite === 'repcount' ? i.name : i.name;
      core[name] = { suite, lift: i.lift, label: i.label, count: r.core };
      psc[name] = { suite, lift: i.lift, label: i.label, count: r.psc ?? 'refused' };
    }
    writeFileSync(resolve(dir, 'core.json'), JSON.stringify({ sets: core }));
    writeFileSync(resolve(dir, 'psc.json'), JSON.stringify({ sets: psc }));
    const rows = items.map(i => ({ suite: i.suite, name: i.name, cls: i.cls, lift: i.lift, label: i.label, ...res.get(i)! }));
    writeFileSync(resolve(dir, 'rows.json'), JSON.stringify(rows));
  }
}, 3_600_000);
