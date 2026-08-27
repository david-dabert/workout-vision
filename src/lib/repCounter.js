/**
 * Rep counting engine — peak/valley detection on smoothed joint angles.
 *
 * Architecture:
 * - Pass 1: update() collects landmarks frame-by-frame (live counting optional)
 * - Pass 2: finalize() runs peak/valley detection on the full signal
 *
 * The finalize pass is the source of truth for video analysis.
 * Live counting is best-effort for real-time feedback.
 */

import { extractJointAngles, LANDMARKS } from './poseAnalysis';
import { EXERCISES } from './exercises';
import { shouldSkipCheck } from './injuries';

// ---------------------------------------------------------------------------
// Utility: moving average smoother
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
    this._fps = opts.fps || 30;
    this._userInjuries = opts.userInjuries || [];
    // Smooth ~0.3s of data: at 4fps→1 frame, at 6fps→2, at 30fps→9 (capped at 5)
    const smoothWindow = Math.min(5, Math.max(1, Math.round(this._fps * 0.3)));
    this._smoother = new AngleBuffer(smoothWindow);
    this.reset();
  }

  get repHistory() { return this._repHistory; }
  get reps() { return this._reps; }

  reset() {
    this._reps = 0;
    this._repHistory = [];
    this._smoother.reset();
    this._phase = 'idle';
    this._collectedLandmarks = [];
    this._observedMin = Infinity;
    this._observedMax = -Infinity;
    this._finalized = false;
    this._lastRepTime = 0;
    this._frameIdx = 0;
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

    // Use RAW angles for getValue — no smoothing before signal extraction.
    // Smoothing happens once in finalize() on the full signal.
    // Live hysteresis counting uses raw values for sharper transitions.
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

    // Live hysteresis counting
    const down = ex.downThreshold;
    const up = ex.upThreshold;
    let repCompleted = false;
    const now = Date.now();

    if (down > up) {
      // Signal decreases during concentric (curls, squats)
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
      // Signal increases during concentric (lateral raises)
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
   * Pass 2: peak/valley rep detection on the full collected signal.
   * This is the authoritative count for video analysis.
   */
  finalize() {
    if (this._finalized) return;
    this._finalized = true;

    const ex = this._exercise;
    if (ex.isIsometric || this._collectedLandmarks.length < 6) return;

    // Extract the raw signal — no per-frame smoothing here.
    // _smoothSignal() handles all smoothing in one pass, avoiding
    // the double-smoothing that flattens peaks at low FPS.
    const rawSignal = [];
    const frameData = [];

    for (let i = 0; i < this._collectedLandmarks.length; i++) {
      const landmarks = this._collectedLandmarks[i];
      const angles = extractJointAngles(landmarks);
      if (!angles) {
        rawSignal.push(null);
        frameData.push(null);
        continue;
      }
      const value = ex.getValue(angles, landmarks);
      rawSignal.push(value);
      frameData.push({ angles, landmarks });
    }

    // Single smoothing pass
    const smoothed = this._smoothSignal(rawSignal);

    // Debug: log signal stats
    const validValues = smoothed.filter(v => v !== null);
    const sigMin = Math.min(...validValues);
    const sigMax = Math.max(...validValues);
    console.debug(`[RepCounter] finalize: ${this._collectedLandmarks.length} frames, signal range ${Math.round(sigMin)}-${Math.round(sigMax)} (${Math.round(sigMax - sigMin)}°)`);

    // Find peaks and valleys
    const extrema = this._findExtrema(smoothed);

    // Count reps from extrema pairs
    const range = sigMax - sigMin;
    // Minimum ROM for a rep: 20% of observed range, floor at 10 degrees
    const minROM = Math.max(10, range * 0.2);

    // Add boundary extrema: if the signal starts or ends far enough from
    // the first/last detected extremum, treat the boundary as a synthetic
    // extremum. This catches reps that begin or end at the video edges.
    if (extrema.length >= 2) {
      const firstValid = smoothed.findIndex(v => v !== null);
      const lastValid = smoothed.length - 1 - [...smoothed].reverse().findIndex(v => v !== null);
      const first = extrema[0];
      const last = extrema[extrema.length - 1];

      // Prepend boundary if it's the opposite type of the first extremum
      // and has enough ROM from it
      if (firstValid >= 0 && firstValid < first.index) {
        const bv = smoothed[firstValid];
        const diff = Math.abs(bv - first.value);
        if (diff >= minROM * 0.5) {
          const bType = (first.type === 'peak') ? 'valley' : 'peak';
          if ((bType === 'valley' && bv <= first.value) || (bType === 'peak' && bv >= first.value)) {
            extrema.unshift({ type: bType, index: firstValid, value: bv });
          }
        }
      }

      // Append boundary if it's the opposite type of the last extremum
      if (lastValid >= 0 && lastValid > last.index) {
        const bv = smoothed[lastValid];
        const diff = Math.abs(bv - last.value);
        if (diff >= minROM * 0.5) {
          const bType = (last.type === 'peak') ? 'valley' : 'peak';
          if ((bType === 'valley' && bv <= last.value) || (bType === 'peak' && bv >= last.value)) {
            extrema.push({ type: bType, index: lastValid, value: bv });
          }
        }
      }
    }

    console.debug(`[RepCounter] extrema found: ${extrema.length}`, extrema.map(e => `${e.type}@${e.index}=${Math.round(e.value)}`));
    console.debug(`[RepCounter] minROM: ${Math.round(minROM)}° (range: ${Math.round(range)}°)`);

    // Reset for pass 2 count
    this._reps = 0;
    this._repHistory = [];

    // Full-cycle detection: find triplets a-b-c where a and c are the same
    // type (both peaks or both valleys) and b is the opposite.
    // This gives three distinct frame indices per rep: start, bottom, end.
    // The end of one rep becomes the start of the next (shared boundary).
    for (let i = 0; i < extrema.length - 2; i++) {
      const a = extrema[i];
      const b = extrema[i + 1];
      const c = extrema[i + 2];

      if (a.type === c.type && a.type !== b.type) {
        const rom = Math.abs(a.value - b.value);
        if (rom >= minROM) {
          this._recordRep(frameData, a.index, b.index, c.index);
          i++; // next rep starts from c (shared boundary)
        }
      }
    }

    console.debug(`[RepCounter] finalize result: ${this._reps} reps`);

    // Sanity check: reject implausible rep durations
    const videoDuration = this._collectedLandmarks.length / this._fps;
    if (this._reps > 0) {
      const avgRepDuration = videoDuration / this._reps;
      if (avgRepDuration > 8.0 || avgRepDuration < 0.5) {
        console.warn(`[RepCounter] Sanity check: ${this._reps} reps in ${videoDuration.toFixed(1)}s = ${avgRepDuration.toFixed(1)}s/rep — trying position fallback`);
        const savedReps = this._reps;
        const savedHistory = [...this._repHistory];
        const posReps = this._countRepsPositionBased(frameData);
        if (posReps > savedReps) {
          console.warn(`[RepCounter] Position fallback found ${posReps} reps (was ${savedReps})`);
        } else {
          // Restore original if fallback didn't improve
          this._reps = savedReps;
          this._repHistory = savedHistory;
        }
      }
    }

    // Position-based fallback for 0 reps
    if (this._reps === 0 && this._collectedLandmarks.length >= 10) {
      const posReps = this._countRepsPositionBased(frameData);
      console.debug(`[RepCounter] position fallback: ${posReps} reps`);
    }
  }

  get diagnostics() {
    const range = this._observedMax - this._observedMin;
    return {
      observedMin: Math.round(this._observedMin * 10) / 10,
      observedMax: Math.round(this._observedMax * 10) / 10,
      observedRange: Math.round(range * 10) / 10,
      repsDetected: this._reps,
      totalFrames: this._collectedLandmarks.length,
    };
  }

  // ─── Private ───

  _smoothSignal(rawSignal) {
    const smoothed = [];
    // Scale smoothing window with FPS: ~0.25s of data (reduced from 0.5s)
    // At 4fps → halfW=1 (3-frame), at 6fps → halfW=2 (5-frame)
    // Narrower window preserves peaks at low FPS instead of merging them
    const halfW = Math.max(1, Math.round(this._fps * 0.25));
    for (let i = 0; i < rawSignal.length; i++) {
      if (rawSignal[i] === null) { smoothed.push(null); continue; }
      let sum = 0, count = 0;
      for (let j = Math.max(0, i - halfW); j <= Math.min(rawSignal.length - 1, i + halfW); j++) {
        if (rawSignal[j] !== null) { sum += rawSignal[j]; count++; }
      }
      smoothed.push(count > 0 ? sum / count : null);
    }
    return smoothed;
  }

  _findExtrema(smoothed) {
    // Find all local peaks and valleys
    const raw = [];
    for (let i = 1; i < smoothed.length - 1; i++) {
      if (smoothed[i] === null || smoothed[i-1] === null || smoothed[i+1] === null) continue;
      if (smoothed[i] > smoothed[i-1] && smoothed[i] >= smoothed[i+1]) {
        raw.push({ type: 'peak', index: i, value: smoothed[i] });
      } else if (smoothed[i] < smoothed[i-1] && smoothed[i] <= smoothed[i+1]) {
        raw.push({ type: 'valley', index: i, value: smoothed[i] });
      }
    }

    // Merge consecutive same-type extrema (keep most extreme)
    const merged = [];
    for (const e of raw) {
      if (merged.length > 0 && merged[merged.length - 1].type === e.type) {
        const prev = merged[merged.length - 1];
        if (e.type === 'peak' && e.value > prev.value) merged[merged.length - 1] = e;
        if (e.type === 'valley' && e.value < prev.value) merged[merged.length - 1] = e;
      } else {
        merged.push(e);
      }
    }

    // Adaptive prominence: 15% of observed range, minimum 8 degrees.
    // Scales with the exercise (a curl with 70 deg ROM needs ~10.5 deg,
    // a squat with 90 deg ROM needs ~13.5 deg). Fixed 4 deg was too low.
    const validValues = smoothed.filter(v => v !== null);
    const range = validValues.length > 0
      ? Math.max(...validValues) - Math.min(...validValues) : 0;
    const MIN_PROM = Math.max(8, range * 0.15);

    // Minimum frame gap: 0.4 seconds worth of frames.
    // At 4 fps = 2 frames, at 8 fps = 3 frames. Prevents double-counting
    // from signal noise where two extrema are 0.25s apart.
    const MIN_GAP = Math.max(2, Math.round(this._fps * 0.4));

    const filtered = [];
    for (const e of merged) {
      if (filtered.length === 0) { filtered.push(e); continue; }
      const prev = filtered[filtered.length - 1];
      const prom = Math.abs(e.value - prev.value);
      const gap = e.index - prev.index;

      if (prom >= MIN_PROM && gap >= MIN_GAP) {
        filtered.push(e);
      } else {
        // Too close in value or time: keep the more extreme one
        if (e.type === 'peak' && e.value > prev.value) filtered[filtered.length - 1] = e;
        else if (e.type === 'valley' && e.value < prev.value) filtered[filtered.length - 1] = e;
      }
    }

    return filtered;
  }

  _recordRep(frameData, startIdx, bottomIdx, endIdx) {
    // Duration filter: reject reps shorter than 0.3s or longer than 8s
    const repDuration = (endIdx - startIdx) / this._fps;
    if (repDuration < 0.3 || repDuration > 8.0) {
      console.debug(`[RepCounter] rejected rep: duration ${repDuration.toFixed(2)}s`);
      return;
    }

    this._reps++;

    // Evaluate form across multiple frames in the rep, not just 2.
    // Sample every Nth frame to balance accuracy vs performance.
    const ex = this._exercise;
    const checks = ex.formChecks || [];
    let score = null;
    const issues = [];

    if (checks.length > 0 && frameData[bottomIdx]) {
      const sampleStep = Math.max(1, Math.floor((endIdx - startIdx) / 12));
      const topData = frameData[startIdx] || frameData[endIdx];

      const formResults = checks.map((fc) => {
        // Skip form checks for user's injured areas
        if (shouldSkipCheck(fc.name, this._userInjuries)) {
          return { name: fc.name, passed: true, bad: fc.bad, severity: 'minor', skipped: true };
        }

        const isTopCheck = fc.phase === 'top';
        // Check the critical frame (bottom or top of rep)
        const criticalData = isTopCheck ? topData : frameData[bottomIdx];
        const criticalPassed = criticalData ? fc.check(criticalData.angles, criticalData.landmarks) : true;

        // Also sample across the rep to catch mid-rep breakdown
        let failCount = 0;
        let sampleCount = 0;
        for (let i = startIdx; i <= endIdx; i += sampleStep) {
          const data = frameData[i];
          if (!data) continue;
          sampleCount++;
          if (!fc.check(data.angles, data.landmarks)) failCount++;
        }

        // Fail if critical frame fails OR >30% of samples fail
        const failRate = sampleCount > 0 ? failCount / sampleCount : 0;
        const passed = criticalPassed && failRate < 0.30;
        return { name: fc.name, passed, bad: fc.bad, severity: fc.severity };
      });

      const failedMajor = formResults.filter(f => !f.passed && f.severity === 'major').length;
      const failedMinor = formResults.filter(f => !f.passed && f.severity !== 'major').length;
      score = Math.max(0, 100 - failedMajor * 15 - failedMinor * 5);
      for (const f of formResults) {
        if (!f.passed) issues.push(f.bad);
      }
    }

    this._repHistory.push({
      score,
      issues,
      ts: Date.now(),
      startFrame: startIdx,
      bottomFrame: bottomIdx,
      endFrame: endIdx,
    });
  }

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

  _countRepsPositionBased(frameData) {
    const joint = this._exercise.joint;
    if (joint !== 'elbow' && joint !== 'shoulder') return 0;

    // Build signal: wrist-to-shoulder distance
    const signal = [];
    for (let i = 0; i < this._collectedLandmarks.length; i++) {
      const lm = this._collectedLandmarks[i];
      if (!lm || lm.length < 33) { signal.push(null); continue; }

      const lVis = Math.min(lm[LANDMARKS.LEFT_WRIST].visibility || 0, lm[LANDMARKS.LEFT_SHOULDER].visibility || 0);
      const rVis = Math.min(lm[LANDMARKS.RIGHT_WRIST].visibility || 0, lm[LANDMARKS.RIGHT_SHOULDER].visibility || 0);

      let wrist, shoulder;
      if (lVis >= rVis && lVis > 0.3) {
        wrist = lm[LANDMARKS.LEFT_WRIST];
        shoulder = lm[LANDMARKS.LEFT_SHOULDER];
      } else if (rVis > 0.3) {
        wrist = lm[LANDMARKS.RIGHT_WRIST];
        shoulder = lm[LANDMARKS.RIGHT_SHOULDER];
      } else {
        wrist = { y: (lm[LANDMARKS.LEFT_WRIST].y + lm[LANDMARKS.RIGHT_WRIST].y) / 2, z: 0 };
        shoulder = { y: (lm[LANDMARKS.LEFT_SHOULDER].y + lm[LANDMARKS.RIGHT_SHOULDER].y) / 2, z: 0 };
      }

      const dy = wrist.y - shoulder.y;
      const dz = (wrist.z || 0) - (shoulder.z || 0);
      signal.push(Math.sqrt(dy * dy + dz * dz));
    }

    const smoothed = this._smoothSignal(signal);
    const valid = smoothed.filter(v => v !== null);
    if (valid.length < 6) return 0;

    const posMin = Math.min(...valid);
    const posMax = Math.max(...valid);
    const posRange = posMax - posMin;
    if (posRange < 0.02) return 0;

    // Find extrema on position signal
    const extrema = this._findExtrema(smoothed);
    const minROM = posRange * 0.2;

    let repCount = 0;
    let lastPeak = null;

    // For curls: peak distance (arm extended) -> valley (arm curled) = 1 rep
    for (const e of extrema) {
      if (e.type === 'peak') {
        lastPeak = e;
      } else if (e.type === 'valley' && lastPeak !== null) {
        const duration = (e.index - lastPeak.index) / this._fps;
        if (duration < 0.3) { lastPeak = null; continue; }
        if (lastPeak.value - e.value >= minROM) {
          repCount++;
          this._reps++;
          this._repHistory.push({
            score: null,
            issues: [],
            ts: Date.now(),
            startFrame: lastPeak.index,
            bottomFrame: e.index,
            endFrame: e.index,
          });
          lastPeak = null;
        }
      }
    }

    // Try reverse direction if nothing found
    if (repCount === 0) {
      let lastValley = null;
      for (const e of extrema) {
        if (e.type === 'valley') {
          lastValley = e;
        } else if (e.type === 'peak' && lastValley !== null) {
          const duration = (e.index - lastValley.index) / this._fps;
          if (duration < 0.3) { lastValley = null; continue; }
          if (e.value - lastValley.value >= minROM) {
            repCount++;
            this._reps++;
            this._repHistory.push({
              score: null,
              issues: [],
              ts: Date.now(),
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

  _evaluateForm(angles, landmarks) {
    return this._exercise.formChecks.map((fc) => {
      const passed = fc.check(angles, landmarks);
      return {
        name: fc.name,
        passed,
        text: passed ? fc.good : fc.bad,
        severity: fc.severity,
      };
    });
  }
}
