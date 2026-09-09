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

import { extractJointAngles, LANDMARKS, interpolateOccludedLandmarks } from './poseAnalysis';
import { EXERCISES } from './exercises';
import { shouldSkipCheck } from './injuries';
import { VelocityEngine } from './VelocityEngine';
import { ProgressionScore } from './ProgressionScore';
import { AnthropometricNormalizer } from './AnthropometricNormalizer';
import { extractSignals3D, getSignalPriority } from './SignalExtractor3D';

const REP_COUNTER_BUILD = 'v24-adaptive-signal';

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

// Hard cap on collected landmarks to bound memory. At 15fps with 33 landmarks
// per frame (~1.3KB/frame), 1200 frames = ~1.6MB. Matches 2× the MAX_FRAMES
// ceiling in VideoUpload (600 on desktop, 300 on iOS) to handle edge cases.
const MAX_LANDMARK_FRAMES = 1200;

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
  }

  /**
   * Per-frame update. Collects landmarks for finalize().
   * Hysteresis counting runs for live rep display.
   * @param {Array} landmarks - MediaPipe pose landmarks
   * @param {number} videoTimestamp - Time in SECONDS (e.g. frameIndex / fps)
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
      let now;
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

    const ex = this._exercise;
    const N = this._collectedLandmarks.length;
    if (ex.isIsometric || N < 6) return;

    // ── Step 0: Interpolate occluded landmarks for cleaner signal ──
    const cleanedLandmarks = interpolateOccludedLandmarks(this._collectedLandmarks);

    // ── Step 1: Extract the raw tracking signal ──
    const rawValues = cleanedLandmarks.map(lm => {
      const a = extractJointAngles(lm);
      return a ? ex.getValue(a, lm) : null;
    });

    // Interpolate nulls, then smooth to eliminate bestSide oscillation noise.
    // Exercises can override via smoothing property. Very fast exercises
    // (minSpacing < 0.2) get reduced smoothing to preserve rapid peaks.
    const smoothWindow = ex.smoothing != null ? ex.smoothing
      : (ex.minSpacing != null && ex.minSpacing < 0.2) ? 1 : 3;
    let interpolated = this._smoothSignal(this._interpolateNulls(rawValues), smoothWindow);

    // ── Step 1b: Adaptive multi-signal selection ──
    // Test ALL available signals (primary + 28 3D alternatives) in both
    // orientations. Score each by reps × tempo_consistency. The signal
    // producing the most rhythmically consistent rep count wins.
    //
    // This is camera-angle invariant: if a front-view camera hides knee
    // flexion in 2D, the hip_Y signal wins. If overhead camera flattens
    // Y-motion, Z-signals win. No hardcoded thresholds — the data decides.
    const adaptive = this._adaptiveSignalSelect(cleanedLandmarks, interpolated);
    interpolated = adaptive.signal;
    this._adaptedSignalName = adaptive.name;

    // ── Step 2: Apply orientation from adaptive selection ──
    const invert = adaptive.invert;
    const signal = invert ? interpolated.map(v => -v) : interpolated;

    // ── Step 3: Use pre-computed valley result ──
    // Then apply autocorrelation edge correction: if the dominant period
    // suggests one more rep than valley counting found, and the signal shows
    // partial motion at the edges, recover the edge rep.
    let result = this._autocorrelationEdgeCorrect(signal, adaptive.result);

    // Template-correlation edge correction: uses waveform shape (NCC) to
    // distinguish truncated reps from setup/return motion at signal edges.
    // Runs after AC correction — if AC already added a rep, the edge gap
    // shrinks below threshold so template won't double-fire.
    result = this._templateEdgeCorrect(signal, result);

    if (result.reps === 0) {
      // Valley counting found nothing. Keep FSM reps if any were counted
      // during live preview — they saw real motion that valley counting missed.
      if (this._reps === 0) {
        this._repHistory = [];
      }
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
    this._repHistory = this._buildFormHistoryFromCycles(cycles, cleanedLandmarks);

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

    // Preserve frame count before freeing landmarks.
    this._totalFramesAnalyzed = this._collectedLandmarks.length;
    // Free collected landmarks after analysis is complete to prevent OOM on mobile.
    // All data needed for downstream consumption is already in _repHistory, _cycleDebug,
    // _velocityAnalysis, and _progressionScore.
    this._collectedLandmarks = [];
  }

  // ─── Trunk swing check detection ───
  //
  // Many isolation exercises (curls, laterals, raises, tricep extensions) use
  // form checks like `angles.trunk < 20` to detect body swing / momentum.
  // This works when standing upright but produces false failures when the user
  // is seated, on an incline bench, or leaning on a machine pad (trunk baseline
  // is naturally 25-45 deg from vertical).
  //
  // Detection: if the exercise is isolation category AND the form check name
  // matches common swing-check patterns AND the check function tests trunk
  // against a small absolute threshold, we flag it for relative-swing evaluation.

  _isTrunkSwingCheck(fc, exercise) {
    const swingNames = /swing|momentum|strict|upright.*torso|no.*lean|stable.*torso|body.*sway/i;
    const isIsolation = exercise.category === 'isolation';
    const nameMatches = swingNames.test(fc.name);
    // Also check the "bad" text for swing-related language
    const badMatches = fc.bad && /swing|momentum|lean|sway|upright/i.test(fc.bad);
    // Only convert for isolation exercises where the check name or bad text indicates trunk sway
    return isIsolation && (nameMatches || badMatches);
  }

  // ─── Adaptive multi-signal selection ───
  //
  // The core innovation: instead of hardcoding which signal to track per
  // exercise, test ALL available signals and let the data decide. This makes
  // rep counting robust to arbitrary camera angles, body orientations, and
  // exercise variations.
  //
  // For each candidate signal (primary + ~28 3D alternatives, each in 2
  // orientations = ~58 candidates), run valley counting and score by:
  //   score = reps × (1 / (1 + CV))
  // where CV = coefficient of variation of inter-valley gaps.
  //
  // Real reps have even timing (low CV → high consistency → high score).
  // Noise produces irregular valleys (high CV → low consistency → low score).
  // The signal with the highest score wins.

  _adaptiveSignalSelect(cleanedLandmarks, primarySmoothed) {
    const candidates = [];

    // Primary signal in both orientations
    candidates.push({ name: 'primary', countSignal: primarySmoothed, original: primarySmoothed, inv: false });
    candidates.push({ name: 'primary_inv', countSignal: primarySmoothed.map(v => -v), original: primarySmoothed, inv: true });

    // Only add biomechanically relevant alternatives. Uses explicit
    // SIGNAL_PRIORITY_3D for ~30 exercises, falls back to joint-based
    // defaults for the remaining ~245. This extends adaptive selection
    // to all 275 exercises without testing irrelevant signals.
    const priority = getSignalPriority(this._exerciseKey, this._exercise.joint);
    if (priority && priority.length > 0) {
      try {
        const signals3D = extractSignals3D(cleanedLandmarks);
        // Alternative signals get stronger smoothing (5) to suppress noise,
        // EXCEPT for fast exercises (battle rope, jumping jacks) where
        // smoothing=5 kills the rapid oscillations that ARE the reps.
        const ex = this._exercise;
        const altSmoothWindow = (ex.minSpacing != null && ex.minSpacing < 0.2)
          ? (ex.smoothing != null ? ex.smoothing : 1) : 5;

        for (const sigName of priority) {
          const sig = signals3D.find(s => s.name === sigName);
          if (!sig) continue;
          const smoothed = this._smoothSignal(this._interpolateNulls(sig.values), altSmoothWindow);
          candidates.push({ name: sigName, countSignal: smoothed, original: smoothed, inv: false });
          candidates.push({ name: sigName + '_inv', countSignal: smoothed.map(v => -v), original: smoothed, inv: true });
        }
      } catch (_) {
        // 3D extraction failed; continue with primary only
      }
    }

    // First: establish the primary baseline with exercise-defined orientation.
    const exInv = this._exercise.downThreshold > this._exercise.upThreshold;
    const primaryCount = this._countValleys(exInv ? primarySmoothed.map(v => -v) : primarySmoothed);
    let primaryConsistency = 1;
    if (primaryCount.valleyFrames.length >= 2) {
      const gaps = [];
      for (let i = 1; i < primaryCount.valleyFrames.length; i++) {
        gaps.push(primaryCount.valleyFrames[i] - primaryCount.valleyFrames[i - 1]);
      }
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const std = Math.sqrt(gaps.reduce((a, v) => a + (v - mean) ** 2, 0) / gaps.length);
      const cv = mean > 0 ? std / mean : 1;
      primaryConsistency = 1 / (1 + cv);
    }
    const primaryScore = primaryCount.reps * primaryConsistency;

    // Now score all candidates. An alternative must beat the primary score
    // by >= 20% margin to override. This prevents marginal noise signals
    // from winning while still allowing genuine improvements (e.g. hip_Y
    // for front-view squats where knee angles are compressed in 2D).
    let bestScore = primaryScore;
    let bestCand = { original: primarySmoothed, inv: exInv, name: 'primary' };
    let bestResult = primaryCount;

    this._adaptiveDiagCandidates = [{ name: 'primary', reps: primaryCount.reps, score: primaryScore, consistency: primaryConsistency, winner: false }];

    for (const cand of candidates) {
      // Skip the two primary entries — we already computed the baseline
      if (cand.name === 'primary' || cand.name === 'primary_inv') continue;

      const result = this._countValleys(cand.countSignal);
      if (result.reps === 0) continue;

      // Overcounting guard: when primary finds >= 3 reps, reject alternatives
      // that find more than 1.5× the primary count. Double-counting from
      // mid-rep oscillation (knee wobble, head bob) typically produces ~2× reps.
      if (primaryCount.reps >= 3 && result.reps > primaryCount.reps * 1.5) continue;

      let consistency = 1;
      if (result.valleyFrames.length >= 2) {
        const gaps = [];
        for (let i = 1; i < result.valleyFrames.length; i++) {
          gaps.push(result.valleyFrames[i] - result.valleyFrames[i - 1]);
        }
        const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const std = Math.sqrt(gaps.reduce((a, v) => a + (v - mean) ** 2, 0) / gaps.length);
        const cv = mean > 0 ? std / mean : 1;
        consistency = 1 / (1 + cv);
      }

      const score = result.reps * consistency;

      this._adaptiveDiagCandidates.push({ name: cand.name, reps: result.reps, score, consistency, winner: false });

      // Asymmetric margin: alternatives finding FEWER reps than primary only
      // need 5% margin (helps correct overcounting). Alternatives finding MORE
      // reps need 20% (prevents noise from inflating the count).
      const margin = result.reps < primaryCount.reps ? 1.05 : 1.2;
      if (score > bestScore * margin) {
        bestScore = score;
        bestCand = cand;
        bestResult = result;
      }
    }

    // Store diagnostics for debugging
    this._adaptiveDiag = this._adaptiveDiagCandidates;

    return {
      signal: bestCand.original,
      invert: bestCand.inv,
      result: bestResult,
      name: bestCand.name,
    };
  }

  // ─── Valley counting ───
  //
  // A rep = a local minimum (valley) in the tracking signal.
  // For bicep curls: each valley is the bottom of one curl.
  //
  // Filters:
  //   1. Valleys must be >= 0.4s apart
  //   2. Amplitude from preceding peak to valley must be >= 25°

  // _countValleys: used by adaptive selection during candidate scoring.
  // Returns raw valley count without reconciliation.
  _countValleys(signal) {
    return this._findValleys(signal);
  }

  // Peak-valley reconciliation: applied ONLY to the final winning signal,
  // never during candidate comparison in _adaptiveSignalSelect.
  // A complete rep has one valley AND one peak. If the video starts or ends
  // mid-rep, the bilateral prominence filter rejects the edge valley
  // (truncated peak on one side) but the corresponding peak has full
  // bilateral support from flanking valleys.
  _reconcilePeaksAndValleys(signal, valleyResult) {
    if (valleyResult.reps < 2) return valleyResult;

    const inverted = signal.map(v => -v);
    const peakResult = this._findValleys(inverted);

    if (peakResult.reps !== valleyResult.reps + 1) return valleyResult;

    // Peaks found exactly one more. Verify the extra peak is at an edge
    // (first or last 20% of signal), not a noise peak in the middle.
    const edgeZone = Math.round(signal.length * 0.20);
    const medianGap = this._medianIntervalFrames(valleyResult.valleyFrames);

    // Find the orphan peak (no nearby valley)
    let orphanPeakFrame = null;
    for (const pf of peakResult.valleyFrames) {
      const nearestDist = valleyResult.valleyFrames.reduce(
        (best, vf) => Math.min(best, Math.abs(pf - vf)), Infinity
      );
      if (nearestDist > medianGap * 0.3) {
        // Only accept if at an edge
        if (pf < edgeZone || pf > signal.length - edgeZone) {
          orphanPeakFrame = pf;
        }
        break;
      }
    }

    if (orphanPeakFrame === null) return valleyResult;

    // Find the valley nearest this orphan peak at the edge
    const searchRadius = Math.round(medianGap * 0.5);
    const lo = Math.max(0, orphanPeakFrame - searchRadius);
    const hi = Math.min(signal.length - 1, orphanPeakFrame + searchRadius);
    let bestFrame = orphanPeakFrame;
    let bestVal = signal[orphanPeakFrame];
    for (let j = lo; j <= hi; j++) {
      if (signal[j] < bestVal) { bestVal = signal[j]; bestFrame = j; }
    }

    const mergedFrames = [...valleyResult.valleyFrames, bestFrame].sort((a, b) => a - b);
    // Deduplicate frames that are too close
    const minGap = Math.max(2, Math.round(this._fps * 0.3));
    const dedupedFrames = [mergedFrames[0]];
    for (let i = 1; i < mergedFrames.length; i++) {
      if (mergedFrames[i] - dedupedFrames[dedupedFrames.length - 1] >= minGap) {
        dedupedFrames.push(mergedFrames[i]);
      }
    }

    console.debug(`[RepCounter] Peak-valley edge reconciliation: ${valleyResult.reps} → ${dedupedFrames.length} reps`);
    return { reps: dedupedFrames.length, allValleys: valleyResult.allValleys, valleyFrames: dedupedFrames, signalRange: valleyResult.signalRange };
  }

  _medianIntervalFrames(frames) {
    if (frames.length < 2) return Infinity;
    const gaps = [];
    for (let i = 1; i < frames.length; i++) gaps.push(frames[i] - frames[i - 1]);
    gaps.sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)];
  }

  // Autocorrelation-based edge correction.
  // Valley counting misses edge reps because the bilateral prominence filter
  // needs peaks on both sides. Autocorrelation uses the entire signal shape
  // to estimate the dominant period, which is robust to edge truncation.
  // If the period-based estimate is exactly valley_count + 1, recover the edge rep.
  _autocorrelationEdgeCorrect(signal, valleyResult) {
    if (valleyResult.reps < 3) return valleyResult;

    const N = signal.length;
    // Subtract mean
    const mean = signal.reduce((a, b) => a + b, 0) / N;
    const centered = signal.map(v => v - mean);

    // Compute autocorrelation for lags from minLag to maxLag
    // minLag: at least 0.3s (fastest reasonable rep)
    // maxLag: half the signal length (can't detect period longer than half)
    const minLag = Math.max(3, Math.round(this._fps * 0.3));
    const maxLag = Math.min(Math.floor(N / 2), Math.round(this._fps * 10));

    let bestLag = 0;
    let bestCorr = -Infinity;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let t = 0; t < N - lag; t++) {
        corr += centered[t] * centered[t + lag];
      }
      corr /= (N - lag);
      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }

    if (bestLag === 0) return valleyResult;

    // AC period-based expected rep count
    const acReps = Math.round(N / bestLag);

    // Also check: the valley-based median period should agree with AC
    const valleyMedianGap = this._medianIntervalFrames(valleyResult.valleyFrames);
    const periodAgreement = valleyMedianGap < Infinity
      ? Math.min(bestLag, valleyMedianGap) / Math.max(bestLag, valleyMedianGap)
      : 0;

    // Only correct if:
    // 1. AC suggests exactly one more rep than valleys found
    // 2. Valley period and AC period roughly agree (within 30%)
    if (acReps === valleyResult.reps + 1 && periodAgreement > 0.7) {
      // Find where the missing rep likely is: at the start or end of the signal.
      // Check which edge has partial motion that looks like a rep.
      const firstValley = valleyResult.valleyFrames[0];
      const lastValley = valleyResult.valleyFrames[valleyResult.valleyFrames.length - 1];
      const expectedPeriod = bestLag;

      // Edge at start: if first valley is far from frame 0 (> 0.7 × period),
      // there's likely a truncated rep before it.
      // Edge at end: if last valley is far from end (> 0.7 × period),
      // there's likely a truncated rep after it.
      const startGap = firstValley;
      const endGap = N - 1 - lastValley;

      let edgeFrame = -1;
      if (startGap > expectedPeriod * 0.7) {
        // Look for a local minimum near the expected position
        const target = Math.round(firstValley - expectedPeriod);
        if (target >= 0) {
          const lo = Math.max(0, target - Math.round(expectedPeriod * 0.3));
          const hi = Math.min(firstValley - 1, target + Math.round(expectedPeriod * 0.3));
          let bestV = signal[lo];
          edgeFrame = lo;
          for (let j = lo; j <= hi; j++) {
            if (signal[j] < bestV) { bestV = signal[j]; edgeFrame = j; }
          }
        }
      } else if (endGap > expectedPeriod * 0.7) {
        const target = Math.round(lastValley + expectedPeriod);
        if (target < N) {
          const lo = Math.max(lastValley + 1, target - Math.round(expectedPeriod * 0.3));
          const hi = Math.min(N - 1, target + Math.round(expectedPeriod * 0.3));
          let bestV = signal[lo];
          edgeFrame = lo;
          for (let j = lo; j <= hi; j++) {
            if (signal[j] < bestV) { bestV = signal[j]; edgeFrame = j; }
          }
        }
      }

      if (edgeFrame >= 0) {
        const newFrames = [...valleyResult.valleyFrames, edgeFrame].sort((a, b) => a - b);
        console.debug(`[RepCounter] AC edge correction: ${valleyResult.reps} → ${newFrames.length} (period=${bestLag}, AC=${acReps})`);
        return { reps: newFrames.length, allValleys: valleyResult.allValleys, valleyFrames: newFrames, signalRange: valleyResult.signalRange };
      }

      // No edge gap large enough. Check for a double-wide interior gap:
      // one inter-valley gap that's ~2× the expected period, indicating
      // two rep cycles merged because the bilateral filter rejected the
      // valley between them.
      const frames = valleyResult.valleyFrames;
      let widestGapIdx = -1;
      let widestGap = 0;
      for (let i = 1; i < frames.length; i++) {
        const gap = frames[i] - frames[i - 1];
        if (gap > widestGap) { widestGap = gap; widestGapIdx = i; }
      }
      // Gap must be 1.5× to 2.5× the expected period to be a merged double-cycle
      if (widestGap > expectedPeriod * 1.5 && widestGap < expectedPeriod * 2.5) {
        // Find the deepest local minimum in the middle of this double gap
        const lo = frames[widestGapIdx - 1] + Math.round(expectedPeriod * 0.3);
        const hi = frames[widestGapIdx] - Math.round(expectedPeriod * 0.3);
        if (lo < hi) {
          let bestV = signal[lo];
          let insertFrame = lo;
          for (let j = lo; j <= hi; j++) {
            if (signal[j] < bestV) { bestV = signal[j]; insertFrame = j; }
          }
          const newFrames = [...frames, insertFrame].sort((a, b) => a - b);
          console.debug(`[RepCounter] AC interior correction: ${valleyResult.reps} → ${newFrames.length} (double gap=${widestGap}, period=${bestLag})`);
          return { reps: newFrames.length, allValleys: valleyResult.allValleys, valleyFrames: newFrames, signalRange: valleyResult.signalRange };
        }
      }
    }

    return valleyResult;
  }

  // Period-locked edge valley recovery.
  // The bilateral prominence filter requires peaks on BOTH sides. At edges,
  // the outer peak is truncated, causing systematic -1. This recovers a valley
  // at the edge ONLY if ALL of these conditions are met:
  //   1. Edge gap is 0.7-1.3 × median period (period-locked)
  //   2. A local minimum exists at the expected position
  //   3. The interior-side prominence alone passes the amplitude threshold
  //   4. The valley depth matches interior valley depths (±50%)
  // This is stricter than unilateral prominence alone (which was catastrophic
  // at 16/41) because conditions 1+4 eliminate setup/return false positives.
  _templateEdgeCorrect(signal, valleyResult) {
    if (valleyResult.reps < 3) return valleyResult;

    const frames = valleyResult.valleyFrames;
    const N = signal.length;

    const period = this._medianIntervalFrames(frames);
    if (period < 4 || period === Infinity) return valleyResult;

    // Signal range and amplitude threshold (same as _findValleys)
    const sigMin = signal.reduce((a, b) => Math.min(a, b));
    const sigMax = signal.reduce((a, b) => Math.max(a, b));
    const signalRange = sigMax - sigMin;
    const ampRatio = (this._exercise.amplitudeRatio != null) ? this._exercise.amplitudeRatio : 0.20;
    const minAmplitude = signalRange * ampRatio;

    // Compute interior valley depths for matching
    const valleyDepths = frames.map(f => signal[f]);
    valleyDepths.sort((a, b) => a - b);
    const medianDepth = valleyDepths[Math.floor(valleyDepths.length / 2)];
    const depthRange = valleyDepths[valleyDepths.length - 1] - valleyDepths[0];
    const depthTolerance = Math.max(depthRange * 0.5, signalRange * 0.10);

    const newFrames = [...frames];
    let changed = false;
    const diag = { period, medianDepth: Math.round(medianDepth * 10) / 10, left: null, right: null };

    // RIGHT edge
    const lastV = frames[frames.length - 1];
    const rightGap = N - 1 - lastV;
    diag.rightRatio = Math.round((rightGap / period) * 100) / 100;
    if (rightGap >= period * 0.8 && rightGap <= period * 1.2) {
      // Search for minimum near the expected position (lastV + period)
      const target = lastV + period;
      const lo = Math.max(lastV + Math.round(period * 0.4), 0);
      const hi = Math.min(N - 1, target + Math.round(period * 0.3));
      let bestVal = Infinity, bestIdx = -1;
      for (let i = lo; i <= hi; i++) {
        if (signal[i] < bestVal) { bestVal = signal[i]; bestIdx = i; }
      }

      if (bestIdx >= 0) {
        // Check interior-side prominence (peak between lastV and candidate)
        let peakBefore = signal[lastV];
        for (let j = lastV; j < bestIdx; j++) {
          if (signal[j] > peakBefore) peakBefore = signal[j];
        }
        const prominence = peakBefore - bestVal;
        // Check depth match: candidate valley should be similar depth to interior valleys
        const depthMatch = Math.abs(bestVal - medianDepth) <= depthTolerance;

        diag.right = { gap: rightGap, prom: Math.round(prominence * 10) / 10, val: Math.round(bestVal * 10) / 10, depthMatch, added: false };

        if (prominence >= minAmplitude && depthMatch) {
          newFrames.push(bestIdx);
          changed = true;
          diag.right.added = true;
          console.debug(`[RepCounter] Edge right: prom=${prominence.toFixed(1)} thresh=${minAmplitude.toFixed(1)} depth=${bestVal.toFixed(1)} median=${medianDepth.toFixed(1)}, valley@${bestIdx}`);
        }
      }
    }

    // LEFT edge
    const leftGap = frames[0];
    diag.leftRatio = Math.round((leftGap / period) * 100) / 100;
    if (!changed && leftGap >= period * 0.8 && leftGap <= period * 1.2) {
      const target = frames[0] - period;
      const lo = Math.max(0, target - Math.round(period * 0.3));
      const hi = Math.min(frames[0] - Math.round(period * 0.4), frames[0] - 1);
      let bestVal = Infinity, bestIdx = -1;
      for (let i = lo; i <= hi; i++) {
        if (signal[i] < bestVal) { bestVal = signal[i]; bestIdx = i; }
      }

      if (bestIdx >= 0) {
        let peakAfter = signal[frames[0]];
        for (let j = bestIdx + 1; j <= frames[0]; j++) {
          if (signal[j] > peakAfter) peakAfter = signal[j];
        }
        const prominence = peakAfter - bestVal;
        const depthMatch = Math.abs(bestVal - medianDepth) <= depthTolerance;

        diag.left = { gap: leftGap, prom: Math.round(prominence * 10) / 10, val: Math.round(bestVal * 10) / 10, depthMatch, added: false };

        // Reject valley at very start of signal (frame 0-2 is just recording start, not a real valley)
        if (prominence >= minAmplitude && depthMatch && bestIdx >= 3) {
          newFrames.unshift(bestIdx);
          changed = true;
          diag.left.added = true;
          console.debug(`[RepCounter] Edge left: prom=${prominence.toFixed(1)} thresh=${minAmplitude.toFixed(1)} depth=${bestVal.toFixed(1)} median=${medianDepth.toFixed(1)}, valley@${bestIdx}`);
        }
      }
    }

    this._templateEdgeDiag = diag;

    if (changed) {
      newFrames.sort((a, b) => a - b);
      console.debug(`[RepCounter] Edge correction: ${valleyResult.reps} → ${newFrames.length}`);
      return { reps: newFrames.length, allValleys: valleyResult.allValleys, valleyFrames: newFrames, signalRange: valleyResult.signalRange };
    }

    return valleyResult;
  }

  _findValleys(signal) {
    // Signal range first — needed for adaptive amplitude threshold
    let sigMin = Infinity, sigMax = -Infinity;
    for (let i = 0; i < signal.length; i++) {
      if (signal[i] < sigMin) sigMin = signal[i];
      if (signal[i] > sigMax) sigMax = signal[i];
    }
    const signalRange = sigMax - sigMin;

    if (signalRange < 10) {
      return { reps: 0, allValleys: 0, valleyFrames: [], signalRange };
    }

    // Amplitude threshold as a proportion of signal range (prominence filter).
    // Default 30%; exercises with smaller angle ranges (lat_pulldown, lateral_raise)
    // can override via amplitudeRatio to avoid filtering out valid reps.
    const ampRatio = (this._exercise.amplitudeRatio != null) ? this._exercise.amplitudeRatio : 0.20;
    const minAmplitude = signalRange * ampRatio;

    // 1. Find local minima that are the deepest point in a ±halfWindow neighborhood.
    // halfWindow for local minimum detection: ±0.2s default, faster exercises
    // can override via minSpacing to use a proportionally smaller window.
    const hwSec = Math.min(0.2, (this._exercise.minSpacing != null) ? this._exercise.minSpacing * 0.6 : 0.2);
    const halfWindow = Math.max(2, Math.round(this._fps * hwSec));
    const allValleys = [];
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i] < signal[i - 1] && signal[i] <= signal[i + 1]) {
        let isDeepest = true;
        const lo = Math.max(0, i - halfWindow);
        const hi = Math.min(signal.length - 1, i + halfWindow);
        for (let k = lo; k <= hi; k++) {
          if (signal[k] < signal[i]) { isDeepest = false; break; }
        }
        if (isDeepest) allValleys.push(i);
      }
    }

    // 2. Two-pass adaptive spacing.
    //    Pass 1: generous spacing (1.0s) to estimate natural cadence.
    //    Pass 2: if cadence is slow (>2.5s/rep), re-filter with 2.5s spacing
    //            to reject noise valleys on slow exercises like push-ups.
    //            Fast exercises (back extensions, curls) keep the 1.0s spacing.
    const filterWithSpacing = (minGap) => {
      const frames = [];
      let last = -Infinity;
      for (const v of allValleys) {
        if (v - last < minGap) continue;
        const searchStart = last > 0 ? last : Math.max(0, v - Math.round(this._fps * 3));
        let peakBefore = signal[v];
        for (let j = searchStart; j < v; j++) {
          if (signal[j] > peakBefore) peakBefore = signal[j];
        }
        const searchEnd = Math.min(signal.length, v + Math.round(this._fps * 3));
        let peakAfter = signal[v];
        for (let j = v + 1; j < searchEnd; j++) {
          if (signal[j] > peakAfter) peakAfter = signal[j];
        }
        const prominence = Math.min(peakBefore - signal[v], peakAfter - signal[v]);
        if (prominence >= minAmplitude) {
          frames.push(v);
          last = v;
        }
      }
      return frames;
    };

    // Pass 1: generous spacing. Default 0.4s; fast exercises (battle ropes,
    // jumping jacks) can override via minSpacing to allow tighter intervals.
    const minSpacingSec = (this._exercise.minSpacing != null) ? this._exercise.minSpacing : 0.4;
    const generousGap = Math.max(2, Math.round(this._fps * minSpacingSec));
    const pass1 = filterWithSpacing(generousGap);

    let valleyFrames;
    if (pass1.length >= 2) {
      // Estimate cadence from median inter-valley gap
      const gaps = [];
      for (let i = 1; i < pass1.length; i++) gaps.push(pass1[i] - pass1[i - 1]);
      gaps.sort((a, b) => a - b);
      const medianGap = gaps[Math.floor(gaps.length / 2)];
      const medianSeconds = medianGap / this._fps;

      // Slow exercises (>2.5s/rep): re-filter with tight spacing to reject noise
      if (medianSeconds > 2.5) {
        const tightGap = Math.round(this._fps * 2.5);
        valleyFrames = filterWithSpacing(tightGap);
      } else {
        valleyFrames = pass1;
      }
    } else {
      valleyFrames = pass1;
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
      totalFrames: this._totalFramesAnalyzed || this._collectedLandmarks.length,
      method: this._adaptedSignalName ? `valley:${this._adaptedSignalName}` : 'valley-counter',
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

  _buildFormHistoryFromCycles(cycles, landmarks) {
    if (cycles.length === 0) return [];

    const lm = landmarks || this._collectedLandmarks;
    const N = lm.length;
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
        // Evaluate form at EVERY frame across the full concentric/eccentric arc.
        // Previous implementation sampled only ~8 frames per rep, missing form
        // breakdowns that occur mid-arc (e.g., knee cave at the bottom of a squat,
        // elbow flare during the hardest portion of a press).
        const sampleStep = 1;

        // Pre-collect trunk angles for this cycle to enable relative-swing detection.
        // Isolation exercises (curls, laterals, raises) check trunk < 15-25 deg which
        // fails when seated or leaning on a machine. The real question is: did the trunk
        // MOVE during the rep (swing), not its absolute angle.
        const cycleTrunkAngles = [];
        for (let i = startFrame; i <= endFrame && i < N; i += sampleStep) {
          const frameLm = lm[i];
          if (!frameLm) continue;
          const a = extractJointAngles(frameLm);
          if (a && a.trunk != null) cycleTrunkAngles.push(a.trunk);
        }
        const trunkBaseline = cycleTrunkAngles.length > 0
          ? cycleTrunkAngles.reduce((s, v) => s + v, 0) / cycleTrunkAngles.length
          : 0;
        const trunkSwing = cycleTrunkAngles.length > 2
          ? Math.max(...cycleTrunkAngles) - Math.min(...cycleTrunkAngles)
          : 0;

        formResults = checks.map((fc) => {
          if (shouldSkipCheck(fc.name, this._userInjuries)) {
            return { name: fc.name, passed: true, quality: 1, bad: fc.bad, severity: 'minor', skipped: true };
          }

          // Detect trunk-swing checks on isolation exercises. These checks use
          // angles.trunk < N where N <= 25. Convert to relative swing measurement
          // so seated/incline positions don't produce false failures.
          const isTrunkSwingCheck = this._isTrunkSwingCheck(fc, ex);
          if (isTrunkSwingCheck) {
            // Trunk swing < 15 deg within the cycle = good form
            const swingLimit = 15;
            const quality = trunkSwing <= swingLimit ? 1.0
              : Math.max(0, 1 - (trunkSwing - swingLimit) / 20);
            const passed = quality >= 0.70;
            return { name: fc.name, passed, quality: Math.round(quality * 100) / 100, bad: fc.bad, severity: fc.severity };
          }

          let failCount = 0, sampleCount = 0;
          let qualitySum = 0;
          const hasQualityFn = typeof fc.quality === 'function';

          for (let i = startFrame; i <= endFrame && i < N; i += sampleStep) {
            const frameLandmarks = lm[i];
            if (!frameLandmarks) continue;
            const angles = extractJointAngles(frameLandmarks);
            if (!angles) continue;
            sampleCount++;
            if (!fc.check(angles, frameLandmarks)) failCount++;
            if (hasQualityFn) {
              qualitySum += fc.quality(angles, frameLandmarks);
            }
          }

          const failRate = sampleCount > 0 ? failCount / sampleCount : 0;
          // Continuous quality: use explicit quality function if available, else derive from failRate
          const quality = sampleCount > 0
            ? (hasQualityFn ? qualitySum / sampleCount : 1 - failRate)
            : 0;
          let passed = quality >= 0.70;

          // Apply anthropometric normalization: adjust quality threshold based on body proportions
          if (!passed && this._anthropometricNormalizer.isCalibrated) {
            // Map form check names to normalizer check names
            const checkMap = {
              'Depth': 'squat_depth', 'depth': 'squat_depth', 'knee_depth': 'knee_depth',
              'Trunk angle': 'forward_lean', 'trunk_angle': 'forward_lean',
              'Trunk upright': 'forward_lean',
              'Shoulder ROM': 'shoulder_rom', 'shoulder_rom': 'shoulder_rom',
              'Overhead lockout': 'overhead_lockout',
              'Elbow lockout': 'elbow_lockout',
            };
            const normCheckName = checkMap[fc.name];
            if (normCheckName) {
              // Default pass threshold is 0.70; normalize it based on body proportions
              const adjustedThreshold = this._anthropometricNormalizer.normalizeThreshold(
                this._exerciseKey, normCheckName, 70
              );
              passed = quality >= (adjustedThreshold / 100);
            }
          }

          return { name: fc.name, passed, quality: Math.round(quality * 100) / 100, bad: fc.bad, severity: fc.severity };
        });

        // Weighted quality score: major checks count 2x, minor 1x
        const totalWeight = formResults.reduce((sum, f) => sum + (f.severity === 'major' ? 2 : 1), 0);
        const weightedQuality = formResults.reduce((sum, f) => sum + f.quality * (f.severity === 'major' ? 2 : 1), 0);
        score = totalWeight > 0 ? Math.round((weightedQuality / totalWeight) * 100) : null;
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

    // Evaluate form across ALL frames collected during this rep cycle,
    // not just the lockout frame. This catches depth checks, trunk angle
    // at bottom, etc. that would be missed at lockout.
    const cycleAngles = this._cycleAngles.length > 0 ? this._cycleAngles : [angles];
    const cycleLandmarks = this._cycleLandmarks.length > 0 ? this._cycleLandmarks : [landmarks];
    // Evaluate every frame in the cycle for continuous-arc form checking.
    const sampleStep = 1;

    // Pre-collect trunk angles for relative-swing detection (same logic as video mode)
    const liveTrunkAngles = [];
    for (let i = 0; i < cycleAngles.length; i += sampleStep) {
      const a = cycleAngles[i];
      if (a && a.trunk != null) liveTrunkAngles.push(a.trunk);
    }
    const liveTrunkSwing = liveTrunkAngles.length > 2
      ? Math.max(...liveTrunkAngles) - Math.min(...liveTrunkAngles)
      : 0;

    const formResults = this._exercise.formChecks.map((fc) => {
      // Relative trunk-swing check for isolation exercises (same as video mode)
      if (this._isTrunkSwingCheck(fc, this._exercise)) {
        const swingLimit = 15;
        const quality = liveTrunkSwing <= swingLimit ? 1.0
          : Math.max(0, 1 - (liveTrunkSwing - swingLimit) / 20);
        const passed = quality >= 0.70;
        return { name: fc.name, passed, quality: Math.round(quality * 100) / 100, bad: fc.bad, severity: fc.severity };
      }

      let failCount = 0;
      let sampleCount = 0;
      let qualitySum = 0;
      const hasQualityFn = typeof fc.quality === 'function';

      for (let i = 0; i < cycleAngles.length; i += sampleStep) {
        const a = cycleAngles[i];
        const lm = cycleLandmarks[i];
        if (!a) continue;
        sampleCount++;
        if (!fc.check(a, lm)) failCount++;
        if (hasQualityFn) qualitySum += fc.quality(a, lm);
      }

      const quality = sampleCount > 0
        ? (hasQualityFn ? qualitySum / sampleCount : 1 - failCount / sampleCount)
        : 0;
      const passed = quality >= 0.70;

      return { name: fc.name, passed, quality: Math.round(quality * 100) / 100, bad: fc.bad, severity: fc.severity };
    });

    const totalWeight = formResults.reduce((sum, f) => sum + (f.severity === 'major' ? 2 : 1), 0);
    const weightedQuality = formResults.reduce((sum, f) => sum + f.quality * (f.severity === 'major' ? 2 : 1), 0);
    const score = totalWeight > 0 ? Math.round((weightedQuality / totalWeight) * 100) : null;
    const issues = formResults.filter(f => !f.passed).map(f => f.bad);

    this._repHistory.push({
      score,
      issues,
      ts: Date.now(),
      startFrame: this._frameIdx - cycleAngles.length,
      bottomFrame: this._frameIdx - Math.floor(cycleAngles.length / 2),
      endFrame: this._frameIdx,
    });

    // Reset cycle buffers for next rep
    this._cycleAngles = [];
    this._cycleLandmarks = [];
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
