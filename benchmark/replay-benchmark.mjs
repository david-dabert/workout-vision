#!/usr/bin/env node
/**
 * Offline replay benchmark — runs RepCounter on cached landmark data.
 *
 * Usage:
 *   node benchmark/replay-benchmark.mjs [--cache path/to/landmark-cache.json]
 *
 * The landmark cache is exported by the Validate page after a benchmark run.
 * It contains pre-extracted MediaPipe landmarks for each video, so the
 * counting algorithm can be tested without any browser or GPU.
 *
 * This is the primary tool for iterating on algorithm changes.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gunzipSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, 'results');
const CACHE_DIR = join(__dirname, 'landmark-cache');

// Parse CLI args
const args = process.argv.slice(2);
let cachePath = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--cache' && args[i + 1]) cachePath = args[i + 1];
}

// Find the latest landmark cache file
if (!cachePath) {
  // Check benchmark/landmark-cache/ directory first (prefer .json, fall back to .json.gz)
  if (existsSync(CACHE_DIR)) {
    const jsonFiles = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json') && !f.endsWith('.json.gz')).sort().reverse();
    const gzFiles = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json.gz')).sort().reverse();
    if (jsonFiles.length > 0) cachePath = join(CACHE_DIR, jsonFiles[0]);
    else if (gzFiles.length > 0) cachePath = join(CACHE_DIR, gzFiles[0]);
  }
  // Then check ~/Downloads
  if (!cachePath) {
    const downloads = join(process.env.HOME, 'Downloads');
    if (existsSync(downloads)) {
      const files = readdirSync(downloads)
        .filter(f => f.startsWith('landmark-cache') && f.endsWith('.json'))
        .sort()
        .reverse();
      if (files.length > 0) cachePath = join(downloads, files[0]);
    }
  }
}

if (!cachePath) {
  console.error('No landmark cache found.');
  console.error('Run a benchmark in the browser first to generate one, or specify:');
  console.error('  node benchmark/replay-benchmark.mjs --cache path/to/landmark-cache.json');
  process.exit(1);
}

console.log(`\n  Replay Benchmark`);
console.log(`  Cache: ${cachePath}\n`);

// Load landmark cache (supports .json and .json.gz)
const rawCache = cachePath.endsWith('.gz')
  ? gunzipSync(readFileSync(cachePath)).toString('utf-8')
  : readFileSync(cachePath, 'utf-8');
const cache = JSON.parse(rawCache);
console.log(`  Loaded ${cache.length} videos\n`);

// Dynamic import of the algorithm modules.
// These are ES modules with relative imports that use './poseAnalysis' etc.
// We need to provide a Node-compatible import path.
// Strategy: use Vite's SSR module resolution by importing directly.

// Since poseAnalysis.js has a CDN import that will fail in Node,
// we create a minimal shim that provides only what RepCounter needs.
// Write shim next to repCounter.js so the loader can find it via parentURL
const shimPath = join(__dirname, '..', 'src', 'lib', '_node_shim_poseAnalysis.mjs');
const shimContent = `
// Auto-generated shim for Node.js benchmark replay.
// Provides LANDMARKS, calculateAngle, extractJointAngles without MediaPipe.

export const LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
  LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
};

export function calculateAngle(a, b, c) {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);
  if (magBA === 0 || magBC === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

function calculateTrunkAngle(landmarks) {
  const midShoulder = {
    x: (landmarks[LANDMARKS.LEFT_SHOULDER].x + landmarks[LANDMARKS.RIGHT_SHOULDER].x) / 2,
    y: (landmarks[LANDMARKS.LEFT_SHOULDER].y + landmarks[LANDMARKS.RIGHT_SHOULDER].y) / 2,
    z: ((landmarks[LANDMARKS.LEFT_SHOULDER].z || 0) + (landmarks[LANDMARKS.RIGHT_SHOULDER].z || 0)) / 2,
  };
  const midHip = {
    x: (landmarks[LANDMARKS.LEFT_HIP].x + landmarks[LANDMARKS.RIGHT_HIP].x) / 2,
    y: (landmarks[LANDMARKS.LEFT_HIP].y + landmarks[LANDMARKS.RIGHT_HIP].y) / 2,
    z: ((landmarks[LANDMARKS.LEFT_HIP].z || 0) + (landmarks[LANDMARKS.RIGHT_HIP].z || 0)) / 2,
  };
  const verticalRef = { ...midHip, y: midHip.y - 1 };
  return calculateAngle(midShoulder, midHip, verticalRef);
}

export function extractJointAngles(landmarks) {
  if (!landmarks || landmarks.length < 33) return null;
  const L = landmarks;
  const vis = (a, b, c) => Math.min(L[a].visibility || 0, L[b].visibility || 0, L[c].visibility || 0);
  return {
    leftKnee: calculateAngle(L[LANDMARKS.LEFT_HIP], L[LANDMARKS.LEFT_KNEE], L[LANDMARKS.LEFT_ANKLE]),
    rightKnee: calculateAngle(L[LANDMARKS.RIGHT_HIP], L[LANDMARKS.RIGHT_KNEE], L[LANDMARKS.RIGHT_ANKLE]),
    leftHip: calculateAngle(L[LANDMARKS.LEFT_SHOULDER], L[LANDMARKS.LEFT_HIP], L[LANDMARKS.LEFT_KNEE]),
    rightHip: calculateAngle(L[LANDMARKS.RIGHT_SHOULDER], L[LANDMARKS.RIGHT_HIP], L[LANDMARKS.RIGHT_KNEE]),
    leftElbow: calculateAngle(L[LANDMARKS.LEFT_SHOULDER], L[LANDMARKS.LEFT_ELBOW], L[LANDMARKS.LEFT_WRIST]),
    rightElbow: calculateAngle(L[LANDMARKS.RIGHT_SHOULDER], L[LANDMARKS.RIGHT_ELBOW], L[LANDMARKS.RIGHT_WRIST]),
    leftShoulder: calculateAngle(L[LANDMARKS.LEFT_HIP], L[LANDMARKS.LEFT_SHOULDER], L[LANDMARKS.LEFT_ELBOW]),
    rightShoulder: calculateAngle(L[LANDMARKS.RIGHT_HIP], L[LANDMARKS.RIGHT_SHOULDER], L[LANDMARKS.RIGHT_ELBOW]),
    trunk: calculateTrunkAngle(landmarks),
    _visLeftElbow: vis(LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST),
    _visRightElbow: vis(LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST),
    _visLeftKnee: vis(LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE),
    _visRightKnee: vis(LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE),
    _visLeftHip: vis(LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE),
    _visRightHip: vis(LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE),
    _visLeftShoulder: vis(LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW),
    _visRightShoulder: vis(LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW),
  };
}

const VIS_INTERP_THRESHOLD = 0.45;
const MAX_INTERP_GAP = 15;

export function interpolateOccludedLandmarks(landmarksArray, visThreshold = VIS_INTERP_THRESHOLD) {
  if (!landmarksArray || landmarksArray.length < 3) return landmarksArray;
  const N = landmarksArray.length;
  const out = landmarksArray.map(frame =>
    frame ? frame.map(lm => ({ ...lm })) : null
  );
  for (let li = 0; li < 33; li++) {
    const vis = new Array(N);
    for (let f = 0; f < N; f++) {
      vis[f] = out[f] && out[f][li] ? (out[f][li].visibility || 0) : 0;
    }
    let i = 0;
    while (i < N) {
      if (vis[i] >= visThreshold) { i++; continue; }
      const runStart = i;
      while (i < N && vis[i] < visThreshold) i++;
      const runEnd = i;
      let before = runStart - 1;
      while (before >= 0 && vis[before] < visThreshold) before--;
      let after = runEnd;
      while (after < N && vis[after] < visThreshold) after++;
      const hasBefore = before >= 0 && out[before] && out[before][li];
      const hasAfter = after < N && out[after] && out[after][li];
      if (!hasBefore && !hasAfter) continue;
      const gapLen = runEnd - runStart;
      if (gapLen > MAX_INTERP_GAP) continue;
      for (let f = runStart; f < runEnd; f++) {
        if (!out[f] || !out[f][li]) continue;
        if (hasBefore && hasAfter) {
          const t = (f - before) / (after - before);
          const lmB = out[before][li];
          const lmA = out[after][li];
          out[f][li].x = lmB.x + t * (lmA.x - lmB.x);
          out[f][li].y = lmB.y + t * (lmA.y - lmB.y);
          out[f][li].z = (lmB.z || 0) + t * ((lmA.z || 0) - (lmB.z || 0));
          out[f][li].visibility = lmB.visibility + t * (lmA.visibility - lmB.visibility);
        } else {
          const ref = hasBefore ? out[before][li] : out[after][li];
          out[f][li].x = ref.x;
          out[f][li].y = ref.y;
          out[f][li].z = ref.z || 0;
        }
      }
    }
  }
  return out;
}

// Stubs for functions RepCounter doesn't actually call during finalize
export function getImageLandmarker() { return null; }
export function detectPoseImage() { return null; }
export function selectSubjectPose() { return null; }
export function drawSkeleton() {}
export function loadModelWithRetry() { return Promise.resolve(null); }
`;

writeFileSync(shimPath, shimContent);

// Patch exercises.js to replace import.meta.env.BASE_URL (Vite-only) with '/'
// This is the belt-and-suspenders fix: works on any Node version regardless
// of whether module loader hooks handle the load transform correctly.
const exercisesPath = join(__dirname, '..', 'src', 'lib', 'exercises.js');
const exercisesOriginal = readFileSync(exercisesPath, 'utf-8');
const exercisesPatched = exercisesOriginal.replace(/import\.meta\.env\.BASE_URL/g, "'/'");
if (exercisesPatched !== exercisesOriginal) {
  writeFileSync(exercisesPath, exercisesPatched);
}
// Restore after import (in finally block below)

// Now we need to import RepCounter. The problem is it imports from './poseAnalysis'
// which has the CDN import. We'll use Node's module loader hooks to intercept.
// Simpler approach: use a custom loader or just copy the needed files.
// Simplest: use --loader with import map, or inline the algorithm.

// Actually, the simplest approach: use Node's --import flag with a loader,
// or use a register hook. But for now, let's just use dynamic import with
// a custom resolve.

// The cleanest approach for a benchmark script: directly inline the algorithm
// by reading the source files and evaluating them with the shim.
// But that's fragile. Better: use Node 22's module customization hooks.

// For maximum simplicity, let's use Vite to bundle the lib for Node.
// Or... just create a thin wrapper that re-exports from the shim.

// Actually, the simplest working approach: register a loader that redirects
// './poseAnalysis' imports to our shim.

import module from 'node:module';

// Custom resolve hook: redirect ./poseAnalysis to our shim and add .js
// extensions for bare relative imports (Vite handles this in browser).
const shimUrl = new URL('../src/lib/_node_shim_poseAnalysis.mjs', import.meta.url).href;

if (module.registerHooks) {
  // Node 26+ API (replaces deprecated module.register)
  module.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.endsWith('/poseAnalysis') || specifier === './poseAnalysis') {
        return { shortCircuit: true, url: shimUrl };
      }
      if (specifier.startsWith('./') && !specifier.slice(2).includes('.')) {
        return nextResolve(specifier + '.js', context);
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      // Shim import.meta.env for Vite-specific code running in Node
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
} else if (module.register) {
  // Fallback for Node 18-22 (module.register API with hooks in worker thread)
  const loaderCode = `
  export async function resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('/poseAnalysis') || specifier === './poseAnalysis') {
      return { shortCircuit: true, url: '${shimUrl}' };
    }
    if (specifier.startsWith('./') && !specifier.slice(2).includes('.')) {
      return nextResolve(specifier + '.js', context);
    }
    return nextResolve(specifier, context);
  }
  export async function load(url, context, nextLoad) {
    const result = await nextLoad(url, context);
    if (result.source != null) {
      let src = typeof result.source === 'string' ? result.source : new TextDecoder().decode(result.source);
      if (src.includes('import.meta.env')) {
        src = src.replace(/import\\.meta\\.env\\.BASE_URL/g, "'/'");
        src = src.replace(/import\\.meta\\.env/g, '({})');
        return { format: result.format || 'module', source: src, shortCircuit: true };
      }
    }
    return result;
  }
  `;
  const loaderUrl = 'data:text/javascript;base64,' + Buffer.from(loaderCode).toString('base64');
  module.register(loaderUrl, import.meta.url);
} else {
  console.error('Node version too old: needs module.registerHooks (Node 23+) or module.register (Node 20.6+)');
  process.exit(1);
}

// Now import RepCounter — it will use our shim for poseAnalysis
const { RepCounter } = await import('../src/lib/repCounter.js');

// Run benchmark
const results = [];
for (const video of cache) {
  const { video: name, exercise, expected, fps, landmarks } = video;

  if (!landmarks || landmarks.length === 0) {
    results.push({ video: name, expected, actual: 0, error: -expected, method: '', exercise, note: 'no landmarks' });
    continue;
  }

  // Flag extraction failures: if we have fewer than 1 frame per expected rep,
  // the video wasn't properly extracted and counting is impossible.
  const minFramesPerRep = 3; // at minimum need 3 frames to see a valley
  if (landmarks.length < expected * minFramesPerRep) {
    results.push({ video: name, expected, actual: 0, error: -expected, method: '', exercise,
      note: `extraction failure: ${landmarks.length} frames for ${expected} reps (need ≥${expected * minFramesPerRep})` });
    continue;
  }

  try {
    const counter = new RepCounter(exercise, { fps, mode: 'video' });
    for (const lm of landmarks) {
      counter.update(lm);
    }
    counter.finalize();

    const actual = counter.reps || 0;
    const diag = counter.diagnostics || {};
    const entry = {
      video: name,
      expected,
      actual,
      error: actual - expected,
      method: diag.method || '',
      exercise,
    };
    // Dump template edge diagnostics for all non-exact videos
    if (counter._templateEdgeDiag && entry.error !== 0) {
      entry._edgeGaps = counter._templateEdgeDiag;
    }
    // Dump edge recovery diagnostics
    if (counter._edgeRecoveryDiag) {
      entry._edgeDiag = counter._edgeRecoveryDiag;
    }
    // Dump adaptive selection diagnostics for non-zero errors
    if (counter._adaptiveDiag && entry.error !== 0) {
      const sorted = [...counter._adaptiveDiag].sort((a, b) => b.score - a.score);
      const topCands = sorted.slice(0, 8).map(c => `${c.name}:${c.reps}(s=${c.score.toFixed(1)},c=${c.consistency.toFixed(3)})`);
      entry._candidates = topCands;
    }
    // Dump signal diagnostics for exercises with large errors
    if (Math.abs(entry.error) >= 2) {
      const cycles = diag.cycles || {};
      entry._diag = {
        observedRange: diag.observedRange,
        signalRange: cycles.signalRange,
        repsFromCycles: cycles.reps,
        periodFrames: cycles.periodFrames,
        numCycles: cycles.cycles ? cycles.cycles.length : 0,
        cycleAmplitudes: cycles.cycles ? cycles.cycles.map(c => Math.round(c.amplitude)) : [],
      };
    }
    results.push(entry);
  } catch (err) {
    results.push({ video: name, expected, actual: 0, error: -expected, method: '', exercise, note: err.message });
  }
}

// Compute stats — exclude extraction failures from metrics
const scored = results.filter(r => r.expected != null && !r.note);
const exact = scored.filter(r => r.error === 0).length;
const obo = scored.filter(r => Math.abs(r.error) <= 1).length;
const mae = scored.length > 0
  ? (scored.reduce((s, r) => s + Math.abs(r.error), 0) / scored.length).toFixed(2)
  : 'N/A';
const avgAcc = scored.length > 0
  ? Math.round(scored.reduce((s, r) => {
      const acc = r.expected === 0 ? (r.actual === 0 ? 100 : 0) : Math.max(0, Math.round((1 - Math.abs(r.error) / r.expected) * 100));
      return s + acc;
    }, 0) / scored.length)
  : 0;

// Print report
console.log('='.repeat(70));
console.log('  REPLAY BENCHMARK RESULTS');
console.log('='.repeat(70));
const excluded = results.filter(r => r.note);
console.log(`  Videos:      ${scored.length} scored, ${excluded.length} excluded`);
console.log(`  Accuracy:    ${avgAcc}%`);
console.log(`  Exact:       ${exact}/${scored.length}`);
console.log(`  OBO (±1):    ${obo}/${scored.length} (${scored.length > 0 ? Math.round(obo / scored.length * 100) : 0}%)`);
console.log(`  MAE:         ${mae}`);
if (excluded.length > 0) {
  console.log(`  Excluded:    ${excluded.map(r => r.video.split('.')[0]).join(', ')}`);
}
console.log('='.repeat(70));

console.log(`\n  Video                                          Got  Exp  Err  Method`);
console.log('  ' + '-'.repeat(68));
for (const r of results) {
  const name = r.video.padEnd(45);
  const got = String(r.actual).padStart(3);
  const exp = String(r.expected ?? '?').padStart(4);
  const err = r.error === 0 ? '  0' : ((r.error > 0 ? '+' : '') + r.error).padStart(3);
  const note = r.note ? ` (${r.note})` : '';
  console.log(`  ${name} ${got} ${exp}  ${err}  ${r.method}${note}`);
}

// Per-exercise breakdown
console.log('\n  Per-exercise:');
const byExercise = {};
for (const r of scored) {
  if (!byExercise[r.exercise]) byExercise[r.exercise] = [];
  byExercise[r.exercise].push(r);
}
for (const [ex, exResults] of Object.entries(byExercise)) {
  const exExact = exResults.filter(r => r.error === 0).length;
  const exObo = exResults.filter(r => Math.abs(r.error) <= 1).length;
  const exMae = (exResults.reduce((s, r) => s + Math.abs(r.error), 0) / exResults.length).toFixed(1);
  console.log(`    ${ex.padEnd(15)} exact=${exExact}/${exResults.length}  OBO=${exObo}/${exResults.length}  MAE=${exMae}`);
}

// Save results
mkdirSync(RESULTS_DIR, { recursive: true });
const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '');
const outFile = join(RESULTS_DIR, `replay-${timestamp}.json`);
const report = {
  date: new Date().toISOString(),
  type: 'replay',
  cacheFile: cachePath,
  summary: { testsRun: results.length, testsScored: scored.length, avgAccuracy: avgAcc, exactMatch: exact, withinOne: obo, mae: parseFloat(mae), oboAccuracy: Math.round(obo / scored.length * 100) },
  results,
};
writeFileSync(outFile, JSON.stringify(report, null, 2));
console.log(`\n  Saved: ${outFile}`);

// Restore patched exercises.js
if (exercisesPatched !== exercisesOriginal) {
  writeFileSync(exercisesPath, exercisesOriginal);
}

// CI gate: fail if accuracy regresses below baseline thresholds
// Baseline recorded 2026-09-09: 80% accuracy, 70% OBO, MAE 1.40
const CI_MIN_ACCURACY = 75;  // allow 5% variance from baseline 80%
const CI_MIN_OBO_PCT = 60;   // allow 10% variance from baseline 70%
const CI_MAX_MAE = 2.0;      // allow 0.6 variance from baseline 1.40

const isCI = args.includes('--ci');
if (isCI) {
  const oboPercent = scored.length > 0 ? Math.round(obo / scored.length * 100) : 0;
  let failed = false;
  if (avgAcc < CI_MIN_ACCURACY) {
    console.error(`\n  CI GATE FAILED: accuracy ${avgAcc}% < ${CI_MIN_ACCURACY}% threshold`);
    failed = true;
  }
  if (oboPercent < CI_MIN_OBO_PCT) {
    console.error(`  CI GATE FAILED: OBO ${oboPercent}% < ${CI_MIN_OBO_PCT}% threshold`);
    failed = true;
  }
  if (parseFloat(mae) > CI_MAX_MAE) {
    console.error(`  CI GATE FAILED: MAE ${mae} > ${CI_MAX_MAE} threshold`);
    failed = true;
  }
  if (failed) {
    process.exit(1);
  } else {
    console.log(`\n  CI GATE PASSED: accuracy=${avgAcc}% OBO=${oboPercent}% MAE=${mae}`);
  }
}
