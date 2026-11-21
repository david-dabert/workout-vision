// SQUAT_PROBE=1 (scratch): rep times against the Countix window on the squat sets shown as sure and off by 1.
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { countInWindow, publicSets } from '../accuracy/sets';
const NAMES = ['AfPkXoJM2sY_000004_0', 'DSdox52D3XY_000004_2970', 'QQPv17nfR_E_000003_0', 'VCPKdt3u1vs_000005_0', 'Wu3MSbqdrbU_000095_0', 'dptApZvEt5Y_000003_0', 'gV3dgCS0hWU_000009_0'];
test.skipIf(!process.env.SQUAT_PROBE)('edges', () => {
  const out: string[] = [];
  for (const s of publicSets('build').sets.filter(s => s.dataset === 'countix' && NAMES.some(n => s.name.includes(n)))) {
    const r: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
    out.push(`${s.name} label ${s.label} window ${JSON.stringify(s.window)} clip ${s.ts[0]?.toFixed?.(2)}..${s.ts[s.ts.length - 1]?.toFixed?.(2)} all ${r.reps.length} inWin ${countInWindow(r.reps, s.window)} reps ${r.reps.map((x: any) => `${x.startTime.toFixed(2)}-${x.endTime.toFixed(2)}`).join(' ')}`);
  }
  writeFileSync(__dirname + '/edges.txt', out.join('\n'));
}, 300000);
