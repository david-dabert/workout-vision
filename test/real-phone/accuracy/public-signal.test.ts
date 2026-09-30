// ACCURACY=1 npx vitest run test/real-phone/accuracy/public-signal.test.ts
// Is a lost rep missing from the pose signal, or in it and dropped by the counting rule? For each build
// set of the public benchmark, the core's count against a count read from the same smoothed joint angle
// by another rule: working-side turning points whose prominence is at least a share of the angle's own
// range, at least 0.4 s apart. If that rule, knowing nothing of rest or thresholds, finds the labelled
// number far more often, the reps are in the signal and the rule loses them. Diagnostic only: build half,
// no parameter of the core changes, and nothing here ships.
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { liftDefinition } from '../../../src/lib/counting/core';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { countInWindow, publicSets } from './sets';
import { turningPoints } from './turning-points';

test.skipIf(!process.env.ACCURACY)('lost reps: signal or rule', () => {
  // The core's count as the scoreboard scores it (summarizeCount, a refused set is never exact), inside the
  // labelled window when there is one; turning points counted inside the same window.
  const shares = [0.3, 0.5];
  const g = new Map<string, { n: number; refused: number; core: number; turn: number[]; coreUnder: number; inSignal: number[] }>();
  for (const s of publicSets('build').sets) {
    const def = liftDefinition(s.lift)!;
    const r = summarizeCount(s.wl, s.ts, s.lift);
    const key = `${s.dataset} ${s.lift}`;
    const e = g.get(key) ?? { n: 0, refused: 0, core: 0, turn: shares.map(() => 0), coreUnder: 0, inSignal: shares.map(() => 0) };
    e.n++;
    const inWindow = (t: number) => !s.window || (t >= s.window[0] && t <= s.window[1]);
    const turns = shares.map(sh => turningPoints(r.smoothedAngles, s.ts, def.rest === 'high', sh).filter(inWindow).length);
    shares.forEach((_, k) => { if (turns[k] === s.label) e.turn[k]++; });
    if (r.refused) { e.refused++; g.set(key, e); continue; }
    const core = countInWindow(r.reps, s.window);
    if (core === s.label) e.core++;
    if (core < s.label) { e.coreUnder++; shares.forEach((_, k) => { if (turns[k] === s.label) e.inSignal[k]++; }); }
    g.set(key, e);
  }
  const sum = (f: (e: any) => number, ds: string) => [...g].filter(([k]) => k.startsWith(ds + ' ')).reduce((a, [, e]) => a + f(e), 0);
  const datasets = [...new Set([...g.keys()].map(k => k.split(' ')[0]))].sort();
  const text = [`Lost reps, signal or rule, ${new Date().toISOString().slice(0, 10)}: public build half, the same smoothed joint angle read two ways, inside the labelled window where there is one.`, '',
    '| Dataset, lift | Sets | Refused | Core exact | Turning points exact (30% of range) | (50%) | Core under | Of those, turning points exact (30%) | (50%) |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...[...g].sort().map(([k, e]) => `| ${k} | ${e.n} | ${e.refused} | ${e.core} | ${e.turn[0]} | ${e.turn[1]} | ${e.coreUnder} | ${e.inSignal[0]} | ${e.inSignal[1]} |`),
    ...datasets.map(ds => `| ${ds}, all | ${sum(e => e.n, ds)} | ${sum(e => e.refused, ds)} | ${sum(e => e.core, ds)} | ${sum(e => e.turn[0], ds)} | ${sum(e => e.turn[1], ds)} | ${sum(e => e.coreUnder, ds)} | ${sum(e => e.inSignal[0], ds)} | ${sum(e => e.inSignal[1], ds)} |`)].join('\n') + '\n';
  writeFileSync(resolve(__dirname, 'public-signal.txt'), text);
  process.stdout.write(text);
});
