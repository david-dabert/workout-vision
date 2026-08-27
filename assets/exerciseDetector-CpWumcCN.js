import { extractJointAngles, LANDMARKS } from "./poseAnalysis-Bd3N5Gcc.js";
import { E as EXERCISES, d as bestSide } from "./index-ClV8Qj7m.js";
class AngleBuffer {
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
class RepCounter {
  constructor(exerciseKey, opts = {}) {
    const ex = EXERCISES[exerciseKey];
    if (!ex) throw new Error(`Unknown exercise: ${exerciseKey}`);
    this._exercise = ex;
    this._exerciseKey = exerciseKey;
    this._fps = opts.fps || 30;
    const smoothWindow = Math.min(5, Math.max(1, Math.round(this._fps * 0.3)));
    this._smoother = new AngleBuffer(smoothWindow);
    this.reset();
  }
  get repHistory() {
    return this._repHistory;
  }
  get reps() {
    return this._reps;
  }
  reset() {
    this._reps = 0;
    this._repHistory = [];
    this._smoother.reset();
    this._phase = "idle";
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
        reps: this._reps,
        phase: this._phase,
        angle: null,
        angles: null,
        formFeedback: [],
        repCompleted: false,
        repHistory: this._repHistory
      };
    }
    const angles = rawAngles;
    const ex = this._exercise;
    if (ex.isIsometric) {
      return {
        reps: 0,
        phase: "hold",
        angle: Math.round((angles.trunk || 0) * 10) / 10,
        angles,
        formFeedback: this._evaluateForm(angles, landmarks),
        repCompleted: false,
        repHistory: []
      };
    }
    const value = ex.getValue(angles, landmarks);
    if (value === null || value === void 0) {
      return {
        reps: this._reps,
        phase: this._phase,
        angle: null,
        angles,
        formFeedback: [],
        repCompleted: false,
        repHistory: this._repHistory
      };
    }
    this._frameIdx++;
    if (value < this._observedMin) this._observedMin = value;
    if (value > this._observedMax) this._observedMax = value;
    this._collectedLandmarks.push(landmarks);
    const down = ex.downThreshold;
    const up = ex.upThreshold;
    let repCompleted = false;
    const now = Date.now();
    if (down > up) {
      if (this._phase === "idle" && value < down) {
        this._phase = "concentric";
      } else if (this._phase === "concentric" && value < up) {
        this._phase = "contracted";
      } else if (this._phase === "contracted" && value > down) {
        if (now - this._lastRepTime > 600) {
          this._lastRepTime = now;
          this._phase = "idle";
          this._countLiveRep(angles, landmarks);
          repCompleted = true;
        }
      }
    } else {
      if (this._phase === "idle" && value > down) {
        this._phase = "concentric";
      } else if (this._phase === "concentric" && value > up) {
        this._phase = "contracted";
      } else if (this._phase === "contracted" && value < down) {
        if (now - this._lastRepTime > 600) {
          this._lastRepTime = now;
          this._phase = "idle";
          this._countLiveRep(angles, landmarks);
          repCompleted = true;
        }
      }
    }
    const formFeedback = this._evaluateForm(angles, landmarks);
    return {
      reps: this._reps,
      phase: this._phase,
      angle: Math.round(value * 10) / 10,
      angles,
      formFeedback,
      repCompleted,
      repHistory: this._repHistory
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
    const smoothed = this._smoothSignal(rawSignal);
    const validValues = smoothed.filter((v) => v !== null);
    const sigMin = Math.min(...validValues);
    const sigMax = Math.max(...validValues);
    console.debug(`[RepCounter] finalize: ${this._collectedLandmarks.length} frames, signal range ${Math.round(sigMin)}-${Math.round(sigMax)} (${Math.round(sigMax - sigMin)}°)`);
    const extrema = this._findExtrema(smoothed);
    const range = sigMax - sigMin;
    const minROM = Math.max(10, range * 0.2);
    if (extrema.length >= 2) {
      const firstValid = smoothed.findIndex((v) => v !== null);
      const lastValid = smoothed.length - 1 - [...smoothed].reverse().findIndex((v) => v !== null);
      const first = extrema[0];
      const last = extrema[extrema.length - 1];
      if (firstValid >= 0 && firstValid < first.index) {
        const bv = smoothed[firstValid];
        const diff = Math.abs(bv - first.value);
        if (diff >= minROM * 0.5) {
          const bType = first.type === "peak" ? "valley" : "peak";
          if (bType === "valley" && bv <= first.value || bType === "peak" && bv >= first.value) {
            extrema.unshift({ type: bType, index: firstValid, value: bv });
          }
        }
      }
      if (lastValid >= 0 && lastValid > last.index) {
        const bv = smoothed[lastValid];
        const diff = Math.abs(bv - last.value);
        if (diff >= minROM * 0.5) {
          const bType = last.type === "peak" ? "valley" : "peak";
          if (bType === "valley" && bv <= last.value || bType === "peak" && bv >= last.value) {
            extrema.push({ type: bType, index: lastValid, value: bv });
          }
        }
      }
    }
    console.debug(`[RepCounter] extrema found: ${extrema.length}`, extrema.map((e) => `${e.type}@${e.index}=${Math.round(e.value)}`));
    console.debug(`[RepCounter] minROM: ${Math.round(minROM)}° (range: ${Math.round(range)}°)`);
    this._reps = 0;
    this._repHistory = [];
    for (let i = 0; i < extrema.length - 2; i++) {
      const a = extrema[i];
      const b = extrema[i + 1];
      const c = extrema[i + 2];
      if (a.type === c.type && a.type !== b.type) {
        const rom = Math.abs(a.value - b.value);
        if (rom >= minROM) {
          this._recordRep(frameData, a.index, b.index, c.index);
          i++;
        }
      }
    }
    console.debug(`[RepCounter] finalize result: ${this._reps} reps`);
    const videoDuration = this._collectedLandmarks.length / this._fps;
    if (this._reps > 0) {
      const avgRepDuration = videoDuration / this._reps;
      if (avgRepDuration > 8 || avgRepDuration < 0.5) {
        console.warn(`[RepCounter] Sanity check: ${this._reps} reps in ${videoDuration.toFixed(1)}s = ${avgRepDuration.toFixed(1)}s/rep — trying position fallback`);
        const savedReps = this._reps;
        const savedHistory = [...this._repHistory];
        const posReps = this._countRepsPositionBased(frameData);
        if (posReps > savedReps) {
          console.warn(`[RepCounter] Position fallback found ${posReps} reps (was ${savedReps})`);
        } else {
          this._reps = savedReps;
          this._repHistory = savedHistory;
        }
      }
    }
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
      totalFrames: this._collectedLandmarks.length
    };
  }
  // ─── Private ───
  _smoothSignal(rawSignal) {
    const smoothed = [];
    const halfW = Math.max(1, Math.round(this._fps * 0.25));
    for (let i = 0; i < rawSignal.length; i++) {
      if (rawSignal[i] === null) {
        smoothed.push(null);
        continue;
      }
      let sum = 0, count = 0;
      for (let j = Math.max(0, i - halfW); j <= Math.min(rawSignal.length - 1, i + halfW); j++) {
        if (rawSignal[j] !== null) {
          sum += rawSignal[j];
          count++;
        }
      }
      smoothed.push(count > 0 ? sum / count : null);
    }
    return smoothed;
  }
  _findExtrema(smoothed) {
    const raw = [];
    for (let i = 1; i < smoothed.length - 1; i++) {
      if (smoothed[i] === null || smoothed[i - 1] === null || smoothed[i + 1] === null) continue;
      if (smoothed[i] > smoothed[i - 1] && smoothed[i] >= smoothed[i + 1]) {
        raw.push({ type: "peak", index: i, value: smoothed[i] });
      } else if (smoothed[i] < smoothed[i - 1] && smoothed[i] <= smoothed[i + 1]) {
        raw.push({ type: "valley", index: i, value: smoothed[i] });
      }
    }
    const merged = [];
    for (const e of raw) {
      if (merged.length > 0 && merged[merged.length - 1].type === e.type) {
        const prev = merged[merged.length - 1];
        if (e.type === "peak" && e.value > prev.value) merged[merged.length - 1] = e;
        if (e.type === "valley" && e.value < prev.value) merged[merged.length - 1] = e;
      } else {
        merged.push(e);
      }
    }
    const validValues = smoothed.filter((v) => v !== null);
    const range = validValues.length > 0 ? Math.max(...validValues) - Math.min(...validValues) : 0;
    const MIN_PROM = Math.max(8, range * 0.15);
    const MIN_GAP = Math.max(2, Math.round(this._fps * 0.4));
    const filtered = [];
    for (const e of merged) {
      if (filtered.length === 0) {
        filtered.push(e);
        continue;
      }
      const prev = filtered[filtered.length - 1];
      const prom = Math.abs(e.value - prev.value);
      const gap = e.index - prev.index;
      if (prom >= MIN_PROM && gap >= MIN_GAP) {
        filtered.push(e);
      } else {
        if (e.type === "peak" && e.value > prev.value) filtered[filtered.length - 1] = e;
        else if (e.type === "valley" && e.value < prev.value) filtered[filtered.length - 1] = e;
      }
    }
    return filtered;
  }
  _recordRep(frameData, startIdx, bottomIdx, endIdx) {
    const repDuration = (endIdx - startIdx) / this._fps;
    if (repDuration < 0.3 || repDuration > 8) {
      console.debug(`[RepCounter] rejected rep: duration ${repDuration.toFixed(2)}s`);
      return;
    }
    this._reps++;
    const ex = this._exercise;
    const checks = ex.formChecks || [];
    let score = null;
    const issues = [];
    if (checks.length > 0 && frameData[bottomIdx]) {
      const sampleStep = Math.max(1, Math.floor((endIdx - startIdx) / 12));
      const topData = frameData[startIdx] || frameData[endIdx];
      const formResults = checks.map((fc) => {
        const isTopCheck = fc.phase === "top";
        const criticalData = isTopCheck ? topData : frameData[bottomIdx];
        const criticalPassed = criticalData ? fc.check(criticalData.angles, criticalData.landmarks) : true;
        let failCount = 0;
        let sampleCount = 0;
        for (let i = startIdx; i <= endIdx; i += sampleStep) {
          const data = frameData[i];
          if (!data) continue;
          sampleCount++;
          if (!fc.check(data.angles, data.landmarks)) failCount++;
        }
        const failRate = sampleCount > 0 ? failCount / sampleCount : 0;
        const passed = criticalPassed && failRate < 0.3;
        return { name: fc.name, passed, bad: fc.bad, severity: fc.severity };
      });
      const failedMajor = formResults.filter((f) => !f.passed && f.severity === "major").length;
      const failedMinor = formResults.filter((f) => !f.passed && f.severity !== "major").length;
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
      endFrame: endIdx
    });
  }
  _countLiveRep(angles, landmarks) {
    this._reps++;
    const formResults = this._exercise.formChecks.map((fc) => {
      const passed = fc.check(angles, landmarks);
      return { name: fc.name, passed, bad: fc.bad, severity: fc.severity };
    });
    const failedMajor = formResults.filter((f) => !f.passed && f.severity === "major").length;
    const failedMinor = formResults.filter((f) => !f.passed && f.severity !== "major").length;
    const score = Math.max(0, 100 - failedMajor * 15 - failedMinor * 5);
    const issues = formResults.filter((f) => !f.passed).map((f) => f.bad);
    this._repHistory.push({
      score,
      issues,
      ts: Date.now(),
      startFrame: this._frameIdx,
      bottomFrame: this._frameIdx,
      endFrame: this._frameIdx
    });
  }
  _countRepsPositionBased(frameData) {
    const joint = this._exercise.joint;
    if (joint !== "elbow" && joint !== "shoulder") return 0;
    const signal = [];
    for (let i = 0; i < this._collectedLandmarks.length; i++) {
      const lm = this._collectedLandmarks[i];
      if (!lm || lm.length < 33) {
        signal.push(null);
        continue;
      }
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
    const valid = smoothed.filter((v) => v !== null);
    if (valid.length < 6) return 0;
    const posMin = Math.min(...valid);
    const posMax = Math.max(...valid);
    const posRange = posMax - posMin;
    if (posRange < 0.02) return 0;
    const extrema = this._findExtrema(smoothed);
    const minROM = posRange * 0.2;
    let repCount = 0;
    let lastPeak = null;
    for (const e of extrema) {
      if (e.type === "peak") {
        lastPeak = e;
      } else if (e.type === "valley" && lastPeak !== null) {
        const duration = (e.index - lastPeak.index) / this._fps;
        if (duration < 0.3) {
          lastPeak = null;
          continue;
        }
        if (lastPeak.value - e.value >= minROM) {
          repCount++;
          this._reps++;
          this._repHistory.push({
            score: null,
            issues: [],
            ts: Date.now(),
            startFrame: lastPeak.index,
            bottomFrame: e.index,
            endFrame: e.index
          });
          lastPeak = null;
        }
      }
    }
    if (repCount === 0) {
      let lastValley = null;
      for (const e of extrema) {
        if (e.type === "valley") {
          lastValley = e;
        } else if (e.type === "peak" && lastValley !== null) {
          const duration = (e.index - lastValley.index) / this._fps;
          if (duration < 0.3) {
            lastValley = null;
            continue;
          }
          if (e.value - lastValley.value >= minROM) {
            repCount++;
            this._reps++;
            this._repHistory.push({
              score: null,
              issues: [],
              ts: Date.now(),
              startFrame: lastValley.index,
              bottomFrame: e.index,
              endFrame: e.index
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
        severity: fc.severity
      };
    });
  }
}
class ExerciseAutoDetector {
  /**
   * @param {object} [opts]
   * @param {number} [opts.fps=30] - capture frame rate; adjusts detection windows
   */
  constructor(opts = {}) {
    const fps = opts.fps || 30;
    this._frameBuffer = [];
    this._bufferSize = Math.max(8, Math.round(fps));
    this._smoother = new AngleBuffer(fps <= 5 ? 2 : 3);
    this._lastDetection = null;
    this._detectionConfidence = 0;
    this._requiredConfidence = fps <= 5 ? 4 : 8;
    this._minFrames = fps <= 5 ? 5 : 8;
    this._voteHistory = [];
    this._voteWindowSize = Math.max(12, Math.round(fps * 1.5));
  }
  /**
   * Process a frame and return detected exercise or null.
   * @param {Array} landmarks - 33 MediaPipe landmarks
   * @returns {string|null} exercise key from EXERCISES, or null
   */
  update(landmarks) {
    const rawAngles = extractJointAngles(landmarks);
    if (!rawAngles) return this._lastDetection;
    const angles = this._smoother.smooth(rawAngles);
    this._frameBuffer.push(angles);
    if (this._frameBuffer.length > this._bufferSize) {
      this._frameBuffer.shift();
    }
    if (this._frameBuffer.length < this._minFrames) return null;
    const detection = this._classify(angles);
    if (detection) {
      this._voteHistory.push(detection);
      if (this._voteHistory.length > this._voteWindowSize) {
        this._voteHistory.shift();
      }
    }
    if (this._voteHistory.length >= this._requiredConfidence) {
      const counts = {};
      for (const v of this._voteHistory) {
        counts[v] = (counts[v] || 0) + 1;
      }
      let best = null, bestCount = 0;
      for (const [key, count] of Object.entries(counts)) {
        if (count > bestCount) {
          best = key;
          bestCount = count;
        }
      }
      if (bestCount >= this._requiredConfidence && bestCount > this._voteHistory.length * 0.5) {
        this._lastDetection = best;
        return best;
      }
    }
    return null;
  }
  _classify(angles) {
    bestSide(angles, "leftKnee", "rightKnee", "_visLeftKnee", "_visRightKnee");
    bestSide(angles, "leftHip", "rightHip", "_visLeftHip", "_visRightHip");
    bestSide(angles, "leftElbow", "rightElbow", "_visLeftElbow", "_visRightElbow");
    const shoulderAvg = bestSide(angles, "leftShoulder", "rightShoulder", "_visLeftShoulder", "_visRightShoulder");
    angles.trunk;
    const buf = this._frameBuffer;
    const vs = (a, l, r, vl, vr) => bestSide(a, l, r, vl, vr);
    const kneeRange = this._getRange(buf, (a) => vs(a, "leftKnee", "rightKnee", "_visLeftKnee", "_visRightKnee"));
    const hipRange = this._getRange(buf, (a) => vs(a, "leftHip", "rightHip", "_visLeftHip", "_visRightHip"));
    const elbowRange = this._getRange(buf, (a) => vs(a, "leftElbow", "rightElbow", "_visLeftElbow", "_visRightElbow"));
    const shoulderRange = this._getRange(buf, (a) => vs(a, "leftShoulder", "rightShoulder", "_visLeftShoulder", "_visRightShoulder"));
    const trunkRange = this._getRange(buf, (a) => a.trunk);
    const kneeBufAvg = this._getAvg(buf, (a) => vs(a, "leftKnee", "rightKnee", "_visLeftKnee", "_visRightKnee"));
    const hipBufAvg = this._getAvg(buf, (a) => vs(a, "leftHip", "rightHip", "_visLeftHip", "_visRightHip"));
    const elbowBufAvg = this._getAvg(buf, (a) => vs(a, "leftElbow", "rightElbow", "_visLeftElbow", "_visRightElbow"));
    const trunkBufAvg = this._getAvg(buf, (a) => a.trunk);
    const shoulderBufAvg = this._getAvg(buf, (a) => vs(a, "leftShoulder", "rightShoulder", "_visLeftShoulder", "_visRightShoulder"));
    const kneeMax = this._getMax(buf, (a) => vs(a, "leftKnee", "rightKnee", "_visLeftKnee", "_visRightKnee"));
    const hipMax = this._getMax(buf, (a) => vs(a, "leftHip", "rightHip", "_visLeftHip", "_visRightHip"));
    const kneeMin = this._getMin(buf, (a) => vs(a, "leftKnee", "rightKnee", "_visLeftKnee", "_visRightKnee"));
    this._getMin(buf, (a) => vs(a, "leftHip", "rightHip", "_visLeftHip", "_visRightHip"));
    const kneeAsym = Math.abs(angles.leftKnee - angles.rightKnee);
    const isSeated = hipBufAvg < 130 && hipRange < 20 || kneeBufAvg < 130 && kneeRange < 25 && hipBufAvg < 140;
    const isLying = trunkBufAvg < 15 && hipBufAvg > 140 && kneeRange < 15;
    const isProne = trunkBufAvg < 15 && hipBufAvg > 150;
    const isStanding = kneeBufAvg > 140 && hipBufAvg > 140;
    const isHanging = shoulderBufAvg > 140 && kneeBufAvg > 100;
    if (isSeated) {
      if (kneeRange > 20 && hipRange > 15 && elbowRange < 10) {
        return "leg_press";
      }
      if (kneeRange > 12 && elbowRange < 10) {
        if (kneeBufAvg < 100) return "leg_curl";
        return "leg_extension";
      }
      if (elbowRange > 8) {
        if (trunkBufAvg > 15) return "chest_supported_row";
        if (shoulderBufAvg > 80) return "lat_pulldown";
        if (shoulderAvg < 40) return "machine_chest_press";
        if (shoulderRange > 15 && elbowBufAvg < 100) return "preacher_curl";
        return "seated_row";
      }
      if (shoulderRange > 10) {
        if (shoulderBufAvg > 80) return "lat_pulldown";
        return "machine_chest_press";
      }
      if (hipRange > 15 && kneeRange < 10) return "russian_twist";
      return "seated_row";
    }
    if (isHanging && elbowRange < 10 && shoulderRange < 10 && hipRange < 10) return "dead_hang";
    if (isHanging && elbowRange > 15) {
      if (hipRange > 25) return "toes_to_bar";
      if (elbowBufAvg < 120) return "chin_up";
      return "pull_up";
    }
    if (isHanging && hipRange > 25 && kneeRange > 15) return "hanging_leg_raise";
    if (isHanging && hipBufAvg < 100 && hipRange < 10 && kneeBufAvg > 140) return "l_sit";
    if (isProne && trunkRange < 8 && kneeRange < 10 && elbowRange < 15) return "plank";
    if (trunkBufAvg < 20 && trunkRange < 8 && shoulderBufAvg > 140 && hipBufAvg > 140 && elbowRange < 10 && kneeRange < 10) return "hollow_body_hold";
    if (isProne && hipRange > 10 && kneeRange < 10 && elbowRange < 10) return "superman";
    if (trunkBufAvg < 30 && elbowRange > 20 && kneeRange < 12 && hipBufAvg > 140) {
      if (elbowBufAvg < 90) return "diamond_push_up";
      if (shoulderBufAvg > 90) return "pike_push_up";
      return "push_up";
    }
    if (isLying && elbowRange > 15) {
      if (shoulderBufAvg < 30 && elbowBufAvg < 100 && shoulderRange < 15) return "lying_bicep_curl";
      if (shoulderRange > 20 && elbowBufAvg > 130) return "dumbbell_fly";
      if (shoulderBufAvg > 70) return "skull_crusher";
      if (shoulderBufAvg < 40) return "close_grip_bench";
      return "bench_press";
    }
    if (trunkBufAvg < 25 && hipRange > 20 && kneeBufAvg > 70 && kneeBufAvg < 130 && elbowRange < 10) {
      if (hipBufAvg < 130) return "hip_thrust";
      return "glute_bridge";
    }
    if (trunkRange > 8 && trunkRange < 30 && kneeRange < 15 && elbowRange < 15 && trunkBufAvg < 30) {
      if (hipRange > 15) return "v_up";
      if (kneeRange > 8) return "bicycle_crunch";
      if (trunkRange > 15) return "sit_up";
      return "crunch";
    }
    if (trunkBufAvg < 15 && hipRange > 5 && hipRange < 20 && kneeBufAvg > 150) return "flutter_kick";
    if (isStanding && shoulderRange > 5 && shoulderRange < 15 && elbowBufAvg > 150 && elbowRange < 10) {
      return "shrug";
    }
    if (elbowRange > 15 && elbowRange > kneeRange * 1.5 && elbowRange > hipRange * 1.5 && shoulderRange < 20 && kneeBufAvg > 140 && hipBufAvg > 140 && trunkBufAvg < 35) {
      if (shoulderBufAvg < 15) return "hammer_curl";
      return "bicep_curl";
    }
    if (isStanding && elbowRange > 20 && shoulderBufAvg < 25 && shoulderRange < 10) {
      return "cable_tricep_pushdown";
    }
    if (shoulderRange > 15 && elbowBufAvg > 120 && trunkBufAvg > 30 && kneeBufAvg > 140) {
      return "rear_delt_fly";
    }
    if (isStanding && shoulderRange > 15 && elbowRange > 15 && shoulderBufAvg < 60 && trunkBufAvg < 40) {
      return "upright_row";
    }
    if (shoulderRange > 15 && elbowRange > 15 && shoulderBufAvg > 60 && trunkBufAvg < 15 && kneeBufAvg > 140) {
      return "face_pull";
    }
    if (shoulderRange > 20 && elbowBufAvg > 150 && trunkBufAvg < 10 && kneeBufAvg > 140) {
      return "front_raise";
    }
    if (shoulderRange > 20 && elbowBufAvg > 130 && trunkBufAvg < 20 && kneeBufAvg > 140) {
      return "lateral_raise";
    }
    if (elbowRange > 20 && shoulderAvg > 80 && trunkBufAvg < 45 && kneeBufAvg > 140) {
      if (kneeRange > 10) return "push_press";
      return "overhead_press";
    }
    if (elbowRange > 20 && shoulderAvg > 100 && trunkBufAvg < 15) {
      return "tricep_extension";
    }
    if (elbowRange > 15 && trunkBufAvg > 35 && trunkBufAvg < 75 && kneeBufAvg > 130) {
      if (trunkBufAvg > 60) return "pendlay_row";
      return "bent_over_row";
    }
    if (isStanding && shoulderRange > 20 && elbowBufAvg > 130 && trunkBufAvg < 20) {
      return "cable_crossover";
    }
    if (elbowRange > 25 && shoulderRange > 15 && kneeBufAvg > 100 && trunkBufAvg > 10 && trunkBufAvg < 40) {
      return "dip";
    }
    if (hipRange > 30 && shoulderRange > 30 && kneeRange > 10 && kneeRange < 30 && trunkRange > 20) {
      return "kettlebell_swing";
    }
    if (kneeRange > 20 && kneeAsym > 30) {
      if (kneeAsym > 50) return "bulgarian_split_squat";
      return "lunge";
    }
    if (isStanding && shoulderBufAvg > 150 && shoulderRange < 10 && elbowBufAvg > 150 && elbowRange < 10 && hipRange < 10) {
      return "overhead_hold";
    }
    if (isStanding && kneeRange < 10 && hipRange < 10 && elbowRange < 10 && shoulderRange < 10) {
      return "calf_raise";
    }
    if (kneeRange > 15 && kneeAsym > 20 && trunkBufAvg < 20) {
      return "step_up";
    }
    if (kneeRange > 25 && hipRange > 15 && trunkBufAvg < 60 && kneeMax > 145) {
      if (shoulderBufAvg > 130) return "overhead_squat";
      if (kneeMin < 80) return "pistol_squat";
      if (trunkBufAvg < 30) return "front_squat";
      if (hipRange > kneeRange) return "sumo_deadlift";
      return "squat";
    }
    if (hipRange > 25 && trunkBufAvg > 35 && hipMax > 145) {
      if (kneeRange < 10) return "good_morning";
      if (kneeRange < 15) return "romanian_deadlift";
      return "deadlift";
    }
    if (hipRange > 20 && kneeBufAvg > 70 && kneeBufAvg < 120 && elbowRange < 10) {
      return "hip_thrust";
    }
    if (kneeRange > 30 && hipRange > 20 && trunkBufAvg < 40) {
      return "jump_squat";
    }
    if (kneeBufAvg < 120 && kneeRange < 10 && hipRange < 10 && trunkBufAvg < 20) {
      return "wall_sit";
    }
    if (trunkBufAvg < 25 && kneeRange > 20 && elbowRange < 10 && hipRange > 15) {
      return "mountain_climber";
    }
    if (isStanding && shoulderRange > 30 && kneeRange > 10 && elbowBufAvg > 130) {
      return "jumping_jack";
    }
    if (trunkRange > 40 && kneeRange > 30 && elbowRange > 20) {
      return "burpee";
    }
    if (isStanding && shoulderRange > 15 && shoulderRange < 40 && elbowRange < 15 && kneeRange < 10) {
      return "battle_rope";
    }
    if (kneeRange > 20 && elbowRange > 20 && shoulderBufAvg > 60 && hipRange > 15) {
      return "thruster";
    }
    if (hipRange > 20 && shoulderRange > 25 && elbowRange > 20) {
      if (shoulderBufAvg > 100) return "clean_and_press";
      return "power_clean";
    }
    return null;
  }
  _getRange(buffer, accessor) {
    let min = Infinity;
    let max = -Infinity;
    for (const frame of buffer) {
      const val = accessor(frame);
      if (val == null || isNaN(val)) continue;
      if (val < min) min = val;
      if (val > max) max = val;
    }
    return max === -Infinity ? 0 : max - min;
  }
  _getAvg(buffer, accessor) {
    if (buffer.length === 0) return 0;
    let sum = 0;
    let count = 0;
    for (const frame of buffer) {
      const val = accessor(frame);
      if (val == null || isNaN(val)) continue;
      sum += val;
      count++;
    }
    return count === 0 ? 0 : sum / count;
  }
  _getMax(buffer, accessor) {
    let max = -Infinity;
    for (const frame of buffer) {
      const val = accessor(frame);
      if (val != null && val > max) max = val;
    }
    return max;
  }
  _getMin(buffer, accessor) {
    let min = Infinity;
    for (const frame of buffer) {
      const val = accessor(frame);
      if (val != null && val < min) min = val;
    }
    return min;
  }
  reset() {
    this._frameBuffer = [];
    this._lastDetection = null;
    this._detectionConfidence = 0;
    this._smoother.reset();
  }
}
export {
  ExerciseAutoDetector as E,
  RepCounter as R
};
