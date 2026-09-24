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
  findValleys,
  reconcilePeaksAndValleys,
  autocorrelationEdgeCorrect,
  templateEdgeCorrect,
  medianIntervalFrames,
  interpolateNulls,
  smoothSignal,
} from '../valleyCounter';
import { hysteresisCount } from '../hysteresisCounter';
import {
  getRepPeriodBounds,
} from '../analysisConfig';

import type { Exercise, ValleyResult, Cycle, DiagCandidate, RepCounterOptions } from './types';
import { adaptiveSignalSelect } from './valley';
import { buildFormHistoryFromCycles, evaluateLiveRep, evaluateFormFeedback } from './scoring';
import { periodCount, type PeriodResult } from './periodCounter';

const REP_COUNTER_BUILD = 'v26-period-primary';

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
  private _countMethod?: string;
  private _adaptiveDiagCandidates?: DiagCandidate[];
  private _adaptiveDiag?: DiagCandidate[];
  private _templateEdgeDiag?: unknown;
  private _periodDiag?: PeriodResult | null;
  private _debugSignal?: number[];
  private _viewpoint: string = 'unknown';

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
        formFeedback: evaluateFormFeedback(angles, landmarks, ex, this._anthropometricNormalizer, this._viewpoint),
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

    const formFeedback = evaluateFormFeedback(angles, landmarks, ex, this._anthropometricNormalizer, this._viewpoint);

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

    // Interpolate nulls, then smooth to eliminate side-switching noise.
    // Exercises can override via smoothing property. Very fast exercises
    // (minSpacing < 0.2) get reduced smoothing to preserve rapid peaks.
    // Window=3 at 10fps = 300ms. Tested window=5 (500ms) and window=9 (900ms);
    // both over-smooth at 10fps, flattening real valleys and causing
    // undercounting. Window=3 is the benchmark-validated optimum.
    const smoothWindow = ex.smoothing != null ? ex.smoothing
      : (ex.minSpacing != null && ex.minSpacing < 0.2) ? 1 : 3;
    let interpolated: number[] = smoothSignal(interpolateNulls(rawValues), smoothWindow);

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
    this._debugSignal = interpolated.slice();

    // ── Step 2: Apply orientation from adaptive selection ──
    const invert = adaptive.invert;
    const signal = invert ? interpolated.map(v => -v) : interpolated;

    // ── Step 3: Use pre-computed valley result ──
    // Then apply autocorrelation edge correction: if the dominant period
    // suggests one more rep than valley counting found, and the signal shows
    // partial motion at the edges, recover the edge rep.
    let result: ValleyResult = this._autocorrelationEdgeCorrect(signal, adaptive.result);

    // Template-correlation edge correction: uses waveform shape (NCC) to
    // distinguish truncated reps from setup/return motion at signal edges.
    // Runs after AC correction -- if AC already added a rep, the edge gap
    // shrinks below threshold so template won't double-fire.
    result = this._templateEdgeCorrect(signal, result);

    // ── Step 4: Period-first arbitration ──
    // Primary principle: "one periodic kinematic cycle per rep."
    // Period counter is PRIMARY. Valley and hysteresis are VALIDATION.
    //
    // Priority:
    //   1. Period counter on the signal (ACF-based cycle counting)
    //   2. If period has strong autocorrelation (>= 0.35), use its count
    //   3. If period is weak (< 0.35), fall back to valley + hysteresis
    //   4. Valley and hysteresis validate the count
    const hysResult: ValleyResult = hysteresisCount(signal, this._fps, ex);
    const valleyReps = result.reps;
    (this as any)._valleyReps = valleyReps;

    const pResult = periodCount(signal, this._fps, this._exerciseKey);
    this._periodDiag = pResult;

    const minSpacingSec = (ex.minSpacing != null) ? ex.minSpacing : 0.5;
    const framesPerMinRep = this._fps * minSpacingSec;
    const hysReliable = framesPerMinRep >= 5;

    let countMethod: string = 'valley';

    if (pResult && pResult.reps >= 2 && pResult.autocorrPeak >= 0.35) {
      // Period counter has a strong signal. Use it as primary.
      //
      // Dynamic trust gate: when period diverges significantly from valley,
      // require stronger autocorrelation evidence. Prevents catastrophic
      // overcounting (e.g. incline_bench 8→25 at autocorrPeak=0.365).
      const periodValleyRatio = pResult.reps / Math.max(valleyReps, 1);
      const minAutocorrForDivergence = periodValleyRatio > 2.0 ? 0.70
        : periodValleyRatio > 1.5 ? 0.55 : 0.35;
      const periodTrusted = pResult.autocorrPeak >= minAutocorrForDivergence;

      // Guard against ACF harmonic confusion: if valley found 2x+ more
      // than period, the ACF likely locked onto 2T (or 3T) instead of T.
      // Also fires if both valley AND hysteresis are significantly higher.
      const valleyMuchHigher = valleyReps >= pResult.reps * 1.8;
      const bothHigher = valleyReps > pResult.reps * 1.3
        && hysReliable && hysResult.reps > pResult.reps * 1.3;
      const valleyHysAgree = hysReliable
        && Math.abs(valleyReps - hysResult.reps) <= 2;
      const harmonicConfusion = (valleyMuchHigher) || (bothHigher && valleyHysAgree);

      if (periodTrusted && !harmonicConfusion) {
        const valleyAgrees = Math.abs(valleyReps - pResult.reps) <= 1;
        const hysAgrees = !hysReliable || Math.abs(hysResult.reps - pResult.reps) <= 1;

        if (valleyReps > pResult.reps && valleyReps >= pResult.reps * 1.3) {
          // Valley overcounts by 30%+ relative to period.
          // Period counter wins (overcounting correction).
          result = {
            ...result,
            reps: pResult.reps,
            valleyFrames: pResult.repFrames.slice(0, pResult.reps),
          };
          countMethod = 'period';
        } else if (valleyReps > pResult.reps) {
          // Valley found slightly more than period (within 30%).
          // Valley found actual physical minima; trust it unless
          // hysteresis also agrees with the lower period count.
          if (hysReliable && Math.abs(hysResult.reps - pResult.reps) <= 1
              && hysResult.reps < valleyReps) {
            result = {
              ...result,
              reps: pResult.reps,
              valleyFrames: pResult.repFrames.slice(0, pResult.reps),
            };
            countMethod = 'period-confirmed';
          }
          // else: keep valley count (it found real valleys)
        } else if (pResult.reps > valleyReps && pResult.reps <= valleyReps + 1) {
          // Period finds ONE more rep than valley.
          result = {
            ...result,
            reps: pResult.reps,
            valleyFrames: pResult.repFrames.slice(0, pResult.reps),
          };
          countMethod = 'period-up';
        } else if (pResult.reps > valleyReps && pResult.reps <= valleyReps + 2
                   && pResult.autocorrPeak >= 0.70) {
          // Period finds +2 reps but with very strong autocorrelation.
          result = {
            ...result,
            reps: pResult.reps,
            valleyFrames: pResult.repFrames.slice(0, pResult.reps),
          };
          countMethod = 'period-up';
        } else if (pResult.reps <= valleyReps) {
          // Period and valley agree or period is lower. Use period-aligned frames.
          result = {
            ...result,
            reps: pResult.reps,
            valleyFrames: pResult.repFrames.slice(0, pResult.reps),
          };
          countMethod = valleyAgrees && hysAgrees ? 'period-confirmed' : 'period';
        }
        // else: period wants to add more than +2 or +2 without strong ACF.
        // Keep valley result as-is.
      }
      // else: period not trusted (divergence too high for ACF strength)
      // or harmonic confusion detected. Keep valley result.
    }

    // Hysteresis validation — runs on ALL counting methods (valley, period,
    // period-up, etc). Previously only ran on 'valley', which let period-up
    // results bypass sanity checking entirely.
    {
      // Hysteresis cap: DISABLED after 43-video benchmark analysis.
      // Hysteresis systematically undercounts (returns 0 on many exercises)
      // because auto-calibrated 25%/75% thresholds are often too tight at
      // 10fps. It was wrong 75% of the time it fired (3 of 4 cases lost
      // 3-4 real reps). The cap dragged correct valley/period counts down
      // to hysteresis's own miscalibrated undercount.

      // Hysteresis floor: when other methods fail (< 3 reps),
      // use hysteresis as a floor.
      if (result.reps < 3 && hysResult.reps > result.reps) {
        result = {
          ...result,
          reps: hysResult.reps,
          valleyFrames: hysResult.valleyFrames,
        };
        countMethod = 'hys-floor';
      }
    }

    // ── Physical sanity bound ──
    // Rep count cannot exceed what is physically possible given signal
    // duration and exercise minimum rep period. Uses REP_PERIOD_BOUNDS.min
    // (calibrated per exercise, e.g. 0.8s for bent_over_row) rather than
    // just minSpacing (defaults to 0.5s), giving a much tighter cap.
    {
      const signalDurationS = N / this._fps;
      const periodBounds = getRepPeriodBounds(this._exerciseKey);
      const effectiveMinPeriod = Math.max(minSpacingSec, periodBounds.min);
      const maxPhysicalReps = Math.ceil(signalDurationS / effectiveMinPeriod) + 1;
      if (result.reps > maxPhysicalReps) {
        result = { ...result, reps: maxPhysicalReps };
        countMethod += ':capped';
      }
    }

    // ── Alternating-limb divisor ──
    // Exercises like mountain_climber drive one leg per cycle, producing 2×
    // the expected rep count. repDivisor halves (or otherwise scales) the
    // count and thins valley frames to match.
    if (ex.repDivisor && ex.repDivisor > 1) {
      const divisor = ex.repDivisor;
      result = {
        ...result,
        reps: Math.round(result.reps / divisor),
        valleyFrames: result.valleyFrames.filter((_: number, i: number) => i % divisor === divisor - 1),
      };
      countMethod += ':div' + divisor;
    }

    this._countMethod = countMethod;
    // Store hysteresis result for diagnostics
    (this as any)._hysReps = hysResult.reps;

    if (result.reps === 0) {
      // Valley counting found nothing. Keep FSM reps if any were counted
      // during live preview -- they saw real motion that valley counting missed.
      if (this._reps === 0) {
        this._repHistory = [];
      }
      return;
    }

    // Build cycles from valley positions for downstream compatibility
    const cycles: Cycle[] = [];
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

    // ── Per-rep amplitude gate (Change 2) ──
    // After finding rep boundaries, compute amplitude of EACH rep.
    // If median per-rep amplitude is too low, the "reps" are likely noise.
    // This catches evenly-spaced noise that passes the global range gate.
    const perRepAmplitudes = cycles.map(c => c.amplitude).filter(a => a > 0);
    let measurementQuality: 'high' | 'medium' | 'low' = 'high';

    if (perRepAmplitudes.length >= 2) {
      perRepAmplitudes.sort((a, b) => a - b);
      const medianAmplitude = perRepAmplitudes[Math.floor(perRepAmplitudes.length / 2)];
      // Use exercise amplitudeRatio as the minimum; default to 25% of signal range.
      // But also enforce an absolute minimum of 15 degrees for angle-based exercises.
      const ampRatio = (ex.amplitudeRatio != null) ? ex.amplitudeRatio : 0.25;
      const minPerRepAmplitude = Math.max(result.signalRange * ampRatio * 0.5, 15);

      if (medianAmplitude < minPerRepAmplitude) {
        // Per-rep amplitude is too low. Flag as low quality.
        measurementQuality = 'low';
      } else if (medianAmplitude < minPerRepAmplitude * 1.5) {
        measurementQuality = 'medium';
      }
    }

    // Store quality for downstream use (coaching gate)
    (this as any)._measurementQuality = measurementQuality;

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

    // Preserve frame count for diagnostics.
    this._totalFramesAnalyzed = this._collectedLandmarks.length;
    // NOTE: _collectedLandmarks is intentionally NOT cleared here.
    // The landmark data must survive until the user has had a chance to
    // click "Export Landmarks" on the results screen. Clearing eagerly
    // caused the export to produce an empty JSON file. The RepCounter
    // instance (and its landmarks) will be garbage-collected once the
    // analysis result is no longer referenced by the UI.
  }

  // ─── Valley counting ───
  //
  // A rep = a local minimum (valley) in the tracking signal.
  // For bicep curls: each valley is the bottom of one curl.
  //
  // Filters:
  //   1. Valleys must be >= 0.4s apart
  //   2. Amplitude from preceding peak to valley must be >= 25°

  // Delegates to standalone valley counter (single source of truth)
  private _countValleys(signal: number[]): ValleyResult {
    return findValleys(signal, this._fps, this._exercise);
  }

  private _reconcilePeaksAndValleys(signal: number[], valleyResult: ValleyResult): ValleyResult {
    return reconcilePeaksAndValleys(signal, valleyResult, this._fps, this._exercise);
  }

  private _medianIntervalFrames(frames: number[]): number {
    return medianIntervalFrames(frames);
  }

  private _autocorrelationEdgeCorrect(signal: number[], valleyResult: ValleyResult): ValleyResult {
    return autocorrelationEdgeCorrect(signal, valleyResult, this._fps);
  }

  private _templateEdgeCorrect(signal: number[], valleyResult: ValleyResult): ValleyResult {
    const result = templateEdgeCorrect(signal, valleyResult, this._fps, this._exercise);
    this._templateEdgeDiag = result._templateDiag || null;
    const { _templateDiag, ...clean } = result;
    return clean;
  }

  /**
   * Estimate the dominant period of the signal via autocorrelation.
   * Returns period in frames, or 0 if no clear periodicity.
   */
  private _estimateDominantPeriod(signal: number[]): number {
    const N = signal.length;
    if (N < 12) return 0;

    let mean = 0;
    for (let i = 0; i < N; i++) mean += signal[i];
    mean /= N;

    let variance = 0;
    for (let i = 0; i < N; i++) variance += (signal[i] - mean) ** 2;
    variance /= N;
    if (variance < 1e-8) return 0;

    const minLag = Math.max(3, Math.round(this._fps * 0.5));
    const maxLag = Math.min(Math.floor(N / 2), Math.round(this._fps * 8));

    let bestLag = 0;
    let bestCorr = -Infinity;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let t = 0; t < N - lag; t++) {
        corr += (signal[t] - mean) * (signal[t + lag] - mean);
      }
      corr /= ((N - lag) * variance);
      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }

    // Require minimum correlation strength to trust the period
    return bestCorr > 0.3 ? bestLag : 0;
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
   * Set camera viewpoint for viewpoint-aware form check filtering.
   * In live mode, prevents phantom "bad form" feedback when the camera
   * angle can't actually observe the thing being checked.
   * @param vp - 'front' | 'side' | 'rear' | 'unknown'
   */
  setViewpoint(vp: string): void {
    this._viewpoint = vp;
  }

  /**
   * Get per-signal diagnostics for the analysis diagnostics layer.
   */
  getSignalDiagnostics(): unknown[] {
    return this._signalDiagnostics;
  }

  get diagnostics() {
    const range = this._observedMax - this._observedMin;
    // Median per-rep amplitude: more reliable than global range for gate checks.
    // Global range passes trivially (e.g. 115° for a curl) even when individual
    // reps have tiny amplitude from noise-driven overcounting.
    const repAmplitudes = this._repHistory
      .map(r => r.rom)
      .filter((v): v is number => v != null && v > 0)
      .sort((a, b) => a - b);
    const medianRepAmplitude = repAmplitudes.length > 0
      ? repAmplitudes[Math.floor(repAmplitudes.length / 2)]
      : null;
    return {
      observedMin: Math.round(this._observedMin * 10) / 10,
      observedMax: Math.round(this._observedMax * 10) / 10,
      observedRange: Math.round(range * 10) / 10,
      medianRepAmplitude: medianRepAmplitude != null ? Math.round(medianRepAmplitude * 10) / 10 : null,
      minROM: this._exercise.minROM || 0,
      repsDetected: this._reps,
      totalFrames: this._totalFramesAnalyzed || this._collectedLandmarks.length,
      method: this._countMethod
        ? `${this._countMethod}:${this._adaptedSignalName || 'primary'}`
        : (this._adaptedSignalName ? `valley:${this._adaptedSignalName}` : 'valley-counter'),
      cycles: this._cycleDebug,
      velocity: this._velocityAnalysis,
      progression: this._progressionScore,
      anthropometrics: this._anthropometricNormalizer.isCalibrated
        ? { calibrated: true, bodyType: this._anthropometricNormalizer.getBodyType(), profile: this._anthropometricNormalizer.profile }
        : { calibrated: false },
      repResult: this._repResult,
      signalDiagnostics: this._signalDiagnostics,
      period: this._periodDiag ? {
        periodSeconds: Math.round(this._periodDiag.periodSeconds * 100) / 100,
        autocorrPeak: Math.round(this._periodDiag.autocorrPeak * 1000) / 1000,
        periodReps: this._periodDiag.reps,
        valleyReps: (this as any)._valleyReps ?? null,
      } : null,
      // Quality flag for coaching gate (Change 4):
      // 'high' = strong periodicity + good per-rep amplitude, coaching is credible
      // 'medium' = marginal amplitude, coaching should be cautious
      // 'low' = weak measurement, do NOT generate coaching feedback
      measurementQuality: (this as any)._measurementQuality || 'high',
      hysteresisReps: (this as any)._hysReps ?? null,
      adaptiveCandidates: this._adaptiveDiagCandidates || [],
      debugSignal: this._debugSignal || [],
    };
  }

  /**
   * Exercise-specific rep period bounds in seconds.
   * Delegates to centralized config in analysisConfig.js.
   */
  static _repPeriodBounds(exerciseKey: string): { min: number; max: number } {
    return getRepPeriodBounds(exerciseKey);
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
