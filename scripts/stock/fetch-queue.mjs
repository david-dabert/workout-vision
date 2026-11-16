#!/usr/bin/env node
// node scripts/stock/fetch-queue.mjs [--out public/stock/queue.json]
// Searches the stock sources (sources.mjs) for every lift and adds what they return to the labelling queue, keeping
// every clip already queued unchanged. Wikimedia Commons needs no key; Pexels and Pixabay are searched only when
// PEXELS_API_KEY and PIXABAY_API_KEY are set (repository secrets in .github/workflows/stock-queue.yml). Prints, per
// source and lift, how many clips were found and kept, and names every request that failed: none is dropped quietly.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { commonsUrl, fromCommons, fromPexels, fromPixabay, mergeQueue, pexelsUrl, pixabayUrl, QUERIES } from './sources.mjs';

const args = process.argv.slice(2);
const OUT = resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : 'public/stock/queue.json');
const PEXELS = process.env.PEXELS_API_KEY || '', PIXABAY = process.env.PIXABAY_API_KEY || '';
// Wikimedia asks automated clients to name themselves (https://meta.wikimedia.org/wiki/User-Agent_policy).
const UA = 'WorkoutVisionLabelQueue/1.0 (https://github.com/david-dabert/workout-vision)';

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const queue = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')).clips ?? [] : [];
const before = queue.length;
let all = queue;
const failures = [];
const report = [];
for (const [lift, words] of Object.entries(QUERIES)) {
  for (const query of words) {
    const jobs = [['commons', () => getJson(commonsUrl(query)).then(j => fromCommons(j, lift, query))]];
    if (PEXELS) jobs.push(['pexels', () => getJson(pexelsUrl(query), { Authorization: PEXELS }).then(j => fromPexels(j, lift, query))]);
    if (PIXABAY) jobs.push(['pixabay', () => getJson(pixabayUrl(query, PIXABAY)).then(j => fromPixabay(j, lift, query))]);
    for (const [source, job] of jobs) {
      try {
        const items = await job();
        const n = all.length;
        all = mergeQueue(all, items);
        report.push(`${source} "${query}" (${lift}): ${items.length} found, ${all.length - n} new`);
      } catch (e) { failures.push(`${source} "${query}": ${e.message}`); }
    }
  }
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ note: 'Stock clips to count (label.html). Addresses, licences and authors only; the lift is a search guess the person labelling confirms.', clips: all }, null, 1)}\n`);
console.log(report.join('\n'));
console.log(`\nQueue: ${before} clips before, ${all.length} now (${all.length - before} new). Sources searched: commons${PEXELS ? ', pexels' : ''}${PIXABAY ? ', pixabay' : ''}.`);
if (!PEXELS) console.log('Pexels not searched: PEXELS_API_KEY is not set.');
if (!PIXABAY) console.log('Pixabay not searched: PIXABAY_API_KEY is not set.');
if (failures.length) { console.log(`\nFailed requests (${failures.length}):\n${failures.join('\n')}`); process.exitCode = all.length === before ? 1 : 0; }
