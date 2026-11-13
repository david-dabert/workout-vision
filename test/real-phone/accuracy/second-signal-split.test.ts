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
import { signalBank } from '../../../src/lib/counting/psc';
import { countInWindow, decides, labelledSets, publicSets } from './sets';

const half = (name: string) => (parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'A' : 'B');
const SPLIT_LONG = 1.7, SHARE = 0.8;

function candidates(c: any, wl: any, ts: number[], il: any) {
  const reps = (c.reps ?? []).filter((r: any) => !r.cut);
  if (reps.length < 2) return 0;
  const d = reps.map((r: any) => r.endTime - r.startTime).sort((a: number, b: number) => a - b);
  const md = d.length % 2 ? d[(d.length - 1) / 2] : (d[d.length / 2 - 1] + d[d.length / 2]) / 2;
  const { grid, sigs } = signalBank(wl, ts, il ?? undefined);
  let n = 0;
  for (const r of reps) {
    if (r.endTime - r.startTime <= SPLIT_LONG * md) continue;
    const idx = grid.map((t: number, k: number) => [t, k]).filter(([t]: number[]) => t >= r.startTime && t <= r.endTime).map(([, k]: number[]) => k);
    if (idx.length < 6) continue;
    const mid = idx.length >> 1;
    const splits = sigs.some((s: any) => [1, -1].some(sign => {
      const v = idx.map((k: number) => (s.z[k] === s.z[k] ? sign * s.z[k] : NaN));
      const lo = Math.min(...v.filter((x: number) => x === x));
      const argmax = (a: number, b: number) => { let m = -Infinity, j = -1; for (let i = a; i < b; i++) if (v[i] === v[i] && v[i] > m) { m = v[i]; j = i; } return j; };
      const p1 = argmax(0, mid), p2 = argmax(mid, v.length);
      if (p1 < 0 || p2 < 0 || p2 - p1 < 2) return false;
      let dip = Infinity; for (let i = p1 + 1; i < p2; i++) if (v[i] === v[i]) dip = Math.min(dip, v[i]);
      const top = Math.min(v[p1], v[p2]);
      return top - lo > 0 && (top - dip) / (top - lo) >= SHARE;
    }));
    if (splits) n++;
  }
  return n;
}

function read(sets: any[], countOf: (s: any, c: any) => number) {
  let counted = 0, exact = 0, gain = 0, lose = 0, under = 0, over = 0;
  const gained: string[] = [], lost: string[] = [];
  for (const s of sets.filter(x => decides(x.lift))) {
    const c: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
    if (c.refused || !(c.count > 0)) continue;
    counted++;
    const now = countOf(s, c);
    if (now === s.label) exact++; else if (now < s.label) under++; else over++;
    const k = candidates(c, s.wl, s.ts, s.il);
    if (!k) continue;
    if (now === s.label) { lose++; lost.push(s.name); } else if (now + k === s.label) { gain++; gained.push(s.name); }
  }
  return { counted, exact, under, over, gain, lose, gained, lost };
}

test.skipIf(!process.env.SPLIT2)('card 003 attempt 1: the ceiling of a split by a second signal', () => {
  const pub = (publicSets('build').sets as any[]).filter(s => half(s.name) === 'A');
  const a = read(pub, (s, c) => countInWindow(c.reps, s.window));
  const dv = read(labelledSets().sets as any[], (_s, c) => c.count);
  const L = [
    '# Card 003, attempt 1: ceiling of a split of overlong reps by a second signal (second-signal-split.test.ts; bench only)',
    `public half A: counted ${a.counted}, exact ${a.exact}, under ${a.under}, over ${a.over}; would gain at most ${a.gain}, would break at least ${a.lose} exact sets`,
    `David's labelled sets: counted ${dv.counted}, exact ${dv.exact}; would gain at most ${dv.gain}, would break at least ${dv.lose}`,
    `gained (half A): ${a.gained.slice(0, 12).join('; ')}`, `broken (half A): ${a.lost.slice(0, 12).join('; ')}`,
    `broken (David): ${dv.lost.join('; ')}`,
  ];
  const text = L.join('\n') + '\n';
  process.stdout.write(text);
  writeFileSync(resolve(__dirname, 'second-signal-split.txt'), text);
}, 900_000);
