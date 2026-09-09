/**
 * AnalysisDiagnostics — structured diagnostics layer for video analysis.
 *
 * Produces a single JSON-serializable object describing the quality and
 * confidence of every stage of the analysis pipeline: exercise detection,
 * pose tracking, movement signal quality, rep counting, and composite
 * analysis confidence.
 *
 * Consumed by the results UI to show confidence indicators and warnings,
 * and by the benchmark harness for automated regression testing.
 */

import {
  REP_CONFIDENCE_HIGH,
  REP_CONFIDENCE_MEDIUM,
} from './analysisConfig';

/**
 * @typedef {Object} DiagnosticsOutput
 * @property {Object} exercise
 * @property {Object} pose
 * @property {Object} movement
 * @property {Object} reps
 * @property {Object} analysis
 * @property {Object} signals
 */

export class AnalysisDiagnostics {
  constructor() {
    this._data = {
      exercise: { detected: null, confidence: 0, alternatives: [] },
      pose: {
        detectionRate: 0,
        meanVisibility: 0,
        ghostFrameCount: 0,
        quality: 0,
      },
      movement: {
        signalQuality: 0,
        rangeOfMotion: 0,
        temporalStability: 0,
        amplitudeConsistency: 0,
      },
      reps: {
        machine: 0,
        confidence: 0,
        quality: 0,
        candidates: [],
        uncertain: 0,
      },
      analysis: {
        confidence: 0,
        status: 'unreliable',
        warnings: [],
        failureReasons: [],
      },
      signals: {},
    };
  }

  /**
   * Build diagnostics from a completed RepCounter analysis.
   *
   * @param {import('./repCounter').RepCounter} repCounter - finalized counter
   * @param {Object} exerciseInfo - { detected, confidence, alternatives } from detector
   * @param {Array} frames - collected landmark frames
   * @param {Object} [opts] - optional overrides
   * @param {number} [opts.ghostFrameCount] - total ghost frames from pose tracker
   * @returns {AnalysisDiagnostics}
   */
  static fromRepCounter(repCounter, exerciseInfo, frames, opts = {}) {
    const diag = new AnalysisDiagnostics();
    const d = diag._data;

    // ── Exercise detection ──
    if (exerciseInfo) {
      d.exercise.detected = exerciseInfo.detected || null;
      d.exercise.confidence = exerciseInfo.confidence || 0;
      d.exercise.alternatives = exerciseInfo.alternatives || [];
    }

    // ── Pose quality ──
    const totalFrames = frames ? frames.length : 0;
    if (totalFrames > 0) {
      let validFrames = 0;
      let visSum = 0;
      let visCount = 0;
      for (const frame of frames) {
        if (frame && Array.isArray(frame) && frame.length >= 33) {
          validFrames++;
          for (const lm of frame) {
            if (lm && lm.visibility != null) {
              visSum += lm.visibility;
              visCount++;
            }
          }
        }
      }
      d.pose.detectionRate = validFrames / totalFrames;
      d.pose.meanVisibility = visCount > 0 ? visSum / visCount : 0;
    }
    d.pose.ghostFrameCount = opts.ghostFrameCount || 0;
    d.pose.quality = Math.max(0, Math.min(1,
      d.pose.detectionRate * 0.5 + d.pose.meanVisibility * 0.5
    ));

    // ── Rep counting ──
    const rcDiag = repCounter.diagnostics;
    const signalDiag = repCounter.getSignalDiagnostics
      ? repCounter.getSignalDiagnostics()
      : null;

    d.reps.machine = rcDiag.repsDetected || 0;

    if (rcDiag.acf && rcDiag.acf.allSignals) {
      // Build per-signal diagnostics
      for (const sig of rcDiag.acf.allSignals) {
        d.signals[sig.name] = {
          repCount: sig.reps,
          confidence: sig.confidence,
          period: sig.periodSeconds || 0,
          snr: sig.confidence, // approximate; CMNDF-based
        };
      }

      // Build candidates list grouped by rep count
      const countGroups = {};
      for (const sig of rcDiag.acf.allSignals) {
        const key = sig.reps;
        if (!countGroups[key]) {
          countGroups[key] = { count: key, confidence: 0, signals: [] };
        }
        countGroups[key].confidence = Math.max(countGroups[key].confidence, sig.confidence);
        countGroups[key].signals.push(sig.name);
      }
      d.reps.candidates = Object.values(countGroups)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);
    }

    // Merge signal-level diagnostics if available
    if (signalDiag) {
      for (const sd of signalDiag) {
        if (!d.signals[sd.name]) {
          d.signals[sd.name] = {};
        }
        Object.assign(d.signals[sd.name], {
          signalRange: sd.signalRange,
          adaptedThreshold: sd.adaptedThreshold,
        });
      }
    }

    // ── Movement quality from rep history ──
    const repHistory = repCounter.repHistory || [];
    if (repHistory.length > 0) {
      const scores = repHistory.map(r => r.score).filter(s => s != null);
      d.reps.quality = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length / 100
        : 0;
    }

    // ── Composite rep confidence ──
    const acfConf = rcDiag.acf && rcDiag.acf.picked
      ? rcDiag.acf.picked.confidence
      : 0;
    d.reps.confidence = acfConf;

    // ── Uncertain rep count ──
    const repResult = repCounter.getRepResult ? repCounter.getRepResult() : null;
    d.reps.uncertain = repResult ? repResult.uncertain : 0;

    // ── Movement diagnostics ──
    d.movement.signalQuality = Math.min(1, acfConf);
    d.movement.rangeOfMotion = _normalizeROM(rcDiag);
    d.movement.temporalStability = _computeTemporalStability(repHistory, repCounter._fps);
    d.movement.amplitudeConsistency = _computeAmplitudeConsistency(rcDiag);

    // ── Classify ──
    diag.classify();
    return diag;
  }

  /**
   * Set analysis.status and populate warnings/failureReasons.
   */
  classify() {
    const d = this._data;
    const warnings = [];
    const failures = [];

    // Composite confidence
    const exConf = d.exercise.confidence;
    const poseQ = d.pose.quality;
    const repConf = d.reps.confidence;
    const movQ = (d.movement.signalQuality + d.movement.rangeOfMotion +
                  d.movement.temporalStability + d.movement.amplitudeConsistency) / 4;

    d.analysis.confidence = exConf * 0.15 + poseQ * 0.25 + repConf * 0.40 + movQ * 0.20;

    // Warnings
    if (d.pose.detectionRate < 0.7) {
      warnings.push(`Low pose detection rate: ${(d.pose.detectionRate * 100).toFixed(0)}%`);
    }
    if (d.pose.meanVisibility < 0.5) {
      warnings.push(`Low landmark visibility: ${(d.pose.meanVisibility * 100).toFixed(0)}%`);
    }
    if (d.pose.ghostFrameCount > 10) {
      warnings.push(`${d.pose.ghostFrameCount} ghost frames (stale pose data)`);
    }
    if (d.exercise.confidence < 0.5) {
      warnings.push('Exercise detection uncertain');
    }
    if (d.reps.machine > 0 && repConf < REP_CONFIDENCE_MEDIUM) {
      warnings.push('Rep count has low confidence');
    }
    if (d.movement.rangeOfMotion < 0.3) {
      warnings.push('Very limited range of motion detected');
    }

    // Failure reasons
    if (d.pose.detectionRate < 0.3) {
      failures.push('Person barely visible in video');
    }
    if (d.reps.machine === 0 && d.reps.candidates.length === 0) {
      failures.push('No periodic movement detected');
    }

    // Status
    const c = d.analysis.confidence;
    if (c >= 0.75) d.analysis.status = 'high';
    else if (c >= 0.50) d.analysis.status = 'medium';
    else if (c >= 0.25) d.analysis.status = 'low';
    else d.analysis.status = 'unreliable';

    d.analysis.warnings = warnings;
    d.analysis.failureReasons = failures;
  }

  /**
   * Return a plain JSON-serializable object.
   * @returns {DiagnosticsOutput}
   */
  toJSON() {
    return JSON.parse(JSON.stringify(this._data));
  }

  /** Direct access to the data for in-memory consumers. */
  get data() {
    return this._data;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalize observed ROM to 0-1 based on exercise expected range.
 * @param {Object} diag - RepCounter diagnostics
 * @returns {number}
 */
function _normalizeROM(diag) {
  const range = diag.observedRange || 0;
  const expected = diag.minROM || 60; // fallback expected ROM
  if (expected <= 0) return range > 10 ? 0.5 : 0;
  return Math.min(1, range / expected);
}

/**
 * Compute temporal stability from rep history (consistency of rep duration).
 * @param {Array} repHistory
 * @param {number} fps
 * @returns {number} 0-1
 */
function _computeTemporalStability(repHistory, fps) {
  if (!repHistory || repHistory.length < 2) return 0.5;
  const durations = repHistory.map(r => (r.endFrame - r.startFrame));
  const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
  if (mean <= 0) return 0;
  const variance = durations.reduce((s, d) => s + (d - mean) ** 2, 0) / durations.length;
  const cv = Math.sqrt(variance) / mean;
  // CV < 0.15 = very consistent, CV > 0.5 = poor
  return Math.max(0, Math.min(1, 1 - cv * 2));
}

/**
 * Compute amplitude consistency from signal diagnostics.
 * @param {Object} diag - RepCounter diagnostics
 * @returns {number} 0-1
 */
function _computeAmplitudeConsistency(diag) {
  // If we have per-rep ROM data, compute CV
  if (diag.acf && diag.acf.allSignals && diag.acf.allSignals.length > 0) {
    const confidences = diag.acf.allSignals.map(s => s.confidence);
    const mean = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    return Math.min(1, mean);
  }
  return 0.5;
}
