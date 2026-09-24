#!/usr/bin/env node
/**
 * ACF + candidate diagnostic for sub-oscillation analysis.
 * Dumps adaptive selection candidates for overcounting exercises
 * to see if ANY alternative signal finds the correct (halved) count.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gunzipSync } from 'zlib';
import module from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, 'landmark-cache');

let cachePath = null;
if (existsSync(CACHE_DIR)) {
  const jsonFiles = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json') && !f.endsWith('.json.gz')).sort().reverse();
  if (jsonFiles.length > 0) cachePath = join(CACHE_DIR, jsonFiles[0]);
}
if (!cachePath) { console.error('No cache found'); process.exit(1); }

const rawCache = cachePath.endsWith('.gz')
  ? gunzipSync(readFileSync(cachePath)).toString('utf-8')
  : readFileSync(cachePath, 'utf-8');
const cache = JSON.parse(rawCache);

const shimUrl = new URL('../src/lib/_node_shim_poseAnalysis.mjs', import.meta.url).href;

if (module.registerHooks) {
  module.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.endsWith('/poseAnalysis') || specifier === './poseAnalysis') {
        return { shortCircuit: true, url: shimUrl };
      }
      if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.split('/').pop().includes('.')) {
        try { return nextResolve(specifier + '.ts', context); } catch {}
        try { return nextResolve(specifier + '.js', context); } catch {}
        try { return nextResolve(specifier + '/index.ts', context); } catch {}
        return nextResolve(specifier + '/index.js', context);
      }
      if (specifier.endsWith('.js')) {
        try { return nextResolve(specifier, context); } catch {}
        return nextResolve(specifier.replace(/\.js$/, '.ts'), context);
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      const result = nextLoad(url, context);
      if (result.source != null) {
        const src = typeof result.source === 'string' ? result.source : result.source.toString();
        if (src.includes('import.meta.env')) {
          let patched = src.replace(/import\.meta\.env\.BASE_URL/g, "'/'");
          patched = patched.replace(/import\.meta\.env/g, '({})');
          result.source = patched;
        }
      }
      return result;
    },
  });
}

const exercisesPath = join(__dirname, '..', 'src', 'lib', 'exercises.js');
const exercisesOriginal = readFileSync(exercisesPath, 'utf-8');
const exercisesPatched = exercisesOriginal.replace(/import\.meta\.env\.BASE_URL/g, "'/'");
if (exercisesPatched !== exercisesOriginal) writeFileSync(exercisesPath, exercisesPatched);

const exercisesJsonPath = join(__dirname, '..', 'public', 'data', 'exercises.json');
const exercisesJsonContent = readFileSync(exercisesJsonPath, 'utf-8');
globalThis.fetch = async (url) => {
  if (typeof url === 'string' && url.includes('exercises.json'))
    return { ok: true, json: async () => JSON.parse(exercisesJsonContent) };
  throw new Error(`fetch: ${url}`);
};

const { RepCounter } = await import('../src/lib/repCounter/index.js');
const { initExercises } = await import('../src/lib/exercises.js');
await initExercises();

writeFileSync(exercisesPath, exercisesOriginal);

const targets = [
  'bent_over_row_cu7XrWm0BUc_5reps',
  'upright_row_aYLFVUgcuik_6reps',
  'leg_curl_AKL-p4U5HH0_5reps',
  'leg_press_YpYaaXGw3DA_8reps',
  'dumbbell_fly_u7qKtYIgsUY_5reps',
  'glute_bridge_Tj_4iwy9EbI_5reps',
  'lying_bicep_curl_tMEGqKuOa-M_5reps',
  'bent_over_row_6gvmcqr226U_5reps',
];

console.log('\n=== ADAPTIVE SELECTION CANDIDATES FOR OVERCOUNTING EXERCISES ===\n');

for (const t of targets) {
  const entry = cache.find(e => e.video && e.video.includes(t));
  if (!entry) { console.log(t + ': NOT FOUND'); continue; }

  const rc = new RepCounter(entry.exercise, { fps: entry.fps, mode: 'video' });
  for (const lm of entry.landmarks) rc.update(lm, 0);
  rc.finalize();

  const diag = rc.diagnostics || {};
  const method = diag.method || '';
  const adaptiveDiag = rc._adaptiveDiag || [];

  console.log(`\n─── ${t} (reps=${rc.reps}/${entry.expected}, method=${method}) ───`);

  // Sort candidates by score descending
  const sorted = [...adaptiveDiag].sort((a, b) => b.score - a.score);

  // Group by rep count
  const repGroups = {};
  for (const c of sorted) {
    if (!repGroups[c.reps]) repGroups[c.reps] = [];
    repGroups[c.reps].push(c);
  }

  // Show rep count distribution
  const repCounts = Object.keys(repGroups).map(Number).sort((a, b) => a - b);
  console.log('  Rep count distribution:');
  for (const r of repCounts) {
    const group = repGroups[r];
    const signals = group.map(c => `${c.name}(s=${c.score.toFixed(1)},c=${c.consistency.toFixed(3)})`).join(', ');
    const isHalf = Math.abs(r - rc.reps / 2) <= 1;
    const isExpected = Math.abs(r - entry.expected) <= 1;
    const marker = isExpected ? ' ← EXPECTED' : (isHalf ? ' ← HALF' : '');
    console.log(`    reps=${r}: ${group.length} signals${marker}`);
    // Show up to 3 signals per group
    for (const c of group.slice(0, 3)) {
      console.log(`      ${c.name} score=${c.score.toFixed(2)} cons=${c.consistency.toFixed(3)}`);
    }
    if (group.length > 3) console.log(`      ... and ${group.length - 3} more`);
  }

  // Show top 10 candidates
  console.log('  Top 10 candidates:');
  for (const c of sorted.slice(0, 10)) {
    console.log(`    ${c.name.padEnd(26)} reps=${String(c.reps).padStart(2)} score=${c.score.toFixed(2).padStart(6)} cons=${c.consistency.toFixed(3)}`);
  }

  // Check: does the period counter disagree?
  const periodResult = diag.period;
  if (periodResult) {
    console.log(`  Period counter: reps=${periodResult.reps} period=${periodResult.periodFrames}f (${periodResult.periodSeconds?.toFixed(2)}s) acf=${periodResult.autocorrPeak?.toFixed(3)}`);
  }

  // Check: winner vs half-winner count
  const halfCount = Math.round(rc.reps / 2);
  const halfGroup = repGroups[halfCount] || [];
  if (halfGroup.length > 0) {
    const bestHalf = halfGroup.reduce((a, b) => a.score > b.score ? a : b);
    console.log(`  Half-count (${halfCount}): ${halfGroup.length} signals, best=${bestHalf.name} score=${bestHalf.score.toFixed(2)} cons=${bestHalf.consistency.toFixed(3)}`);
  } else {
    console.log(`  Half-count (${halfCount}): NO signals found this count`);
  }
}
