// SGC=1 [SGC_SUITES=real video,stored sets,...] [SGC_TXT=<file>] npx vitest run --no-cache test/real-phone/template/sgc.test.ts
// Spec-guided counting (sgc.js) against the core (summarizeCount) and PSC, on every suite whose sets name a catalogue
// exercise with a motion spec: David's 13 real videos and 20 stored sets, the public build halves (RepCount-A, Countix,
// MM-Fit, CF-Rep: the sets mapped to a lift), the synthetic and occlusion sets. Bench only. Writes SGC_TXT (default
// sgc.txt beside this file).
import { expect, test } from 'vitest';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { COUNT_AS, liftDefinition } from '../../../src/lib/counting/core';
import { pscCount } from '../../../src/lib/counting/psc.js';
import { labelledSets, videoSets } from '../accuracy/sets';
import { sgcCount } from './sgc.js';
import FAMILIES from '../../../src/lib/counting/guide-families.json';

type Item = { suite: string; name: string; lift: string; label: number; wl: any[]; ts: number[]; image: any[] | null };
const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());
const PUB = resolve(__dirname, '../public'), MOTIONS = resolve(__dirname, '../synth/motions');
const flat = (frames: any[]) => frames.map(f => (f ? f.flatMap((p: any) => [p.x, p.y]) : null));
const specFor = (lift: string) => {
  for (const k of [lift, (COUNT_AS as any)[lift]]) if (k && existsSync(resolve(MOTIONS, `${k}.json`))) return JSON.parse(readFileSync(resolve(MOTIONS, `${k}.json`), 'utf8'));
  return null;
};

function load(want: Set<string> | null): Item[] {
  const items: Item[] = [];
  const ok = (s: string) => !want || want.has(s);
  for (const ds of ['repcount', 'countix', 'mmfit', 'cfrep']) {
    if (!ok(ds)) continue;
    const dir = resolve(PUB, ds, 'build');
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort()) {
      const d = gz(resolve(dir, f));
      if (d.admitted === false || d.split !== 'build' || !d.lift) continue;
      items.push({ suite: ds, name: `public/${ds}/build/${f}`, lift: d.lift, label: d.count, wl: d.worldLandmarks, ts: d.timestamps, image: d.imageXY ?? null });
    }
  }
  if (ok('real video')) for (const s of videoSets().sets) {
    const d = gz(resolve(__dirname, '..', s.name));
    items.push({ suite: 'real video', name: s.name, lift: s.lift, label: s.label, wl: s.wl, ts: s.ts, image: d.imageLandmarks ? flat(d.imageLandmarks) : null });
  }
  if (ok('stored sets')) for (const s of labelledSets().sets) items.push({ suite: 'stored sets', name: s.name, lift: s.lift, label: s.label, wl: s.wl, ts: s.ts, image: null });
  for (const [suite, dir] of [['synthetic', '../synth/sets'], ['occlusion', '../occlusion/sets']]) {
    if (!ok(suite)) continue;
    const D = resolve(__dirname, dir);
    for (const f of readdirSync(D).filter(f => f.endsWith('.json.gz')).sort()) {
      const r = gz(resolve(D, f)), lift = r.params.lift ?? r.params.exercise;
      items.push({ suite, name: `${suite}/${f}`, lift, label: r.reps.length, wl: r.worldLandmarks, ts: r.timestamps, image: null });
    }
  }
  return items;
}

const err = (c: any, l: number) => (typeof c === 'number' ? Math.abs(c - l) : Infinity);
const tally = (xs: { c: any; l: number }[]) => {
  const n = xs.length, ex = xs.filter(x => err(x.c, x.l) === 0).length, w1 = xs.filter(x => err(x.c, x.l) <= 1).length, b3 = xs.filter(x => err(x.c, x.l) >= 3).length;
  return `${ex} / ${w1} / ${b3}`;
};

test.skipIf(!process.env.SGC)('spec-guided counting against core and PSC', () => {
  const want = process.env.SGC_SUITES ? new Set(process.env.SGC_SUITES.split(',')) : null;
  const items = load(want);
  expect(items.length).toBeGreaterThan(0);
  const rows: any[] = [];
  for (const it of items) {
    const spec = specFor(it.lift);
    if (!spec) continue;
    const c = liftDefinition(it.lift) ? summarizeCount(it.wl, it.ts, it.lift) : null;
    const core = c ? (c.refused ? 'refused' : c.count) : 'no counter';
    let psc: any = null;
    try { psc = pscCount({ wl: it.wl, ts: it.ts, image: it.image }).count; } catch { psc = null; }
    const first = (FAMILIES as any)[spec.key]?.first ?? 'concentric';
    const g = sgcCount({ wl: it.wl, ts: it.ts, image: it.image }, spec, { summarize: summarizeCount, first });
    rows.push({ ...it, core, psc, sgc: g.count, sgcCore: g.coreCount, members: g.members, period: g.period, reason: g.reason, sides: g.sides });
  }
  const suites = [...new Set(rows.map(r => r.suite))];
  const lines = [
    `Spec-guided counting (test/real-phone/template/sgc.js) against the core and PSC, ${new Date().toISOString().slice(0, 10)}. Cells: exact / within 1 / off by 3+ (refused or no count is off by 3+). Sets whose lift has a motion spec.`,
    '',
    '| Suite | Sets | Core | PSC | SGC (PSC cycles) | SGC (core rep logic) | Core, or SGC-core where the core refuses or has no counter |',
    '|---|---:|---|---|---|---|---|',
    ...suites.map(s => {
      const rs = rows.filter(r => r.suite === s);
      const fill = rs.map(r => ({ c: typeof r.core === 'number' ? r.core : r.sgcCore, l: r.label }));
      return `| ${s} | ${rs.length} | ${tally(rs.map(r => ({ c: r.core, l: r.label })))} | ${tally(rs.map(r => ({ c: r.psc, l: r.label })))} | ${tally(rs.map(r => ({ c: r.sgc, l: r.label })))} | ${tally(rs.map(r => ({ c: r.sgcCore, l: r.label })))} | ${tally(fill)} |`;
    }),
    '',
  ];
  for (const s of ['real video', 'stored sets']) {
    const rs = rows.filter(r => r.suite === s);
    if (!rs.length) continue;
    lines.push(`${s}, set by set: label | core | PSC | SGC | SGC-core (period s; signals)`);
    for (const r of rs) lines.push(`- ${r.name.split('/').pop()}: ${r.label} | ${r.core} | ${r.psc} | ${r.sgc} | ${r.sgcCore}${r.sides ? ` (sides ${r.sides.join('+')})` : ''} (${r.period ? r.period.toFixed(2) : '-'} s; ${r.reason ?? r.members.slice(0, 6).join(' ')})`);
    lines.push('');
  }
  // Per lift on the larger suites: where SGC differs most from the core.
  const byLift = new Map<string, any[]>();
  for (const r of rows) { const k = `${r.suite} ${r.lift}`; if (!byLift.has(k)) byLift.set(k, []); byLift.get(k)!.push(r); }
  lines.push('Per suite and lift: sets | core | PSC | SGC | SGC-core');
  for (const [k, rs] of [...byLift.entries()].sort()) lines.push(`- ${k}: ${rs.length} | ${tally(rs.map(r => ({ c: r.core, l: r.label })))} | ${tally(rs.map(r => ({ c: r.psc, l: r.label })))} | ${tally(rs.map(r => ({ c: r.sgc, l: r.label })))} | ${tally(rs.map(r => ({ c: r.sgcCore, l: r.label })))}`);
  const text = lines.join('\n') + '\n';
  writeFileSync(process.env.SGC_TXT ?? resolve(__dirname, 'sgc.txt'), text);
  process.stdout.write(text.split('\n').slice(0, 14).join('\n') + '\n');
}, 3_600_000);
