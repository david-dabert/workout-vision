// HALF_RATE=1 npx vitest run test/real-phone/accuracy/half-rate.test.ts
// Speed (9 October 2026): the pose model costs about 120 ms a sample and the app reads 15 samples a second
// (extractionConfig.js, TARGET_FPS), so a 30 s set takes about a minute (TRIED.md, 7 October). Reading every other
// sample would halve that. Simulated here on the stored reads (every other sample kept; the pose model reads each
// sample alone in IMAGE mode, so the kept samples' landmarks are those a half-rate read gives, but for the crop retry
// and the backward pass, which look back up to 1 s): the core's count at 15 and at 7.5 samples a second, under the
// scoreboard's rule (exact not lower, none newly off by 3 or more, no known one grown, none newly refused).
import { test } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { ROOT, benchSets, countInWindow, labelledSets, publicSets, videoSets } from './sets';

const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());
const half = <T,>(a: T[]) => a.filter((_, i) => i % 2 === 0);

test.skipIf(!process.env.HALF_RATE)('half the sample rate: counts against the full rate', () => {
  const suites: Record<string, { name: string; lift: string; label: number; wl: any[]; ts: number[]; refused?: boolean; window?: [number, number] }[]> = {
    'David stored': labelledSets().sets.map(s => { const d = gz(resolve(ROOT, s.name)); return { name: s.name, lift: s.lift, label: s.label, wl: d.worldLandmarks, ts: d.timestamps }; }),
    'David video': videoSets().sets.map(s => ({ name: s.name, lift: s.lift, label: s.label, wl: s.wl, ts: s.ts, refused: s.appRefused })),
    'public build': publicSets('build').sets.map(s => { const d = gz(resolve(ROOT, s.name)); return { name: s.name, lift: s.lift, label: s.label, wl: d.worldLandmarks, ts: d.timestamps, window: s.window }; }),
    'RepCount-A build': benchSets('repcount', 'build').sets.filter(s => s.lift && liftDefinition(s.lift)).map(s => ({ name: s.name, lift: s.lift, label: s.label, wl: s.wl, ts: s.ts })),
  };
  const L: string[] = [];
  const read = (s: any, wl: any[], ts: number[]) => {
    if (s.refused) return 'refused';
    const c: any = summarizeCount(wl, ts, s.lift);
    return c.refused ? 'refused' : s.window ? countInWindow(c.reps, s.window) : c.count;
  };
  const err = (n: any, l: number) => (n === 'refused' ? Infinity : Math.abs(n - l));
  for (const [suite, sets] of Object.entries(suites)) {
    let e15 = 0, e7 = 0, newly3 = 0, grown = 0, newlyRefused = 0, bad15 = 0, bad7 = 0;
    const named: string[] = [];
    for (const s of sets) {
      const a = read(s, s.wl, s.ts), b = read(s, half(s.wl), half(s.ts));
      if (a === s.label) e15++;
      if (b === s.label) e7++;
      if (err(a, s.label) >= 3) bad15++;
      if (err(b, s.label) >= 3) bad7++;
      if (a !== 'refused' && b === 'refused') newlyRefused++;
      if (b !== 'refused' && err(b, s.label) >= 3) {
        if (a === 'refused' || err(a, s.label) < 3) newly3++;
        else if (err(b, s.label) > err(a, s.label)) grown++;
      }
      if (a !== b && named.length < 14) named.push(`${s.name.split('/').pop()!.slice(0, 40)} ${s.label}: ${a} -> ${b}`);
    }
    L.push(`${suite} (${sets.length}): exact ${e15} -> ${e7}; off by 3+ or refused ${bad15} -> ${bad7}; newly off by 3+ ${newly3}, grown ${grown}, newly refused ${newlyRefused}`);
    if (suite.startsWith('David')) L.push(`  ${named.join('; ')}`);
  }
  process.stdout.write(L.join('\n') + '\n');
}, 1_200_000);
