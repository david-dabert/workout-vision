#!/usr/bin/env node
/**
 * MEASUREMENT 1, Step B — Run counter on extracted landmarks.
 *
 * Reads landmark JSON files from test/real-phone/landmarks/,
 * runs the app's own RepCounter with the exercise from the manifest
 * (never auto-detected), and produces the per-clip table.
 *
 * Uses the same module-loading approach as replay-benchmark.mjs.
 *
 * Does NOT modify any app code. Measurement only.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import module from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MANIFEST_PATH = join(ROOT, 'test', 'real-phone', 'manifest.json');
const LANDMARKS_DIR = join(ROOT, 'test', 'real-phone', 'landmarks');
const RESULTS_DIR = join(__dirname, 'results');

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
const videoClips = manifest.clips.filter(c => c.type === 'video');

console.log(`\n  MEASUREMENT 1B — Offline Counter`);
console.log(`  ${videoClips.length} clips from manifest\n`);

// ── Module loading: same approach as replay-benchmark.mjs ──

// Write the Node shim for poseAnalysis (same as replay-benchmark)
const shimPath = join(ROOT, 'src', 'lib', '_node_shim_poseAnalysis.mjs');
// The shim should already exist from replay-benchmark runs.
// If not, replay-benchmark.mjs writes it. For safety, check:
if (!existsSync(shimPath)) {
  console.error('Missing shim at ' + shimPath);
  console.error('Run `node benchmark/replay-benchmark.mjs` once first to generate it.');
  process.exit(1);
}

// Patch exercises.js to replace import.meta.env.BASE_URL
const exercisesPath = join(ROOT, 'src', 'lib', 'exercises.js');
const exercisesOriginal = readFileSync(exercisesPath, 'utf-8');
const exercisesPatched = exercisesOriginal.replace(/import\.meta\.env\.BASE_URL/g, "'/'");
if (exercisesPatched !== exercisesOriginal) {
  writeFileSync(exercisesPath, exercisesPatched);
}

// Register module hooks
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

// Import RepCounter
const { RepCounter } = await import('../src/lib/repCounter/index.js');

// Restore exercises.js
if (exercisesPatched !== exercisesOriginal) {
  writeFileSync(exercisesPath, exercisesOriginal);
}

// ── Run counter on each clip's landmarks ──

const results = [];

for (const clip of videoClips) {
  const landmarkFile = join(LANDMARKS_DIR, clip.file.replace(/\.\w+$/, '.landmarks.json'));

  if (!existsSync(landmarkFile)) {
    console.log(`  ${clip.exercise.padEnd(20)} — NO LANDMARKS FILE`);
    results.push({
      file: clip.file,
      exercise: clip.exercise,
      view: clip.view,
      expectedReps: clip.reps,
      countedReps: null,
      error: null,
      note: 'No landmark file found. Run measurement1-extract-landmarks.mjs first.',
    });
    continue;
  }

  const data = JSON.parse(readFileSync(landmarkFile, 'utf-8'));
  const landmarks = data.landmarks;
  const fps = data.fps || 15; // default analysis fps

  if (!landmarks || landmarks.length === 0) {
    console.log(`  ${clip.exercise.padEnd(20)} — EMPTY LANDMARKS`);
    results.push({
      file: clip.file,
      exercise: clip.exercise,
      view: clip.view,
      expectedReps: clip.reps,
      countedReps: 0,
      error: -clip.reps,
      framesAvailable: 0,
      note: 'Landmark file exists but has no frames',
    });
    continue;
  }

  try {
    const counter = new RepCounter(clip.exercise, { fps, mode: 'video' });
    for (const lm of landmarks) {
      counter.update(lm);
    }
    counter.finalize();

    const counted = counter.reps || 0;
    const diag = counter.diagnostics || {};
    const error = counted - clip.reps;

    // Gather signal candidates from diagnostics
    const candidates = diag.signalCandidates || diag.candidates || [];
    const topCandidates = (Array.isArray(candidates) ? candidates : [])
      .slice(0, 3)
      .map(c => `${c.name || c.signal || '?'}:${c.reps ?? '?'}`);

    const method = diag.method || diag.countMethod || counter._method || 'unknown';
    const confidence = diag.confidence ?? counter.confidence ?? null;

    results.push({
      file: clip.file,
      exercise: clip.exercise,
      view: clip.view,
      expectedReps: clip.reps,
      countedReps: counted,
      error,
      confidence,
      method,
      topSignalCandidates: topCandidates,
      framesAvailable: landmarks.length,
      fps,
    });

    const errStr = error === 0 ? ' exact' : ` ${error > 0 ? '+' : ''}${error}`;
    console.log(`  ${clip.exercise.padEnd(20)} expected=${clip.reps}  counted=${counted}${errStr}  method=${method}  conf=${confidence != null ? confidence.toFixed(2) : '-'}`);
  } catch (err) {
    console.log(`  ${clip.exercise.padEnd(20)} — COUNTER ERROR: ${err.message}`);
    results.push({
      file: clip.file,
      exercise: clip.exercise,
      view: clip.view,
      expectedReps: clip.reps,
      countedReps: null,
      error: null,
      counterError: err.message,
    });
  }
}

// ── Print table ──
console.log('\n' + '='.repeat(90));
console.log('  MEASUREMENT 1B — Counter-Only Results');
console.log('='.repeat(90));
console.log(`\n  Exercise              Expected  Counted  Error  Confidence  Method              Top Signals`);
console.log('  ' + '-'.repeat(86));

let exactCount = 0, oboCount = 0, totalAbsError = 0, measured = 0;

for (const r of results) {
  if (r.countedReps == null) continue;
  measured++;
  const absErr = Math.abs(r.error);
  totalAbsError += absErr;
  if (r.error === 0) exactCount++;
  if (absErr <= 1) oboCount++;

  const ex = r.exercise.replace(/_/g, ' ').padEnd(20);
  const exp = String(r.expectedReps).padStart(4);
  const got = String(r.countedReps).padStart(4);
  const err = r.error === 0 ? '    0' : (`${r.error > 0 ? '+' : ''}${r.error}`).padStart(5);
  const conf = r.confidence != null ? r.confidence.toFixed(2).padStart(10) : '         -';
  const method = (r.method || '-').padEnd(18);
  const sigs = (r.topSignalCandidates || []).join(', ') || '-';
  console.log(`  ${ex}  ${exp}    ${got}  ${err}  ${conf}  ${method}  ${sigs}`);
}

console.log('  ' + '-'.repeat(86));
if (measured > 0) {
  console.log(`  Exact match:   ${exactCount}/${measured} (${Math.round(exactCount / measured * 100)}%)`);
  console.log(`  Within +-1:    ${oboCount}/${measured} (${Math.round(oboCount / measured * 100)}%)`);
  console.log(`  MAE:           ${(totalAbsError / measured).toFixed(2)}`);
}
console.log('='.repeat(90));

// Save results
mkdirSync(RESULTS_DIR, { recursive: true });
const ts = new Date().toISOString().slice(0, 10);
const outFile = join(RESULTS_DIR, `real-phone-${ts}.json`);
let combined = {};
try { combined = JSON.parse(readFileSync(outFile, 'utf-8')); } catch {}
combined.date = new Date().toISOString();
combined.measurement1_counter = {
  results,
  summary: {
    total: measured,
    exact: exactCount,
    obo: oboCount,
    mae: measured > 0 ? totalAbsError / measured : null,
  },
};
writeFileSync(outFile, JSON.stringify(combined, null, 2));
console.log(`\n  Saved: ${outFile}\n`);
