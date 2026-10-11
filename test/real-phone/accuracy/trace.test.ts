// npx vitest run test/real-phone/accuracy/trace.test.ts  (TRACE=<dir/file> to choose the set)
// One set's raw and smoothed angle, every 2nd sample, with its thresholds and counted reps.
import { test } from 'vitest';

// Runs only when asked (ACCURACY=1), so a plain npm test rewrites no evidence file.
const asked = !!process.env.ACCURACY;
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { countReps } from '../../../src/lib/counting/core';

test.skipIf(!asked)('trace', () => {
  const f = process.env.TRACE || 'sets-29sep/bench_press_7_side_24cc4f0b.json.gz';
  const d = JSON.parse(gunzipSync(readFileSync(resolve(__dirname, '..', f))).toString());
  const lift = d.lift || f.split('/').pop()!.match(/^(.+?)_\d+_/)![1];
  const r = countReps(d.worldLandmarks, d.timestamps, lift);
  const lines = [`${f} low ${r.lowThreshold.toFixed(0)} high ${r.highThreshold.toFixed(0)} count ${r.count}`];
  for (let i = 0; i < d.timestamps.length; i += 2) {
    const s = r.smoothedAngles[i], raw = r.angles[i];
    const bar = s === null ? '' : ' '.repeat(Math.max(0, Math.round((s - 50) / 2))) + '|';
    lines.push(`${d.timestamps[i].toFixed(2).padStart(6)} raw ${raw === null ? '  -' : String(Math.round(raw)).padStart(3)} sm ${s === null ? '  -' : String(Math.round(s)).padStart(3)} ${bar}`);
  }
  process.stdout.write(lines.join('\n') + '\n');
});
