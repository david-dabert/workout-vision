// EDGES=1 npx vitest run test/real-phone/accuracy/edges-trace.test.ts
// Task of 15 October 2026 (count-edges): for every set the scoreboard counts wrong, the smoothed angle sample by
// sample against the core's own thresholds, and the reps it kept, so a miss can be placed on a rep, a sample and a
// threshold (test/real-phone/accuracy/edges-2026-10-15.md). Reads saved landmarks only; changes no parameter.
// Runs only when asked, so a plain npm test writes nothing.
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { labelledSets, videoSets } from './sets';

const asked = !!process.env.EDGES;

test.skipIf(!asked)('trace every miss', () => {
  const out: string[] = [];
  const all = [...labelledSets().sets.map(s => ({ ...s, kind: 'stored' })), ...videoSets().sets.map(s => ({ ...s, kind: 'video' }))];
  for (const s of all) {
    const r: any = summarizeCount(s.wl, s.ts, s.lift);
    const def = liftDefinition(s.lift)!;
    const count = r.refused ? 'refused' : r.count;
    if (count === s.label) continue;
    const lo = r.lowThreshold, hi = r.highThreshold, restHigh = def.rest === 'high';
    const zone = (x: number | null) => (x === null ? '.' : restHigh ? (x > hi ? 'R' : x <= lo ? 'W' : 'm') : (x < lo ? 'R' : x >= hi ? 'W' : 'm'));
    out.push(`=== ${s.kind} ${s.name}  lift ${s.lift} (rest ${def.rest})  label ${s.label}  count ${count}  arm ${r.arm}${r.sides ? ' (both sides)' : ''}`);
    out.push(`thresholds low ${lo.toFixed(1)} high ${hi.toFixed(1)}; ${s.ts.length} samples, ${s.ts[0].toFixed(2)}-${s.ts.at(-1)!.toFixed(2)} s`);
    out.push(`reps: ${r.reps.map((p: any, i: number) => `#${i + 1} ${p.startTime.toFixed(2)}-${p.endTime.toFixed(2)}${p.clipped ? ' (clipped)' : ''}`).join('  ')}`);
    const a: (number | null)[] = r.smoothedAngles;
    // One line per sample: index, time, raw, smoothed, zone (R rest side of the rest threshold, W past the working
    // threshold, m between), and the rep the sample falls in.
    const inRep = (t: number) => r.reps.findIndex((p: any) => t >= p.startTime - 1e-6 && t <= p.endTime + 1e-6);
    if (!r.sides) for (let i = 0; i < a.length; i++) {
      const k = inRep(s.ts[i]);
      out.push(`${String(i).padStart(4)} ${s.ts[i].toFixed(2).padStart(6)}  raw ${r.angles[i] === null ? '   -  ' : r.angles[i].toFixed(1).padStart(6)}  sm ${a[i] === null ? '   -  ' : a[i]!.toFixed(1).padStart(6)}  ${zone(a[i])}  ${k >= 0 ? `rep${k + 1}` : ''}`);
    }
    else for (const side of ['left', 'right'] as const) {
      const sd = r.sides[side];
      out.push(`-- side ${side}: thresholds low ${sd.lowThreshold.toFixed(1)} high ${sd.highThreshold.toFixed(1)}; reps ${sd.reps.map((p: any) => `${p.startTime.toFixed(2)}-${p.endTime.toFixed(2)}`).join(' ')}`);
    }
    out.push('');
  }
  writeFileSync(resolve(__dirname, 'edges-trace.txt'), out.join('\n') + '\n');
});
