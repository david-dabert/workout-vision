/**
 * Offline test of _countValleys logic.
 * Generates synthetic signals matching real video data, runs the counter,
 * and reports pass/fail. No browser needed.
 *
 * Run: node test_valley_counter.mjs
 */

// ── Extract the valley counting logic (pure function, no class dependency) ──

function countValleys(signal, fps) {
  let sigMin = Infinity, sigMax = -Infinity;
  for (let i = 0; i < signal.length; i++) {
    if (signal[i] < sigMin) sigMin = signal[i];
    if (signal[i] > sigMax) sigMax = signal[i];
  }
  const signalRange = sigMax - sigMin;

  if (signalRange < 15) {
    return { reps: 0, allValleys: 0, valleyFrames: [], signalRange };
  }

  const minFramesBetweenReps = Math.round(fps * 1.5);
  const minAmplitude = Math.max(40, signalRange * 0.35);

  // Find local minima that are deepest in ±halfWindow neighborhood
  const halfWindow = Math.max(3, Math.round(fps * 0.5));
  const allValleys = [];
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] < signal[i - 1] && signal[i] <= signal[i + 1]) {
      let isDeepest = true;
      const lo = Math.max(0, i - halfWindow);
      const hi = Math.min(signal.length - 1, i + halfWindow);
      for (let k = lo; k <= hi; k++) {
        if (signal[k] < signal[i]) { isDeepest = false; break; }
      }
      if (isDeepest) allValleys.push(i);
    }
  }

  // Filter: spacing and prominence (both sides)
  const valleyFrames = [];
  let lastValley = -Infinity;

  for (const v of allValleys) {
    if (v - lastValley < minFramesBetweenReps) continue;

    const searchStart = lastValley > 0 ? lastValley : Math.max(0, v - Math.round(fps * 3));
    let peakBefore = signal[v];
    for (let j = searchStart; j < v; j++) {
      if (signal[j] > peakBefore) peakBefore = signal[j];
    }

    const searchEnd = Math.min(signal.length, v + Math.round(fps * 3));
    let peakAfter = signal[v];
    for (let j = v + 1; j < searchEnd; j++) {
      if (signal[j] > peakAfter) peakAfter = signal[j];
    }

    const prominence = Math.min(peakBefore - signal[v], peakAfter - signal[v]);
    if (prominence >= minAmplitude) {
      valleyFrames.push(v);
      lastValley = v;
    }
  }

  return { reps: valleyFrames.length, allValleys: allValleys.length, valleyFrames, signalRange, minAmplitude, minFramesBetweenReps };
}

// ── Signal generators ──

function generateCleanCurlSignal(numReps, totalFrames, minAngle, maxAngle) {
  // Clean sinusoidal bicep curl: high (extended) -> low (curled) -> high
  const signal = [];
  for (let i = 0; i < totalFrames; i++) {
    const t = i / totalFrames;
    // Cosine wave: starts high, dips low numReps times
    const angle = (maxAngle + minAngle) / 2 +
      ((maxAngle - minAngle) / 2) * Math.cos(2 * Math.PI * numReps * t);
    signal.push(angle);
  }
  return signal;
}

function addNoise(signal, noiseAmplitude) {
  // Add random noise to simulate real sensor jitter
  return signal.map(v => v + (Math.random() - 0.5) * 2 * noiseAmplitude);
}

function addRealisticNoise(signal, noiseAmplitude) {
  // Correlated noise (more realistic than pure random)
  const noisy = [...signal];
  let drift = 0;
  for (let i = 0; i < noisy.length; i++) {
    drift += (Math.random() - 0.5) * noiseAmplitude * 0.5;
    drift *= 0.9; // mean-revert
    noisy[i] += drift + (Math.random() - 0.5) * noiseAmplitude;
  }
  return noisy;
}

// ── Tests ──

let passed = 0;
let failed = 0;

function test(name, signal, fps, expectedReps) {
  const result = countValleys(signal, fps);
  const ok = result.reps === expectedReps;
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`${status}: ${name} — expected ${expectedReps}, got ${result.reps} (raw valleys: ${result.allValleys}, range: ${result.signalRange.toFixed(1)}°, minAmp: ${result.minAmplitude?.toFixed(1)}°, minFrames: ${result.minFramesBetweenReps})`);
  if (!ok) {
    console.log(`  Valley frames: [${result.valleyFrames.join(', ')}]`);
    failed++;
  } else {
    passed++;
  }
}

console.log('=== Valley Counter Tests ===\n');

// Test 1: Exact match to user's 7-rep video
// IMG_9621.mov: 7 reps, 238 frames, 10fps, range 53.7°-176.3°
console.log('--- Test group: 7-rep bicep curl (matches user video) ---');
const clean7 = generateCleanCurlSignal(7, 238, 54, 176);
test('Clean 7 reps, 238 frames, 10fps', clean7, 10, 7);

const noisy7_5 = addNoise(clean7, 5);
test('7 reps + 5° random noise', noisy7_5, 10, 7);

const noisy7_10 = addNoise(clean7, 10);
test('7 reps + 10° random noise', noisy7_10, 10, 7);

const noisy7_15 = addRealisticNoise(clean7, 15);
test('7 reps + 15° realistic correlated noise', noisy7_15, 10, 7);

// Test 2: Other rep counts
console.log('\n--- Test group: various rep counts ---');
const clean5 = generateCleanCurlSignal(5, 180, 60, 170);
test('Clean 5 reps, 180 frames, 10fps', clean5, 10, 5);

const clean10 = generateCleanCurlSignal(10, 340, 50, 175);
test('Clean 10 reps, 340 frames, 10fps', clean10, 10, 10);

const clean3 = generateCleanCurlSignal(3, 100, 55, 170);
test('Clean 3 reps, 100 frames, 10fps', clean3, 10, 3);

const clean12 = generateCleanCurlSignal(12, 400, 60, 165);
test('Clean 12 reps, 400 frames, 10fps', clean12, 10, 12);

const clean1 = generateCleanCurlSignal(1, 35, 55, 170);
test('Clean 1 rep, 35 frames, 10fps', clean1, 10, 1);

// Test 3: Noisy versions
console.log('\n--- Test group: noisy signals ---');
const noisy5 = addRealisticNoise(clean5, 12);
test('5 reps + 12° noise', noisy5, 10, 5);

const noisy10 = addRealisticNoise(clean10, 10);
test('10 reps + 10° noise', noisy10, 10, 10);

const noisy12 = addRealisticNoise(clean12, 8);
test('12 reps + 8° noise', noisy12, 10, 12);

// Test 4: Edge cases
console.log('\n--- Test group: edge cases ---');
const flat = Array(100).fill(150);
test('Flat signal (no reps)', flat, 10, 0);

const tinyRange = generateCleanCurlSignal(5, 150, 140, 150);
test('Tiny range (10°, should be 0)', tinyRange, 10, 0);

// Test 5: Different FPS
console.log('\n--- Test group: different FPS ---');
const clean7_30fps = generateCleanCurlSignal(7, 714, 54, 176); // 24s at 30fps
test('Clean 7 reps at 30fps, 714 frames', clean7_30fps, 30, 7);

const noisy7_30fps = addRealisticNoise(clean7_30fps, 10);
test('7 reps at 30fps + 10° noise', noisy7_30fps, 30, 7);

// Test 6: Second user video characteristics
// IMG_9582.mov: 360 frames, 10fps, range 26.7°-164.2° (137.5°)
// Unknown rep count - let's test with plausible counts
console.log('\n--- Test group: second video characteristics (360 frames, 10fps) ---');
const clean10_v2 = generateCleanCurlSignal(10, 360, 27, 164);
test('Clean 10 reps, 360 frames, range 27-164', clean10_v2, 10, 10);

const noisy10_v2 = addRealisticNoise(clean10_v2, 12);
test('10 reps + 12° noise, 360 frames', noisy10_v2, 10, 10);

// Summary
console.log(`\n=== Results: ${passed} passed, ${failed} failed out of ${passed + failed} ===`);
process.exit(failed > 0 ? 1 : 0);
