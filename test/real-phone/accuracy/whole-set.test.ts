// Card 018 (cards/018-sure-only-on-whole-sets.md): is the app right 9 times in 10 when it says it is sure only of a set
// the video holds from rest to rest? Bench only; decides nothing in the app. The rule is the card's, fixed in commit
// 60ff04e9 before any run: whole = first and last angle seen at rest, no rise left open after the last counted rep
// (fitness-tests.js openRise), and no refused head rep. Sure = the gate that ships (sure.ts, sure-parity.test.ts).
// WHOLE=A reads David's sets and public half A; WHOLE=B reads public half B, once, after the rule is fixed.
import { test } from 'vitest';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeCount, withBodyCheck, withProposal, withSensitivity } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { openRise } from '../../../src/lib/fitness-tests';
import { countInWindow, decides, labelledSets, publicSets } from './sets';
import { sureRow } from './sure';

// The split of choices.test.ts (and variant-eval): the first hex digit of a hash of the set's name.
const half = (name: string) => (parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'A' : 'B');

/** The card's rule, on the core's own result for the whole video. */
export function wholeSet(c: any, ts: number[], lift: string): boolean {
  if (!c || c.refused || !(c.count > 0) || c.headRefused === true) return false;
  const def: any = liftDefinition(lift);
  const s: (number | null)[] = c.smoothedAngles, low: number = c.lowThreshold, high: number = c.highThreshold;
  if (!def || !Array.isArray(s)) return false;
  const atRest = (a: number) => (def.rest === 'low' ? a <= low : a >= high);
  const seen = s.filter((a): a is number => a !== null);
  if (!seen.length) return false;
  const after = c.reps?.at(-1)?.endTime ?? 0;
  return atRest(seen[0]) && atRest(seen[seen.length - 1]) && !openRise(s, ts, low, high, def.rest, after);
}

function read(sets: any[], countOf: (s: any) => (r: any) => number) {
  const out = { counted: 0, sure: 0, sureExact: 0, sureBad: 0, whole: 0, wholeExact: 0, wholeBad: 0, bad: [] as string[] };
  for (const s of sets.filter(x => decides(x.lift))) {
    const c: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
    const app = withSensitivity(withBodyCheck(withProposal({ ...c, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: s.il ?? null }, s.lift), s.lift), s.lift);
    const row = sureRow(app, s.lift, s.label, countOf(s));
    if (row.err === null) continue;
    out.counted++;
    if (row.flagged || row.moved) continue;
    out.sure++; if (row.err === 0) out.sureExact++; if (row.err >= 3) out.sureBad++;
    if (!wholeSet(app, s.ts, s.lift)) continue;
    out.whole++; if (row.err === 0) out.wholeExact++; if (row.err >= 3) { out.wholeBad++; out.bad.push(s.name); }
  }
  return out;
}

const pct = (k: number, n: number) => (n ? `${((100 * k) / n).toFixed(1)} %` : 'n/a');
const line = (name: string, r: ReturnType<typeof read>) =>
  `${name}: counted ${r.counted}; sure (as shipped) ${r.sure}, exact ${r.sureExact} (${pct(r.sureExact, r.sure)}), off by 3+ ${r.sureBad}; `
  + `sure and whole ${r.whole} (${pct(r.whole, r.counted)} of counted), exact ${r.wholeExact} (${pct(r.wholeExact, r.whole)}), off by 3+ ${r.wholeBad}`
  + (r.bad.length ? `\n  off by 3+ and sure and whole: ${r.bad.join('; ')}` : '');

test.skipIf(!process.env.WHOLE)('card 018: right when sure, sure only of whole sets', () => {
  const which = process.env.WHOLE!;
  const pub = publicSets('build').sets as any[];
  const inWindow = (s: any) => (r: any) => countInWindow(r.reps, s.window);
  const L: string[] = [`# Card 018, WHOLE=${which} (whole-set.test.ts; rule fixed in 60ff04e9)`];
  if (which === 'A') {
    L.push(line("David's labelled sets", read(labelledSets().sets as any[], () => (r: any) => r.count)));
    L.push(line('public build half A', read(pub.filter(s => half(s.name) === 'A'), inWindow)));
  } else if (which === 'B') {
    L.push(line('public build half B (read once)', read(pub.filter(s => half(s.name) === 'B'), inWindow)));
  }
  const text = L.join('\n') + '\n';
  process.stdout.write(text);
  writeFileSync(resolve(__dirname, `whole-set-${which}.txt`), text);
}, 900_000);
