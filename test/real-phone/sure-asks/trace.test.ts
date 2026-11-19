// Card 065's diagnosis: the smoothed angle and counted reps of one public build set (TRACE=<name>, TRACE_OUT=<file>). Bench only, decides nothing.
import { test } from 'vitest';
import { appendFileSync } from 'node:fs';
const log = (...a: any[]) => appendFileSync(process.env.TRACE_OUT!, a.join(' ') + '\n');
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { publicSets } from '../accuracy/sets';
const N = process.env.TRACE ?? '';
test.skipIf(!N)('trace', () => {
  for (const s of publicSets('build').sets.filter(s => s.dataset !== 'countix-whole' && s.name.includes(N))) {
    const r: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
    log('TS', s.ts[0], s.ts[1], s.ts.at(-1), 'window', JSON.stringify(s.window), 'keys', Object.keys(r).join(','));
    log('REPS', JSON.stringify(r.reps.map((p: any) => [p.startTime, p.endTime, p.peakAngle ?? p.rom ?? null])));
    const a = r.smoothedAngles ?? [];
    log('ANG', a.map((x: any) => x == null ? '.' : Math.round(x)).join(' '));
  }
});
