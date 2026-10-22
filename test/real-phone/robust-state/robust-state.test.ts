// RS_OUT=<out.json> [RS_K=5] [RS_BAND=0.25] [RS_SUITES=david,video,...] npx vitest run --no-cache test/real-phone/robust-state/robust-state.test.ts
// The state chosen for its invariance (bench only; the app imports none of it). David's decision of 22 October 2026,
// after ConfigWM (Shen, Chen, Hu, Zhang, Fung, arXiv 2610.27914): a task description configures the state a world model
// plans in, and that state stays stable as distractors grow. Here the exercise is the task: its profile
// (spec-profiles.json, the signals the motion spec says move) names the candidate states, the core's own joint angle
// among them. Each candidate is counted through the core's own rep logic (sgc.js coreOnSignal: the signal's 5-95 % band
// carried as a 120-degree angle), on the clean read and on K reads under the noise proxy fitted on six encodings of
// David's videos (stability/noise.mjs, intensity 0.5). The candidate whose count moves least across the reads is the
// state; its clean count is the set's. Label-free: no label enters the choice; a candidate must count near the median
// of every state's count (a flat signal is invariant and counts one). The output keeps, per set, the core's count and
// moves and the best other state, so two rules are read from one run: `any` (the most invariant state wins, the core's
// own angle first on a tie) and `core-moves` (the core keeps the set unless its own count moves on some read and the
// other state's does not). Every set of variant-eval's suites, in its format (compare-variants).
// Nearest tried work (R14): SGC combined the profile's signals by hand-set weights (TRIED.md, 8 October; a check, not
// a counter); the consensus bench took the mode of one signal's reads (20 October; does not ship). Neither chose the
// signal by its invariance.
import { test } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { signalBank } from '../../../src/lib/counting/psc.js';
import { flatImage, signalProfile } from '../../../src/lib/counting/bodyCheck.js';
import { coreOnSignal, sideSignals } from '../../../src/lib/counting/sgc.js';
import { ROOT, benchSets, countInWindow, labelledSets, publicSets, videoSets } from '../accuracy/sets';
// @ts-expect-error: a JavaScript module without types
import { perturbSet } from '../stability/noise.mjs';

const K = Number(process.env.RS_K || 5);
const BAND = Number(process.env.RS_BAND || 0.25);
const SUITES = (process.env.RS_SUITES ?? 'david,video,publicA,publicB,synthetic,repcount,occlusion').split(',');
type Out = number | 'refused';
const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());
const half = (name: string) => (parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'publicA' : 'publicB');

type Read = { wl: any[]; ts: number[]; image: any[] | null };
type Cand = { name: string; sign: number; strength: number };

/** The set's image landmarks in PSC's flat form, masked where a read has no pose. */
function imageOf(wl: any[], il: any[] | null, xy: any[] | null): any[] | null {
  const img = flatImage({ worldLandmarks: wl, imageLandmarks: il, imageXY: xy });
  return img ? img.map((f: any, t: number) => (wl[t] ? f : null)) : null;
}

/** One read's count on one candidate state, through the core's rep logic; null when the core refuses it. */
function candidateCount(read: Read, bank: any, c: Cand, first: string, window?: [number, number]): { count: Out; reps: any[] } {
  const s = bank.sigs.find((x: any) => x.name === c.name);
  if (!s) return { count: 'refused', reps: [] };
  const r = coreOnSignal(Float64Array.from(s.z, (v: number) => c.sign * v), bank.grid, first, summarizeCount);
  if (!Number.isInteger(r.count)) return { count: 'refused', reps: [] };
  return { count: window ? countInWindow(r.reps ?? [], window) : r.count, reps: r.reps ?? [] };
}

/** The core as the app runs it, on one read. */
function coreCount(read: Read, lift: string, window?: [number, number]): { count: Out; arm: string | null } {
  const r: any = summarizeCount(read.wl, read.ts, lift);
  if (r.refused) return { count: 'refused', arm: null };
  return { count: window ? countInWindow(r.reps ?? [], window) : r.count, arm: r.arm ?? null };
}

function chooseState(lift: string, wl: any[], ts: number[], il: any[] | null, xy: any[] | null, window?: [number, number]) {
  const clean: Read = { wl, ts, image: imageOf(wl, il, xy) };
  const core = coreCount(clean, lift, window);
  const def = liftDefinition(lift), profile = signalProfile(lift);
  const base = { count: core.count, state: 'core', coreMoves: 0, moves: 0, candidates: 0 };
  if (!def || !profile || ts.length < 10) return { ...base, why: 'no profile' };
  // The reads: the clean one and K under the noise proxy; the image landmarks follow the poses that remain.
  const reads: Read[] = [clean];
  for (let seed = 1; seed <= K; seed++) {
    const p = perturbSet({ worldLandmarks: wl, timestamps: ts, imageLandmarks: il }, { seed });
    reads.push({ wl: p.worldLandmarks, ts: p.timestamps, image: imageOf(p.worldLandmarks, p.imageLandmarks ?? il, xy) });
  }
  // The core's own state: its count on every read.
  const coreReads = reads.map((r, i) => (i === 0 ? core.count : coreCount(r, lift, window).count));
  const coreMoves = coreReads.slice(1).filter(c => c !== coreReads[0]).length;
  // The candidate states: the profile's signals, world and image, signed to rise from rest; a one-limb profile on the
  // side the core read (both sides when it refused).
  const sides = profile.mode === 'side' ? (core.arm ? [core.arm] : ['left', 'right']) : [null];
  const cands: Cand[] = [];
  for (const side of sides) for (const p of (side ? sideSignals(profile.signals, side) : profile.signals)) for (const pre of ['w.', 'i.']) cands.push({ name: pre + p.name, sign: Math.sign(p.delta) || 1, strength: p.strength });
  const banks = reads.map(r => signalBank(r.wl, r.ts, r.image, { useImage: true }));
  const scored = cands.map(c => {
    const counts = reads.map((r, i) => candidateCount(r, banks[i], c, profile.first, window).count);
    if (counts[0] === 'refused' || !(Number(counts[0]) > 0)) return null;
    const moves = counts.slice(1).filter(x => x !== counts[0]).length;
    const far = Math.max(0, ...counts.slice(1).map(x => (x === 'refused' ? 99 : Math.abs(Number(x) - Number(counts[0])))));
    return { c, count: counts[0] as number, moves, far, counts };
  }).filter(Boolean) as { c: Cand; count: number; moves: number; far: number; counts: Out[] }[];
  const refused = core.count === 'refused';
  // The core's own state competes with its own moves; a refused core has no count to keep.
  const coreEntry = refused ? null : { c: { name: 'core', sign: 1, strength: Infinity }, count: core.count as number, moves: coreMoves, far: Math.max(0, ...coreReads.slice(1).map(x => (x === 'refused' ? 99 : Math.abs(Number(x) - Number(coreReads[0]))))) };
  const every = coreEntry ? [coreEntry, ...scored] : scored;
  if (!every.length) return { ...base, coreMoves, candidates: scored.length, why: 'no candidate counted' };
  // A flat signal is invariant and counts one rep: a candidate's count must sit within BAND of the median count of
  // every state read (the body's own consensus on the number), or within 2 reps of it. Label-free.
  const sortedCounts = every.map(e => e.count).sort((a, b) => a - b), median = sortedCounts[Math.floor(sortedCounts.length / 2)];
  const near = (n: number) => Math.abs(n - median) <= Math.max(2, BAND * median);
  const all = every.filter(e => near(e.count));
  if (!all.length) return { ...base, coreMoves, candidates: scored.length, why: 'none near the median' };
  // Least moves, then the smallest largest move, then the core, then the strongest signal.
  all.sort((p, q) => p.moves - q.moves || p.far - q.far || (q.c.strength === Infinity ? 1 : 0) - (p.c.strength === Infinity ? 1 : 0) || q.c.strength - p.c.strength);
  const pick = all[0], alt = all.find(e => e.c.name !== 'core') ?? null;
  // Every state's counts across the reads are kept, so other rules can be read from one run without counting again.
  return { count: pick.count, state: pick.c.name, coreMoves, moves: pick.moves, candidates: scored.length, median,
    core: core.count, coreReads, alt: alt ? { name: alt.c.name, count: alt.count, moves: alt.moves, far: alt.far } : null,
    cands: scored.map(e => ({ name: e.c.name, strength: e.c.strength === Infinity ? null : e.c.strength, counts: e.counts })) };
}

test.skipIf(!process.env.RS_OUT)('the state chosen for its invariance under the noise proxy', () => {
  const sets: Record<string, any> = {};
  const put = (name: string, suite: string, lift: string, label: number, wl: any[], ts: number[], il: any[] | null, xy: any[] | null, window?: [number, number], refusedByApp = false) => {
    if (!SUITES.includes(suite)) return;
    if (refusedByApp) { sets[name] = { suite, lift, label, count: 'refused', state: 'app refused' }; return; }
    sets[name] = { suite, lift, label, ...chooseState(lift, wl, ts, il, xy, window) };
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
  writeFileSync(process.env.RS_OUT!, JSON.stringify({ k: K, band: BAND, sets }, null, 0) + '\n');
}, 7_200_000);
