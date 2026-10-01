// ACCURACY=1 npx vitest run test/real-phone/accuracy/joint-range.test.ts
// The lift's own joint range (95th minus 5th percentile of the core's smoothed angle) on every labelled set
// and on the held batch of 1 October, to set the collector's mismatch warning (jointRange, core.ts).
import { test } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { jointRange, countReps, COUNTABLE_RANGE_DEG } from '../../../src/lib/counting/core';
import { expect } from 'vitest';
import { labelledSets, ROOT } from './sets';

test.skipIf(!process.env.ACCURACY)('joint range of each set\'s own lift', () => {
  // The collector's warning (under COUNTABLE_RANGE_DEG) must never stand beside a count: every set under it counts 0.
  const all: { wl: any[]; ts: number[]; lift: string }[] = [];
  const rows = labelledSets().sets.map(s => { all.push(s); return `${jointRange(s.wl, s.ts, s.lift).toFixed(0).padStart(4)}  ${s.name}  (${s.lift}, labelled ${s.label})`; });
  const held = resolve(ROOT, 'held-01oct');
  for (const f of readdirSync(held).filter(f => f.endsWith('.gz'))) {
    const d = JSON.parse(gunzipSync(readFileSync(resolve(held, f))).toString());
    all.push({ wl: d.worldLandmarks, ts: d.timestamps, lift: d.lift });
    rows.push(`${jointRange(d.worldLandmarks, d.timestamps, d.lift).toFixed(0).padStart(4)}  held-01oct/${f}  (${d.lift}, labelled ${d.count}; held)`);
  }
  for (const s of all) if (jointRange(s.wl, s.ts, s.lift) < COUNTABLE_RANGE_DEG) expect(countReps(s.wl, s.ts, s.lift).count).toBe(0);
  writeFileSync(resolve(__dirname, 'joint-range.txt'), ['Range of the lift\'s own joint, degrees (95th - 5th percentile of the smoothed angle).', ...rows].join('\n') + '\n');
}, 120_000);
