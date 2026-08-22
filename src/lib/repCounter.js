/**
 * Rep counting engine using hysteresis-based phase detection
 * on smoothed joint angles.
 *
 * Separated from exercises.js for modularity. The EXERCISES database
 * and extractJointAngles are imported as dependencies.
 */

import { extractJointAngles, LANDMARKS } from './poseAnalysis';
import { EXERCISES } from './exercises';

// ---------------------------------------------------------------------------
// Utility: 3-frame moving average for angle smoothing
// ---------------------------------------------------------------------------

export class AngleBuffer {
  constructor(windowSize = 3) {
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

/**
 * Counts repetitions for a given exercise using hysteresis-based phase detection
 * on smoothed joint angles. Prevents double-counting via explicit state machine
 * (up -> going_down -> down -> going_up -> up).
 *
 * @example
 * const counter = new RepCounter('squat');
 * // in your frame loop:
 * const result = counter.update(landmarks);
 * // result.reps, result.phase, result.formFeedback, etc.
 */
export class RepCounter {
  /**
   * @param {string} exerciseKey - key from EXERCISES
   * @param {object} [opts] - options
   * @param {number} [opts.fps=30] - capture frame rate; adjusts smoother and state machine
   */
  constructor(exerciseKey, opts = {}) {
    const ex = EXERCISES[exerciseKey];
    if (!ex) throw new Error(`Unknown exercise: ${exerciseKey}`);
    this._exercise = ex;
    this._exerciseKey = exerciseKey;
    this._fps = opts.fps || 30;
    const smoothWindow = this._fps <= 5 ? 1 : 3;
    this._smoother = new AngleBuffer(smoothWindow);
    this._lowFps = this._fps <= 5;
    this.reset();
  }

  get repHistory() { return this._repHistory; }
  get reps() { return this._reps; }

  reset() {
    this._reps = 0;
    this._repHistory = [];
    this._currentRepIssues = [];
    this._issueFrameCounts = {};
    this._peakAngle = null;
    this._smoother.reset();
    // Threshold-crossing state
    this._atBottom = false;
    this._frameIdx = 0;
    this._phase = 'up';
    this._lastValue = null;
    // Two-pass: collect all landmarks in pass 1, count reps in pass 2
    this._collectedLandmarks = [];
    this._observedMin = Infinity;
    this._observedMax = -Infinity;
    this._useAdaptive = false;
    this._finalized = false;
    // Frame tracking for biomechanics integration
    this._repStartFrame = 0;
    this._bottomFrame = 0;
  }

  /**
   * Pass 1: collect landmarks frame by frame. No rep counting happens here.
   * Call finalize() after all frames to trigger pass 2 (rep counting with
   * locked thresholds computed from the full observed range).
   *
   * @param {Array} landmarks - 33 MediaPipe landmarks
   * @returns {{ reps: number, phase: string, angle: number, angles: object,
   *            formFeedback: Array, repCompleted: boolean,
   *            repHistory: Array }}
   */
  update(landmarks) {
    const rawAngles = extractJointAngles(landmarks);
    if (!rawAngles) {
      return {
        reps: this._reps, phase: this._phase, angle: null, angles: null,
        formFeedback: [], repCompleted: false, repHistory: this._repHistory,
      };
    }

    const angles = this._smoother.smooth(rawAngles);
    const ex = this._exercise;

    if (ex.isIsometric) {
      return this._handleIsometric(angles, landmarks);
    }

    const value = ex.getValue(angles, landmarks);
    this._frameIdx++;

    // Track observed range for threshold computation in finalize()
    if (value < this._observedMin) this._observedMin = value;
    if (value > this._observedMax) this._observedMax = value;

    // Store for pass 2
    this._collectedLandmarks.push(landmarks);

    // Track direction for live phase display
    if (this._lastValue !== null) {
      if (value < this._lastValue - 1) this._phase = 'down';
      else if (value > this._lastValue + 1) this._phase = 'up';
    }
    this._lastValue = value;

    return {
      reps: this._reps, phase: this._phase,
      angle: Math.round(value * 10) / 10, angles,
      formFeedback: [], repCompleted: false,
      repHistory: this._repHistory,
    };
  }

  /**
   * Pass 2: peak-valley rep detection on the full collected signal.
   *
   * Algorithm:
   * 1. Extract the exercise getValue() for every frame -> raw signal
   * 2. Smooth with a wider window (5-frame moving average)
   * 3. Find local minima (valleys) and maxima (peaks)
   * 4. A rep = one valley followed by one peak where (peak - valley) >= minROM
   *    minROM = 30% of the full observed range, minimum 15 degrees
   *
   * This replaces threshold-crossing entirely. No thresholds to tune.
   * Works on any absolute angle range.
   */
  finalize() {
    if (this._finalized) return;
    this._finalized = true;

    const ex = this._exercise;
    if (ex.isIsometric || this._collectedLandmarks.length < 6) return;

    // Step 1: extract raw signal and per-frame angles/landmarks
    const rawSignal = [];
    const frameData = []; // { angles, landmarks } per frame
    const smoother = new AngleBuffer(this._fps <= 5 ? 1 : 3);

    for (let i = 0; i < this._collectedLandmarks.length; i++) {
      const landmarks = this._collectedLandmarks[i];
      const rawAngles = extractJointAngles(landmarks);
      if (!rawAngles) {
        rawSignal.push(null);
        frameData.push(null);
        continue;
      }
      const angles = smoother.smooth(rawAngles);
      const value = ex.getValue(angles, landmarks);
      rawSignal.push(value);
      frameData.push({ angles, landmarks });
    }

    // Step 2: smooth the signal with moving average
    // Window scales with FPS: 7 frames at 8fps (0.9s), 3 frames at 4fps (0.75s)
    const smoothed = [];
    const halfW = this._fps <= 5 ? 1 : 3;
    for (let i = 0; i < rawSignal.length; i++) {
      if (rawSignal[i] === null) { smoothed.push(null); continue; }
      let sum = 0, count = 0;
      for (let j = Math.max(0, i - halfW); j <= Math.min(rawSignal.length - 1, i + halfW); j++) {
        if (rawSignal[j] !== null) { sum += rawSignal[j]; count++; }
      }
      smoothed.push(count > 0 ? sum / count : null);
    }

    // Step 3: find peaks and valleys with prominence filtering
    // Minimum prominence = 5 degrees prevents noise extrema
    // Minimum gap = 3 frames (~0.4s at 8fps) between extrema filters jitter
    const MIN_PROMINENCE = 5;
    const MIN_GAP_FRAMES = 3;
    const extrema = [];
    for (let i = 1; i < smoothed.length - 1; i++) {
      if (smoothed[i] === null || smoothed[i-1] === null || smoothed[i+1] === null) continue;
      if (smoothed[i] > smoothed[i-1] && smoothed[i] > smoothed[i+1]) {
        extrema.push({ type: 'peak', index: i, value: smoothed[i] });
      } else if (smoothed[i] < smoothed[i-1] && smoothed[i] < smoothed[i+1]) {
        extrema.push({ type: 'valley', index: i, value: smoothed[i] });
      }
    }

    // Merge consecutive same-type extrema (keep the most extreme)
    const merged = [];
    for (const e of extrema) {
      if (merged.length > 0 && merged[merged.length - 1].type === e.type) {
        const prev = merged[merged.length - 1];
        if (e.type === 'peak' && e.value > prev.value) merged[merged.length - 1] = e;
        if (e.type === 'valley' && e.value < prev.value) merged[merged.length - 1] = e;
      } else {
        merged.push(e);
      }
    }

    // Filter by prominence and minimum gap between alternating extrema
    const filtered = [];
    for (const e of merged) {
      if (filtered.length === 0) { filtered.push(e); continue; }
      const prev = filtered[filtered.length - 1];
      const gap = Math.abs(e.value - prev.value);
      const frameGap = e.index - prev.index;
      if (gap >= MIN_PROMINENCE && frameGap >= MIN_GAP_FRAMES) {
        filtered.push(e);
      } else if (gap < MIN_PROMINENCE) {
        // Noise extremum: keep whichever is more extreme
        if (e.type === 'peak' && e.value > prev.value) filtered[filtered.length - 1] = e;
        else if (e.type === 'valley' && e.value < prev.value) filtered[filtered.length - 1] = e;
      }
      // If frameGap too small but prominence sufficient, still keep it
      else { filtered.push(e); }
    }

    // Step 4: count reps using peak/valley pairs with sufficient ROM
    const range = this._observedMax - this._observedMin;
    const minROM = Math.max(15, range * 0.3);

    // Reset rep state
    this._reps = 0;
    this._repHistory = [];
    this._currentRepIssues = [];
    this._issueFrameCounts = {};

    // Determine the expected signal shape for a rep.
    // If upThreshold < downThreshold (e.g. Squat: 90 < 140), the signal goes DOWN to a valley, then UP to a peak.
    // If upThreshold > downThreshold (e.g. Upright Row: 80 > 30), the signal goes UP to a peak, then DOWN to a valley.
    const isValleyFirst = ex.upThreshold < ex.downThreshold;

    // Helper: find where the active phase toward the first extremum begins.
    const findPhaseStart = (firstExtremumIdx) => {
      let best = firstExtremumIdx;
      for (let i = firstExtremumIdx - 1; i >= 0; i--) {
        if (smoothed[i] === null) break;
        if (isValleyFirst) {
          if (smoothed[i] >= smoothed[best]) best = i;
          else if (smoothed[best] - smoothed[i] > 3) break;
        } else {
          if (smoothed[i] <= smoothed[best]) best = i;
          else if (smoothed[i] - smoothed[best] > 3) break;
        }
      }
      return best;
    };

    let lastFirstExtremum = null;

    for (const e of filtered) {
      if (isValleyFirst) {
        if (e.type === 'valley') {
          lastFirstExtremum = e;
        } else if (e.type === 'peak' && lastFirstExtremum !== null) {
          const rom = e.value - lastFirstExtremum.value;
          if (rom >= minROM) {
            const phaseStart = findPhaseStart(lastFirstExtremum.index);
            this._peakAngle = e.value;
            this._repStartFrame = phaseStart;
            this._bottomFrame = lastFirstExtremum.index;
            this._frameIdx = e.index;

            this._currentRepIssues = [];
            this._issueFrameCounts = {};
            const bottomData = frameData[lastFirstExtremum.index];
            const topData = frameData[e.index];
            if (bottomData || topData) {
              const formFeedback = this._evaluateFormPhased(bottomData, topData);
              for (const fb of formFeedback) {
                if (!fb.passed) this._currentRepIssues.push(fb.name);
              }
            }

            this._completeRep(
              frameData[e.index]?.angles || bottomData?.angles || {},
              frameData[e.index]?.landmarks || bottomData?.landmarks || []
            );
            lastFirstExtremum = null;
          }
        }
      } else {
        // peak->valley (e.g. Upright Row, Lateral Raise)
        if (e.type === 'peak') {
          lastFirstExtremum = e;
        } else if (e.type === 'valley' && lastFirstExtremum !== null) {
          const rom = lastFirstExtremum.value - e.value;
          if (rom >= minROM) {
            const phaseStart = findPhaseStart(lastFirstExtremum.index);
            this._peakAngle = e.value;
            this._repStartFrame = phaseStart;
            this._bottomFrame = lastFirstExtremum.index;
            this._frameIdx = e.index;

            this._currentRepIssues = [];
            this._issueFrameCounts = {};
            const bottomData = frameData[lastFirstExtremum.index];
            const topData = frameData[e.index];
            if (bottomData || topData) {
              const formFeedback = this._evaluateFormPhased(bottomData, topData);
              for (const fb of formFeedback) {
                if (!fb.passed) this._currentRepIssues.push(fb.name);
              }
            }

            this._completeRep(
              frameData[e.index]?.angles || bottomData?.angles || {},
              frameData[e.index]?.landmarks || bottomData?.landmarks || []
            );
            lastFirstExtremum = null;
          }
        }
      }
    }

    // ── POSITION-BASED FALLBACK ──
    // If angle-based detection found 0 reps, try using wrist vertical
    // displacement relative to shoulder. This works from ANY camera angle,
    // including behind the user where elbow angles barely change.
    if (this._reps === 0 && this._collectedLandmarks.length >= 6) {
      const posReps = this._countRepsPositionBased(frameData);
      if (posReps > 0) {
        this._positionFallbackUsed = true;
      }
    }

    this._useAdaptive = true; // for diagnostics display
  }

  /**
   * Position-based rep counting fallback.
   * Uses the wrist-to-shoulder vertical distance as the signal.
   * For curls: wrist moves up (y decreases) during contraction.
   * For presses: wrist moves up during extension.
   * Works from any camera angle since it uses absolute position, not joint angle.
   */
  _countRepsPositionBased(frameData) {
    const joint = this._exercise.joint;
    // Only use position fallback for arm exercises
    if (joint !== 'elbow' && joint !== 'shoulder') return 0;

    // Build signal: wrist Y relative to shoulder Y (normalized 0-1)
    // Lower Y = higher on screen = arm raised
    const signal = [];
    for (let i = 0; i < this._collectedLandmarks.length; i++) {
      const lm = this._collectedLandmarks[i];
      if (!lm || lm.length < 33) { signal.push(null); continue; }

      // Use the side with better visibility
      const lVis = Math.min(lm[LANDMARKS.LEFT_WRIST].visibility || 0, lm[LANDMARKS.LEFT_SHOULDER].visibility || 0);
      const rVis = Math.min(lm[LANDMARKS.RIGHT_WRIST].visibility || 0, lm[LANDMARKS.RIGHT_SHOULDER].visibility || 0);

      let wristY, shoulderY;
      if (lVis >= rVis && lVis > 0.3) {
        wristY = lm[LANDMARKS.LEFT_WRIST].y;
        shoulderY = lm[LANDMARKS.LEFT_SHOULDER].y;
      } else if (rVis > 0.3) {
        wristY = lm[LANDMARKS.RIGHT_WRIST].y;
        shoulderY = lm[LANDMARKS.RIGHT_SHOULDER].y;
      } else {
        // Neither side visible enough, try average
        wristY = (lm[LANDMARKS.LEFT_WRIST].y + lm[LANDMARKS.RIGHT_WRIST].y) / 2;
        shoulderY = (lm[LANDMARKS.LEFT_SHOULDER].y + lm[LANDMARKS.RIGHT_SHOULDER].y) / 2;
      }

      // Distance: positive = wrist below shoulder, negative = wrist above
      signal.push(wristY - shoulderY);
    }

    // Smooth
    const smoothed = [];
    for (let i = 0; i < signal.length; i++) {
      if (signal[i] === null) { smoothed.push(null); continue; }
      let sum = 0, count = 0;
      for (let j = Math.max(0, i - 1); j <= Math.min(signal.length - 1, i + 1); j++) {
        if (signal[j] !== null) { sum += signal[j]; count++; }
      }
      smoothed.push(count > 0 ? sum / count : null);
    }

    // Find range
    let posMin = Infinity, posMax = -Infinity;
    for (const v of smoothed) {
      if (v === null) continue;
      if (v < posMin) posMin = v;
      if (v > posMax) posMax = v;
    }
    const posRange = posMax - posMin;
    if (posRange < 0.03) return 0; // Less than 3% of frame height moved

    // Find peaks and valleys
    const extrema = [];
    for (let i = 1; i < smoothed.length - 1; i++) {
      if (smoothed[i] === null || smoothed[i-1] === null || smoothed[i+1] === null) continue;
      if (smoothed[i] > smoothed[i-1] && smoothed[i] > smoothed[i+1]) {
        extrema.push({ type: 'peak', index: i, value: smoothed[i] });
      } else if (smoothed[i] < smoothed[i-1] && smoothed[i] < smoothed[i+1]) {
        extrema.push({ type: 'valley', index: i, value: smoothed[i] });
      }
    }

    // Merge consecutive same-type
    const merged = [];
    for (const e of extrema) {
      if (merged.length > 0 && merged[merged.length - 1].type === e.type) {
        const prev = merged[merged.length - 1];
        if (e.type === 'peak' && e.value > prev.value) merged[merged.length - 1] = e;
        if (e.type === 'valley' && e.value < prev.value) merged[merged.length - 1] = e;
      } else {
        merged.push(e);
      }
    }

    // Filter by prominence (use 25% of range as min prominence for position)
    const minProm = posRange * 0.2;
    const filtered = [];
    for (const e of merged) {
      if (filtered.length === 0) { filtered.push(e); continue; }
      const prev = filtered[filtered.length - 1];
      const gap = Math.abs(e.value - prev.value);
      if (gap >= minProm) {
        filtered.push(e);
      } else {
        if (e.type === 'peak' && e.value > prev.value) filtered[filtered.length - 1] = e;
        else if (e.type === 'valley' && e.value < prev.value) filtered[filtered.length - 1] = e;
      }
    }

    // Count reps: for curls, wrist goes DOWN (peak in distance) then UP (valley)
    // For presses, wrist goes UP (valley) then DOWN (peak)
    // Use peak->valley pairs (wrist rises = curl contraction)
    const minROM = posRange * 0.25;
    let repCount = 0;
    let lastPeak = null;

    for (const e of filtered) {
      if (e.type === 'peak') {
        lastPeak = e;
      } else if (e.type === 'valley' && lastPeak !== null) {
        const rom = lastPeak.value - e.value;
        if (rom >= minROM) {
          repCount++;

          // Build rep history entry
          const bottomData = frameData[e.index];
          const topData = frameData[lastPeak.index];
          this._reps++;
          this._repHistory.push({
            score: 80, // Default score for position-detected reps
            issues: [],
            ts: Date.now(),
            peakAngle: null,
            startFrame: lastPeak.index,
            bottomFrame: e.index,
            endFrame: e.index,
          });
          lastPeak = null;
        }
      }
    }

    // Also try valley->peak (for exercises where wrist drops = rep)
    if (repCount === 0) {
      let lastValley = null;
      for (const e of filtered) {
        if (e.type === 'valley') {
          lastValley = e;
        } else if (e.type === 'peak' && lastValley !== null) {
          const rom = e.value - lastValley.value;
          if (rom >= minROM) {
            repCount++;
            this._reps++;
            this._repHistory.push({
              score: 80,
              issues: [],
              ts: Date.now(),
              peakAngle: null,
              startFrame: lastValley.index,
              bottomFrame: e.index,
              endFrame: e.index,
            });
            lastValley = null;
          }
        }
      }
    }

    return repCount;
  }

  _handleIsometric(angles, landmarks) {
    const formFeedback = this._evaluateForm(angles, landmarks);
    return {
      reps: 0,
      phase: 'hold',
      angle: Math.round(angles.trunk * 10) / 10,
      angles,
      formFeedback,
      repCompleted: false,
      repHistory: [],
    };
  }

  /** Diagnostic data for debugging on mobile */
  get diagnostics() {
    const range = this._observedMax - this._observedMin;
    const minROM = Math.max(15, range * 0.3);
    return {
      observedMin: Math.round(this._observedMin * 10) / 10,
      observedMax: Math.round(this._observedMax * 10) / 10,
      observedRange: Math.round(range * 10) / 10,
      minROM: Math.round(minROM * 10) / 10,
      method: this._positionFallbackUsed ? 'position-fallback' : 'peak-valley',
      repsDetected: this._reps,
      totalFrames: this._collectedLandmarks.length,
    };
  }

  _completeRep(angles, landmarks) {
    this._reps++;
    const totalChecks = this._exercise.formChecks.length;
    const failedMajor = this._currentRepIssues.filter((name) => {
      const fc = this._exercise.formChecks.find((c) => c.name === name);
      return fc && fc.severity === 'major';
    }).length;
    const failedMinor = this._currentRepIssues.filter((name) => {
      const fc = this._exercise.formChecks.find((c) => c.name === name);
      return fc && fc.severity !== 'major';
    }).length;

    // Score: start at 100, -15 per major issue, -5 per minor issue
    const score = Math.max(0, 100 - failedMajor * 15 - failedMinor * 5);

    // Map check names to their failure text so form notes show actionable feedback
    // ("Curl higher -- full contraction") instead of the check name ("Full contraction")
    const issueTexts = this._currentRepIssues.map(name => {
      const fc = this._exercise.formChecks.find(c => c.name === name);
      return fc ? fc.bad : name;
    });

    this._repHistory.push({
      score,
      issues: issueTexts,
      ts: Date.now(),
      peakAngle: this._peakAngle,
      // Frame indices for biomechanics: start of descent, bottom, end of ascent
      startFrame: this._repStartFrame,
      bottomFrame: this._bottomFrame,
      endFrame: this._frameIdx,
    });

    this._peakAngle = null;
    this._currentRepIssues = [];
    this._issueFrameCounts = {};
    // Next rep starts from this frame
    this._repStartFrame = this._frameIdx;
  }

  _evaluateForm(angles, landmarks) {
    return this._exercise.formChecks.map((fc) => {
      // Pass landmarks as optional second argument; existing checks that only
      // use angles will simply ignore it.
      const passed = fc.check(angles, landmarks);
      return {
        name: fc.name,
        passed,
        text: passed ? fc.good : fc.bad,
        severity: fc.severity,
      };
    });
  }

  /**
   * Phase-aware form evaluation: checks tagged phase:'top' are evaluated
   * at the peak frame (top of rep), all others at the valley frame (bottom).
   * This fixes lockout/extension/hang checks that were previously evaluated
   * at the wrong frame and could never pass.
   */
  _evaluateFormPhased(bottomData, topData) {
    return this._exercise.formChecks.map((fc) => {
      const isTopCheck = fc.phase === 'top';
      const data = isTopCheck ? topData : bottomData;
      if (!data) {
        // If the needed frame data is missing, assume passed to avoid false negatives
        return { name: fc.name, passed: true, text: fc.good, severity: fc.severity };
      }
      const passed = fc.check(data.angles, data.landmarks);
      return {
        name: fc.name,
        passed,
        text: passed ? fc.good : fc.bad,
        severity: fc.severity,
      };
    });
  }
}
