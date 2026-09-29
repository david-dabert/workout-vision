/**
 * Every committed clip counted under every lift in LIFTS: count, side and each rep's start, end and
 * range. Written to the file named by CLIP_COUNTS_OUT, so the counts before and after a change to
 * the core can be compared line by line. Run:
 *   CLIP_COUNTS_OUT=… npx vitest run test/real-phone/step2/clip-counts.test.ts
 */
import { it } from 'vitest';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { countReps, LIFTS, type Lift } from '../../../src/lib/counting/core';

it('counts every clip under every lift', () => {
  const dir = resolve(__dirname, '../landmarks');
  const out: string[] = [];
  for (const file of readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort()) {
    const data = JSON.parse(gunzipSync(readFileSync(resolve(dir, file))).toString());
    for (const lift of Object.keys(LIFTS).sort() as Lift[]) {
      const r = countReps(data.worldLandmarks, data.timestamps, lift);
      const reps = r.reps.map(p => `${p.startTime.toFixed(3)}-${p.endTime.toFixed(3)}:${p.romDegrees.toFixed(2)}`).join(' ');
      out.push(`${file} ${lift} count=${r.count} arm=${r.arm} ${reps}`);
    }
  }
  writeFileSync(process.env.CLIP_COUNTS_OUT || '/dev/null', out.join('\n') + '\n');
});
