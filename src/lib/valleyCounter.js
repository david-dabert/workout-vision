/**
 * Valley counting — pure signal processing extracted from RepCounter.
 *
 * A rep is a valley (local minimum) in the tracking signal. This module
 * provides all the signal-level operations: valley detection, bilateral
 * prominence filtering, autocorrelation edge correction, template edge
 * correction, and signal smoothing/interpolation.
 *
 * Every function is stateless: takes a signal array + config, returns results.
 * No MediaPipe, no exercise definitions, no React — just math on arrays.
 */

// ---------------------------------------------------------------------------
// Interpolate null values (forward-fill, backward-fill, zero-fill remainder)
// ---------------------------------------------------------------------------

export function interpolateNulls(signal) {
  const out = [...signal];
  const N = out.length;

  let lastValid = null;
  for (let i = 0; i < N; i++) {
    if (out[i] !== null) lastValid = out[i];
    else if (lastValid !== null) out[i] = lastValid;
  }
  lastValid = null;
  for (let i = N - 1; i >= 0; i--) {
    if (out[i] !== null) lastValid = out[i];
    else if (lastValid !== null) out[i] = lastValid;
  }
  for (let i = 0; i < N; i++) {
    if (out[i] === null) out[i] = 0;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Moving average smoothing
// ---------------------------------------------------------------------------

export function smoothSignal(signal, windowSize) {
  const half = Math.floor(windowSize / 2);
  const out = new Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(signal.length - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += signal[j];
    out[i] = sum / (hi - lo + 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Median interval between sorted frame indices
// ---------------------------------------------------------------------------

export function medianIntervalFrames(frames) {
  if (frames.length < 2) return Infinity;
  const gaps = [];
  for (let i = 1; i < frames.length; i++) gaps.push(frames[i] - frames[i - 1]);
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

// ---------------------------------------------------------------------------
// Core valley finder
//
// Finds local minima with bilateral prominence filtering.
//   exercise.amplitudeRatio: min prominence as fraction of signal range (default 0.20)
//   exercise.minSpacing: min seconds between valleys (default 0.4)
//   fps: frames per second
// ---------------------------------------------------------------------------

export function findValleys(signal, fps, exercise) {
  let sigMin = Infinity, sigMax = -Infinity;
  for (let i = 0; i < signal.length; i++) {
    if (signal[i] < sigMin) sigMin = signal[i];
    if (signal[i] > sigMax) sigMax = signal[i];
  }
  const signalRange = sigMax - sigMin;

  if (signalRange < 10) {
    return { reps: 0, allValleys: 0, valleyFrames: [], signalRange };
  }

  const ampRatio = (exercise.amplitudeRatio != null) ? exercise.amplitudeRatio : 0.20;
  const minAmplitude = signalRange * ampRatio;

  const hwSec = Math.min(0.2, (exercise.minSpacing != null) ? exercise.minSpacing * 0.6 : 0.2);
  const halfWindow = Math.max(2, Math.round(fps * hwSec));
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

  const filterWithSpacing = (minGap) => {
    const frames = [];
    let last = -Infinity;
    for (const v of allValleys) {
      if (v - last < minGap) continue;
      const searchStart = last > 0 ? last : Math.max(0, v - Math.round(fps * 3));
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
        frames.push(v);
        last = v;
      }
    }
    return frames;
  };

  const minSpacingSec = (exercise.minSpacing != null) ? exercise.minSpacing : 0.4;
  const generousGap = Math.max(2, Math.round(fps * minSpacingSec));
  const pass1 = filterWithSpacing(generousGap);

  let valleyFrames;
  if (pass1.length >= 2) {
    const gaps = [];
    for (let i = 1; i < pass1.length; i++) gaps.push(pass1[i] - pass1[i - 1]);
    gaps.sort((a, b) => a - b);
    const medianGap = gaps[Math.floor(gaps.length / 2)];
    const medianSeconds = medianGap / fps;

    if (medianSeconds > 2.5) {
      const tightGap = Math.round(fps * 2.5);
      valleyFrames = filterWithSpacing(tightGap);
    } else {
      valleyFrames = pass1;
    }
  } else {
    valleyFrames = pass1;
  }

  return { reps: valleyFrames.length, allValleys: allValleys.length, valleyFrames, signalRange };
}

// ---------------------------------------------------------------------------
// Peak-valley reconciliation
//
// Applied to the final winning signal only. If inverted signal has exactly
// one more peak than forward signal has valleys, recover the edge valley.
// ---------------------------------------------------------------------------

export function reconcilePeaksAndValleys(signal, valleyResult, fps, exercise) {
  if (valleyResult.reps < 2) return valleyResult;

  const inverted = signal.map(v => -v);
  const peakResult = findValleys(inverted, fps, exercise);

  if (peakResult.reps !== valleyResult.reps + 1) return valleyResult;

  const edgeZone = Math.round(signal.length * 0.20);
  const medianGap = medianIntervalFrames(valleyResult.valleyFrames);

  let orphanPeakFrame = null;
  for (const pf of peakResult.valleyFrames) {
    const nearestDist = valleyResult.valleyFrames.reduce(
      (best, vf) => Math.min(best, Math.abs(pf - vf)), Infinity
    );
    if (nearestDist > medianGap * 0.3) {
      if (pf < edgeZone || pf > signal.length - edgeZone) {
        orphanPeakFrame = pf;
      }
      break;
    }
  }

  if (orphanPeakFrame === null) return valleyResult;

  const searchRadius = Math.round(medianGap * 0.5);
  const lo = Math.max(0, orphanPeakFrame - searchRadius);
  const hi = Math.min(signal.length - 1, orphanPeakFrame + searchRadius);
  let bestFrame = orphanPeakFrame;
  let bestVal = signal[orphanPeakFrame];
  for (let j = lo; j <= hi; j++) {
    if (signal[j] < bestVal) { bestVal = signal[j]; bestFrame = j; }
  }

  const mergedFrames = [...valleyResult.valleyFrames, bestFrame].sort((a, b) => a - b);
  const minGap = Math.max(2, Math.round(fps * 0.3));
  const dedupedFrames = [mergedFrames[0]];
  for (let i = 1; i < mergedFrames.length; i++) {
    if (mergedFrames[i] - dedupedFrames[dedupedFrames.length - 1] >= minGap) {
      dedupedFrames.push(mergedFrames[i]);
    }
  }

  return { reps: dedupedFrames.length, allValleys: valleyResult.allValleys, valleyFrames: dedupedFrames, signalRange: valleyResult.signalRange };
}

// ---------------------------------------------------------------------------
// Autocorrelation-based edge correction
//
// Valley counting misses edge reps because bilateral prominence needs peaks
// on both sides. Autocorrelation uses the entire signal shape to estimate
// the dominant period, which is robust to edge truncation.
// ---------------------------------------------------------------------------

export function autocorrelationEdgeCorrect(signal, valleyResult, fps) {
  if (valleyResult.reps < 3) return valleyResult;

  const N = signal.length;
  const mean = signal.reduce((a, b) => a + b, 0) / N;
  const centered = signal.map(v => v - mean);

  const minLag = Math.max(3, Math.round(fps * 0.3));
  const maxLag = Math.min(Math.floor(N / 2), Math.round(fps * 10));

  let bestLag = 0;
  let bestCorr = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let t = 0; t < N - lag; t++) {
      corr += centered[t] * centered[t + lag];
    }
    corr /= (N - lag);
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  if (bestLag === 0) return valleyResult;

  const acReps = Math.round(N / bestLag);
  const valleyMedianGap = medianIntervalFrames(valleyResult.valleyFrames);
  const periodAgreement = valleyMedianGap < Infinity
    ? Math.min(bestLag, valleyMedianGap) / Math.max(bestLag, valleyMedianGap)
    : 0;

  if (acReps === valleyResult.reps + 1 && periodAgreement > 0.7) {
    const firstValley = valleyResult.valleyFrames[0];
    const lastValley = valleyResult.valleyFrames[valleyResult.valleyFrames.length - 1];
    const expectedPeriod = bestLag;

    const startGap = firstValley;
    const endGap = N - 1 - lastValley;

    let edgeFrame = -1;
    if (startGap > expectedPeriod * 0.7) {
      const target = Math.round(firstValley - expectedPeriod);
      if (target >= 0) {
        const lo = Math.max(0, target - Math.round(expectedPeriod * 0.3));
        const hi = Math.min(firstValley - 1, target + Math.round(expectedPeriod * 0.3));
        let bestV = signal[lo];
        edgeFrame = lo;
        for (let j = lo; j <= hi; j++) {
          if (signal[j] < bestV) { bestV = signal[j]; edgeFrame = j; }
        }
      }
    } else if (endGap > expectedPeriod * 0.7) {
      const target = Math.round(lastValley + expectedPeriod);
      if (target < N) {
        const lo = Math.max(lastValley + 1, target - Math.round(expectedPeriod * 0.3));
        const hi = Math.min(N - 1, target + Math.round(expectedPeriod * 0.3));
        let bestV = signal[lo];
        edgeFrame = lo;
        for (let j = lo; j <= hi; j++) {
          if (signal[j] < bestV) { bestV = signal[j]; edgeFrame = j; }
        }
      }
    }

    if (edgeFrame >= 0) {
      const newFrames = [...valleyResult.valleyFrames, edgeFrame].sort((a, b) => a - b);
      return { reps: newFrames.length, allValleys: valleyResult.allValleys, valleyFrames: newFrames, signalRange: valleyResult.signalRange };
    }

    // Check for double-wide interior gap (merged double-cycle)
    const frames = valleyResult.valleyFrames;
    let widestGapIdx = -1;
    let widestGap = 0;
    for (let i = 1; i < frames.length; i++) {
      const gap = frames[i] - frames[i - 1];
      if (gap > widestGap) { widestGap = gap; widestGapIdx = i; }
    }
    if (widestGap > expectedPeriod * 1.5 && widestGap < expectedPeriod * 2.5) {
      const lo = frames[widestGapIdx - 1] + Math.round(expectedPeriod * 0.3);
      const hi = frames[widestGapIdx] - Math.round(expectedPeriod * 0.3);
      if (lo < hi) {
        let bestV = signal[lo];
        let insertFrame = lo;
        for (let j = lo; j <= hi; j++) {
          if (signal[j] < bestV) { bestV = signal[j]; insertFrame = j; }
        }
        const newFrames = [...frames, insertFrame].sort((a, b) => a - b);
        return { reps: newFrames.length, allValleys: valleyResult.allValleys, valleyFrames: newFrames, signalRange: valleyResult.signalRange };
      }
    }
  }

  return valleyResult;
}

// ---------------------------------------------------------------------------
// Template-based edge correction
//
// Period-locked valley recovery: if edge gap matches the median inter-valley
// period, look for a valley candidate at the expected position and recover
// it if prominence and depth match the established pattern.
// ---------------------------------------------------------------------------

export function templateEdgeCorrect(signal, valleyResult, fps, exercise) {
  if (valleyResult.reps < 3) return valleyResult;

  const frames = valleyResult.valleyFrames;
  const N = signal.length;

  const period = medianIntervalFrames(frames);
  if (period < 4 || period === Infinity) return valleyResult;

  const sigMin = signal.reduce((a, b) => Math.min(a, b));
  const sigMax = signal.reduce((a, b) => Math.max(a, b));
  const signalRange = sigMax - sigMin;
  const ampRatio = (exercise.amplitudeRatio != null) ? exercise.amplitudeRatio : 0.20;
  const minAmplitude = signalRange * ampRatio;

  const valleyDepths = frames.map(f => signal[f]);
  valleyDepths.sort((a, b) => a - b);
  const medianDepth = valleyDepths[Math.floor(valleyDepths.length / 2)];
  const depthRange = valleyDepths[valleyDepths.length - 1] - valleyDepths[0];
  const depthTolerance = Math.max(depthRange * 0.5, signalRange * 0.10);

  const newFrames = [...frames];
  let changed = false;
  const diag = { period, medianDepth: Math.round(medianDepth * 10) / 10, left: null, right: null };

  // RIGHT edge
  const lastV = frames[frames.length - 1];
  const rightGap = N - 1 - lastV;
  diag.rightRatio = Math.round((rightGap / period) * 100) / 100;
  if (rightGap >= period * 0.8 && rightGap <= period * 1.2) {
    const target = lastV + period;
    const lo = Math.max(lastV + Math.round(period * 0.4), 0);
    const hi = Math.min(N - 1, target + Math.round(period * 0.3));
    let bestVal = Infinity, bestIdx = -1;
    for (let i = lo; i <= hi; i++) {
      if (signal[i] < bestVal) { bestVal = signal[i]; bestIdx = i; }
    }

    if (bestIdx >= 0) {
      let peakBefore = signal[lastV];
      for (let j = lastV; j < bestIdx; j++) {
        if (signal[j] > peakBefore) peakBefore = signal[j];
      }
      const prominence = peakBefore - bestVal;
      const depthMatch = Math.abs(bestVal - medianDepth) <= depthTolerance;

      diag.right = { gap: rightGap, prom: Math.round(prominence * 10) / 10, val: Math.round(bestVal * 10) / 10, depthMatch, added: false };

      if (prominence >= minAmplitude && depthMatch) {
        newFrames.push(bestIdx);
        changed = true;
        diag.right.added = true;
      }
    }
  }

  // LEFT edge
  const leftGap = frames[0];
  diag.leftRatio = Math.round((leftGap / period) * 100) / 100;
  if (!changed && leftGap >= period * 0.8 && leftGap <= period * 1.2) {
    const target = frames[0] - period;
    const lo = Math.max(0, target - Math.round(period * 0.3));
    const hi = Math.min(frames[0] - Math.round(period * 0.4), frames[0] - 1);
    let bestVal = Infinity, bestIdx = -1;
    for (let i = lo; i <= hi; i++) {
      if (signal[i] < bestVal) { bestVal = signal[i]; bestIdx = i; }
    }

    if (bestIdx >= 0) {
      let peakAfter = signal[frames[0]];
      for (let j = bestIdx + 1; j <= frames[0]; j++) {
        if (signal[j] > peakAfter) peakAfter = signal[j];
      }
      const prominence = peakAfter - bestVal;
      const depthMatch = Math.abs(bestVal - medianDepth) <= depthTolerance;

      diag.left = { gap: leftGap, prom: Math.round(prominence * 10) / 10, val: Math.round(bestVal * 10) / 10, depthMatch, added: false };

      if (prominence >= minAmplitude && depthMatch && bestIdx >= 3) {
        newFrames.unshift(bestIdx);
        changed = true;
        diag.left.added = true;
      }
    }
  }

  if (changed) {
    newFrames.sort((a, b) => a - b);
    return { reps: newFrames.length, allValleys: valleyResult.allValleys, valleyFrames: newFrames, signalRange: valleyResult.signalRange, _templateDiag: diag };
  }

  return { ...valleyResult, _templateDiag: diag };
}
