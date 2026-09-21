#!/usr/bin/env node
/**
 * Determinism verification for the workout-vision analysis pipeline.
 *
 * The full pipeline (video file -> MediaPipe WASM -> signal processing -> rep count)
 * requires a browser context because MediaPipe runs in WASM with WebGL/CPU delegates.
 * This script therefore operates in TWO modes:
 *
 * MODE 1: COMPARE (default)
 *   Compare two exported result JSON files (or landmark artifact files) and report
 *   whether the pipeline produced identical outputs. Use this after running the
 *   manual A/A test procedure documented below.
 *
 *   Usage:
 *     node benchmark/determinism-test.mjs run_A.json run_B.json
 *     node benchmark/determinism-test.mjs --landmarks lm_A.json lm_B.json
 *
 * MODE 2: REPLAY-DETERMINISM
 *   Replay a single landmark cache through RepCounter twice and verify the
 *   algorithm layer (signal processing + rep counting) is deterministic.
 *   This does NOT test MediaPipe inference, but it proves the post-inference
 *   pipeline is purely functional.
 *
 *   Usage:
 *     node benchmark/determinism-test.mjs --replay [--cache path/to/cache.json]
 *
 * ────────────────────────────────────────────────────────────────────────────
 * MANUAL A/A TEST PROCEDURE (full pipeline determinism)
 *
 * This checklist produces two independent full-pipeline runs on the same video.
 * The compare mode of this script then diffs every output field.
 *
 *   1. Open the app in Chrome (http://localhost:5173 or production URL).
 *   2. Open DevTools > Application > IndexedDB > workoutVisionCache > landmarks.
 *   3. Delete all entries (or note the cache key for your test video).
 *   4. Select a test video file and an exercise (or auto-detect).
 *   5. Run analysis. When complete:
 *      a. Open DevTools Console.
 *      b. The app stores the result in the workout history (IndexedDB > workoutVisionDB).
 *         Export it: copy the latest entry from the "workouts" object store as JSON.
 *         Save as run_A.json.
 *      c. To export landmarks: use benchmark/dump-landmarks.html, or from the
 *         Validate page export the landmark cache. Save as lm_A.json.
 *   6. Clear the landmark cache again (Application > IndexedDB > workoutVisionCache).
 *   7. Hard-reload the page (Cmd+Shift+R) to reset all in-memory state.
 *   8. Repeat step 4-5 with the SAME video and exercise. Save as run_B.json / lm_B.json.
 *   9. Run this script:
 *        node benchmark/determinism-test.mjs run_A.json run_B.json
 *        node benchmark/determinism-test.mjs --landmarks lm_A.json lm_B.json
 *
 * Expected result: DETERMINISTIC (all fields identical).
 * If GPU delegate is used instead of CPU, landmark coordinates will differ
 * between runs, causing cascading differences in rep count, form scores, etc.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { gunzipSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, 'results');

// ── CLI parsing ──

const args = process.argv.slice(2);
let mode = 'compare';         // 'compare' | 'landmarks' | 'replay'
let fileA = null;
let fileB = null;
let cachePath = null;
const positional = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--landmarks') { mode = 'landmarks'; continue; }
  if (args[i] === '--replay') { mode = 'replay'; continue; }
  if (args[i] === '--cache' && args[i + 1]) { cachePath = args[++i]; continue; }
  if (args[i] === '--help' || args[i] === '-h') { printUsage(); process.exit(0); }
  if (!args[i].startsWith('--')) positional.push(args[i]);
}

function printUsage() {
  console.log(`
  Determinism Test — verify pipeline produces identical results on identical input.

  Usage:
    node benchmark/determinism-test.mjs <run_A.json> <run_B.json>
        Compare two full result exports field-by-field.

    node benchmark/determinism-test.mjs --landmarks <lm_A.json> <lm_B.json>
        Compare two landmark exports coordinate-by-coordinate.

    node benchmark/determinism-test.mjs --replay [--cache <cache.json>]
        Replay cached landmarks through RepCounter twice and diff.

  See the header of this file for the manual A/A test procedure.
`);
}

// ── Utility functions ──

function loadJSON(path) {
  const raw = path.endsWith('.gz')
    ? gunzipSync(readFileSync(path)).toString('utf-8')
    : readFileSync(path, 'utf-8');
  return JSON.parse(raw);
}

/**
 * SHA-256 hash of a JSON-serialized value. Uses Node crypto (not WebCrypto).
 */
function hashValue(value) {
  const str = JSON.stringify(value);
  return createHash('sha256').update(str).digest('hex').slice(0, 16);
}

/**
 * Hash landmark coordinates the same way frameExtractor.hashLandmarks does,
 * but using Node crypto instead of WebCrypto.
 */
function hashLandmarksNode(landmarks) {
  const data = landmarks.map(frame => {
    if (!frame) return '';
    return frame.map(lm => {
      if (!lm) return '0,0,0';
      return `${(lm.x || 0).toFixed(6)},${(lm.y || 0).toFixed(6)},${(lm.z || 0).toFixed(6)}`;
    }).join(';');
  }).join('|');
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/**
 * Deep-compare two values. Returns an array of difference descriptions.
 * Recurses into objects and arrays. Stops at leaf values.
 */
function deepDiff(a, b, path = '') {
  const diffs = [];

  if (a === b) return diffs;
  if (a == null && b == null) return diffs;
  if (a == null || b == null) {
    diffs.push({ path, a, b, kind: 'null_mismatch' });
    return diffs;
  }

  const typeA = typeof a;
  const typeB = typeof b;
  if (typeA !== typeB) {
    diffs.push({ path, a: `(${typeA})`, b: `(${typeB})`, kind: 'type_mismatch' });
    return diffs;
  }

  if (typeA === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return diffs;
    if (a !== b) {
      const relDiff = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-10);
      diffs.push({
        path,
        a: a.toFixed(8),
        b: b.toFixed(8),
        delta: Math.abs(a - b).toExponential(3),
        relDelta: relDiff.toExponential(3),
        kind: relDiff < 1e-9 ? 'float_noise' : 'value_mismatch',
      });
    }
    return diffs;
  }

  if (typeA === 'string' || typeA === 'boolean') {
    if (a !== b) diffs.push({ path, a, b, kind: 'value_mismatch' });
    return diffs;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      diffs.push({ path: `${path}.length`, a: a.length, b: b.length, kind: 'length_mismatch' });
    }
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      diffs.push(...deepDiff(a[i], b[i], `${path}[${i}]`));
    }
    return diffs;
  }

  if (typeA === 'object') {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    const allKeys = new Set([...keysA, ...keysB]);
    for (const key of allKeys) {
      if (!(key in a)) {
        diffs.push({ path: `${path}.${key}`, a: '(missing)', b: typeof b[key], kind: 'key_missing_in_A' });
      } else if (!(key in b)) {
        diffs.push({ path: `${path}.${key}`, a: typeof a[key], b: '(missing)', kind: 'key_missing_in_B' });
      } else {
        diffs.push(...deepDiff(a[key], b[key], `${path}.${key}`));
      }
    }
    return diffs;
  }

  return diffs;
}

/**
 * Print a diff report. Returns true if deterministic (no meaningful differences).
 */
function printDiffReport(diffs, label) {
  // Separate float noise from real differences
  const noise = diffs.filter(d => d.kind === 'float_noise');
  const real = diffs.filter(d => d.kind !== 'float_noise');

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  DETERMINISM TEST: ${label}`);
  console.log('='.repeat(70));

  if (real.length === 0 && noise.length === 0) {
    console.log('  Result: DETERMINISTIC (all fields identical)\n');
    return true;
  }

  if (real.length === 0 && noise.length > 0) {
    console.log(`  Result: DETERMINISTIC (${noise.length} float-noise differences below 1e-9 relative)`);
    console.log('  These are IEEE 754 rounding artifacts and do not affect outputs.\n');
    return true;
  }

  console.log(`  Result: NOT DETERMINISTIC`);
  console.log(`  Meaningful differences: ${real.length}`);
  if (noise.length > 0) console.log(`  Float noise (ignorable): ${noise.length}`);
  console.log('');

  // Group by top-level field for readability
  const grouped = {};
  for (const d of real) {
    const topField = d.path.split('.')[0] || d.path.split('[')[0] || d.path;
    if (!grouped[topField]) grouped[topField] = [];
    grouped[topField].push(d);
  }

  for (const [field, fieldDiffs] of Object.entries(grouped)) {
    console.log(`  ${field}: ${fieldDiffs.length} difference(s)`);
    // Show first 5 per field
    for (const d of fieldDiffs.slice(0, 5)) {
      if (d.delta) {
        console.log(`    ${d.path}: ${d.a} vs ${d.b} (delta=${d.delta})`);
      } else {
        console.log(`    ${d.path}: ${JSON.stringify(d.a)} vs ${JSON.stringify(d.b)}`);
      }
    }
    if (fieldDiffs.length > 5) {
      console.log(`    ... and ${fieldDiffs.length - 5} more`);
    }
  }
  console.log('');
  return false;
}

// ── MODE: Compare two result JSONs ──

function compareResults(pathA, pathB) {
  console.log(`\n  Loading run A: ${basename(pathA)}`);
  console.log(`  Loading run B: ${basename(pathB)}`);

  const a = loadJSON(pathA);
  const b = loadJSON(pathB);

  // Fields that are expected to differ between runs (timestamps, IDs)
  const IGNORED_FIELDS = new Set([
    'workoutId', 'date', 'analysisTime',
  ]);

  // Strip ignored fields for comparison
  const strip = (obj) => {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (IGNORED_FIELDS.has(k)) continue;
      out[k] = v;
    }
    return out;
  };

  const strippedA = strip(a);
  const strippedB = strip(b);

  // Key fields to report individually
  const keyFields = [
    'reps', 'exercise', 'formScore', 'progressionScore',
    'duration', 'fps', 'videoHash', 'landmarkHash',
    'autoDetected', 'detectionConfidence', 'hasFormChecks',
  ];

  console.log('\n  Key fields:');
  for (const field of keyFields) {
    const va = a[field];
    const vb = b[field];
    const match = JSON.stringify(va) === JSON.stringify(vb);
    console.log(`    ${field.padEnd(25)} ${match ? 'MATCH' : 'DIFF'}  A=${JSON.stringify(va)}  B=${JSON.stringify(vb)}`);
  }

  // Full deep diff
  const diffs = deepDiff(strippedA, strippedB, '');
  return printDiffReport(diffs, 'Full Result Comparison');
}

// ── MODE: Compare two landmark exports ──

function compareLandmarks(pathA, pathB) {
  console.log(`\n  Loading landmarks A: ${basename(pathA)}`);
  console.log(`  Loading landmarks B: ${basename(pathB)}`);

  let lmA = loadJSON(pathA);
  let lmB = loadJSON(pathB);

  // Handle different formats: raw array, { landmarks: [...] }, artifact { frames: [...] }
  if (lmA.landmarks) lmA = lmA.landmarks;
  if (lmA.frames) lmA = lmA.frames.map(f => f.landmarks || f);
  if (lmB.landmarks) lmB = lmB.landmarks;
  if (lmB.frames) lmB = lmB.frames.map(f => f.landmarks || f);

  // Also handle landmark cache format: [{ video, landmarks, ... }]
  if (Array.isArray(lmA) && lmA.length > 0 && lmA[0].landmarks) {
    lmA = lmA[0].landmarks;
  }
  if (Array.isArray(lmB) && lmB.length > 0 && lmB[0].landmarks) {
    lmB = lmB[0].landmarks;
  }

  console.log(`  Frames A: ${lmA.length}`);
  console.log(`  Frames B: ${lmB.length}`);

  const hashA = hashLandmarksNode(lmA);
  const hashB = hashLandmarksNode(lmB);
  console.log(`  Hash A: ${hashA}`);
  console.log(`  Hash B: ${hashB}`);
  console.log(`  Hash match: ${hashA === hashB ? 'YES' : 'NO'}`);

  if (lmA.length !== lmB.length) {
    console.log(`\n  Frame count mismatch: ${lmA.length} vs ${lmB.length}`);
    console.log('  Result: NOT DETERMINISTIC (different frame counts)\n');
    return false;
  }

  // Compare frame by frame, landmark by landmark
  let totalDiffs = 0;
  let maxDelta = 0;
  let firstDiffFrame = -1;
  const diffsByProperty = { x: 0, y: 0, z: 0, visibility: 0 };

  for (let f = 0; f < lmA.length; f++) {
    const frameA = lmA[f];
    const frameB = lmB[f];
    if (!frameA && !frameB) continue;
    if (!frameA || !frameB) { totalDiffs++; if (firstDiffFrame < 0) firstDiffFrame = f; continue; }

    const numLandmarks = Math.max(frameA.length, frameB.length);
    for (let li = 0; li < numLandmarks; li++) {
      const la = frameA[li] || {};
      const lb = frameB[li] || {};
      for (const prop of ['x', 'y', 'z', 'visibility']) {
        const va = la[prop] || 0;
        const vb = lb[prop] || 0;
        const delta = Math.abs(va - vb);
        if (delta > 1e-9) {
          totalDiffs++;
          if (delta > maxDelta) maxDelta = delta;
          if (firstDiffFrame < 0) firstDiffFrame = f;
          diffsByProperty[prop]++;
        }
      }
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('  DETERMINISM TEST: Landmark Comparison');
  console.log('='.repeat(70));

  if (totalDiffs === 0) {
    console.log('  Result: DETERMINISTIC (all landmark coordinates identical)\n');
    return true;
  }

  console.log('  Result: NOT DETERMINISTIC');
  console.log(`  Total coordinate differences: ${totalDiffs}`);
  console.log(`  Max delta: ${maxDelta.toExponential(3)}`);
  console.log(`  First differing frame: ${firstDiffFrame}`);
  console.log(`  Diffs by property: x=${diffsByProperty.x} y=${diffsByProperty.y} z=${diffsByProperty.z} vis=${diffsByProperty.visibility}`);
  console.log('');
  console.log('  This usually means the GPU delegate was used instead of CPU.');
  console.log('  GPU floating-point ops are non-deterministic across runs.');
  console.log('  Fix: ensure forceCPU: true is set in the worker init.\n');
  return false;
}

// ── MODE: Replay determinism (algorithm layer only) ──

async function replayDeterminism(cachePath) {
  // Find landmark cache
  if (!cachePath) {
    const CACHE_DIR = join(__dirname, 'landmark-cache');
    if (existsSync(CACHE_DIR)) {
      const jsonFiles = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json') && !f.endsWith('.json.gz')).sort().reverse();
      const gzFiles = readdirSync(CACHE_DIR).filter(f => f.endsWith('.json.gz')).sort().reverse();
      if (jsonFiles.length > 0) cachePath = join(CACHE_DIR, jsonFiles[0]);
      else if (gzFiles.length > 0) cachePath = join(CACHE_DIR, gzFiles[0]);
    }
    if (!cachePath) {
      const downloads = join(process.env.HOME, 'Downloads');
      if (existsSync(downloads)) {
        const files = readdirSync(downloads)
          .filter(f => f.startsWith('landmark-cache') && f.endsWith('.json'))
          .sort().reverse();
        if (files.length > 0) cachePath = join(downloads, files[0]);
      }
    }
  }

  if (!cachePath) {
    console.error('No landmark cache found. Specify with --cache <path>.');
    process.exit(1);
  }

  console.log(`\n  Replay Determinism Test`);
  console.log(`  Cache: ${cachePath}\n`);

  const cache = loadJSON(cachePath);
  console.log(`  Loaded ${cache.length} video(s)\n`);

  // ── Set up Node module loader (same as replay-benchmark.mjs) ──
  const shimPath = join(__dirname, '..', 'src', 'lib', '_node_shim_poseAnalysis.mjs');
  const shimUrl = new URL('../src/lib/_node_shim_poseAnalysis.mjs', import.meta.url).href;

  // Ensure shim exists
  if (!existsSync(shimPath)) {
    console.error('Shim file not found. Run replay-benchmark.mjs first to generate it.');
    process.exit(1);
  }

  // Patch exercises.js for Node compatibility
  const exercisesPath = join(__dirname, '..', 'src', 'lib', 'exercises.js');
  const exercisesOriginal = readFileSync(exercisesPath, 'utf-8');
  const exercisesPatched = exercisesOriginal.replace(/import\.meta\.env\.BASE_URL/g, "'/'");
  if (exercisesPatched !== exercisesOriginal) {
    writeFileSync(exercisesPath, exercisesPatched);
  }

  const mod = await import('node:module');
  const module = mod.default || mod;

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
  } else if (module.register) {
    const loaderCode = `
    export async function resolve(specifier, context, nextResolve) {
      if (specifier.endsWith('/poseAnalysis') || specifier === './poseAnalysis') {
        return { shortCircuit: true, url: '${shimUrl}' };
      }
      if (specifier.startsWith('./') && !specifier.slice(2).includes('.')) {
        try { return nextResolve(specifier + '.ts', context); } catch {}
        return nextResolve(specifier + '.js', context);
      }
      if (specifier.endsWith('.js')) {
        try { return nextResolve(specifier, context); } catch {}
        return nextResolve(specifier.replace(/\\.js$/, '.ts'), context);
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

  const { RepCounter } = await import('../src/lib/repCounter/index.js');

  // ── Run each video TWICE and compare ──

  let allPass = true;

  for (const video of cache) {
    const { video: name, exercise, expected, fps, landmarks } = video;

    if (!landmarks || landmarks.length === 0) {
      console.log(`  SKIP  ${name} (no landmarks)`);
      continue;
    }

    // Run A
    const runA = runRepCounter(RepCounter, exercise, fps, landmarks);
    // Run B (independent instance, same input)
    const runB = runRepCounter(RepCounter, exercise, fps, landmarks);

    // Compare
    const diffs = deepDiff(runA, runB, '');
    const real = diffs.filter(d => d.kind !== 'float_noise');

    if (real.length === 0) {
      console.log(`  PASS  ${name.padEnd(45)} reps=${runA.reps} method=${runA.method}`);
    } else {
      allPass = false;
      console.log(`  FAIL  ${name.padEnd(45)} reps A=${runA.reps} B=${runB.reps}`);
      for (const d of real.slice(0, 5)) {
        console.log(`        ${d.path}: ${JSON.stringify(d.a)} vs ${JSON.stringify(d.b)}`);
      }
      if (real.length > 5) console.log(`        ... and ${real.length - 5} more`);
    }
  }

  // Restore exercises.js
  if (exercisesPatched !== exercisesOriginal) {
    writeFileSync(exercisesPath, exercisesOriginal);
  }

  console.log(`\n${'='.repeat(70)}`);
  if (allPass) {
    console.log('  REPLAY DETERMINISM: PASS (algorithm layer is deterministic)');
  } else {
    console.log('  REPLAY DETERMINISM: FAIL (algorithm layer produced different outputs)');
  }
  console.log('='.repeat(70));
  console.log('');
  console.log('  Note: this tests the post-inference pipeline (signal processing +');
  console.log('  rep counting). It does NOT test MediaPipe inference determinism.');
  console.log('  For full-pipeline determinism, use the manual A/A test procedure');
  console.log('  and compare mode: node benchmark/determinism-test.mjs run_A.json run_B.json\n');

  return allPass;
}

/**
 * Run RepCounter on a set of landmarks and extract a comparable result object.
 * Mirrors the replay-benchmark logic but captures all output fields.
 */
function runRepCounter(RepCounter, exercise, fps, landmarks) {
  const counter = new RepCounter(exercise, { fps, mode: 'video' });
  for (const lm of landmarks) {
    counter.update(lm);
  }
  counter.finalize();

  const diag = counter.diagnostics || {};
  const repHistory = counter.repHistory || [];
  const cycles = diag.cycles || {};

  return {
    reps: counter.reps || 0,
    hysReps: counter._hysReps || 0,
    method: diag.method || '',
    exercise,
    observedRange: diag.observedRange || null,
    medianRepAmplitude: diag.medianRepAmplitude || null,
    // Rep-level detail
    repCount: repHistory.length,
    repFrames: repHistory.map(r => ({
      startFrame: r.startFrame,
      bottomFrame: r.bottomFrame,
      endFrame: r.endFrame,
      peakFrame: r.peakFrame,
      amplitude: r.amplitude,
      score: r.score,
    })),
    // Signal diagnostics
    signalRange: cycles.signalRange || null,
    repsFromCycles: cycles.reps || null,
    periodFrames: cycles.periodFrames || null,
    numCycles: cycles.cycles ? cycles.cycles.length : 0,
    cycleAmplitudes: cycles.cycles ? cycles.cycles.map(c => c.amplitude) : [],
    // Valley frames (the raw counted valleys)
    valleyFrames: repHistory.map(r => r.bottomFrame || r.peakFrame),
    // Landmark hash for the input (sanity check that inputs are identical)
    inputHash: hashLandmarksNode(landmarks),
  };
}

// ── Main dispatch ──

async function main() {
  if (mode === 'replay') {
    const pass = await replayDeterminism(cachePath);
    process.exit(pass ? 0 : 1);
  }

  if (mode === 'landmarks') {
    if (positional.length < 2) {
      console.error('Usage: node benchmark/determinism-test.mjs --landmarks <lm_A.json> <lm_B.json>');
      process.exit(1);
    }
    const pass = compareLandmarks(positional[0], positional[1]);
    process.exit(pass ? 0 : 1);
  }

  // Default: compare mode
  if (positional.length < 2) {
    console.error('Usage: node benchmark/determinism-test.mjs <run_A.json> <run_B.json>');
    console.error('       node benchmark/determinism-test.mjs --landmarks <lm_A.json> <lm_B.json>');
    console.error('       node benchmark/determinism-test.mjs --replay [--cache <cache.json>]');
    console.error('\nRun with --help for the full manual A/A test procedure.');
    process.exit(1);
  }

  const pass = compareResults(positional[0], positional[1]);

  // Save report
  mkdirSync(RESULTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '');
  const outFile = join(RESULTS_DIR, `determinism-${timestamp}.json`);
  const report = {
    date: new Date().toISOString(),
    type: 'determinism',
    mode,
    fileA: positional[0],
    fileB: positional[1],
    result: pass ? 'DETERMINISTIC' : 'NOT_DETERMINISTIC',
  };
  writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`  Report saved: ${outFile}\n`);

  process.exit(pass ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
