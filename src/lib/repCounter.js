/**
 * Rep counting engine — autocorrelation on multi-signal fusion.
 *
 * Architecture:
 * - Pass 1: update() collects landmarks frame-by-frame (live counting via hysteresis)
 * - Pass 2: finalize() extracts 11 signals from landmarks, runs autocorrelation
 *   on each, picks the signal with highest periodicity confidence.
 *
 * The finalize pass is the source of truth for video analysis.
 * Live counting is best-effort for real-time feedback.
 */

import { extractJointAngles, LANDMARKS } from './poseAnalysis';
import { EXERCISES } from './exercises';
import { shouldSkipCheck } from './injuries';
import { extractSignals3D, SIGNAL_PRIORITY_3D } from './SignalExtractor3D';
import { VelocityEngine } from './VelocityEngine';
import { ProgressionScore } from './ProgressionScore';
import { AnthropometricNormalizer } from './AnthropometricNormalizer';

// ---------------------------------------------------------------------------
// Utility: moving average smoother (used by ExerciseAutoDetector)
// ---------------------------------------------------------------------------

export class AngleBuffer {
  constructor(windowSize = 5) {
    this._window = windowSize;
    this._buffers = {};
  }

  smooth(angles) {
    if (!angles) return null;
    const smoothed = {};
    for (const key of Object.keys(angles)) {
      if (!this._buffers[key]) this._buffers[key] = [];
      this._buffers[key].push(angles[key]);
      if (this._buffers[key].length > this._window) {
        this._buffers[key].shift();
      }
      const buf = this._buffers[key];
      smoothed[key] = buf.reduce((s, v) => s + v, 0) / buf.length;
    }
    return smoothed;
  }

  reset() {
    this._buffers = {};
  }
}

// ---------------------------------------------------------------------------
// Signal priority per exercise — which signals are most reliable
// Signals matching the exercise get a 30% confidence boost
// ---------------------------------------------------------------------------

// Signal priority now uses 3D-aware version from SignalExtractor3D
const SIGNAL_PRIORITY = SIGNAL_PRIORITY_3D;

// ---------------------------------------------------------------------------
// RepCounter
// ---------------------------------------------------------------------------

export class RepCounter {
  constructor(exerciseKey, opts = {}) {
    const ex = EXERCISES[exerciseKey];
    if (!ex) throw new Error(`Unknown exercise: ${exerciseKey}`);
    this._exercise = ex;
    this._exerciseKey = exerciseKey;
    this._fps = opts.fps || 30;
    this._userInjuries = opts.userInjuries || [];
    this._weightKg = opts.weightKg || 0;
    this._anthropometricNormalizer = new AnthropometricNormalizer();
    this.reset();
  }

  get repHistory() { return this._repHistory; }
  get reps() { return this._reps; }

  reset() {
    this._reps = 0;
    this._repHistory = [];
    this._phase = 'idle';
    this._collectedLandmarks = [];
    this._observedMin = Infinity;
    this._observedMax = -Infinity;
    this._finalized = false;
    this._lastRepTime = 0;
    this._frameIdx = 0;
    this._acfDebug = null;
    this._velocityAnalysis = null;
    this._progressionScore = null;
  }

  /**
   * Pass 1: collect landmarks and do live rep counting.
   */
  update(landmarks) {
    const rawAngles = extractJointAngles(landmarks);
    if (!rawAngles) {
      return {
        reps: this._reps, phase: this._phase, angle: null, angles: null,
        formFeedback: [], repCompleted: false, repHistory: this._repHistory,
      };
    }

    const angles = rawAngles;
    const ex = this._exercise;

    if (ex.isIsometric) {
      return {
        reps: 0, phase: 'hold',
        angle: Math.round((angles.trunk || 0) * 10) / 10, angles,
        formFeedback: this._evaluateForm(angles, landmarks),
        repCompleted: false, repHistory: [],
      };
    }

    const value = ex.getValue(angles, landmarks);
    if (value === null || value === undefined) {
      return {
        reps: this._reps, phase: this._phase, angle: null, angles,
        formFeedback: [], repCompleted: false, repHistory: this._repHistory,
      };
    }

    this._frameIdx++;
    if (value < this._observedMin) this._observedMin = value;
    if (value > this._observedMax) this._observedMax = value;
    this._collectedLandmarks.push(landmarks);

    // Anthropometric calibration from first frames
    if (!this._anthropometricNormalizer.isCalibrated) {
      this._anthropometricNormalizer.addFrame(landmarks);
    }

    // Live hysteresis counting (unchanged — best-effort for real-time)
    const down = ex.downThreshold;
    const up = ex.upThreshold;
    let repCompleted = false;
    const now = Date.now();

    if (down > up) {
      if (this._phase === 'idle' && value < down) {
        this._phase = 'concentric';
      } else if (this._phase === 'concentric' && value < up) {
        this._phase = 'contracted';
      } else if (this._phase === 'contracted' && value > down) {
        if (now - this._lastRepTime > 600) {
          this._lastRepTime = now;
          this._phase = 'idle';
          this._countLiveRep(angles, landmarks);
          repCompleted = true;
        }
      }
    } else {
      if (this._phase === 'idle' && value > down) {
        this._phase = 'concentric';
      } else if (this._phase === 'concentric' && value > up) {
        this._phase = 'contracted';
      } else if (this._phase === 'contracted' && value < down) {
        if (now - this._lastRepTime > 600) {
          this._lastRepTime = now;
          this._phase = 'idle';
          this._countLiveRep(angles, landmarks);
          repCompleted = true;
        }
      }
    }

    const formFeedback = this._evaluateForm(angles, landmarks);

    return {
      reps: this._reps, phase: this._phase,
      angle: Math.round(value * 10) / 10, angles,
      formFeedback, repCompleted,
      repHistory: this._repHistory,
    };
  }

  /**
   * Pass 2: autocorrelation-based rep counting on multi-signal fusion.
   * Extracts 11+ signals from collected landmarks, runs autocorrelation
   * on each, picks the signal with highest periodicity confidence.
   */
  finalize() {
    if (this._finalized) return;
    this._finalized = true;

    const ex = this._exercise;
    const N = this._collectedLandmarks.length;
    if (ex.isIsometric || N < 6) return;

    // ── Step 1: Extract all candidate signals ──
    const signals = this._extractSignals();

    // ── Step 2: Smooth and run autocorrelation on each ──
    // Two-tier approach: try priority signals first. Only fall back to all signals
    // if priority signals produce no results. This prevents noise signals from
    // beating the biomechanically correct signal for the exercise.
    const prioritySignals = SIGNAL_PRIORITY[this._exerciseKey] || [];

    const runACF = (signalSubset) => {
      const results = [];
      for (const sig of signalSubset) {
        const valid = sig.values.filter(v => v !== null);
        if (valid.length < 6) continue;

        const interpolated = this._interpolateNulls(sig.values);
        const smoothed = this._gaussianSmooth(interpolated, Math.max(1, Math.round(this._fps * 0.1)));
        const acf = this._autocorrelation(smoothed, sig.name);

        if (acf.confidence > 0) {
          results.push({
            name: sig.name,
            reps: acf.reps,
            confidence: acf.confidence,
            rawConfidence: acf.confidence,
            periodFrames: acf.periodFrames,
            periodSeconds: acf.periodFrames / this._fps,
          });
        }
      }
      return results;
    };

    // Tier 1: only priority signals for this exercise
    const prioritySubset = prioritySignals.length > 0
      ? signals.filter(s => prioritySignals.includes(s.name))
      : [];
    let results = runACF(prioritySubset);

    // Tier 2: fall back to all signals if priority signals found nothing
    if (results.length === 0 || results.every(r => r.reps === 0)) {
      results = runACF(signals);
    }

    // ── Step 3: Pick best signal via consensus + confidence ──
    results.sort((a, b) => b.confidence - a.confidence);

    if (results.length === 0 || results[0].reps === 0) {
      console.debug(`[RepCounter] ACF: no periodic signal found across ${signals.length} signals`);
      // Keep live count as fallback
      return;
    }

    // Consensus voting: group signals by rep count (within ±1), pick the
    // group with the most votes. Within that group, take the highest confidence.
    // This prevents a single noisy high-confidence signal from dominating.
    const countVotes = {};
    for (const r of results) {
      if (r.reps <= 0) continue;
      // Find which bucket this count belongs to (within ±1 of existing bucket)
      let matched = false;
      for (const key of Object.keys(countVotes)) {
        if (Math.abs(r.reps - parseInt(key)) <= 1) {
          countVotes[key].votes++;
          countVotes[key].totalConf += r.confidence;
          if (r.confidence > countVotes[key].bestConf) {
            countVotes[key].bestConf = r.confidence;
            countVotes[key].bestResult = r;
          }
          matched = true;
          break;
        }
      }
      if (!matched) {
        countVotes[r.reps] = { votes: 1, totalConf: r.confidence, bestConf: r.confidence, bestResult: r };
      }
    }

    // Pick the consensus winner: most votes first, then highest total confidence
    const buckets = Object.values(countVotes).sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return b.totalConf - a.totalConf;
    });

    // Use consensus winner if it has at least 2 votes AND the top-confidence
    // result disagrees with consensus. Otherwise use top confidence.
    let best;
    const topConf = results[0];
    const consensus = buckets[0];
    if (consensus.votes >= 2 && Math.abs(topConf.reps - consensus.bestResult.reps) > 1) {
      // Consensus overrides single outlier
      best = consensus.bestResult;
      console.debug(`[RepCounter] Consensus override: ${consensus.votes} signals agree on ~${best.reps} reps vs top-conf ${topConf.reps} reps`);
    } else {
      best = topConf;
    }

    if (!best || best.reps === 0) {
      console.debug(`[RepCounter] ACF: no periodic signal found across ${signals.length} signals`);
      return;
    }

    console.debug(
      `[RepCounter] ACF results:\n` +
      results.slice(0, 5).map(r =>
        `  ${r.name}: ${r.reps} reps, conf=${r.rawConfidence.toFixed(2)}${r.confidence !== r.rawConfidence ? ` (boosted ${r.confidence.toFixed(2)})` : ''}, period=${r.periodSeconds.toFixed(2)}s`
      ).join('\n')
    );
    console.debug(`[RepCounter] ACF picked: ${best.name} → ${best.reps} reps (conf=${best.confidence.toFixed(2)}, period=${best.periodSeconds.toFixed(2)}s)`);

    this._acfDebug = { allSignals: results, picked: best };

    // ── Step 4: Build rep history with form scores ──
    this._reps = best.reps;
    this._repHistory = this._buildFormHistory(best.reps, best.periodFrames);

    // ── Step 5: Velocity analysis (Convergence #2 + #6) ──
    try {
      const velocityEngine = new VelocityEngine(this._fps);
      const bestSignal = signals.find(s => s.name === best.name);
      if (bestSignal) {
        const interpolated = this._interpolateNulls(bestSignal.values);
        const smoothed = this._gaussianSmooth(interpolated, Math.max(1, Math.round(this._fps * 0.1)));

        // Per-rep velocity analysis
        const repBoundaries = this._repHistory.map(r => ({ startFrame: r.startFrame, endFrame: r.endFrame }));
        const repVelocities = velocityEngine.analyzePerRep(smoothed, repBoundaries, this._weightKg || 0);

        // Attach velocity data to rep history
        for (let i = 0; i < this._repHistory.length && i < repVelocities.length; i++) {
          if (repVelocities[i]) {
            this._repHistory[i].velocity = repVelocities[i];
          }
        }

        // Full-signal velocity analysis for fatigue detection
        const fullAnalysis = velocityEngine.analyze(smoothed, this._weightKg || 0);
        this._velocityAnalysis = {
          fatigue: fullAnalysis.fatigue,
          power: fullAnalysis.power,
          smoothness: fullAnalysis.smoothness,
        };

        // ── Step 6: Progression score (Convergence #5) ──
        const formScores = this._repHistory.map(r => r.score).filter(s => s !== null);
        this._progressionScore = ProgressionScore.computeSet({
          formScores,
          repVelocities,
          reps: best.reps,
          weightKg: this._weightKg || 0,
        });

        console.debug(
          `[RepCounter] Velocity: fatigue=${fullAnalysis.fatigue.detected ? 'YES' : 'no'} decay=${fullAnalysis.fatigue.decay}\n` +
          `[RepCounter] Progression: ${this._progressionScore.breakdown}`
        );
      }
    } catch (e) {
      console.warn('[RepCounter] Velocity/Progression analysis failed:', e.message);
    }
  }

  get diagnostics() {
    const range = this._observedMax - this._observedMin;
    return {
      observedMin: Math.round(this._observedMin * 10) / 10,
      observedMax: Math.round(this._observedMax * 10) / 10,
      observedRange: Math.round(range * 10) / 10,
      minROM: this._exercise.minROM || 0,
      repsDetected: this._reps,
      totalFrames: this._collectedLandmarks.length,
      method: this._acfDebug?.picked?.name || '',
      acf: this._acfDebug,
      velocity: this._velocityAnalysis,
      progression: this._progressionScore,
      anthropometrics: this._anthropometricNormalizer.isCalibrated
        ? { calibrated: true, bodyType: this._anthropometricNormalizer.getBodyType(), profile: this._anthropometricNormalizer.profile }
        : { calibrated: false },
    };
  }

  // ─── Private: Signal extraction (now 3D-aware via SignalExtractor3D) ───

  _extractSignals() {
    return extractSignals3D(this._collectedLandmarks);
  }

  // ─── Private: Gaussian smoothing ───

  _gaussianSmooth(signal, sigma) {
    const N = signal.length;
    const kernelSize = Math.min(N, Math.max(3, Math.round(sigma * 4) | 1));
    const half = Math.floor(kernelSize / 2);

    // Build Gaussian kernel
    const kernel = [];
    let kernelSum = 0;
    for (let i = -half; i <= half; i++) {
      const w = Math.exp(-(i * i) / (2 * sigma * sigma));
      kernel.push(w);
      kernelSum += w;
    }
    for (let i = 0; i < kernel.length; i++) kernel[i] /= kernelSum;

    // Convolve
    const out = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      let sum = 0, wsum = 0;
      for (let j = 0; j < kernel.length; j++) {
        const idx = i - half + j;
        if (idx >= 0 && idx < N) {
          sum += signal[idx] * kernel[j];
          wsum += kernel[j];
        }
      }
      out[i] = wsum > 0 ? sum / wsum : signal[i];
    }
    return Array.from(out);
  }

  // ─── Private: Interpolate null values ───

  _interpolateNulls(signal) {
    const out = [...signal];
    const N = out.length;

    // Forward fill then backward fill
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
    // If still null (all frames failed), fill with 0
    for (let i = 0; i < N; i++) {
      if (out[i] === null) out[i] = 0;
    }
    return out;
  }

  // Exercise-specific minimum rep period in seconds.
  // Calibrated against Countix ground truth rep rates.
  static _minPeriod(exerciseKey) {
    const periods = {
      battle_rope: 0.4,    // Fast reps: Countix shows 14 reps in 10s = 0.71s/rep
      deadlift: 1.5,       // Slow lift
      squat: 0.8,          // Countix shows ~1.2-1.7s/rep
      bench_press: 0.8,    // Countix shows ~1.0-2.0s/rep
      pull_up: 1.0,        // Moderate speed
    };
    return periods[exerciseKey] || 0.5;
  }

  // Check if a signal name is an angle signal (measured in degrees)
  // vs a position/distance signal (measured in normalized coords or 3D units)
  static _isAngleSignal(signalName) {
    return ['elbow_L', 'elbow_R', 'knee_L', 'knee_R', 'hip_L', 'hip_R',
            'shoulder_L', 'shoulder_R', 'trunk'].includes(signalName);
  }

  // ─── Private: Autocorrelation ───

  _autocorrelation(signal, signalName) {
    const N = signal.length;
    if (N < 6) return { reps: 0, confidence: 0, periodFrames: 0 };

    // Step 1: Detrend (subtract mean)
    const mean = signal.reduce((a, b) => a + b, 0) / N;
    const centered = signal.map(v => v - mean);

    // Step 1b: Signal ROM guard — penalize very narrow signals later
    const sigMin = Math.min(...signal);
    const sigMax = Math.max(...signal);
    const sigRange = sigMax - sigMin;

    // Step 2: Compute normalized autocorrelation
    const maxLag = Math.floor(N / 2);
    const acf = new Float64Array(maxLag);

    // Compute energy for normalization
    const energy = centered.reduce((a, b) => a + b * b, 0);
    if (energy < 1e-10) return { reps: 0, confidence: 0, periodFrames: 0 };

    for (let k = 0; k < maxLag; k++) {
      let sum = 0;
      for (let n = 0; n < N - k; n++) {
        sum += centered[n] * centered[n + k];
      }
      // Normalize by overlap count to prevent decay at high lags
      acf[k] = (sum / (N - k)) / (energy / N);
    }

    // Step 3: Find ALL significant peaks, then pick the best
    // Use exercise-specific minimum period to avoid harmonics
    const minPeriodSec = RepCounter._minPeriod(this._exerciseKey);
    const minLagFrames = Math.max(2, Math.round(this._fps * minPeriodSec));
    const maxLagFrames = Math.min(maxLag - 1, Math.round(this._fps * 6.0));

    // First, find where ACF drops below 0.3 (initial descent from lag-0)
    let searchStart = minLagFrames;
    for (let k = 1; k < minLagFrames; k++) {
      if (acf[k] < 0.3) { searchStart = k; break; }
    }
    searchStart = Math.max(searchStart, minLagFrames);

    // Collect ALL peaks above minimum threshold
    const peaks = [];
    for (let k = searchStart; k <= maxLagFrames; k++) {
      if (k > 0 && k < maxLag - 1 && acf[k] > acf[k - 1] && acf[k] >= acf[k + 1]) {
        if (acf[k] > 0.05) {
          peaks.push({ lag: k, val: acf[k] });
        }
      }
    }

    if (peaks.length === 0) {
      return { reps: 0, confidence: 0, periodFrames: 0 };
    }

    // Step 3b: Harmonic filtering — if a peak at lag L has a peak near 2L,
    // the shorter peak may be a harmonic (half-cycle). Prefer the longer period
    // if its ACF value is at least 60% of the shorter peak's value.
    // IMPORTANT: Only one promotion step. Chaining (7→14→28→56) caused severe
    // undercounting on fast exercises like battle rope (3/14 from 7→28 chain).
    const firstPeak = peaks[0]; // shortest period found
    let bestPeak = firstPeak;
    for (let i = 1; i < peaks.length; i++) {
      const ratio = peaks[i].lag / firstPeak.lag;
      // Compare against FIRST peak only (no chaining). One 2x promotion max.
      if (ratio >= 1.8 && ratio <= 2.2 && peaks[i].val >= firstPeak.val * 0.6) {
        bestPeak = peaks[i];
        break; // One promotion only
      }
    }

    // Also consider: if the highest-value peak produces a more reasonable count,
    // prefer it. "Reasonable" means 1-30 reps for the video duration.
    const highestPeak = peaks.reduce((a, b) => b.val > a.val ? b : a, peaks[0]);
    const bestReps = Math.round(N / bestPeak.lag);
    const highestReps = Math.round(N / highestPeak.lag);
    const durationSec = N / this._fps;

    // If highest peak gives a more reasonable count and is much stronger, use it
    if (highestPeak.lag !== bestPeak.lag) {
      const bestReasonable = bestReps >= 1 && bestReps <= Math.ceil(durationSec / minPeriodSec);
      const highestReasonable = highestReps >= 1 && highestReps <= Math.ceil(durationSec / minPeriodSec);
      if (highestReasonable && !bestReasonable) {
        bestPeak = highestPeak;
      } else if (highestReasonable && bestReasonable && highestPeak.val > bestPeak.val * 1.3) {
        bestPeak = highestPeak;
      }
    }

    const bestLag = bestPeak.lag;
    let bestVal = bestPeak.val;

    if (bestLag === 0 || bestVal < 0.05) {
      return { reps: 0, confidence: 0, periodFrames: 0 };
    }

    // Step 4: Count = duration / period
    const reps = Math.round(N / bestLag);

    // Step 5: Sanity clamp — max 1 rep per minimum period
    const maxReasonableReps = Math.ceil(durationSec / minPeriodSec);
    const clampedReps = Math.min(reps, maxReasonableReps);

    // Step 6: Narrow-ROM penalty — only for angle signals (measured in degrees).
    // Position signals (Y, Z) are in normalized 0-1 coords; distance signals are
    // in 3D units. Their ranges are naturally small (0.05-0.3) and would be
    // falsely penalized by degree-based thresholds.
    if (RepCounter._isAngleSignal(signalName)) {
      if (sigRange < 20) {
        bestVal *= 0.3;  // Heavy penalty for < 20° range
      } else if (sigRange < 40) {
        bestVal *= 0.6;  // Moderate penalty for 20-40° range
      } else if (sigRange < 60) {
        bestVal *= 0.85; // Light penalty for 40-60° range
      }
    }

    return {
      reps: clampedReps,
      confidence: Math.min(1, bestVal),
      periodFrames: bestLag,
    };
  }

  // ─── Private: Build form history from ACF count ───

  _buildFormHistory(repCount, periodFrames) {
    if (repCount <= 0) return [];

    const N = this._collectedLandmarks.length;
    const ex = this._exercise;
    const checks = ex.formChecks || [];
    const history = [];

    for (let r = 0; r < repCount; r++) {
      // Estimate frame range for this rep
      const startFrame = Math.round(r * periodFrames);
      const endFrame = Math.min(N - 1, Math.round((r + 1) * periodFrames));
      const midFrame = Math.round((startFrame + endFrame) / 2);

      if (startFrame >= N) break;

      let score = null;
      const issues = [];

      if (checks.length > 0) {
        const sampleStep = Math.max(1, Math.floor((endFrame - startFrame) / 8));

        const formResults = checks.map((fc) => {
          if (shouldSkipCheck(fc.name, this._userInjuries)) {
            return { name: fc.name, passed: true, bad: fc.bad, severity: 'minor', skipped: true };
          }

          let failCount = 0, sampleCount = 0;
          for (let i = startFrame; i <= endFrame && i < N; i += sampleStep) {
            const landmarks = this._collectedLandmarks[i];
            if (!landmarks) continue;
            const angles = extractJointAngles(landmarks);
            if (!angles) continue;
            sampleCount++;
            if (!fc.check(angles, landmarks)) failCount++;
          }

          const failRate = sampleCount > 0 ? failCount / sampleCount : 0;
          let passed = failRate < 0.30;

          // Anthropometric adjustment for finalized form history
          if (!passed && this._anthropometricNormalizer.isCalibrated) {
            const bodyType = this._anthropometricNormalizer.getBodyType();
            if (bodyType) {
              if ((fc.name === 'Depth' || fc.name === 'depth') && bodyType.femurType === 'long') {
                passed = failRate < 0.50; // Relax threshold for long femurs
              }
              if ((fc.name === 'Trunk angle' || fc.name === 'trunk_angle') && bodyType.torsoType === 'short') {
                passed = failRate < 0.50; // Relax threshold for short torsos
              }
            }
          }

          return { name: fc.name, passed, bad: fc.bad, severity: fc.severity };
        });

        const failedMajor = formResults.filter(f => !f.passed && f.severity === 'major').length;
        const failedMinor = formResults.filter(f => !f.passed && f.severity !== 'major').length;
        score = Math.max(0, 100 - failedMajor * 15 - failedMinor * 5);
        for (const f of formResults) {
          if (!f.passed) issues.push(f.bad);
        }
      }

      history.push({
        score,
        issues,
        ts: Date.now() + r,
        startFrame,
        bottomFrame: midFrame,
        endFrame,
      });
    }

    return history;
  }

  // ─── Private: Live counting (unchanged) ───

  _countLiveRep(angles, landmarks) {
    this._reps++;
    const formResults = this._exercise.formChecks.map((fc) => {
      const passed = fc.check(angles, landmarks);
      return { name: fc.name, passed, bad: fc.bad, severity: fc.severity };
    });

    const failedMajor = formResults.filter(f => !f.passed && f.severity === 'major').length;
    const failedMinor = formResults.filter(f => !f.passed && f.severity !== 'major').length;
    const score = Math.max(0, 100 - failedMajor * 15 - failedMinor * 5);
    const issues = formResults.filter(f => !f.passed).map(f => f.bad);

    this._repHistory.push({
      score,
      issues,
      ts: Date.now(),
      startFrame: this._frameIdx,
      bottomFrame: this._frameIdx,
      endFrame: this._frameIdx,
    });
  }

  _evaluateForm(angles, landmarks) {
    return this._exercise.formChecks.map((fc) => {
      let passed = fc.check(angles, landmarks);

      // Anthropometric adjustment: relax certain checks for extreme body proportions
      if (!passed && this._anthropometricNormalizer.isCalibrated) {
        const bodyType = this._anthropometricNormalizer.getBodyType();
        if (bodyType) {
          // Long femurs: relax depth checks (they reach parallel at a wider knee angle)
          if ((fc.name === 'Depth' || fc.name === 'depth') && bodyType.femurType === 'long') {
            passed = true; // Long femurs pass depth at wider angles than the 90-degree standard
          }
          // Short torso: relax trunk angle checks (more forward lean is biomechanically necessary)
          if ((fc.name === 'Trunk angle' || fc.name === 'trunk_angle') && bodyType.torsoType === 'short') {
            passed = true; // Short torso requires more forward lean
          }
        }
      }

      return {
        name: fc.name,
        passed,
        text: passed ? fc.good : fc.bad,
        severity: fc.severity,
      };
    });
  }
}

// ─── Standalone angle calculation (avoids dependency on extractJointAngles for signals) ───

function calculateAngle3(a, b, c) {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };
  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y + ba.z * ba.z);
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y + bc.z * bc.z);
  if (magBA < 1e-6 || magBC < 1e-6) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}
