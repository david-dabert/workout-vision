// VARIANT_EVAL=<out.json> npx vitest run --no-cache test/real-phone/accuracy/variant-eval.test.ts
// The live counter's count on every set of the three suites the gates use, set by set, written as JSON: David's
// labelled sets, the public build half (in two fixed halves, A and B, by a salted hash of the clip, so a change
// chosen on one half can be checked on the other) and the 96 synthetic sets. Never the held-out half.
// Compare two runs with: node scripts/compare-variants.mjs <before.json> <after.json>
// Research tool: it changes nothing and gates nothing.
import { test } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { countInWindow, labelledSets, publicSets } from './sets';

// WV_CORE_BENCH='{"zWeight":0.5}' (7 October): the survey techniques of src/lib/counting/survey.ts, switched for this
// run only (research; the app never sets it).
if (process.env.WV_CORE_BENCH) (globalThis as any).__WV_CORE_BENCH__ = JSON.parse(process.env.WV_CORE_BENCH);
type Entry = { suite: 'david' | 'publicA' | 'publicB' | 'synthetic'; lift: string; label: number; count: number | 'refused' };

test.skipIf(!process.env.VARIANT_EVAL)('every set, as the live counter counts it', () => {
  const sets: Record<string, Entry> = {};
  for (const s of labelledSets().sets) {
    const r = summarizeCount(s.wl, s.ts, s.lift);
    sets[s.name] = { suite: 'david', lift: s.lift, label: s.label, count: r.refused ? 'refused' : r.count };
  }
  const half = (name: string) => (parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'publicA' : 'publicB');
  for (const s of publicSets('build').sets) {
    const r = summarizeCount(s.wl, s.ts, s.lift);
    sets[s.name] = { suite: half(s.name), lift: s.lift, label: s.label, count: r.refused ? 'refused' : countInWindow(r.reps, s.window) };
  }
  const dir = resolve(__dirname, '../synth/sets');
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort()) {
    const r = JSON.parse(gunzipSync(readFileSync(resolve(dir, f))).toString()), lift = r.params?.exercise ?? r.lift;
    const c = summarizeCount(r.worldLandmarks, r.timestamps, lift);
    sets[`synth/${f}`] = { suite: 'synthetic', lift, label: r.reps.length, count: c.refused ? 'refused' : c.count };
  }
  writeFileSync(process.env.VARIANT_EVAL!, JSON.stringify({ sets }, null, 0) + '\n');
}, 900_000);
