/**
 * Rep counting engine — valley counting.
 *
 * A rep is a valley in the tracking signal. For bicep curls,
 * every time the elbow angle hits its most flexed position
 * (the bottom of the curl), that is one rep.
 *
 * Valley counting doesn't care where the video starts.
 * It finds every local minimum that is deep enough (>=25 deg
 * amplitude from the preceding peak) and far enough apart
 * (>=0.4s) from the last counted rep.
 *
 * mode: 'video' (default)
 *   update() collects landmarks per frame.
 *   finalize() runs valley counting on the full signal.
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

export const REP_COUNTER_BUILD = 'v22-tighter-spacing';

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
   * Valley counting on the full collected signal.
   * Called once after all frames are collected in video mode.
   *
   * A rep = a valley (local minimum) in the tracking signal.
   * For bicep curls: each time the elbow angle dips to its
   * most flexed point, that's one rep.
   *
   * For exercises where the signal goes UP during the rep
   * (e.g. overhead press), we invert the signal and still
   * count valleys.
   */
  finalize() {
    if (this._finalized) return;
    this._finalized = true;

    this._hysteresisReps = this._reps;

    const ex = this._exercise;
    const N = this._collectedLandmarks.length;
    if (ex.isIsometric || N < 6) return;

    // ── Step 1: Extract the raw tracking signal ──
    const rawValues = this._collectedLandmarks.map(lm => {
      const a = extractJointAngles(lm);
      return a ? ex.getValue(a, lm) : null;
    });

    // Interpolate nulls, then smooth to eliminate bestSide oscillation noise
    const interpolated = this._smoothSignal(this._interpolateNulls(rawValues), 5);

    // ── Step 2: Invert if needed ──
    const down = ex.downThreshold;
    const up = ex.upThreshold;
    const invert = down > up;
    const signal = invert ? interpolated.map(v => -v) : interpolated;

    // ── Step 3: Valley counting ──
    const result = this._countValleys(signal);

    if (result.reps === 0) {
      this._reps = 0;
      this._repHistory = [];
      return;
    }

    // Build cycles from valley positions for downstream compatibility
    const cycles = [];
    for (let i = 0; i < result.valleyFrames.length; i++) {
      const vFrame = result.valleyFrames[i];
      const searchStart = i > 0 ? result.valleyFrames[i - 1] : 0;
      let peakFrame = searchStart;
      let peakVal = interpolated[searchStart];
      for (let j = searchStart; j < vFrame; j++) {
        if (invert ? interpolated[j] < peakVal : interpolated[j] > peakVal) {
          peakVal = interpolated[j];
          peakFrame = j;
        }
      }
      const searchEnd = i < result.valleyFrames.length - 1 ? result.valleyFrames[i + 1] : interpolated.length - 1;
      let endFrame = vFrame;
      let endVal = interpolated[vFrame];
      for (let j = vFrame; j <= searchEnd; j++) {
        if (invert ? interpolated[j] < endVal : interpolated[j] > endVal) {
          endVal = interpolated[j];
          endFrame = j;
        }
      }

      const valleyVal = interpolated[vFrame];
      const amplitude = invert
        ? valleyVal - Math.min(peakVal, endVal)
        : Math.max(peakVal, endVal) - valleyVal;

      cycles.push({
        start: peakFrame,
        end: endFrame,
        min: invert ? peakVal : valleyVal,
        max: invert ? valleyVal : Math.max(peakVal, endVal),
        amplitude: Math.abs(amplitude),
        duration: endFrame - peakFrame,
      });
    }

    this._cycleDebug = {
      reps: result.reps,
      cycles,
      periodFrames: result.reps > 0 ? Math.round(interpolated.length / result.reps) : 0,
      signalRange: result.signalRange,
    };

    this._reps = result.reps;
    this._repHistory = this._buildFormHistoryFromCycles(cycles);

    // Velocity and progression (downstream features, non-critical)
    try {
      const velocityEngine = new VelocityEngine(this._fps);
      const repBoundaries = this._repHistory.map(r => ({ startFrame: r.startFrame, endFrame: r.endFrame }));
      const repVelocities = velocityEngine.analyzePerRep(interpolated, repBoundaries, this._weightKg || 0);
      for (let i = 0; i < this._repHistory.length && i < repVelocities.length; i++) {
        if (repVelocities[i]) this._repHistory[i].velocity = repVelocities[i];
      }
      const fullAnalysis = velocityEngine.analyze(interpolated, this._weightKg || 0);
      this._velocityAnalysis = { fatigue: fullAnalysis.fatigue, power: fullAnalysis.power, smoothness: fullAnalysis.smoothness };
      const formScores = this._repHistory.map(r => r.score).filter(s => s !== null);
      this._progressionScore = ProgressionScore.computeSet({ formScores, repVelocities, reps: result.reps, weightKg: this._weightKg || 0 });
    } catch (e) {
    }
  }

  // ─── Valley counting ───
  //
  // A rep = a local minimum (valley) in the tracking signal.
  // For bicep curls: each valley is the bottom of one curl.
  //
  // Filters:
  //   1. Valleys must be >= 0.4s apart
  //   2. Amplitude from preceding peak to valley must be >= 25°

  _countValleys(signal) {
    // Signal range first — needed for adaptive amplitude threshold
    let sigMin = Infinity, sigMax = -Infinity;
    for (let i = 0; i < signal.length; i++) {
      if (signal[i] < sigMin) sigMin = signal[i];
      if (signal[i] > sigMax) sigMax = signal[i];
    }
    const signalRange = sigMax - sigMin;

    if (signalRange < 15) {
      console.debug(`[RepCounter] Signal range too small: ${signalRange.toFixed(1)}°`);
      return { reps: 0, allValleys: 0, valleyFrames: [], signalRange };
    }

    // Minimum 2.5 seconds between reps. A controlled rep (push-up, squat,
    // curl) takes 3-5 seconds. 2.0s was still letting one noise valley through.
    const minFramesBetweenReps = Math.round(this._fps * 2.5);

    // Amplitude threshold = 45% of signal range.
    // For a 100° range (deficit push-up), this is ~45°.
    // Noise valleys from bestSide arm-switching are 20-40°; real valleys are 60-100°.
    const minAmplitude = Math.max(40, signalRange * 0.45);

    console.debug(`[RepCounter] Valley params: minFrames=${minFramesBetweenReps}, minAmp=${minAmplitude.toFixed(1)}°, range=${signalRange.toFixed(1)}°`);

    // 1. Find local minima that are the deepest point in a ±halfWindow neighborhood.
    //    A real rep bottom dominates its neighborhood. A noise dip does not.
    const halfWindow = Math.max(5, Math.round(this._fps * 0.8)); // ±0.8s — wider window rejects noise dips
    const allValleys = [];
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] < signal[i - 1] && signal[i] <= signal[i + 1]) {
        // Check: is this the minimum in [i-halfWindow, i+halfWindow]?
        let isDeepest = true;
        const lo = Math.max(0, i - halfWindow);
        const hi = Math.min(signal.length - 1, i + halfWindow);
        for (let k = lo; k <= hi; k++) {
          if (signal[k] < signal[i]) { isDeepest = false; break; }
        }
        if (isDeepest) allValleys.push(i);
      }
    }

    // 2. Filter: spacing and amplitude from BOTH sides (prominence)
    const valleyFrames = [];
    let lastValley = -Infinity;

    for (const v of allValleys) {
      if (v - lastValley < minFramesBetweenReps) continue;

      // Peak before valley
      const searchStart = lastValley > 0 ? lastValley : Math.max(0, v - Math.round(this._fps * 3));
      let peakBefore = signal[v];
      for (let j = searchStart; j < v; j++) {
        if (signal[j] > peakBefore) peakBefore = signal[j];
      }

      // Peak after valley
      const searchEnd = Math.min(signal.length, v + Math.round(this._fps * 3));
      let peakAfter = signal[v];
      for (let j = v + 1; j < searchEnd; j++) {
        if (signal[j] > peakAfter) peakAfter = signal[j];
      }

      // Prominence = minimum drop from either side
      const prominence = Math.min(peakBefore - signal[v], peakAfter - signal[v]);
      if (prominence >= minAmplitude) {
        valleyFrames.push(v);
        lastValley = v;
      }
    }

    return { reps: valleyFrames.length, allValleys: allValleys.length, valleyFrames, signalRange };
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
      method: 'valley-counter',
      cycles: this._cycleDebug,
      velocity: this._velocityAnalysis,
      progression: this._progressionScore,
      anthropometrics: this._anthropometricNormalizer.isCalibrated
        ? { calibrated: true, bodyType: this._anthropometricNormalizer.getBodyType(), profile: this._anthropometricNormalizer.profile }
        : { calibrated: false },
    };
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

  // ─── Private: Moving average smoothing ───

  _smoothSignal(signal, windowSize) {
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
