// HMM_EVAL=1 npx vitest run --no-cache test/real-phone/accuracy/hmm-eval.test.ts
// The state-model counter (src/lib/counting/hmm.ts) against the core, set by set, on the three suites the gates
// use: David's labelled sets, the public build half, the 96 synthetic sets. Never the held-out half. Paired: the
// sets each counter gets exact that the other does not (McNemar's discordant pairs), and the sets off by 3 or more.
// Research only; changes nothing in the app. Writes hmm-eval.txt beside this file.
import { test } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { hmmCountLift } from '../../../src/lib/counting/hmm';
import { countInWindow, labelledSets, publicSets } from './sets';

type Row = { name: string; label: number; core: number | 'refused'; hmm: number };
const off = (c: number | 'refused', l: number) => (c === 'refused' ? Infinity : Math.abs(c - l));

function summary(title: string, rows: Row[]) {
  const n = rows.length;
  const ce = rows.filter(r => off(r.core, r.label) === 0).length, he = rows.filter(r => r.hmm === r.label).length;
  const onlyCore = rows.filter(r => off(r.core, r.label) === 0 && r.hmm !== r.label).length;
  const onlyHmm = rows.filter(r => off(r.core, r.label) !== 0 && r.hmm === r.label).length;
  const cBad = rows.filter(r => off(r.core, r.label) >= 3).length, hBad = rows.filter(r => off(r.hmm, r.label) >= 3).length;
  // McNemar with continuity correction on the discordant pairs; chi-square of 1 degree: 3.84 is p = 0.05.
  const chi = onlyCore + onlyHmm ? (Math.abs(onlyCore - onlyHmm) - 1) ** 2 / (onlyCore + onlyHmm) : 0;
  return `${title.padEnd(26)} n ${String(n).padStart(4)}  exact core ${String(ce).padStart(4)}  hmm ${String(he).padStart(4)}  only core ${String(onlyCore).padStart(3)}  only hmm ${String(onlyHmm).padStart(3)}  McNemar chi2 ${chi.toFixed(2).padStart(6)}  off>=3 core ${String(cBad).padStart(3)}  hmm ${String(hBad).padStart(3)}`;
}

test.skipIf(!process.env.HMM_EVAL)('state model against the core', () => {
  const out: string[] = [`State model against the core, ${new Date().toISOString().slice(0, 10)}. Exact: the count equals the label.`];
  const david: Row[] = labelledSets().sets.map(s => {
    const c = summarizeCount(s.wl, s.ts, s.lift);
    return { name: s.name, label: s.label, core: c.refused ? 'refused' : c.count, hmm: hmmCountLift(s.wl, s.ts, s.lift).count };
  });
  out.push(summary("David's sets", david));
  const pub: Row[] = publicSets('build').sets.map(s => {
    const c = summarizeCount(s.wl, s.ts, s.lift);
    return { name: s.name, label: s.label, core: c.refused ? 'refused' : countInWindow(c.reps, s.window), hmm: countInWindow(hmmCountLift(s.wl, s.ts, s.lift).reps, s.window) };
  });
  out.push(summary('Public build half', pub));
  const byLift = new Map<string, Row[]>();
  publicSets('build').sets.forEach((s, i) => { const k = `  public ${s.lift}`; byLift.set(k, [...(byLift.get(k) || []), pub[i]]); });
  for (const [k, rows] of [...byLift].sort()) out.push(summary(k, rows));
  const dir = process.env.SYNTH_DIR || resolve(__dirname, '../synth/sets');
  const synth: Row[] = readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort().map(f => {
    const r = JSON.parse(gunzipSync(readFileSync(resolve(dir, f))).toString());
    const ts: number[] = r.timestamps, lift = r.params?.exercise ?? r.lift;
    return { name: f, label: r.reps.length, core: summarizeCount(r.worldLandmarks, ts, lift).count, hmm: hmmCountLift(r.worldLandmarks, ts, lift).count };
  });
  out.push(summary('Synthetic sets', synth));
  out.push('', "David's sets, one by one (label, core, state model):", ...david.map(r => `  ${r.name.padEnd(60)} ${String(r.label).padStart(3)} ${String(r.core).padStart(7)} ${String(r.hmm).padStart(4)}`));
  writeFileSync(resolve(__dirname, 'hmm-eval.txt'), out.join('\n') + '\n');
  console.log(out.slice(0, 20).join('\n'));
}, 900_000);

// HMM_GRID=1: a small search over the state model's settings. Chosen on one half of the public build sets (by a
// hash of the clip, so both readings of a clip fall together), checked on the other half and on the synthetic
// sets; David's sets are never used to choose. Writes hmm-grid.txt.
import { createHash } from 'node:crypto';
import type { HmmOptions } from '../../../src/lib/counting/hmm';
test.skipIf(!process.env.HMM_GRID)('state model settings', () => {
  const half = (name: string) => (parseInt(createHash('sha256').update(name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'A' : 'B');
  const pub = publicSets('build').sets.map(s => ({ s, core: (() => { const c = summarizeCount(s.wl, s.ts, s.lift); return c.refused ? 'refused' as const : countInWindow(c.reps, s.window); })() }));
  const dir = process.env.SYNTH_DIR || resolve(__dirname, '../synth/sets');
  const synth = readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort().map(f => { const r = JSON.parse(gunzipSync(readFileSync(resolve(dir, f))).toString()); return { wl: r.worldLandmarks, ts: r.timestamps as number[], lift: r.params?.exercise ?? r.lift, label: r.reps.length as number }; });
  const variants: [string, HmmOptions][] = [];
  for (const returnTo of [0.25, 0.35, 0.45]) for (const depth of [0.5, 0.65]) for (const outlierShare of [0.02, 0.05, 0.1]) for (const meanRest of [0.6, 1.0, 2.0])
    variants.push([`returnTo ${returnTo} depth ${depth} outlier ${outlierShare} rest ${meanRest}s`, { returnTo, depth, outlierShare, meanSec: [meanRest, 0.5, 0.3, 0.6] }]);
  const out: string[] = [`State model settings, ${new Date().toISOString().slice(0, 10)}. Exact counts (off by 3 or more). Core: public A ${pub.filter(p => half(p.s.name) === 'A' && p.core === p.s.label).length}, B ${pub.filter(p => half(p.s.name) === 'B' && p.core === p.s.label).length}, synthetic 74.`];
  const results = variants.map(([name, o]) => {
    let a = 0, aBad = 0, b = 0, bBad = 0, sy = 0, syBad = 0;
    for (const { s } of pub) { const c = countInWindow(hmmCountLift(s.wl, s.ts, s.lift, o).reps, s.window), d = Math.abs(c - s.label); if (half(s.name) === 'A') { if (!d) a++; if (d >= 3) aBad++; } else { if (!d) b++; if (d >= 3) bBad++; } }
    for (const s of synth) { const d = Math.abs(hmmCountLift(s.wl, s.ts, s.lift, o).count - s.label); if (!d) sy++; if (d >= 3) syBad++; }
    return { name, a, aBad, b, bBad, sy, syBad };
  }).sort((x, y) => y.a - x.a);
  for (const r of results) out.push(`  ${r.name.padEnd(52)} public A ${String(r.a).padStart(3)} (${String(r.aBad).padStart(3)})  B ${String(r.b).padStart(3)} (${String(r.bBad).padStart(3)})  synthetic ${String(r.sy).padStart(2)} (${String(r.syBad).padStart(2)})`);
  writeFileSync(resolve(__dirname, 'hmm-grid.txt'), out.join('\n') + '\n');
}, 3_600_000);

// HMM_HYBRID=1: the core's count, replaced by the state model's only where the two differ by `gap` or more.
// Halves of the public build sets by a salted hash of the clip (the build half itself is a hash split, so an
// unsalted one would put every set in one half). Writes hmm-hybrid.txt.
test.skipIf(!process.env.HMM_HYBRID)('core and state model together', () => {
  const half = (name: string) => (parseInt(createHash('sha256').update('hybrid:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'A' : 'B');
  const rows = publicSets('build').sets.map(s => {
    const c = summarizeCount(s.wl, s.ts, s.lift);
    return { name: s.name, half: half(s.name), label: s.label, core: c.refused ? null : countInWindow(c.reps, s.window), hmm: countInWindow(hmmCountLift(s.wl, s.ts, s.lift).reps, s.window) };
  });
  const dir = process.env.SYNTH_DIR || resolve(__dirname, '../synth/sets');
  const synth = readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort().map(f => { const r = JSON.parse(gunzipSync(readFileSync(resolve(dir, f))).toString()); const lift = r.params?.exercise ?? r.lift; return { label: r.reps.length as number, core: summarizeCount(r.worldLandmarks, r.timestamps, lift).count as number, hmm: hmmCountLift(r.worldLandmarks, r.timestamps, lift).count }; });
  const david = labelledSets().sets.map(s => { const c = summarizeCount(s.wl, s.ts, s.lift); return { label: s.label, core: c.refused ? null : c.count as number, hmm: hmmCountLift(s.wl, s.ts, s.lift).count }; });
  const score = (list: { label: number; core: number | null; hmm: number }[], gap: number) => {
    let exact = 0, bad = 0;
    for (const r of list) { const n = r.core === null ? null : gap > 0 && Math.abs(r.core - r.hmm) >= gap ? r.hmm : r.core; const d = n === null ? Infinity : Math.abs(n - r.label); if (!d) exact++; if (d >= 3) bad++; }
    return `${String(exact).padStart(3)} (${String(bad).padStart(3)})`;
  };
  const A = rows.filter(r => r.half === 'A'), B = rows.filter(r => r.half === 'B');
  const out = [`Core, and core with the state model where they differ by gap or more, ${new Date().toISOString().slice(0, 10)}. Exact (off by 3 or more). Sets: public A ${A.length}, B ${B.length}, synthetic ${synth.length}, David ${david.length}.`];
  for (const gap of [0, 3, 4, 5, 6, 8]) out.push(`  ${gap ? `gap ${gap}` : 'core alone'}`.padEnd(14) + `public A ${score(A, gap)}  B ${score(B, gap)}  synthetic ${score(synth, gap)}  David ${score(david, gap)}`);
  writeFileSync(resolve(__dirname, 'hmm-hybrid.txt'), out.join('\n') + '\n');
}, 3_600_000);
