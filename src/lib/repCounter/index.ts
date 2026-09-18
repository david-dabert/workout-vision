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

import type {
  LandmarkArray,
  JointAngles,
  RepEvent,
  RepHistoryEntry,
} from '../types';
import { extractJointAngles, interpolateOccludedLandmarks } from '../poseAnalysis';
import { EXERCISES } from '../exercises';
import { VelocityEngine } from '../VelocityEngine';
import { ProgressionScore } from '../ProgressionScore';
import { AnthropometricNormalizer } from '../AnthropometricNormalizer';
import {
  interpolateNulls,
  smoothSignal,
} from '../valleyCounter';

import type { Exercise, ValleyResult, Cycle, DiagCandidate, RepCounterOptions } from './types';
import { adaptiveSignalSelect } from './valley';
import { buildFormHistoryFromCycles, evaluateLiveRep, evaluateFormFeedback } from './scoring';
import { oneEuroFilter } from './stateMachine';

const REP_COUNTER_BUILD = 'v25-state-machine';

// ---------------------------------------------------------------------------
// Utility: moving average smoother (used by ExerciseAutoDetector)
// ---------------------------------------------------------------------------

export class AngleBuffer {
  private _window: number;
  private _buffers: Record<string, number[]>;

  constructor(windowSize = 5) {
    this._window = windowSize;
    this._buffers = {};
  }

  smooth(angles: JointAngles | null): JointAngles | null {
    if (!angles) return null;
    const smoothed: Record<string, number> = {};
    for (const key of Object.keys(angles)) {
      if (!this._buffers[key]) this._buffers[key] = [];
      this._buffers[key].push(angles[key]);
      if (this._buffers[key].length > this._window) {
        this._buffers[key].shift();
      }
      const buf = this._buffers[key];
      smoothed[key] = buf.reduce((s, v) => s + v, 0) / buf.length;
    }
    return smoothed as JointAngles;
  }

  reset(): void {
    this._buffers = {};
  }
}

// ---------------------------------------------------------------------------
// RepCounter
// ---------------------------------------------------------------------------

// Hard cap on collected landmarks to bound memory. At 15fps with 33 landmarks
// per frame (~1.3KB/frame), 1200 frames = ~1.6MB. Matches 2× the MAX_FRAMES
// ceiling in VideoUpload (600 on desktop, 300 on iOS) to handle edge cases.
const MAX_LANDMARK_FRAMES = 1200;

export class RepCounter {
  private _exercise: Exercise;
  private _exerciseKey: string;
  private _mode: 'video' | 'live';
  private _fps: number;
  private _userInjuries: string[];
  private _weightKg: number;
  private _anthropometricNormalizer: AnthropometricNormalizer;
  private _reps!: number;
  private _repHistory!: RepHistoryEntry[];
  private _phase!: string;
  private _collectedLandmarks!: LandmarkArray[];
  private _totalFramesAnalyzed!: number;
  private _observedMin!: number;
  private _observedMax!: number;
  private _finalized!: boolean;
  private _lastRepTime!: number;
  private _frameIdx!: number;
  private _cycleDebug!: { reps: number; cycles: Cycle[]; periodFrames: number; signalRange: number } | null;
  private _velocityAnalysis!: { fatigue: unknown; power: unknown; smoothness: unknown } | null;
  private _progressionScore!: unknown;
  private _prevValue!: number | null;
  private _prevPrevValue!: number | null;
  private _angularVelocity!: number;
  private _isometricFrames!: number;
  private _cycleAngles!: JointAngles[];
  private _cycleLandmarks!: LandmarkArray[];
  private _signalDiagnostics!: unknown[];
  private _repResult!: { confirmed: number; uncertain: number; total: number } | null;
  private _exerciseConfidence!: number;
  private _adaptedSignalName?: string;
  private _adaptiveDiagCandidates?: DiagCandidate[];
  private _adaptiveDiag?: DiagCandidate[];
  private _templateEdgeDiag?: unknown;

  constructor(exerciseKey: string, opts: RepCounterOptions = {}) {
    const ex = (EXERCISES as Record<string, Exercise>)[exerciseKey];
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

  get repHistory(): RepHistoryEntry[] { return this._repHistory; }
  get reps(): number { return this._reps; }

  reset(): void {
    this._reps = 0;
    this._repHistory = [];
    this._phase = 'setup'; // 5-stage FSM: setup → eccentric → isometric → concentric → lockout
    this._collectedLandmarks = [];
    this._totalFramesAnalyzed = 0;
    this._observedMin = Infinity;
    this._observedMax = -Infinity;
    this._finalized = false;
    this._lastRepTime = -Infinity;
    this._frameIdx = 0;
    this._cycleDebug = null;
    this._velocityAnalysis = null;
    this._progressionScore = null;
    // Velocity tracking for FSM
    this._prevValue = null;
    this._prevPrevValue = null;
    this._angularVelocity = 0;
    this._isometricFrames = 0;
    // Live mode: track worst angles during the current rep cycle for form evaluation
    this._cycleAngles = [];
    this._cycleLandmarks = [];
    this._signalDiagnostics = [];
    this._repResult = null;
    this._exerciseConfidence = 0;
  }

  /**
   * Per-frame update. Collects landmarks for finalize().
   * Hysteresis counting runs for live rep display.
   * @param landmarks - MediaPipe pose landmarks
   * @param videoTimestamp - Time in SECONDS (e.g. frameIndex / fps)
   */
  update(landmarks: LandmarkArray, videoTimestamp?: number): RepEvent {
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
        formFeedback: evaluateFormFeedback(angles, landmarks, ex, this._anthropometricNormalizer),
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
    // Bounded landmark accumulation: stop collecting once cap is reached.
    // finalize() will still work on whatever was collected; the cap prevents
    // OOM on mobile for unexpectedly long videos or high-fps streams.
    if (this._collectedLandmarks.length < MAX_LANDMARK_FRAMES) {
      this._collectedLandmarks.push(landmarks);
    }

    // Anthropometric calibration from first frames
    if (!this._anthropometricNormalizer.isCalibrated) {
      this._anthropometricNormalizer.addFrame(landmarks);
    }

    let repCompleted = false;

    // Collect angles/landmarks during rep cycle for form evaluation across the full rep
    if (this._phase !== 'setup' && this._phase !== 'lockout') {
      this._cycleAngles.push(angles);
      this._cycleLandmarks.push(landmarks);
    }

    // ─── 5-Stage Biomechanical State Machine ───
    // Phases: setup → eccentric → isometric → concentric → lockout → eccentric ...
    // Transitions fire on angular velocity direction, not static angle thresholds.
    // This handles tempo reps, pauses at bottom, and partial ROM correctly.
    {
      const dt = 1 / this._fps;
      // Convert seconds to ms. Guard against callers passing ms already (>1000 = likely ms).
      let now: number;
      if (videoTimestamp == null) {
        now = Date.now();
      } else if (videoTimestamp > 1000) {
        now = videoTimestamp; // already in ms (e.g. performance.now())
      } else {
        now = videoTimestamp * 1000; // seconds → ms
      }

      // Compute angular velocity (deg/s) with simple finite difference
      if (this._prevValue !== null) {
        this._angularVelocity = (value - this._prevValue) / dt;
      }
      this._prevPrevValue = this._prevValue;
      this._prevValue = value;

      // Normalize direction: for exercises where down < up (e.g. push-up, curl),
      // negative velocity = eccentric (lowering). For exercises where down > up,
      // positive velocity = eccentric.
      const down = ex.downThreshold;
      const up = ex.upThreshold;
      const invert = down > up;
      const signedVel = invert ? -this._angularVelocity : this._angularVelocity;

      // Velocity thresholds (deg/s). These are intentionally low to catch slow
      // tempo reps. The isometric zone absorbs noise at the inflection point.
      const velThreshold = 15; // minimum angular velocity to count as moving
      const isometricLimit = 8; // below this = isometric hold

      switch (this._phase) {
        case 'setup':
          // Wait for initial movement in either direction
          if (Math.abs(signedVel) > velThreshold) {
            this._phase = signedVel > 0 ? 'eccentric' : 'concentric';
          }
          break;

        case 'eccentric':
          // Moving toward the bottom of the rep
          if (Math.abs(signedVel) < isometricLimit) {
            this._isometricFrames++;
            // After ~0.1s of near-zero velocity at the inflection, transition
            if (this._isometricFrames > Math.max(2, this._fps * 0.1)) {
              this._phase = 'isometric';
              this._isometricFrames = 0;
            }
          } else {
            this._isometricFrames = 0;
            // If velocity reverses hard during eccentric, skip to concentric
            if (signedVel < -velThreshold) {
              this._phase = 'concentric';
            }
          }
          break;

        case 'isometric':
          // Paused at inflection (bottom of rep). Wait for concentric movement.
          if (signedVel < -velThreshold) {
            this._phase = 'concentric';
          } else if (signedVel > velThreshold) {
            // False inflection — went back to eccentric
            this._phase = 'eccentric';
          }
          break;

        case 'concentric':
          // Moving back toward lockout
          if (Math.abs(signedVel) < isometricLimit) {
            this._isometricFrames++;
            if (this._isometricFrames > Math.max(2, this._fps * 0.1)) {
              // Reached lockout (velocity died at the top)
              if (now - this._lastRepTime > 600) {
                this._lastRepTime = now;
                this._phase = 'lockout';
                this._isometricFrames = 0;
                this._countLiveRep(angles, landmarks);
                repCompleted = true;
              }
            }
          } else {
            this._isometricFrames = 0;
            // Velocity reversed — back to eccentric without reaching lockout
            if (signedVel > velThreshold) {
              this._phase = 'eccentric';
            }
          }
          break;

        case 'lockout':
          // At the top. Wait for next eccentric to start the next rep.
          if (signedVel > velThreshold) {
            this._phase = 'eccentric';
            // Reset cycle buffers for the new rep
            this._cycleAngles = [];
            this._cycleLandmarks = [];
          }
          break;
      }
    }

    const formFeedback = evaluateFormFeedback(angles, landmarks, ex, this._anthropometricNormalizer);

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
  finalize(): void {
    if (this._finalized) return;
    this._finalized = true;

    const ex = this._exercise;
    const N = this._collectedLandmarks.length;
    if (ex.isIsometric || N < 6) return;

    // ── Step 0: Interpolate occluded landmarks for cleaner signal ──
    const cleanedLandmarks: LandmarkArray[] = interpolateOccludedLandmarks(this._collectedLandmarks);

    // ── Step 1: Extract the raw tracking signal ──
    const rawValues: (number | null)[] = cleanedLandmarks.map(lm => {
      const a = extractJointAngles(lm);
      return a ? ex.getValue(a, lm) : null;
    });

    // Two-stage smoothing:
    //   1. Moving average (window=5) kills bilateral flicker (1-5 frame oscillations)
    //   2. One-Euro filter adapts: heavy smoothing during holds, light during fast motion
    // This preserves sharp phase transitions (important for the state machine)
    // while suppressing jitter (important for threshold crossings).
    const smoothWindow = ex.smoothing != null ? ex.smoothing
      : (ex.minSpacing != null && ex.minSpacing < 0.2) ? 1 : 5;
    const maSmoothed: number[] = smoothSignal(interpolateNulls(rawValues), smoothWindow);
    let interpolated: number[] = oneEuroFilter(maSmoothed, this._fps);

    // ── Step 1b: Adaptive multi-signal selection ──
    // Test ALL available signals (primary + 28 3D alternatives) in both
    // orientations. Score each by reps x tempo_consistency. The signal
    // producing the most rhythmically consistent rep count wins.
    //
    // This is camera-angle invariant: if a front-view camera hides knee
    // flexion in 2D, the hip_Y signal wins. If overhead camera flattens
    // Y-motion, Z-signals win. No hardcoded thresholds -- the data decides.
    const adaptive = adaptiveSignalSelect(cleanedLandmarks, interpolated, ex, this._exerciseKey, this._fps);
    interpolated = adaptive.signal;
    this._adaptedSignalName = adaptive.name;
    this._adaptiveDiagCandidates = adaptive.diagCandidates;
    this._adaptiveDiag = adaptive.diagCandidates;

    // ── Step 2: Use state machine result directly ──
    // The adaptive selection already ran the hysteresis state machine on
    // each candidate signal. The result contains Cycle[] with proper phase
    // boundaries — no edge correction or AC sanity check needed because
    // the state machine's hysteresis inherently prevents the failure modes
    // that those heuristics were patching.
    const result = adaptive.result;

    if (result.reps === 0) {
      if (this._reps === 0) {
        this._repHistory = [];
      }
      return;
    }

    const cycles: Cycle[] = (result.cycles as Cycle[]) || [];

    this._cycleDebug = {
      reps: result.reps,
      cycles,
      periodFrames: result.reps > 0 ? Math.round(interpolated.length / result.reps) : 0,
      signalRange: result.signalRange,
    };

    this._reps = result.reps;
    this._repHistory = buildFormHistoryFromCycles(
      cycles, cleanedLandmarks, ex, this._exerciseKey, this._fps,
      this._userInjuries, this._anthropometricNormalizer,
    );

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
      const formScores = this._repHistory.map(r => r.score).filter((s): s is number => s !== null);
      this._progressionScore = ProgressionScore.computeSet({ formScores, repVelocities, reps: result.reps, weightKg: this._weightKg || 0 });
    } catch (e) {
      // Non-critical; swallow errors from velocity/progression analysis
    }

    // Preserve frame count before freeing landmarks.
    this._totalFramesAnalyzed = this._collectedLandmarks.length;
    // Free collected landmarks after analysis is complete to prevent OOM on mobile.
    // All data needed for downstream consumption is already in _repHistory, _cycleDebug,
    // _velocityAnalysis, and _progressionScore.
    this._collectedLandmarks = [];
  }


  /**
   * Get the rep result with uncertain classification.
   */
  getRepResult(): { confirmed: number; uncertain: number; total: number } | null {
    return this._repResult;
  }

  /**
   * Set exercise detection confidence (from ExerciseAutoDetector).
   * Used in candidate scoring.
   * @param conf - 0-1
   */
  setExerciseConfidence(conf: number): void {
    this._exerciseConfidence = conf || 0;
  }

  /**
   * Get per-signal diagnostics for the analysis diagnostics layer.
   */
  getSignalDiagnostics(): unknown[] {
    return this._signalDiagnostics;
  }

  get diagnostics() {
    const range = this._observedMax - this._observedMin;
    return {
      observedMin: Math.round(this._observedMin * 10) / 10,
      observedMax: Math.round(this._observedMax * 10) / 10,
      observedRange: Math.round(range * 10) / 10,
      minROM: this._exercise.minROM || 0,
      repsDetected: this._reps,
      totalFrames: this._totalFramesAnalyzed || this._collectedLandmarks.length,
      method: this._adaptedSignalName ? `sm:${this._adaptedSignalName}` : 'state-machine',
      cycles: this._cycleDebug,
      velocity: this._velocityAnalysis,
      progression: this._progressionScore,
      anthropometrics: this._anthropometricNormalizer.isCalibrated
        ? { calibrated: true, bodyType: this._anthropometricNormalizer.getBodyType(), profile: this._anthropometricNormalizer.profile }
        : { calibrated: false },
      repResult: this._repResult,
      signalDiagnostics: this._signalDiagnostics,
    };
  }

  // ─── Private: Live counting ───

  private _countLiveRep(angles: JointAngles, landmarks: LandmarkArray): void {
    this._reps++;

    const { score, issues } = evaluateLiveRep(
      this._cycleAngles, this._cycleLandmarks,
      angles, landmarks, this._exercise,
    );

    this._repHistory.push({
      score,
      issues,
      ts: Date.now(),
      startFrame: this._frameIdx - this._cycleAngles.length,
      bottomFrame: this._frameIdx - Math.floor(this._cycleAngles.length / 2),
      endFrame: this._frameIdx,
    });

    // Reset cycle buffers for next rep
    this._cycleAngles = [];
    this._cycleLandmarks = [];
  }
}
