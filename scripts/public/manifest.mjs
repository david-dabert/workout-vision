#!/usr/bin/env node
// node scripts/public/manifest.mjs repcount <annotation.csv> <video folder> > repcount.json
// node scripts/public/manifest.mjs mmfit <MM-Fit folder> > mmfit.json
// Writes the manifest scripts/public/run-public.mjs reads; the sets left out, and why, go to stderr.
import { readFileSync } from 'node:fs';
import { parseRepCount, repCountManifest } from './repcount.mjs';
import { mmfitManifest } from './mmfit.mjs';

const [kind, a, b] = process.argv.slice(2);
const { sets, skipped } = kind === 'repcount' ? repCountManifest(parseRepCount(readFileSync(a, 'utf8')), { videoDir: b })
  : kind === 'mmfit' ? mmfitManifest(a) : (() => { console.error('usage: manifest.mjs (repcount <csv> <videos> | mmfit <folder>)'); process.exit(2); })();
for (const s of skipped) console.error(`left out: ${s}`);
console.error(`${sets.length} sets, ${skipped.length} left out.`);
// The sets left out go with the manifest, so the run records them (run-public.mjs, <dataset>/sets.json).
const dataset = kind;
const left = skipped.map(line => ({ dataset, id: line.split(':')[0].replace(/\.[^.]+$/, ''), reason: line.slice(line.indexOf(':') + 2) }));
process.stdout.write(JSON.stringify({ sets, skipped: left }, null, 2) + '\n');
