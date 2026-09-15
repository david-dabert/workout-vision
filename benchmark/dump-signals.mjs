#!/usr/bin/env node
/**
 * Signal diagnostics dump — shows top adaptive candidate signals and raw
 * smoothed signal values for the winning signal, per video.
 *
 * Usage:
 *   node benchmark/dump-signals.mjs [video_name ...]
 *
 * Video names can be partial (prefix match) or full (with _Nreps.mp4 suffix).
 * Defaults to: battle_rope_BuhAROfTtx8, sit_up_q0bQropuof0, push_up_E0p8QDRa0Fg, squat_rRUaSaoVlBc
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, 'landmark-cache');

// ── Parse CLI args ──
const argVideos = process.argv.slice(2);
const DEFAULT_VIDEOS = [
  'battle_rope_BuhAROfTtx8',
  'sit_up_q0bQropuof0',
  'push_up_E0p8QDRa0Fg',
  'squat_rRUaSaoVlBc',
];
const targetPrefixes = argVideos.length > 0 ? argVideos : DEFAULT_VIDEOS;

// ── Find latest cache ──
let cachePath = null;
if (existsSync(CACHE_DIR)) {
  const jsonFiles = readdirSync(CACHE_DIR)
    .filter(f => f.endsWith('.json') && !f.endsWith('.json.gz'))
    .sort()
    .reverse();
  if (jsonFiles.length > 0) cachePath = join(CACHE_DIR, jsonFiles[0]);
}
if (!cachePath) {
  console.error('No landmark cache found in', CACHE_DIR);
  process.exit(1);
}

console.log(`Cache: ${cachePath}\n`);
const cache = JSON.parse(readFileSync(cachePath, 'utf-8'));
console.log(`Loaded ${cache.length} videos\n`);

// ── Resolve target videos (prefix or exact match) ──
function resolveVideos(allVideos, prefixes) {
  const resolved = [];
  for (const prefix of prefixes) {
    const match = allVideos.find(v => v.video === prefix || v.video.startsWith(prefix));
    if (match) {
      resolved.push(match);
    } else {
      console.warn(`WARNING: no video found matching "${prefix}"`);
    }
  }
  return resolved;
}

// ── Module loader shim (copied from replay-benchmark.mjs) ──
const shimPath = join(__dirname, '..', 'src', 'lib', '_node_shim_poseAnalysis.mjs');
const shimContent = `
// Auto-generated shim for Node.js benchmark replay.
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
  const out = landmarksArray.map(frame => frame ? frame.map(lm => ({ ...lm })) : null);
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
          const lmB = out[before][li]; const lmA = out[after][li];
          out[f][li].x = lmB.x + t * (lmA.x - lmB.x);
          out[f][li].y = lmB.y + t * (lmA.y - lmB.y);
          out[f][li].z = (lmB.z || 0) + t * ((lmA.z || 0) - (lmB.z || 0));
          out[f][li].visibility = lmB.visibility + t * (lmA.visibility - lmB.visibility);
        } else {
          const ref = hasBefore ? out[before][li] : out[after][li];
          out[f][li].x = ref.x; out[f][li].y = ref.y; out[f][li].z = ref.z || 0;
        }
      }
    }
  }
  return out;
}

export function getImageLandmarker() { return null; }
export function detectPoseImage() { return null; }
export function selectSubjectPose() { return null; }
export function drawSkeleton() {}
export function loadModelWithRetry() { return Promise.resolve(null); }
`;
writeFileSync(shimPath, shimContent);

// Patch exercises.js to replace import.meta.env.BASE_URL (Vite-only) with '/'
const exercisesPath = join(__dirname, '..', 'src', 'lib', 'exercises.js');
const exercisesOriginal = readFileSync(exercisesPath, 'utf-8');
const exercisesPatched = exercisesOriginal.replace(/import\.meta\.env\.BASE_URL/g, "'/'");
if (exercisesPatched !== exercisesOriginal) {
  writeFileSync(exercisesPath, exercisesPatched);
}

import module from 'node:module';

const shimUrl = new URL('../src/lib/_node_shim_poseAnalysis.mjs', import.meta.url).href;

if (module.registerHooks) {
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

// ── Import RepCounter after loader hooks are set up ──
const { RepCounter } = await import('../src/lib/repCounter.js');

// Restore exercises.js if it was patched
if (exercisesPatched !== exercisesOriginal) {
  writeFileSync(exercisesPath, exercisesOriginal);
}

// ── Resolve which videos to process ──
const targets = resolveVideos(cache, targetPrefixes);
if (targets.length === 0) {
  console.error('No matching videos found. Available videos:');
  cache.forEach(v => console.error(' ', v.video));
  process.exit(1);
}

// ── Run diagnostics for each video ──
for (const video of targets) {
  const { video: name, exercise, expected, fps, landmarks } = video;

  console.log('='.repeat(72));
  console.log(`VIDEO:    ${name}`);
  console.log(`Exercise: ${exercise}  |  Expected reps: ${expected}  |  FPS: ${fps}`);
  console.log(`Frames:   ${landmarks?.length ?? 0}`);
  console.log('='.repeat(72));

  if (!landmarks || landmarks.length === 0) {
    console.log('  (no landmarks — skipping)\n');
    continue;
  }

  let counter;
  try {
    counter = new RepCounter(exercise, { fps, mode: 'video' });
    for (const lm of landmarks) {
      counter.update(lm);
    }
    counter.finalize();
  } catch (err) {
    console.log(`  ERROR: ${err.message}\n`);
    continue;
  }

  const actual = counter.reps || 0;
  const diag = counter.diagnostics || {};

  console.log(`\nResult:   got=${actual}  expected=${expected}  error=${actual - expected >= 0 ? '+' : ''}${actual - expected}`);
  console.log(`Method:   ${diag.method || '(none)'}`);
  console.log(`Signal range: ${diag.observedRange ?? '?'} deg  (min=${diag.observedMin ?? '?'}, max=${diag.observedMax ?? '?'})`);

  // ── Top 10 adaptive candidates ──
  const adaptiveCands = counter._adaptiveDiag;
  if (adaptiveCands && adaptiveCands.length > 0) {
    const sorted = [...adaptiveCands].sort((a, b) => b.score - a.score);
    const top10 = sorted.slice(0, 10);
    const winnerName = counter._adaptedSignalName;

    console.log(`\nTop 10 adaptive candidate signals (winner: ${winnerName}):`);
    console.log(`  ${'Signal'.padEnd(28)} ${'Reps'.padStart(4)} ${'Score'.padStart(8)} ${'Consistency'.padStart(12)}`);
    console.log(`  ${'-'.repeat(56)}`);
    for (const c of top10) {
      const isWinner = c.name === winnerName ? ' <-- WINNER' : '';
      console.log(
        `  ${c.name.padEnd(28)} ${String(c.reps).padStart(4)} ${c.score.toFixed(3).padStart(8)} ${c.consistency.toFixed(4).padStart(12)}${isWinner}`
      );
    }
  } else {
    console.log('\n  (no adaptive candidate diagnostics available)');
  }

  // ── Raw smoothed signal for the winning signal ──
  // Re-run the counter with internal signal capture patched in
  // by accessing private fields after finalize (they are already computed).
  // The winning signal is stored implicitly; we reconstruct it by re-running
  // with a minimal patch that captures _adaptiveSignalSelect output.

  // The counter stores _adaptiveDiag but not the actual signal values after
  // finalize() clears _collectedLandmarks. We must reconstruct it.
  // Re-run a fresh counter with signal capture.
  console.log(`\nReconstructing winning signal ("${counter._adaptedSignalName}") via second pass...`);

  let winningSignalValues = null;
  let winningSignalName = null;

  try {
    const counter2 = new RepCounter(exercise, { fps, mode: 'video' });

    // Monkey-patch _adaptiveSignalSelect to capture the winning signal
    const origAdaptive = counter2._adaptiveSignalSelect.bind(counter2);
    counter2._adaptiveSignalSelect = function(cleanedLandmarks, primarySmoothed) {
      const result = origAdaptive(cleanedLandmarks, primarySmoothed);
      winningSignalValues = result.signal.slice(); // copy
      winningSignalName = result.name;
      return result;
    };

    for (const lm of landmarks) {
      counter2.update(lm);
    }
    counter2.finalize();
  } catch (err) {
    console.log(`  (signal reconstruction failed: ${err.message})`);
  }

  if (winningSignalValues) {
    const N = winningSignalValues.length;
    const minVal = Math.min(...winningSignalValues).toFixed(2);
    const maxVal = Math.max(...winningSignalValues).toFixed(2);
    const range = (Math.max(...winningSignalValues) - Math.min(...winningSignalValues)).toFixed(2);

    console.log(`\nWinning signal: "${winningSignalName}"  (${N} frames)`);
    console.log(`  min=${minVal}  max=${maxVal}  range=${range}`);
    console.log(`\n  Frame-by-frame smoothed values (all ${N} frames):`);

    // Print in rows of 10 for readability
    const ROW = 10;
    for (let i = 0; i < N; i += ROW) {
      const slice = winningSignalValues.slice(i, i + ROW);
      const label = String(i).padStart(4);
      const vals = slice.map(v => (v == null ? '  null' : v.toFixed(1).padStart(7))).join(' ');
      console.log(`  [${label}] ${vals}`);
    }
  } else {
    console.log('  (could not reconstruct signal)');
  }

  console.log('');
}
