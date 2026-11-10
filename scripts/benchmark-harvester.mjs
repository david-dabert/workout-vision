/**
 * scripts/benchmark-harvester.mjs: Real Benchmark Evaluation Engine.
 * 
 * Executes the production counting pipeline on REAL pre-extracted MediaPipe
 * landmark streams (from benchmark/landmark-cache/ or benchmark/staging/).
 * Reports actual empirical accuracy, Mean Absolute Error (MAE), exact matches,
 * and off-by-one (OBO) metrics without any synthetic math or simulated curves.
 *
 * Usage:
 *   node scripts/benchmark-harvester.mjs
 *   node scripts/benchmark-harvester.mjs --cache benchmark/landmark-cache/landmark-cache-2026-09-22T2350.json
 */

import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CACHE_DIR = join(ROOT, 'benchmark', 'landmark-cache');

const args = process.argv.slice(2);
let cachePath = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--cache' && args[i + 1]) cachePath = args[i + 1];
}

if (!cachePath && existsSync(CACHE_DIR)) {
  const caches = readdirSync(CACHE_DIR)
    .filter(f => f.endsWith('.json') || f.endsWith('.json.gz'))
    .sort()
    .reverse();
  if (caches.length > 0) cachePath = join(CACHE_DIR, caches[0]);
}

if (!cachePath || !existsSync(cachePath)) {
  console.error('[Benchmark Harvester] Error: No real landmark cache file found in benchmark/landmark-cache/.');
  process.exit(1);
}

console.log(`[Benchmark Harvester] Executing real benchmark evaluation on: ${cachePath}`);

// Run the validated replay benchmark harness
const replayScript = join(ROOT, 'benchmark', 'replay-benchmark.mjs');
try {
  const output = execFileSync('node', [replayScript, '--cache', cachePath], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  console.log(output);
} catch (err) {
  console.error('[Benchmark Harvester] Replay execution failed:', err.message);
  process.exit(1);
}
