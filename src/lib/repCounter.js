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

    // Collapse L/R pairs: correlated bilateral signals should count as one vote.
    // Keep the higher-confidence member of each pair.
    const lrPairs = [
      ['elbow_L', 'elbow_R'], ['knee_L', 'knee_R'],
      ['hip_L', 'hip_R'], ['shoulder_L', 'shoulder_R'],
      ['wrist_Y_L', 'wrist_Y_R'], ['wrist_Z_L', 'wrist_Z_R'],
      ['wristShoulderDist3D_L', 'wristShoulderDist3D_R'],
      ['wristShoulderDist_L', 'wristShoulderDist_R'],
      ['ankleHipDist3D_L', 'ankleHipDist3D_R'],
    ];
    const collapsed = [];
    const used = new Set();
    for (const r of results) {
      if (r.reps <= 0 || used.has(r.name)) continue;
      const pair = lrPairs.find(p => p.includes(r.name));
      if (pair) {
        const otherName = pair[0] === r.name ? pair[1] : pair[0];
        const other = results.find(x => x.name === otherName && !used.has(x.name));
        used.add(r.name);
        if (other) {
          used.add(other.name);
          collapsed.push(r.confidence >= other.confidence ? r : other);
        } else {
          collapsed.push(r);
        }
      } else {
        used.add(r.name);
        collapsed.push(r);
      }
    }

    // Consensus voting: group signals by rep count (within ±1), pick the
    // group with the most votes. Within that group, take the highest confidence.
    const countVotes = {};
    for (const r of collapsed) {
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

    if (!best || best.reps === 0 || best.confidence < 0.15) {
      console.debug(`[RepCounter] ACF: no reliable periodic signal (best conf=${best?.confidence?.toFixed(2) || 0})`);
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

  // Exercise-specific rep period bounds in seconds.
  // minPeriod: fastest possible rep. Filters sub-cycle noise peaks.
  // maxPeriod: slowest possible rep. Filters long-lag ACF artifacts.
  // Calibrated against Countix ground truth and biomechanical limits.
  static _repPeriodBounds(exerciseKey) {
    const bounds = {
      battle_rope:      { min: 0.4,  max: 3.0 },  // Fast: 14 reps/10s = 0.71s/rep
      bench_press:      { min: 0.8,  max: 4.0 },  // 1.0-2.0s typical
      bicep_curl:       { min: 0.8,  max: 4.0 },  // 1.5-3.0s typical
      hammer_curl:      { min: 0.8,  max: 4.0 },
      squat:            { min: 0.8,  max: 4.0 },  // 1.2-1.7s typical
      goblet_squat:     { min: 0.8,  max: 4.0 },
      front_squat:      { min: 0.8,  max: 4.0 },
      deadlift:         { min: 1.2,  max: 5.0 },  // Slow controlled lift
      romanian_deadlift:{ min: 1.2,  max: 5.0 },
      pull_up:          { min: 1.0,  max: 4.0 },  // Moderate speed
      chin_up:          { min: 1.0,  max: 4.0 },
      push_up:          { min: 1.0,  max: 4.0 },  // Nobody does push-ups > 1/sec
      sit_up:           { min: 0.5,  max: 3.0 },  // Can be fast: 15 reps/10s
      crunch:           { min: 0.5,  max: 3.0 },
      front_raise:      { min: 1.0,  max: 4.0 },  // Controlled lift
      lateral_raise:    { min: 1.0,  max: 4.0 },
      overhead_press:   { min: 1.0,  max: 4.0 },
      shoulder_press:   { min: 1.0,  max: 4.0 },
      lunge:            { min: 1.0,  max: 4.0 },  // Walking lunge ~2s/rep
      bent_over_row:    { min: 0.8,  max: 4.0 },
      upright_row:      { min: 0.8,  max: 4.0 },
      tricep_extension: { min: 0.8,  max: 4.0 },
      tricep_pushdown:  { min: 0.8,  max: 4.0 },
      leg_press:        { min: 1.0,  max: 4.0 },
      leg_extension:    { min: 0.8,  max: 4.0 },
      leg_curl:         { min: 0.8,  max: 4.0 },
      calf_raise:       { min: 0.5,  max: 3.0 },
    };
    return bounds[exerciseKey] || { min: 0.6, max: 4.0 };
  }

  // Backward compat — some internal code calls _minPeriod
  static _minPeriod(exerciseKey) {
    return RepCounter._repPeriodBounds(exerciseKey).min;
  }

  // Check if a signal name is an angle signal (measured in degrees)
  // vs a position/distance signal (measured in normalized coords or 3D units)
  static _isAngleSignal(signalName) {
    return ['elbow_L', 'elbow_R', 'knee_L', 'knee_R', 'hip_L', 'hip_R',
            'shoulder_L', 'shoulder_R', 'trunk'].includes(signalName);
  }

  // ─── Private: YIN period estimator (de Cheveigné & Kawahara, 2002) ───
  //
  // YIN replaces ACF peak-picking. ACF peaks at the fundamental and all
  // harmonics are nearly equal, so "pick highest" or "pick first above
  // threshold" is a coin flip between fundamental and 2× harmonic.
  //
  // YIN uses a difference function + cumulative mean normalization (CMNDF).
  // The CMNDF mathematically suppresses harmonics: its first dip below
  // threshold is always the fundamental period. This is the algorithm
  // behind Shazam, Auto-Tune, and every production pitch detector.

  _autocorrelation(signal, signalName) {
    const N = signal.length;
    if (N < 6) return { reps: 0, confidence: 0, periodFrames: 0 };

    // Signal range for ROM penalty later (avoid spread for large arrays)
    let sigMin = signal[0], sigMax = signal[0];
    for (let i = 1; i < N; i++) {
      if (signal[i] < sigMin) sigMin = signal[i];
      if (signal[i] > sigMax) sigMax = signal[i];
    }
    const sigRange = sigMax - sigMin;

    // Exercise-calibrated lag bounds
    const { min: minPeriodSec, max: maxPeriodSec } = RepCounter._repPeriodBounds(this._exerciseKey);
    const minLag = Math.max(2, Math.round(this._fps * minPeriodSec));
    const W = Math.min(Math.floor(N / 2), Math.round(this._fps * maxPeriodSec));

    if (W <= minLag) return { reps: 0, confidence: 0, periodFrames: 0 };

    // Step 1: Difference function d(τ) = Σ (x[n] - x[n+τ])²
    // Standard YIN variable-length summation (N-tau terms per lag).
    // Mean removal is unnecessary: mean cancels in x[n]-x[n+tau].
    const diff = new Float64Array(W + 1);
    diff[0] = 0;
    for (let tau = 1; tau <= W; tau++) {
      let sum = 0;
      for (let n = 0; n < N - tau; n++) {
        const delta = signal[n] - signal[n + tau];
        sum += delta * delta;
      }
      diff[tau] = sum;
    }

    // Step 2: Cumulative mean normalized difference function (CMNDF)
    // d'(τ) = d(τ) / ((1/τ) * Σ d(j) for j=1..τ)
    // d'(0) = 1 by definition. This normalization is what suppresses
    // harmonics: the cumulative mean grows, making later dips shallower.
    const cmndf = new Float64Array(W + 1);
    cmndf[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau <= W; tau++) {
      runningSum += diff[tau];
      cmndf[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
    }

    // Step 3: Find the fundamental period.
    // YIN rule: find the first local minimum of CMNDF below threshold
    // within the exercise's valid rep-rate range. The CMNDF's structure
    // guarantees the first dip is the fundamental, not a harmonic.
    const yinThreshold = 0.25;
    let bestLag = 0;
    let bestCmndf = Infinity;

    // Primary: first dip below threshold (YIN's core rule)
    for (let tau = minLag; tau <= W; tau++) {
      if (cmndf[tau] < yinThreshold) {
        // Walk to the bottom of this dip
        while (tau + 1 <= W && cmndf[tau + 1] < cmndf[tau]) {
          tau++;
        }
        bestLag = tau;
        bestCmndf = cmndf[tau];
        break;
      }
    }

    // Fallback: if no dip below threshold (noisy signal), pick the
    // deepest local minimum in the valid range
    if (bestLag === 0) {
      for (let tau = minLag + 1; tau < W; tau++) {
        if (cmndf[tau] <= cmndf[tau - 1] && cmndf[tau] <= cmndf[tau + 1]) {
          if (cmndf[tau] < bestCmndf) {
            bestCmndf = cmndf[tau];
            bestLag = tau;
          }
        }
      }
    }

    // Last resort: absolute minimum
    if (bestLag === 0) {
      for (let tau = minLag; tau <= W; tau++) {
        if (cmndf[tau] < bestCmndf) {
          bestCmndf = cmndf[tau];
          bestLag = tau;
        }
      }
    }

    if (bestLag === 0) return { reps: 0, confidence: 0, periodFrames: 0 };

    // Sub-harmonic refinement: if bestLag came from fallback (deepest min),
    // it might be at 2x or 3x the true period. Check if bestLag/2 or
    // bestLag/3 also has a strong CMNDF dip (below yinThreshold).
    // Only fires when a shorter period has strong independent evidence.
    if (bestCmndf >= yinThreshold) {
      // bestLag was selected by fallback, not by primary YIN rule
      for (const divisor of [2, 3]) {
        const subLag = Math.round(bestLag / divisor);
        if (subLag < minLag || subLag > W) continue;
        // Search ±1 frame around the expected sub-harmonic position
        let subMin = Infinity, subIdx = subLag;
        for (let t = Math.max(minLag, subLag - 1); t <= Math.min(W, subLag + 1); t++) {
          if (cmndf[t] < subMin) { subMin = cmndf[t]; subIdx = t; }
        }
        // Only switch if the sub-period has a strong dip (below YIN threshold)
        if (subMin < yinThreshold) {
          bestLag = subIdx;
          bestCmndf = subMin;
          break; // prefer shortest valid sub-harmonic
        }
      }
    }

    // Parabolic interpolation for sub-frame accuracy
    if (bestLag > 1 && bestLag < W) {
      const a = cmndf[bestLag - 1];
      const b = cmndf[bestLag];
      const c = cmndf[bestLag + 1];
      const denom = 2 * (2 * b - a - c);
      if (Math.abs(denom) > 1e-10) {
        const shift = (a - c) / denom;
        bestLag = bestLag + Math.max(-0.5, Math.min(0.5, shift));
      }
    }

    const reps = Math.round(N / bestLag);
    const durationSec = N / this._fps;
    const maxReasonableReps = Math.ceil(durationSec / minPeriodSec);

    if (reps < 1 || reps > maxReasonableReps) {
      return { reps: 0, confidence: 0, periodFrames: 0 };
    }

    // Confidence: 1 - CMNDF value (lower CMNDF = stronger periodicity)
    let confidence = Math.max(0, Math.min(1, 1 - bestCmndf));

    // Narrow-ROM penalty — only for angle signals (measured in degrees)
    if (RepCounter._isAngleSignal(signalName)) {
      if (sigRange < 20) {
        confidence *= 0.3;
      } else if (sigRange < 40) {
        confidence *= 0.6;
      } else if (sigRange < 60) {
        confidence *= 0.85;
      }
    }

    return {
      reps,
      confidence,
      periodFrames: Math.round(bestLag),
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
