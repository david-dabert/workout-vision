// CONSENSUS=<default|grid|noise|both> CONSENSUS_OUT=<out.json> npx vitest run --no-cache test/real-phone/consensus/consensus.test.ts
// The count as the agreement of several reads of the same set, instead of one read (bench only; the app imports none
// of it). The counter is a threshold machine on a noisy signal: on the public build sets a re-encoding-sized noise
// moves the count of 28 % of sets (stability.txt, 10 October 2026), and the sensitivity check (coreAnalysis.js
// SENSITIVITY_GRID) already recounts every set six times on the phone, only to flag disagreement. Here the mode of
// those reads is the count: `grid` over the app's count and the six grid settings; `noise` over the clean read and
// K seeds of the noise proxy (stability/noise.mjs, intensity 0.5); `both` over all. A tie keeps the app's own count;
// a refusal is a value of its own. Every set of variant-eval's suites, written in its format for compare-variants.mjs.
// Each entry also carries `agree` (every read the same) so "right when all agree" can be read off (R16).
import { test } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { SENSITIVITY_GRID, summarizeCount } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { ROOT, benchSets, countInWindow, labelledSets, publicSets, videoSets } from '../accuracy/sets';
// @ts-expect-error: a JavaScript module without types
import { perturbSet } from '../stability/noise.mjs';

const MODE = process.env.CONSENSUS ?? 'default';
const K = Number(process.env.CONSENSUS_K || 5);
type Out = number | 'refused';
const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());

function outcome(wl: any[], ts: number[], lift: string, window?: [number, number], tuning?: any): Out {
  const r: any = summarizeCount(wl, ts, lift, tuning);
  if (r.refused) return 'refused';
  return window ? countInWindow(r.reps ?? [], window) : r.count;
}

/** Every read of the set: the app's own first. */
function reads(wl: any[], ts: number[], lift: string, window?: [number, number]): Out[] {
  const own = outcome(wl, ts, lift, window);
  const out: Out[] = [own];
  if (MODE === 'grid' || MODE === 'both') for (const t of SENSITIVITY_GRID) out.push(outcome(wl, ts, lift, window, t));
  if (MODE === 'noise' || MODE === 'both') for (let s = 1; s <= K; s++) { const p = perturbSet({ worldLandmarks: wl, timestamps: ts }, { seed: s }); out.push(outcome(p.worldLandmarks, p.timestamps, lift, window)); }
  return out;
}

/** The mode of the reads; a tie keeps the app's own count (the first read). */
function consensus(xs: Out[]): { count: Out; agree: boolean; reads: Out[] } {
  const n = new Map<string, number>();
  for (const x of xs) n.set(String(x), (n.get(String(x)) ?? 0) + 1);
  const top = Math.max(...n.values());
  const own = String(xs[0]);
  const count = n.get(own) === top ? xs[0] : xs.find(x => n.get(String(x)) === top)!;
  return { count, agree: n.size === 1, reads: xs };
}

test.skipIf(!process.env.CONSENSUS_OUT)('every set, counted by the agreement of its reads', () => {
  const sets: Record<string, any> = {};
  const put = (name: string, suite: string, lift: string, label: number, wl: any[], ts: number[], window?: [number, number], refusedByApp = false) => {
    if (refusedByApp) { sets[name] = { suite, lift, label, count: 'refused', agree: true }; return; }
    const c = consensus(reads(wl, ts, lift, window));
    sets[name] = { suite, lift, label, count: c.count, agree: c.agree, own: c.reads[0], reads: c.reads };
  };
  for (const s of labelledSets().sets) put(s.name, 'david', s.lift, s.label, s.wl, s.ts);
  for (const s of videoSets().sets) put(s.name, 'video', s.lift, s.label, s.wl, s.ts, undefined, s.appRefused);
  const half = (name: string) => (parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'publicA' : 'publicB');
  for (const s of publicSets('build').sets) put(s.name, half(s.name), s.lift, s.label, s.wl, s.ts, s.window);
  for (const s of benchSets('repcount', 'build').sets) if (s.lift && liftDefinition(s.lift)) put(s.name, 'repcount', s.lift, s.label, s.wl, s.ts);
  for (const [suite, dir] of [['synthetic', '../synth/sets'], ['occlusion', '../occlusion/sets']] as const) {
    const D = resolve(__dirname, dir);
    for (const f of readdirSync(D).filter(f => f.endsWith('.json.gz')).sort()) {
      const r = gz(resolve(D, f)), lift = suite === 'synthetic' ? r.params?.exercise ?? r.lift : r.params.lift ?? r.params.exercise;
      put(`${suite === 'synthetic' ? 'synth' : suite}/${f}`, suite, lift, r.reps.length, r.worldLandmarks, r.timestamps);
    }
  }
  writeFileSync(process.env.CONSENSUS_OUT!, JSON.stringify({ mode: MODE, k: K, sets }, null, 0) + '\n');
}, 3_600_000);
