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
  // Check benchmark/landmark-cache/ directory first
  if (existsSync(CACHE_DIR)) {
    const files = readdirSync(CACHE_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length > 0) cachePath = join(CACHE_DIR, files[0]);
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

// Load landmark cache
const cache = JSON.parse(readFileSync(cachePath, 'utf-8'));
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

// Stubs for functions RepCounter doesn't actually call during finalize
export function getImageLandmarker() { return null; }
export function detectPoseImage() { return null; }
export function selectSubjectPose() { return null; }
export function drawSkeleton() {}
export function loadModelWithRetry() { return Promise.resolve(null); }
`;

writeFileSync(shimPath, shimContent);

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
  });
} else {
  // Fallback for older Node versions
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
  `;
  const loaderUrl = 'data:text/javascript;base64,' + Buffer.from(loaderCode).toString('base64');
  module.register(loaderUrl, import.meta.url);
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

  try {
    const counter = new RepCounter(exercise, { fps, mode: 'video' });
    for (const lm of landmarks) {
      counter.update(lm);
    }
    counter.finalize();

    const actual = counter.reps || 0;
    const diag = counter.diagnostics || {};
    results.push({
      video: name,
      expected,
      actual,
      error: actual - expected,
      method: diag.method || '',
      exercise,
    });
  } catch (err) {
    results.push({ video: name, expected, actual: 0, error: -expected, method: '', exercise, note: err.message });
  }
}

// Compute stats
const scored = results.filter(r => r.expected != null);
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
console.log(`  Accuracy:    ${avgAcc}%`);
console.log(`  Exact:       ${exact}/${scored.length}`);
console.log(`  OBO (±1):    ${obo}/${scored.length} (${scored.length > 0 ? Math.round(obo / scored.length * 100) : 0}%)`);
console.log(`  MAE:         ${mae}`);
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
