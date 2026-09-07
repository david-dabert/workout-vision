/**
 * Recalibration engine.
 *
 * When the user corrects the rep count (e.g., AI detected 8 but user says 10),
 * this module re-segments the signal into the user-specified number of reps
 * and re-runs the full analysis pipeline: biomechanics, form scoring, velocity,
 * fatigue, report generation.
 *
 * Strategy: use the primary tracking signal to find N valleys closest to
 * evenly-spaced positions. This respects the actual movement pattern rather
 * than blindly dividing by time.
 */

import { EXERCISES } from './exercises';
import { extractJointAngles } from './poseAnalysis';
import { analyzeSet } from './biomechanics';
import { generateWorkoutReport } from './coach';
import { VelocityEngine } from './VelocityEngine';
import { ProgressionScore } from './ProgressionScore';

/**
 * Smooth a signal with a moving average.
 */
function smooth(signal, window) {
  const out = new Array(signal.length);
  const half = Math.floor(window / 2);
  for (let i = 0; i < signal.length; i++) {
    let sum = 0, count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(signal.length - 1, i + half); j++) {
      if (signal[j] !== null) { sum += signal[j]; count++; }
    }
    out[i] = count > 0 ? sum / count : signal[i];
  }
  return out;
}

/**
 * Interpolate null values in a signal.
 */
function interpolateNulls(signal) {
  const out = [...signal];
  let lastValid = null;
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== null) lastValid = out[i];
    else if (lastValid !== null) out[i] = lastValid;
  }
  // Backwards fill for leading nulls
  let firstValid = null;
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i] !== null) firstValid = out[i];
    else if (firstValid !== null) out[i] = firstValid;
  }
  return out;
}

/**
 * Find the N best valleys in a signal, preferring positions near evenly-spaced targets.
 * Returns array of frame indices where valleys (rep bottoms) occur.
 */
function findNValleys(signal, n) {
  if (n <= 0 || signal.length < 3) return [];

  // Find ALL local minima
  const allMinima = [];
  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] <= signal[i - 1] && signal[i] <= signal[i + 1]) {
      allMinima.push(i);
    }
  }

  if (allMinima.length === 0) {
    // No minima found: evenly divide
    const step = signal.length / (n + 1);
    return Array.from({ length: n }, (_, i) => Math.round(step * (i + 1)));
  }

  if (allMinima.length <= n) {
    // Fewer minima than requested: use all minima, then fill gaps with evenly-spaced points
    const result = [...allMinima];
    while (result.length < n) {
      // Find the largest gap and split it
      let maxGap = -1, gapIdx = 0;
      const sorted = result.sort((a, b) => a - b);
      // Check gap before first
      if (sorted[0] > maxGap) { maxGap = sorted[0]; gapIdx = -1; }
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = sorted[i + 1] - sorted[i];
        if (gap > maxGap) { maxGap = gap; gapIdx = i; }
      }
      // Check gap after last
      if (signal.length - 1 - sorted[sorted.length - 1] > maxGap) {
        gapIdx = sorted.length - 1;
      }
      if (gapIdx === -1) result.push(Math.round(sorted[0] / 2));
      else if (gapIdx === sorted.length - 1) result.push(Math.round((sorted[gapIdx] + signal.length - 1) / 2));
      else result.push(Math.round((sorted[gapIdx] + sorted[gapIdx + 1]) / 2));
    }
    return result.sort((a, b) => a - b).slice(0, n);
  }

  // More minima than requested: pick the N deepest that are also well-spaced
  // Score each minimum by depth (deeper = better) and proximity to ideal spacing
  const idealSpacing = signal.length / (n + 1);
  const depths = allMinima.map(i => {
    // Depth: how far below the neighboring peaks
    let leftPeak = signal[i], rightPeak = signal[i];
    for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
      if (signal[j] > leftPeak) leftPeak = signal[j];
    }
    for (let j = i + 1; j <= Math.min(signal.length - 1, i + 20); j++) {
      if (signal[j] > rightPeak) rightPeak = signal[j];
    }
    return Math.min(leftPeak - signal[i], rightPeak - signal[i]);
  });

  // Greedy selection: pick deepest, then pick next deepest that's far enough from selected
  const minGap = idealSpacing * 0.4;
  const selected = [];
  const ranked = allMinima.map((idx, i) => ({ idx, depth: depths[i] }))
    .sort((a, b) => b.depth - a.depth);

  for (const candidate of ranked) {
    if (selected.length >= n) break;
    const tooClose = selected.some(s => Math.abs(s - candidate.idx) < minGap);
    if (!tooClose) selected.push(candidate.idx);
  }

  return selected.sort((a, b) => a - b);
}

/**
 * Build rep boundaries (cycles) from valley positions.
 */
function buildCyclesFromValleys(valleys, signal, totalFrames) {
  const cycles = [];
  for (let i = 0; i < valleys.length; i++) {
    const vFrame = valleys[i];
    const searchStart = i > 0 ? valleys[i - 1] : 0;
    const searchEnd = i < valleys.length - 1 ? valleys[i + 1] : totalFrames - 1;

    // Find peak before valley
    let peakFrame = searchStart;
    let peakVal = signal[searchStart];
    for (let j = searchStart; j < vFrame; j++) {
      if (signal[j] > peakVal) { peakVal = signal[j]; peakFrame = j; }
    }

    // Find peak after valley (end of rep)
    let endFrame = vFrame;
    let endVal = signal[vFrame];
    for (let j = vFrame; j <= searchEnd; j++) {
      if (signal[j] > endVal) { endVal = signal[j]; endFrame = j; }
    }

    cycles.push({
      start: peakFrame,
      end: endFrame,
      min: signal[vFrame],
      max: Math.max(peakVal, endVal),
      amplitude: Math.max(peakVal, endVal) - signal[vFrame],
      duration: endFrame - peakFrame,
    });
  }
  return cycles;
}

/**
 * Run form checks on a cycle (simplified version of RepCounter._buildFormHistoryFromCycles).
 */
function evaluateFormForCycle(cycle, landmarks, exercise) {
  const checks = exercise.formChecks || [];
  if (checks.length === 0) {
    return { score: 70, issues: [], startFrame: cycle.start, endFrame: cycle.end, bottomFrame: Math.round((cycle.start + cycle.end) / 2), rom: cycle.amplitude };
  }

  const startFrame = cycle.start;
  const endFrame = Math.min(cycle.end, landmarks.length - 1);
  const sampleStep = Math.max(1, Math.floor((endFrame - startFrame) / 8));

  const formResults = checks.map(fc => {
    let failCount = 0, sampleCount = 0;
    let qualitySum = 0;
    const hasQualityFn = typeof fc.quality === 'function';

    for (let i = startFrame; i <= endFrame && i < landmarks.length; i += sampleStep) {
      const lm = landmarks[i];
      if (!lm) continue;
      const a = extractJointAngles(lm);
      if (!a) continue;
      sampleCount++;
      try {
        if (!fc.check(a, lm)) failCount++;
        if (hasQualityFn) qualitySum += fc.quality(a, lm);
      } catch { /* skip */ }
    }

    const quality = sampleCount > 0
      ? (hasQualityFn ? qualitySum / sampleCount : 1 - failCount / sampleCount)
      : 0;
    const passed = quality >= 0.70;

    return { name: fc.name, passed, quality: Math.round(quality * 100) / 100, bad: fc.bad };
  });

  // Weighted average of continuous quality scores (matching RepCounter logic)
  const totalQuality = formResults.reduce((s, r) => s + r.quality, 0);
  const score = formResults.length > 0 ? Math.round((totalQuality / formResults.length) * 100) : 70;
  const issues = formResults.filter(r => !r.passed).map(r => r.name);

  return {
    score,
    issues,
    startFrame: cycle.start,
    endFrame: cycle.end,
    bottomFrame: Math.round((cycle.start + cycle.end) / 2),
    rom: cycle.amplitude,
    romPercent: cycle.amplitude > 0 ? 100 : 0,
  };
}

/**
 * Recalibrate analysis with a user-specified rep count.
 *
 * @param {Object} params
 * @param {Array} params.frames - Array of { landmarks, timestamp } from replayFrames
 * @param {string} params.exerciseKey - Exercise identifier
 * @param {number} params.targetReps - User-specified rep count
 * @param {number} params.fps - Analysis FPS
 * @param {Object} [params.profile] - User profile (for height, etc.)
 * @param {number} [params.weightKg] - Weight in kg
 * @returns {Object} Recalibrated result: { repHistory, bioAnalysis, report, formScore, diagnostics }
 */
export function recalibrateAnalysis({ frames, exerciseKey, targetReps, fps, profile, weightKg = 0 }) {
  const exercise = EXERCISES[exerciseKey];
  if (!exercise || !frames || frames.length < 6 || targetReps < 1) {
    return null;
  }

  const landmarks = frames.map(f => f.landmarks || f);
  const interval = 1 / fps;

  // Extract the tracking signal
  const rawValues = landmarks.map(lm => {
    const a = extractJointAngles(lm);
    return a ? exercise.getValue(a, lm) : null;
  });

  const interpolated = smooth(interpolateNulls(rawValues), 3);

  // Handle inverted exercises (where down threshold > up threshold)
  const down = exercise.downThreshold;
  const up = exercise.upThreshold;
  const invert = down > up;
  const signal = invert ? interpolated.map(v => -v) : interpolated;

  // Find N valleys in the signal
  const valleys = findNValleys(signal, targetReps);

  // Build cycles from valleys using the non-inverted signal
  const cycles = buildCyclesFromValleys(
    valleys,
    interpolated,
    interpolated.length
  );

  // Evaluate form for each cycle
  const repHistory = cycles.map((cycle, i) => {
    const form = evaluateFormForCycle(cycle, landmarks, exercise);
    return {
      ...form,
      startTime: cycle.start * interval,
      peakTime: form.bottomFrame * interval,
      endTime: cycle.end * interval,
    };
  });

  // Run velocity analysis on rep boundaries
  try {
    const velocityEngine = new VelocityEngine(fps);
    const repBoundaries = repHistory.map(r => ({ startFrame: r.startFrame, endFrame: r.endFrame }));
    const repVelocities = velocityEngine.analyzePerRep(interpolated, repBoundaries, weightKg);
    for (let i = 0; i < repHistory.length && i < repVelocities.length; i++) {
      if (repVelocities[i]) repHistory[i].velocity = repVelocities[i];
    }
  } catch { /* non-critical */ }

  // Run biomechanics analysis with new rep boundaries
  let bioAnalysis = null;
  try {
    bioAnalysis = analyzeSet(landmarks, fps, exerciseKey, repHistory, profile?.height);
  } catch { /* non-critical */ }

  // Generate report
  let report = null;
  try {
    report = generateWorkoutReport(profile, [{
      exerciseKey, exercise: exerciseKey,
      reps: targetReps, analysis: bioAnalysis, bioAnalysis, repHistory,
    }]);
  } catch { /* non-critical */ }

  // Calculate form score
  const scoredReps = repHistory.filter(r => r.score !== null && r.score !== undefined);
  const formScore = scoredReps.length > 0
    ? Math.round(scoredReps.reduce((s, r) => s + r.score, 0) / scoredReps.length)
    : bioAnalysis?.movementQuality || 0;

  // Progression score
  let progressionScore = null;
  try {
    const formScores = repHistory.map(r => r.score).filter(s => s !== null);
    const repVelocities = repHistory.map(r => r.velocity).filter(Boolean);
    progressionScore = ProgressionScore.computeSet({
      formScores, repVelocities, reps: targetReps, weightKg,
    });
  } catch { /* non-critical */ }

  return {
    repHistory,
    bioAnalysis,
    report,
    formScore,
    reps: repHistory.length,
    diagnostics: {
      progression: progressionScore,
      recalibrated: true,
      originalReps: null, // caller fills this
      userReps: targetReps,
    },
  };
}
