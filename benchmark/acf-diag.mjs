#!/usr/bin/env node
/**
 * ACF peak diagnostic for sub-oscillation analysis.
 * Uses same bootstrap as replay-benchmark.mjs.
 * Dumps RepCounter's actual _debugSignal ACF peaks for overcounting exercises.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gunzipSync } from 'zlib';
import module from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, 'landmark-cache');

// Find cache
let cachePath = null;
if (existsSync(CACHE_DIR)) {
  const jsonFiles = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json') && !f.endsWith('.json.gz')).sort().reverse();
  const gzFiles = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json.gz')).sort().reverse();
  if (jsonFiles.length > 0) cachePath = join(CACHE_DIR, jsonFiles[0]);
  else if (gzFiles.length > 0) cachePath = join(CACHE_DIR, gzFiles[0]);
}
if (!cachePath) { console.error('No cache found'); process.exit(1); }

// Load cache
const rawCache = cachePath.endsWith('.gz')
  ? gunzipSync(readFileSync(cachePath)).toString('utf-8')
  : readFileSync(cachePath, 'utf-8');
const cache = JSON.parse(rawCache);

// Module hooks (same as replay-benchmark.mjs)
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

// Patch exercises.js
const exercisesPath = join(__dirname, '..', 'src', 'lib', 'exercises.js');
const exercisesOriginal = readFileSync(exercisesPath, 'utf-8');
const exercisesPatched = exercisesOriginal.replace(/import\.meta\.env\.BASE_URL/g, "'/'");
if (exercisesPatched !== exercisesOriginal) writeFileSync(exercisesPath, exercisesPatched);

// Shim fetch
const exercisesJsonPath = join(__dirname, '..', 'public', 'data', 'exercises.json');
const exercisesJsonContent = readFileSync(exercisesJsonPath, 'utf-8');
globalThis.fetch = async (url) => {
  if (typeof url === 'string' && url.includes('exercises.json'))
    return { ok: true, json: async () => JSON.parse(exercisesJsonContent) };
  throw new Error(`fetch: ${url}`);
};

const { RepCounter } = await import('../src/lib/repCounter/index.js');
const { getAllACFPeaks } = await import('../src/lib/repCounter/periodCounter.ts');
const { getRepPeriodBounds } = await import('../src/lib/analysisConfig.ts');
const { initExercises } = await import('../src/lib/exercises.js');
await initExercises();

// Restore exercises.js
writeFileSync(exercisesPath, exercisesOriginal);

// ── Inline ACF for extended range analysis ──
function computeACF(signal, minLag, maxLag) {
  const N = signal.length;
  let mean = 0;
  for (let i = 0; i < N; i++) mean += signal[i];
  mean /= N;
  let variance = 0;
  for (let i = 0; i < N; i++) variance += (signal[i] - mean) ** 2;
  variance /= N;
  if (variance < 1e-8) return [];
  const acf = new Array(maxLag + 1).fill(0);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let t = 0; t < N - lag; t++) {
      corr += (signal[t] - mean) * (signal[t + lag] - mean);
    }
    acf[lag] = corr / ((N - lag) * variance);
  }
  return acf;
}

function findPeaks(acf, minLag, maxLag, threshold) {
  const peaks = [];
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (acf[lag] >= threshold && acf[lag] >= acf[lag - 1] && acf[lag] >= acf[lag + 1]) {
      peaks.push({ lag, height: acf[lag] });
    }
  }
  return peaks;
}

// Target exercises
const targets = [
  // Overcounting (sub-oscillation suspects):
  'bent_over_row_cu7XrWm0BUc_5reps',
  'upright_row_aYLFVUgcuik_6reps',
  'leg_curl_AKL-p4U5HH0_5reps',
  'leg_press_YpYaaXGw3DA_8reps',
  'dumbbell_fly_u7qKtYIgsUY_5reps',
  'glute_bridge_Tj_4iwy9EbI_5reps',
  'lying_bicep_curl_tMEGqKuOa-M_5reps',
  'bent_over_row_6gvmcqr226U_5reps',
  // Controls (correct or near-correct):
  'battle_rope_bvlg9_Di1vI_14reps',
  'battle_rope_k3OYki3qGs0_9reps',
  'lunge_SQ_4MVrxuH8_9reps',
  'bicep_curl_N2UWMqGMDcs_5reps',
  'squat_D_0MYx9k8Qk_5reps',
  'front_raise_gGEDGKZh0r4_5reps',
  'push_up_E0p8QDRa0Fg_8reps',
  'glute_bridge_Xp33YgPZgns_6reps',
  'upright_row_Ub6QruNKfbY_5reps',
  'lying_bicep_curl_Q7RyGuOAFKM_8reps',
];

console.log('\n=== ACF PEAK LANDSCAPE ON RepCounter\'s ACTUAL SIGNAL ===\n');
console.log('Legend: >>> = overcounting (reps > 1.4 × expected)');
console.log('        T = ACF peak near mean valley interval');
console.log('        2T = ACF peak near double the mean valley interval');
console.log('        r = 2T_height / T_height (key discriminator candidate)\n');

for (const t of targets) {
  const entry = cache.find(e => e.video && e.video.includes(t));
  if (!entry) { console.log(t + ': NOT FOUND'); continue; }

  const rc = new RepCounter(entry.exercise, { fps: entry.fps, mode: 'video' });
  for (const lm of entry.landmarks) rc.update(lm, 0);
  rc.finalize();

  const signal = rc._debugSignal;
  if (!signal) { console.log(t + ': no debug signal'); continue; }

  const diag = rc.diagnostics;
  const method = diag.method || '';
  const cycles = diag.cycles?.cycles || [];
  const vFrames = cycles.map(c => c.start);
  const intervals = [];
  for (let i = 1; i < vFrames.length; i++) intervals.push(vFrames[i] - vFrames[i-1]);
  const meanInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;

  // Get ACF peaks from the physiological band
  const bounds = getRepPeriodBounds(entry.exercise);
  const allPeaks = getAllACFPeaks(signal, entry.fps, bounds.min, bounds.max);

  // Also compute ACF over EXTENDED range (up to N/2) to see full harmonic structure
  const N = signal.length;
  const extMinLag = Math.max(3, Math.round(entry.fps * bounds.min));
  const extMaxLag = Math.min(Math.floor(N / 2), Math.round(entry.fps * 8)); // up to 8 seconds
  const extAcf = computeACF(signal, extMinLag, extMaxLag);
  const extPeaks = findPeaks(extAcf, extMinLag, extMaxLag, 0.08)
    .sort((a, b) => b.height - a.height);

  // Find T and 2T peaks relative to valley mean interval
  const tol = Math.max(2, Math.round(meanInterval * 0.25));
  const tPeak = allPeaks.find(p => Math.abs(p.lag - meanInterval) <= tol);
  const doubleLag = meanInterval * 2;
  const dTol = Math.max(3, Math.round(doubleLag * 0.2));
  const twoPeak = extPeaks.find(p => Math.abs(p.lag - doubleLag) <= dTol);

  const ratio = (tPeak && twoPeak) ? (twoPeak.height / tPeak.height).toFixed(3) : 'N/A';
  const shouldHalve = rc.reps > entry.expected * 1.4;

  console.log(
    (shouldHalve ? '>>> ' : '    ') +
    t.substring(0,45).padEnd(47),
    'reps=' + String(rc.reps).padStart(2) + '/' + entry.expected,
    method.padEnd(28),
    'N=' + String(signal.length).padStart(3),
    'mInt=' + meanInterval.toFixed(1).padStart(5)
  );

  console.log(
    '     T_peak:  ' + (tPeak ? `lag=${tPeak.lag} (${(tPeak.lag/entry.fps).toFixed(2)}s) h=${tPeak.height.toFixed(4)}` : 'NONE')
  );
  console.log(
    '     2T_peak: ' + (twoPeak ? `lag=${twoPeak.lag} (${(twoPeak.lag/entry.fps).toFixed(2)}s) h=${twoPeak.height.toFixed(4)}` : 'NONE')
  );
  console.log(
    '     ratio 2T/T: ' + ratio
  );
  console.log(
    '     physio-band peaks: [' + allPeaks.slice(0, 6).map(p => `${p.lag}@${p.height.toFixed(3)}`).join(', ') + ']'
  );
  console.log(
    '     extended peaks:    [' + extPeaks.slice(0, 8).map(p => `${p.lag}@${p.height.toFixed(3)}`).join(', ') + ']'
  );

  // Valley interval analysis
  if (intervals.length >= 4) {
    const oddI = intervals.filter((_,k) => k % 2 === 0);
    const evenI = intervals.filter((_,k) => k % 2 === 1);
    const oddMean = oddI.reduce((a,b)=>a+b,0)/oddI.length;
    const evenMean = evenI.reduce((a,b)=>a+b,0)/evenI.length;
    const cvAll = (() => {
      const m = meanInterval;
      const std = Math.sqrt(intervals.reduce((a,v) => a + (v-m)**2, 0) / intervals.length);
      return std / m;
    })();
    console.log(
      '     intervals: [' + intervals.join(', ') + ']',
      'CV=' + cvAll.toFixed(3),
      'odd_mean=' + oddMean.toFixed(1),
      'even_mean=' + evenMean.toFixed(1),
      'ratio=' + (Math.max(oddMean,evenMean) / Math.max(Math.min(oddMean,evenMean), 0.1)).toFixed(2)
    );
  }

  console.log('');
}
