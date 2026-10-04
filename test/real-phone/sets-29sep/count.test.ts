// ACCURACY=1 npx vitest run test/real-phone/sets-29sep/count.test.ts
// David's sets of 29 September, collected on his iPhone: the app's count and refusal, with the current
// code, against his count. Prints one line per set and asserts nothing, so it runs only when asked; the gate
// on these sets is npm run scoreboard (test/real-phone/accuracy/scoreboard.txt), third audit, C32.
import { test } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';

test.skipIf(!process.env.ACCURACY)('count the sets', () => {
  const dir = resolve(__dirname);
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort()) {
    const d = JSON.parse(gunzipSync(readFileSync(resolve(dir, f))).toString());
    const r = summarizeCount(d.worldLandmarks, d.timestamps, d.lift);
    const shown = r.refused ? 'refused' : String(r.count);
    const verdict = r.refused ? 'REFUSED' : r.count === d.count ? 'exact' : `off by ${r.count - d.count}`;
    process.stdout.write(`${f}  David ${d.count}  app ${shown}  ${verdict}  (${d.timestamps.length} samples, ${d.metadata.extractionMethod}, arm ${r.arm})\n`);
  }
});
