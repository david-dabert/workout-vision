// Card 003, attempt 1, ceiling first (13 November 2026; bench only, nothing in the app changes). Before a second signal
// is wired into core.ts splitOverlongReps, how many public half-A sets could it fix, and how many could it break? For
// every rep the core returns lasting more than SPLIT_LONG (1.7) median reps, a second signal of the set (psc.js
// signalBank: the other joints' angles and the landmark coordinates) "splits" it when, in either orientation, its
// highest point in the rep's first half and in its second half are separated by a dip that returns at least 0.8 of
// the way from the lower of the two to the rep's lowest value (SPLIT_RETURN_SHARE's own figure). A set gains if the
// count plus its candidate splits equals the label; it loses if it was exact and has a candidate.
// SPLIT2=1 npx vitest run test/real-phone/accuracy/second-signal-split.test.ts
import { test } from 'vitest';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { bodyConsensus, flatImage, signalProfile } from '../../../src/lib/counting/bodyCheck';
import { signalBank } from '../../../src/lib/counting/psc';
import { sideSignals } from '../../../src/lib/counting/sgc';
import { countInWindow, decides, labelledSets, publicSets } from './sets';

const half = (name: string) => (parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'A' : 'B');
const SPLIT_LONG = 1.7, SHARE = 0.8;

function dipSplits(series: ArrayLike<number>, idx: number[], share = SHARE) {
  if (idx.length < 6) return false;
  const mid = idx.length >> 1;
  const v = idx.map((k: number) => (series[k] === series[k] ? series[k] : NaN));
  const fin = v.filter((x: number) => x === x);
  if (fin.length < 6) return false;
  const lo = Math.min(...fin);
  const argmax = (a: number, b: number) => {
    let m = -Infinity, j = -1;
    for (let i = a; i < b; i++) if (v[i] === v[i] && v[i] > m) { m = v[i]; j = i; }
    return j;
  };
  const p1 = argmax(0, mid), p2 = argmax(mid, v.length);
  if (p1 < 0 || p2 < 0 || p2 - p1 < 2) return false;
  let dip = Infinity;
  for (let i = p1 + 1; i < p2; i++) if (v[i] === v[i]) dip = Math.min(dip, v[i]);
  const top = Math.min(v[p1], v[p2]);
  return top - lo > 0 && (top - dip) / (top - lo) >= share;
}

function primaryPartialReturnShare(c: any, ts: number[], lift: string, startTime: number, endTime: number) {
  const def = liftDefinition(lift);
  const ang: (number | null)[] = c.smoothedAngles ?? [];
  if (!def || !ang.length || ang.length !== ts.length) return 0;
  const restsLow = def.rest === 'low';
  const o = (a: number) => (restsLow ? a : -a);
  const work = restsLow ? c.highThreshold : -c.lowThreshold;
  const restT = restsLow ? c.lowThreshold : -c.highThreshold;
  let reached = false, extreme = -Infinity, ret = Infinity, bestShare = 0;
  for (let i = 0; i < ts.length; i++) {
    if (ts[i] < startTime || ts[i] > endTime || ang[i] === null) continue;
    const v = o(ang[i]!);
    if (v >= work) {
      if (reached && Number.isFinite(ret) && extreme > restT) {
        bestShare = Math.max(bestShare, (extreme - ret) / (extreme - restT));
      }
      reached = true;
      ret = Infinity;
      extreme = Math.max(extreme, v);
    } else if (reached && v < ret) {
      ret = v;
    }
  }
  return bestShare;
}

type Mode = 'any' | 'spec_consensus' | 'spec_top' | 'spec_consensus_plus_partial50';

function candidates(c: any, wl: any, ts: number[], il: any, lift = '', mode: Mode = 'any') {
  const reps = (c.reps ?? []).filter((r: any) => !r.cut);
  if (reps.length < 2) return 0;
  const d = reps.map((r: any) => r.endTime - r.startTime).sort((a: number, b: number) => a - b);
  const md = d.length % 2 ? d[(d.length - 1) / 2] : (d[d.length / 2 - 1] + d[d.length / 2]) / 2;
  const flatIl = il ? flatImage({ worldLandmarks: wl, imageLandmarks: il, imageXY: il }) : undefined;
  const bank = signalBank(wl, ts, flatIl ?? undefined);
  const { grid, sigs } = bank;
  const def = lift ? liftDefinition(lift) : null;
  const prof = lift ? signalProfile(lift) : null;
  const signals = prof ? (prof.mode === 'side' ? sideSignals(prof.signals, c.arm === 'right' ? 'right' : 'left') : prof.signals) : null;
  const cons = mode !== 'any' && def && signals ? bodyConsensus(bank, signals, def.joint) : null;
  const byName = new Map(sigs.map((x: any) => [x.name, x]));
  const topSpecSigs = signals && def
    ? signals
        .filter((p: any) => p.name.replace(/[LR]$/, '') !== def.joint)
        .sort((a: any, b: any) => b.strength - a.strength)
        .slice(0, 1)
        .flatMap((p: any) => ['w.', 'i.'].map(pre => {
          const s = byName.get(pre + p.name);
          return s ? Float64Array.from(s.z, (v: number) => Math.sign(p.delta) * v) : null;
        }).filter(Boolean))
    : [];

  let n = 0;
  for (const r of reps) {
    if (r.endTime - r.startTime <= SPLIT_LONG * md) continue;
    const idx = grid.map((t: number, k: number) => [t, k]).filter(([t]: number[]) => t >= r.startTime && t <= r.endTime).map(([, k]: number[]) => k);
    if (idx.length < 6) continue;
    let splits = false;
    if (mode === 'any') {
      splits = sigs.some((s: any) => [1, -1].some(sign => dipSplits(Float64Array.from(s.z, (v: number) => sign * v), idx)));
    } else if (mode === 'spec_consensus') {
      splits = !!cons && dipSplits(cons.s, idx);
    } else if (mode === 'spec_top') {
      splits = topSpecSigs.some((s: any) => dipSplits(s, idx));
    } else if (mode === 'spec_consensus_plus_partial50') {
      const pShare = primaryPartialReturnShare(c, ts, lift, r.startTime, r.endTime);
      splits = pShare >= 0.5 && pShare < 0.8 && !!cons && dipSplits(cons.s, idx);
    }
    if (splits) n++;
  }
  return n;
}

function read(sets: any[], countOf: (s: any, c: any) => number, mode: Mode = 'any') {
  let counted = 0, exact = 0, gain = 0, lose = 0, under = 0, over = 0;
  const gained: string[] = [], lost: string[] = [];
  for (const s of sets.filter(x => decides(x.lift))) {
    const c: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
    if (c.refused || !(c.count > 0)) continue;
    counted++;
    const now = countOf(s, c);
    if (now === s.label) exact++; else if (now < s.label) under++; else over++;
    const k = candidates(c, s.wl, s.ts, s.il, s.lift, mode);
    if (!k) continue;
    if (now === s.label) { lose++; lost.push(s.name); } else if (now + k === s.label) { gain++; gained.push(s.name); }
  }
  return { counted, exact, under, over, gain, lose, gained, lost };
}

test.skipIf(!process.env.SPLIT2)('card 003 attempts 1 & 2: ceiling of a split by a second signal vs motion-spec signal', () => {
  const pub = (publicSets('build').sets as any[]).filter(s => half(s.name) === 'A');
  const dvSets = labelledSets().sets as any[];
  const a = read(pub, (s, c) => countInWindow(c.reps, s.window), 'any');
  const dv = read(dvSets, (_s, c) => c.count, 'any');
  const L = [
    '# Card 003, attempt 1: ceiling of a split of overlong reps by a second signal (second-signal-split.test.ts; bench only)',
    `public half A: counted ${a.counted}, exact ${a.exact}, under ${a.under}, over ${a.over}; would gain at most ${a.gain}, would break at least ${a.lose} exact sets`,
    `David's labelled sets: counted ${dv.counted}, exact ${dv.exact}; would gain at most ${dv.gain}, would break at least ${dv.lose}`,
    `gained (half A): ${a.gained.join('; ')}`, `broken (half A): ${a.lost.join('; ')}`,
    `broken (David): ${dv.lost.join('; ')}`,
    '',
    '# Attempt 2 (Task 10, TRIED.md:191 reopen condition): per-exercise motion-spec signal (signalProfile / bodyConsensus) checked on the broken sets and Half A',
  ];
  for (const mode of ['spec_consensus', 'spec_top', 'spec_consensus_plus_partial50'] as const) {
    const ma = read(pub, (s, c) => countInWindow(c.reps, s.window), mode);
    const mdv = read(dvSets, (_s, c) => c.count, mode);
    const brokenA1StillBroken = a.lost.filter(n => ma.lost.includes(n));
    const brokenDvStillBroken = dv.lost.filter(n => mdv.lost.includes(n));
    L.push(
      `## Mode: ${mode}`,
      `- Attempt-1 broken sets still broken: half A ${brokenA1StillBroken.length}/${a.lost.length} (${brokenA1StillBroken.join('; ') || 'none'}), David ${brokenDvStillBroken.length}/${dv.lost.length} (${brokenDvStillBroken.join('; ') || 'none'})`,
      `- Public half A: gain at most ${ma.gain}, break at least ${ma.lose} exact sets (net ${ma.gain - ma.lose >= 0 ? '+' : ''}${ma.gain - ma.lose})`,
      `- David's labelled sets: gain at most ${mdv.gain}, break at least ${mdv.lose} exact sets`,
      `- gained (half A): ${ma.gained.join('; ') || 'none'}`,
      `- broken (half A): ${ma.lost.join('; ') || 'none'}`,
      `- broken (David): ${mdv.lost.join('; ') || 'none'}`,
    );
  }
  const text = L.join('\n') + '\n';
  process.stdout.write(text);
  writeFileSync(resolve(__dirname, 'second-signal-split.txt'), text);
}, 900_000);
