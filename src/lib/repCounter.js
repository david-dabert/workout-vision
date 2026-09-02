/**
 * Rep counting engine — cycle-counting state machine.
 *
 * A rep is a state transition, not a frequency or a peak.
 * Bicep curl: angle starts above upThreshold (extended)
 *   → drops below downThreshold (flexed)
 *   → returns above upThreshold (extended)
 * That is one rep. Pauses, wiggles, double-peaks don't count
 * because the state machine waits for the full cycle.
 *
 * mode: 'video' (default)
 *   update() collects landmarks per frame.
 *   finalize() runs cycle counting on the full signal.
 *
 * mode: 'live'
 *   update() runs hysteresis counting for real-time rep feedback.
 *   finalize() is never called.
 */

import { extractJointAngles, LANDMARKS } from './poseAnalysis';
import { EXERCISES } from './exercises';
import { shouldSkipCheck } from './injuries';
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
// RepCounter
// ---------------------------------------------------------------------------

export class RepCounter {
  constructor(exerciseKey, opts = {}) {
    const ex = EXERCISES[exerciseKey];
    if (!ex) throw new Error(`Unknown exercise: ${exerciseKey}`);
    this._exercise = ex;
    this._exerciseKey = exerciseKey;
    this._mode = opts.mode || 'video';
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
    this._lastRepTime = -Infinity;
    this._frameIdx = 0;
    this._cycleDebug = null;
    this._velocityAnalysis = null;
    this._progressionScore = null;
  }

  /**
   * Per-frame update. Collects landmarks for finalize().
   * Hysteresis counting runs for live rep display.
   */
  update(landmarks, videoTimestamp) {
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

    let repCompleted = false;

    // Hysteresis counting for live rep display
    {
      const down = ex.downThreshold;
      const up = ex.upThreshold;
      const now = videoTimestamp != null ? videoTimestamp * 1000 : Date.now();

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
   * Cycle-counting state machine on the full collected signal.
   * Called once after all frames are collected in video mode.
   *
   * A rep = the tracking value crosses from "extended" zone through
   * "flexed" zone and back to "extended" zone. Pauses, wiggles,
   * and double-peaks are ignored because the state machine requires
   * the full transition.
   */
  finalize() {
    if (this._finalized) return;
    this._finalized = true;

    this._hysteresisReps = this._reps;

    const ex = this._exercise;
    const N = this._collectedLandmarks.length;
    if (ex.isIsometric || N < 6) return;

    // ── Step 1: Extract the tracking signal for this exercise ──
    const rawValues = this._collectedLandmarks.map(lm => {
      const a = extractJointAngles(lm);
      return a ? ex.getValue(a, lm) : null;
    });

    const interpolated = this._interpolateNulls(rawValues);
    const sigma = Math.max(2, Math.round(this._fps * 0.12));
    const smoothed = this._gaussianSmooth(interpolated, sigma);

    // ── Step 2: Cycle counting state machine ──
    const result = this._countCycles(smoothed);

    if (result.reps === 0) {
      console.debug(`[RepCounter] Cycle count: 0 reps (hysteresis had ${this._hysteresisReps})`);
      this._reps = 0;
      this._repHistory = [];
      return;
    }

    console.debug(
      `[RepCounter] Cycle count: ${result.reps} reps ` +
      `(hysteresis=${this._hysteresisReps}, cycles=${result.cycles.length}, ` +
      `period=${(result.periodFrames / this._fps).toFixed(2)}s)`
    );

    this._cycleDebug = {
      reps: result.reps,
      cycles: result.cycles,
      periodFrames: result.periodFrames,
      signalRange: result.signalRange,
    };

    // ── Step 3: Build rep history with form scores ──
    this._reps = result.reps;
    this._repHistory = this._buildFormHistoryFromCycles(result.cycles);

    // ── Step 4: Velocity analysis ──
    try {
      const velocityEngine = new VelocityEngine(this._fps);
      const repBoundaries = this._repHistory.map(r => ({ startFrame: r.startFrame, endFrame: r.endFrame }));
      const repVelocities = velocityEngine.analyzePerRep(smoothed, repBoundaries, this._weightKg || 0);

      for (let i = 0; i < this._repHistory.length && i < repVelocities.length; i++) {
        if (repVelocities[i]) this._repHistory[i].velocity = repVelocities[i];
      }

      const fullAnalysis = velocityEngine.analyze(smoothed, this._weightKg || 0);
      this._velocityAnalysis = {
        fatigue: fullAnalysis.fatigue,
        power: fullAnalysis.power,
        smoothness: fullAnalysis.smoothness,
      };

      // ── Step 5: Progression score ──
      const formScores = this._repHistory.map(r => r.score).filter(s => s !== null);
      this._progressionScore = ProgressionScore.computeSet({
        formScores, repVelocities,
        reps: result.reps, weightKg: this._weightKg || 0,
      });
    } catch (e) {
      console.warn('[RepCounter] Velocity/Progression analysis failed:', e.message);
    }
  }

  // ─── Cycle counting state machine ───
  //
  // A rep is a full cycle: extended → flexed → extended.
  // Uses the exercise's own thresholds (downThreshold, upThreshold).
  //
  // Validation per cycle:
  //   Duration: 0.5s to 5.0s
  //   Amplitude: at least 30° of movement

  _countCycles(signal) {
    const ex = this._exercise;
    const down = ex.downThreshold;
    const up = ex.upThreshold;
    const goesDown = down > up;

    // For exercises where tracking value decreases during the concentric phase
    // (curls: angle goes from ~145° down to ~80°), "extended" = above upThreshold,
    // "flexed" = below downThreshold.
    // For exercises where tracking value increases (squats: angle goes from ~170° up to ~100°),
    // "extended" = below downThreshold, "flexed" = above upThreshold.
    const extendedThreshold = goesDown ? up : down;
    const flexedThreshold = goesDown ? down : up;

    // Wait, let me re-examine. For bicep_curl:
    //   downThreshold: 80, upThreshold: 145
    //   getValue returns elbow angle
    //   Extended arm = angle ~160° (above upThreshold 145)
    //   Flexed arm = angle ~50° (below downThreshold 80)
    //   goesDown = false (down < up, 80 < 145)
    //
    // For squat:
    //   downThreshold: 100, upThreshold: 160
    //   getValue returns knee angle
    //   Standing = angle ~170° (above upThreshold 160)
    //   Squatted = angle ~80° (below downThreshold 100)
    //   goesDown = false (down < up, 100 < 160)
    //
    // So for most exercises: extended = above upThreshold, flexed = below downThreshold
    // The hysteresis code handles the case where down > up (inverted exercises)
    // but in practice all exercises have down < up.

    const minDuration = Math.round(this._fps * 0.5); // 0.5 seconds minimum per rep
    const maxDuration = Math.round(this._fps * 5.0); // 5.0 seconds maximum per rep
    const minAmplitude = 30; // at least 30° of movement

    let state = 'seeking_start'; // wait for first extended position
    let cycleStart = 0;
    let cycleMin = Infinity;
    let cycleMax = -Infinity;
    let reps = 0;
    const cycles = [];

    // Signal range check
    let sigMin = Infinity, sigMax = -Infinity;
    for (let i = 0; i < signal.length; i++) {
      if (signal[i] < sigMin) sigMin = signal[i];
      if (signal[i] > sigMax) sigMax = signal[i];
    }
    const signalRange = sigMax - sigMin;

    if (signalRange < 20) {
      console.debug(`[RepCounter] Signal range too small: ${signalRange.toFixed(1)}°`);
      return { reps: 0, cycles: [], periodFrames: 0, signalRange };
    }

    if (!goesDown) {
      // Standard: value high when extended, low when flexed
      for (let i = 0; i < signal.length; i++) {
        const val = signal[i];

        if (state === 'seeking_start') {
          if (val > extendedThreshold) {
            state = 'extended';
          }
        } else if (state === 'extended') {
          if (val < extendedThreshold) {
            state = 'flexing';
            cycleStart = i;
            cycleMin = val;
            cycleMax = val;
          }
        } else if (state === 'flexing') {
          cycleMin = Math.min(cycleMin, val);
          cycleMax = Math.max(cycleMax, val);
          if (val < flexedThreshold) {
            state = 'flexed';
          }
        } else if (state === 'flexed') {
          cycleMin = Math.min(cycleMin, val);
          cycleMax = Math.max(cycleMax, val);
          if (val > flexedThreshold) {
            state = 'extending';
          }
        } else if (state === 'extending') {
          cycleMin = Math.min(cycleMin, val);
          cycleMax = Math.max(cycleMax, val);
          if (val > extendedThreshold) {
            // Completed one full cycle
            const duration = i - cycleStart;
            const amplitude = cycleMax - cycleMin;
            if (duration >= minDuration && duration <= maxDuration && amplitude >= minAmplitude) {
              reps++;
              cycles.push({ start: cycleStart, end: i, min: cycleMin, max: cycleMax, amplitude, duration });
            } else {
              console.debug(`[RepCounter] Cycle rejected: duration=${(duration / this._fps).toFixed(2)}s, amplitude=${amplitude.toFixed(1)}°`);
            }
            state = 'extended';
          }
        }
      }
    } else {
      // Inverted: value low when extended, high when flexed
      for (let i = 0; i < signal.length; i++) {
        const val = signal[i];

        if (state === 'seeking_start') {
          if (val < extendedThreshold) {
            state = 'extended';
          }
        } else if (state === 'extended') {
          if (val > extendedThreshold) {
            state = 'flexing';
            cycleStart = i;
            cycleMin = val;
            cycleMax = val;
          }
        } else if (state === 'flexing') {
          cycleMin = Math.min(cycleMin, val);
          cycleMax = Math.max(cycleMax, val);
          if (val > flexedThreshold) {
            state = 'flexed';
          }
        } else if (state === 'flexed') {
          cycleMin = Math.min(cycleMin, val);
          cycleMax = Math.max(cycleMax, val);
          if (val < flexedThreshold) {
            state = 'extending';
          }
        } else if (state === 'extending') {
          cycleMin = Math.min(cycleMin, val);
          cycleMax = Math.max(cycleMax, val);
          if (val < extendedThreshold) {
            const duration = i - cycleStart;
            const amplitude = cycleMax - cycleMin;
            if (duration >= minDuration && duration <= maxDuration && amplitude >= minAmplitude) {
              reps++;
              cycles.push({ start: cycleStart, end: i, min: cycleMin, max: cycleMax, amplitude, duration });
            } else {
              console.debug(`[RepCounter] Cycle rejected: duration=${(duration / this._fps).toFixed(2)}s, amplitude=${amplitude.toFixed(1)}°`);
            }
            state = 'extended';
          }
        }
      }
    }

    const periodFrames = reps > 0 ? Math.round(signal.length / reps) : 0;
    return { reps, cycles, periodFrames, signalRange };
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
      method: 'cycle-counter',
      cycles: this._cycleDebug,
      velocity: this._velocityAnalysis,
      progression: this._progressionScore,
      anthropometrics: this._anthropometricNormalizer.isCalibrated
        ? { calibrated: true, bodyType: this._anthropometricNormalizer.getBodyType(), profile: this._anthropometricNormalizer.profile }
        : { calibrated: false },
    };
  }

  // ─── Private: Gaussian smoothing ───

  _gaussianSmooth(signal, sigma) {
    const N = signal.length;
    const kernelSize = Math.min(N, Math.max(3, Math.round(sigma * 4) | 1));
    const half = Math.floor(kernelSize / 2);

    const kernel = [];
    let kernelSum = 0;
    for (let i = -half; i <= half; i++) {
      const w = Math.exp(-(i * i) / (2 * sigma * sigma));
      kernel.push(w);
      kernelSum += w;
    }
    for (let i = 0; i < kernel.length; i++) kernel[i] /= kernelSum;

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

  // ─── Private: Build form history from cycle boundaries ───

  _buildFormHistoryFromCycles(cycles) {
    if (cycles.length === 0) return [];

    const N = this._collectedLandmarks.length;
    const ex = this._exercise;
    const checks = ex.formChecks || [];
    const history = [];

    for (let r = 0; r < cycles.length; r++) {
      const cycle = cycles[r];
      const startFrame = cycle.start;
      const endFrame = Math.min(cycle.end, N - 1);
      const midFrame = Math.round((startFrame + endFrame) / 2);

      let score = null;
      const issues = [];
      let formResults = null;

      if (checks.length > 0) {
        const sampleStep = Math.max(1, Math.floor((endFrame - startFrame) / 8));

        formResults = checks.map((fc) => {
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

          if (!passed && this._anthropometricNormalizer.isCalibrated) {
            const bodyType = this._anthropometricNormalizer.getBodyType();
            if (bodyType) {
              if ((fc.name === 'Depth' || fc.name === 'depth') && bodyType.femurType === 'long') {
                passed = failRate < 0.50;
              }
              if ((fc.name === 'Trunk angle' || fc.name === 'trunk_angle') && bodyType.torsoType === 'short') {
                passed = failRate < 0.50;
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

      // Per-rep ROM from cycle data
      const repRom = cycle.amplitude;

      history.push({
        score,
        issues,
        feedback: formResults,
        ts: Date.now() + r,
        startFrame,
        bottomFrame: midFrame,
        endFrame,
        peakFrame: midFrame,
        rom: repRom != null ? Math.round(repRom * 10) / 10 : null,
        startTime: startFrame / this._fps,
        endTime: endFrame / this._fps,
      });
    }

    // Compute %ROM relative to the best rep in the set
    const maxRom = Math.max(...history.map(h => h.rom || 0));
    if (maxRom > 0) {
      for (const h of history) {
        h.romPercent = h.rom != null ? Math.round((h.rom / maxRom) * 100) : null;
      }
    }

    return history;
  }

  // ─── Private: Live counting ───

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

      if (!passed && this._anthropometricNormalizer.isCalibrated) {
        const bodyType = this._anthropometricNormalizer.getBodyType();
        if (bodyType) {
          if ((fc.name === 'Depth' || fc.name === 'depth') && bodyType.femurType === 'long') {
            passed = true;
          }
          if ((fc.name === 'Trunk angle' || fc.name === 'trunk_angle') && bodyType.torsoType === 'short') {
            passed = true;
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
