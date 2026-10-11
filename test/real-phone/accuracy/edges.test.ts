// npx vitest run test/real-phone/accuracy/edges.test.ts
// The first and last 3 s of each labelled set's smoothed angle, every 4th sample, against its
// thresholds: what the edges of a set actually do (accuracy work, 30 September).
import { test } from 'vitest';

// Runs only when asked (ACCURACY=1), so a plain npm test rewrites no evidence file.
const asked = !!process.env.ACCURACY;
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { countReps } from '../../../src/lib/counting/core';
import { labelledSets } from './sets';

test.skipIf(!asked)('edges', () => {
  const out: string[] = [];
  for (const { name, lift, wl, ts } of labelledSets().sets) {
    const r = countReps(wl, ts, lift);
    const a = r.smoothedAngles, n = ts.length;
    const row = (from: number, to: number) => a.slice(from, to).map((x, k) => (k % 4 ? null : `${ts[from + k].toFixed(1)}:${x === null ? '-' : Math.round(x)}`)).filter(Boolean).join(' ');
    const head = ts.findIndex(t => t > 3), tail = ts.findIndex(t => t > ts[n - 1] - 3);
    out.push(`${name}  low ${r.lowThreshold.toFixed(0)} high ${r.highThreshold.toFixed(0)}`);
    out.push(`  start: ${row(0, head)}`);
    out.push(`  end:   ${row(tail, n)}`);
  }
  writeFileSync(resolve(__dirname, 'edges.txt'), out.join('\n') + '\n');
  process.stdout.write(out.join('\n') + '\n');
});
