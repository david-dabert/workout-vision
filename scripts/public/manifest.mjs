#!/usr/bin/env node
// node scripts/public/manifest.mjs repcount <annotation.csv> <video folder> > repcount.json
// node scripts/public/manifest.mjs repcount-lance <rows.json> <video folder> > repcount.json  (rows from repcount-lance.py)
// node scripts/public/manifest.mjs mmfit <MM-Fit folder> > mmfit.json
// node scripts/public/manifest.mjs countix <countix_train.csv,countix_val.csv> <video folder> > countix.json
// Writes the manifest scripts/public/run-public.mjs reads; the sets left out, and why, go to stderr.
import { existsSync, readFileSync } from 'node:fs';
import { parseRepCount, repCountLanceManifest, repCountManifest } from './repcount.mjs';
import { mmfitManifest } from './mmfit.mjs';
import { countixManifest, parseCountix } from './countix.mjs';

const [kind, a, b] = process.argv.slice(2);
// The Countix clips already used to build and gate the counter (benchmark/manifest.json).
function benchmarkIds() {
  const file = new URL('../../benchmark/manifest.json', import.meta.url);
  return existsSync(file) ? new Set(JSON.parse(readFileSync(file, 'utf8')).videos.map(v => v.video_id).filter(Boolean)) : new Set();
}
const { sets, skipped } = kind === 'repcount-lance' ? repCountLanceManifest(JSON.parse(readFileSync(a, 'utf8')), { videoDir: b })
  : kind === 'repcount' ? repCountManifest(parseRepCount(readFileSync(a, 'utf8')), { videoDir: b })
  : kind === 'countix' || kind === 'countix-whole' ? countixManifest(a.split(',').flatMap(f => parseCountix(readFileSync(f, 'utf8'))), { videoDir: b, seen: benchmarkIds(), whole: kind === 'countix-whole' })
  : kind === 'mmfit' ? mmfitManifest(a) : (() => { console.error('usage: manifest.mjs (repcount <csv> <videos> | mmfit <folder> | countix | countix-whole <csv,csv> <videos>)'); process.exit(2); })();
for (const s of skipped) console.error(`left out: ${typeof s === 'string' ? s : `${s.id}: ${s.reason}`}`);
console.error(`${sets.length} sets, ${skipped.length} left out.`);
// The sets left out go with the manifest, so the run records them (run-public.mjs, <dataset>/sets.json).
const dataset = kind === 'repcount-lance' ? 'repcount' : kind;
const left = skipped.map(s => (typeof s === 'string' ? { dataset, id: s.split(':')[0].replace(/\.[^.]+$/, ''), reason: s.slice(s.indexOf(':') + 2) } : s));
process.stdout.write(JSON.stringify({ sets, skipped: left }, null, 2) + '\n');
