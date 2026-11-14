// REREAD=<folder written by run-public.mjs with WV_PUBLIC_OUT> npx vitest run --no-cache test/real-phone/public-reread/reread.test.ts
// The stored public reads against the same videos read again through today's pose path (review board item 4, 14 November
// 2026; TRIED.md, 10 October: the stored Countix reads date from 30 September). Build half only. Each file is scored as
// the public scoreboard scores it: the live core (summarizeCount) on the landmarks, counted inside the labelled window
// (countInWindow). Sets present in both folders are paired; a set in one only is listed. Writes reread.txt beside this
// file. A benchmark, not a gate; it moves no baseline (R13).
import { expect, test } from 'vitest';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { countInWindow, PUBLIC } from '../accuracy/sets';
import { pairedLine } from '../accuracy/paired';

const DIR = process.env.REREAD;
const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());
const score = (d: any) => {
  if (d.admitted === false) return 'not admitted';
  const r = summarizeCount(d.worldLandmarks, d.timestamps, d.lift, undefined, d.imageLandmarks ?? d.imageXY ?? undefined);
  return r.refused ? 'refused' : countInWindow(r.reps, d.window);
};
const off = (c: any, l: number) => (typeof c === 'number' ? Math.abs(c - l) : Infinity);

test.skipIf(!DIR)('stored public reads against a re-read', () => {
  const out: string[] = [`Public re-read ${new Date().toISOString().slice(0, 10)}: stored reads (test/real-phone/public) against the same videos read again (REREAD), build half, live core.`];
  for (const ds of readdirSync(DIR!).filter(d => existsSync(resolve(DIR!, d, 'build'))).sort()) {
    const nf = readdirSync(resolve(DIR!, ds, 'build')).filter(f => f.endsWith('.json.gz'));
    const of = existsSync(resolve(PUBLIC, ds, 'build')) ? readdirSync(resolve(PUBLIC, ds, 'build')).filter(f => f.endsWith('.json.gz')) : [];
    const both = nf.filter(f => of.includes(f)).sort();
    const rows: string[] = [], pairs: { before: boolean; now: boolean }[] = [];
    let exO = 0, exN = 0, b3O = 0, b3N = 0, moved = 0, samplesO = 0, samplesN = 0;
    for (const f of both) {
      const o = gz(resolve(PUBLIC, ds, 'build', f)), n = gz(resolve(DIR!, ds, 'build', f));
      const so = score(o), sn = score(n), l = o.count;
      if (so === 'not admitted' || sn === 'not admitted') { rows.push(`  ${f}  admitted before ${o.admitted !== false}, now ${n.admitted !== false}`); continue; }
      samplesO += o.timestamps.length; samplesN += n.timestamps.length;
      if (off(so, l) === 0) exO++; if (off(sn, l) === 0) exN++;
      if (off(so, l) >= 3) b3O++; if (off(sn, l) >= 3) b3N++;
      pairs.push({ before: off(so, l) === 0, now: off(sn, l) === 0 });
      if (so !== sn) { moved++; rows.push(`  ${f}  label ${l}  stored ${so}  re-read ${sn}  samples ${o.timestamps.length} -> ${n.timestamps.length}`); }
    }
    out.push('', `${ds}: ${both.length} sets in both (${of.length} stored, ${nf.length} re-read); scored ${pairs.length}; counts moved ${moved}.`,
      `  exact ${exO} -> ${exN}; off by 3 or more (refused included) ${b3O} -> ${b3N}; samples ${samplesO} -> ${samplesN}.`,
      `  ${pairedLine(pairs, 'one row per file')}`,
      `  stored only: ${of.filter(f => !nf.includes(f)).length}; re-read only: ${nf.filter(f => !of.includes(f)).length}.`, ...rows);
  }
  writeFileSync(resolve(__dirname, 'reread.txt'), out.join('\n') + '\n');
  process.stdout.write(out.join('\n') + '\n');
  expect(out.length).toBeGreaterThan(1);
}, 1_800_000);
