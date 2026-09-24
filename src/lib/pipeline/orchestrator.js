/**
 * Pipeline Orchestrator
 *
 * Connects Layer 1 (Frame Pipeline) -> Layer 2 (Kinematic Engine) ->
 * Layer 3 (Rep Counter) -> Layer 4 (Analysis).
 *
 * Produces a result payload compatible with the existing ResultCard component.
 */

import { extractPoseLandmarks } from './framePipeline.js';
import { processKinematics, extractJointAngles } from './kinematicEngine.js';
import { countReps } from './repCounter.js';
import { generateAnalysis } from './analysisLayer.js';

/**
 * Run the full v2 analysis pipeline on a video file.
 *
 * @param {Object} params
 * @param {File} params.file - Video file
 * @param {string} params.exercise - Exercise key (required; no auto-detect in default flow)
 * @param {Function} params.onProgress - Progress callback (0-100)
 * @param {Function} params.onPhase - Phase label callback
 * @param {AbortSignal} params.signal - Cancellation signal
 * @returns {Promise<Object>} Result payload for ResultCard
 */
export async function analyzeVideoV2({
  file,
  exercise,
  onProgress = () => {},
  onPhase = () => {},
  signal,
}) {
  const analysisStart = Date.now();

  if (!exercise || exercise === '__auto__') {
    return {
      error: true,
      errorReason: 'Please select an exercise before analyzing.',
    };
  }

  try {
    // ── Phase 1: Frame extraction + Pose detection (Layer 1) ──
    onPhase('extracting');
    const pipelineResult = await extractPoseLandmarks(file, {
      onProgress: (p) => onProgress(Math.round(p * 0.7)),
      signal,
    });

    if (!pipelineResult.frames || pipelineResult.frames.length === 0) {
      return {
        error: true,
        errorReason: 'No poses detected. Ensure your full body is visible with good lighting.',
      };
    }

    onProgress(70);

    // ── Phase 2: Kinematic processing (Layer 2) ──
    onPhase('analyzing');
    const kinematics = processKinematics(pipelineResult.frames, exercise);

    if (!kinematics.signal || kinematics.signal.length < 6) {
      return {
        error: true,
        errorReason: 'Insufficient pose data for analysis. Try a longer video.',
      };
    }

    onProgress(80);

    // ── Phase 3: Rep counting (Layer 3) ──
    const repResult = countReps(kinematics.signal, exercise, kinematics.fps);

    onProgress(90);

    // ── Phase 4: Analysis & feedback (Layer 4) ──
    let analysis;
    try {
      analysis = generateAnalysis(kinematics, repResult, exercise, {
        duration: pipelineResult.duration,
      });
    } catch {
      // Layer 4 failure: count still shows
      analysis = {
        exerciseName: exercise,
        repCount: repResult.count,
        confidence: repResult.confidence,
        duration: Math.round(pipelineResult.duration),
        reps: repResult.reps,
        validated: false,
        metrics: { validated: false },
        coaching: [],
      };
    }

    onProgress(100);

    const analysisTime = ((Date.now() - analysisStart) / 1000).toFixed(1);

    // Build result payload compatible with existing ResultCard
    return {
      fileName: file.name,
      exercise,
      exerciseName: exercise,
      reps: repResult.count,
      machineReps: repResult.count,
      duration: Math.round(pipelineResult.duration),
      analysisTime,
      confidence: {
        visibility: repResult.confidence,
        level: repResult.confidence > 0.7 ? 'high' : repResult.confidence > 0.5 ? 'medium' : 'low',
        framesWithPose: pipelineResult.frames.length,
      },
      repHistory: repResult.reps.map((r, i) => ({
        ...r,
        score: null,
        issues: [],
        ts: analysisStart + r.timestamp * 1000,
        startTime: r.timestamp,
        peakTime: r.peakFrame / 30,
        endTime: r.endFrame / 30,
      })),
      // v2 pipeline metadata
      v2Pipeline: true,
      analysis,
      // Compatibility fields
      formScore: null,
      hasFormChecks: false,
      bioAnalysis: null,
      coaching: null,
      report: null,
      progression: null,
      baselineComparison: null,
      diagnostics: {
        observedMin: kinematics.signal.length > 0 ? Math.round(Math.min(...kinematics.signal) * 10) / 10 : 0,
        observedMax: kinematics.signal.length > 0 ? Math.round(Math.max(...kinematics.signal) * 10) / 10 : 0,
        observedRange: kinematics.signal.length > 0
          ? Math.round((Math.max(...kinematics.signal) - Math.min(...kinematics.signal)) * 10) / 10
          : 0,
        repsDetected: repResult.count,
        totalFrames: pipelineResult.frames.length,
        method: 'v2-fsm',
      },
      frames: pipelineResult.frames.map(f => ({
        landmarks: f.landmarks,
        timestamp: f.timestamp,
      })),
      fps: 30,
      autoDetected: false,
      detectionFailed: false,
      detectionConfidence: 1,
      detectionLowConfidence: false,
      insufficientFootage: false,
      hardRefuse: false,
      qualityGateReasons: [],
      weight: 0,
      debug: {
        frameCount: pipelineResult.frames.length,
        pipeline: 'v2',
      },
      aborted: false,
      error: false,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { aborted: true, reps: 0, frames: [], exercise };
    }
    return {
      error: true,
      errorReason: err.message || 'Unknown analysis error',
    };
  }
}
