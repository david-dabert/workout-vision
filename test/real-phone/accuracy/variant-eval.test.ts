// VARIANT_EVAL=<out.json> npx vitest run --no-cache test/real-phone/accuracy/variant-eval.test.ts
// The live counter's count on every set of the suites the gates use, set by set, written as JSON: David's
// labelled sets, the public build half (in two fixed halves, A and B, by a salted hash of the clip, so a change
// chosen on one half can be checked on the other) and the 96 synthetic sets. Never the held-out half.
// Since 8 October also, as suites of their own: David's real videos read whole through the app (video; a read the
// app refused stays refused), the RepCount-A build half on its classes with a counter (repcount, benchmark only) and
// the 68 occlusion sets (occlusion).
// Compare two runs with: node scripts/compare-variants.mjs <before.json> <after.json>
// Research tool: it changes nothing and gates nothing.
import { test } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { pscProposal } from '../../../src/lib/counting/psc.js';
import { ROOT, benchSets, countInWindow, labelledSets, publicSets, videoSets } from './sets';

// WV_CORE_BENCH='{"zWeight":0.5}' (7 October): the survey techniques of src/lib/counting/survey.ts, switched for this
// run only (research; the app never sets it).
if (process.env.WV_CORE_BENCH) (globalThis as any).__WV_CORE_BENCH__ = JSON.parse(process.env.WV_CORE_BENCH);
// WV_PSC_FILL=1 (8 October): where the core refuses, PSC's proposal (src/lib/counting/psc.js pscProposal, as the app
// offers it on the low-confidence screen) is read as the count; no proposal stays a refusal.
const FILL = !!process.env.WV_PSC_FILL;
type Suite = 'david' | 'publicA' | 'publicB' | 'synthetic' | 'video' | 'repcount' | 'occlusion';
type Entry = { suite: Suite; lift: string; label: number; count: number | 'refused'; filled?: boolean };
const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());

function counted(r: any, set: () => any, window?: [number, number]): Pick<Entry, 'count' | 'filled'> {
  if (!r.refused) return { count: window ? countInWindow(r.reps, window) : r.count };
  if (!FILL) return { count: 'refused' };
  const p = pscProposal(set());
  if (!p) return { count: 'refused' };
  return { count: window ? countInWindow(p.reps, window) : p.count, filled: true };
}

test.skipIf(!process.env.VARIANT_EVAL)('every set, as the live counter counts it', () => {
  const sets: Record<string, Entry> = {};
  for (const s of labelledSets().sets) {
    const r = summarizeCount(s.wl, s.ts, s.lift);
    sets[s.name] = { suite: 'david', lift: s.lift, label: s.label, ...counted(r, () => ({ ...gz(resolve(ROOT, s.name)), worldLandmarks: s.wl, timestamps: s.ts })) };
  }
  for (const s of videoSets().sets) {
    const r = summarizeCount(s.wl, s.ts, s.lift);
    sets[s.name] = { suite: 'video', lift: s.lift, label: s.label, ...(s.appRefused ? { count: 'refused' as const } : counted(r, () => ({ ...gz(resolve(ROOT, s.name)), worldLandmarks: s.wl, timestamps: s.ts }))) };
  }
  const half = (name: string) => (parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'publicA' : 'publicB');
  for (const s of publicSets('build').sets) {
    const r = summarizeCount(s.wl, s.ts, s.lift);
    sets[s.name] = { suite: half(s.name), lift: s.lift, label: s.label, ...counted(r, () => ({ ...gz(resolve(ROOT, s.name)), worldLandmarks: s.wl, timestamps: s.ts }), s.window) };
  }
  for (const s of benchSets('repcount', 'build').sets) {
    if (!s.lift || !liftDefinition(s.lift)) continue;
    const r = summarizeCount(s.wl, s.ts, s.lift);
    sets[s.name] = { suite: 'repcount', lift: s.lift, label: s.label, ...counted(r, () => ({ worldLandmarks: s.wl, timestamps: s.ts, imageXY: s.image })) };
  }
  for (const [suite, dir] of [['synthetic', '../synth/sets'], ['occlusion', '../occlusion/sets']] as const) {
    const D = resolve(__dirname, dir);
    for (const f of readdirSync(D).filter(f => f.endsWith('.json.gz')).sort()) {
      const r = gz(resolve(D, f)), lift = suite === 'synthetic' ? r.params?.exercise ?? r.lift : r.params.lift ?? r.params.exercise;
      const c = summarizeCount(r.worldLandmarks, r.timestamps, lift);
      sets[`${suite === 'synthetic' ? 'synth' : suite}/${f}`] = { suite, lift, label: r.reps.length, ...counted(c, () => r) };
    }
  }
  writeFileSync(process.env.VARIANT_EVAL!, JSON.stringify({ sets }, null, 0) + '\n');
}, 1_800_000);
