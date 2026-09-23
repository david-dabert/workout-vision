/**
 * Video analysis engine — thin orchestrator.
 *
 * Takes a video file and configuration, returns analysis results.
 * Orchestrates: hashing → cache check → frame extraction → MediaPipe inference →
 * exercise detection → rep counting → biomechanical analysis → coaching report.
 *
 * Delegates to focused modules under ./analysis/:
 *   frameExtractor  — frame extraction, worker pipeline, serial fallback
 *   poseDetection   — MediaPipe model loading and worker initialization
 *   signalProcessing — exercise auto-detection and candidate scoring
 *   repCounter      — rep counting, finalization, enrichment
 *   formAnalyzer    — form checks, scoring, coaching, result compilation
 */

import { extractJointAngles } from './poseAnalysis';
import { hashFile } from './frameExtractor';
import {
  getCachedLandmarks,
  setCachedLandmarks,
  savePartialCheckpoint,
  clearPartialCheckpoint,
} from './landmarkCache';
import { IS_IOS, getMaxFrames, extractAndInferFrames } from './analysis/frameExtractor';
import { initPoseDetection } from './analysis/poseDetection';
import { detectExercise } from './analysis/signalProcessing';
import { countReps, enrichRepHistory } from './analysis/repCounter';
import { compileResults } from './analysis/formAnalyzer';

const MAX_FRAMES = getMaxFrames();

/**
 * Analyze a single video file.
 *
 * @param {Object} params
 * @param {File} params.file - Video file to analyze
 * @param {string} params.exercise - Exercise key or '__auto__'
 * @param {boolean} params.autoDetect - Whether to auto-detect exercise
 * @param {boolean} params.userChangedExercise - Whether user manually selected exercise
 * @param {number} params.weightKg - Weight in kg (0 if bodyweight)
 * @param {Array} params.userInjuries - Injury keys to skip form checks for
 * @param {Object} params.userProfile - User profile for coaching
 * @param {Object} params.worker - { ready, supported, init, detect, reset } worker interface
 * @param {Function} params.onProgress - Progress callback (0-100)
 * @param {Function} params.onPhase - Phase callback ('hashing'|'model'|'extracting'|'analyzing')
 * @param {Function} params.onLiveReps - Live rep count callback
 * @param {Function} params.onExerciseDetected - Called when auto-detect resolves
 * @param {AbortSignal} [params.signal] - AbortSignal for cancellation
 * @returns {Promise<Object|null>} Analysis result or null on failure
 */
export async function analyzeVideoFile({
  file, exercise, autoDetect, userChangedExercise, weightKg,
  userInjuries, userProfile, worker,
  onProgress = () => {}, onPhase = () => {}, onLiveReps = () => {},
  onExerciseDetected = () => {}, onSuitability, onProgressiveUpdate,
  signal, gymMode = 'gym', detectorRef,
}) {
  const analysisStart = Date.now();
  const analysisFps = IS_IOS ? 10 : 15;
  const maxWidth = IS_IOS ? 480 : 720;
  const MAX_VIDEO_DURATION = 120;
  const ANALYSIS_TIMEOUT = 180_000;

  // ── Global analysis timeout ──
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), ANALYSIS_TIMEOUT);
  const effectiveSignal = (() => {
    if (!signal) return timeoutController.signal;
    const combined = new AbortController();
    const onAbort = () => combined.abort();
    signal.addEventListener('abort', onAbort);
    timeoutController.signal.addEventListener('abort', onAbort);
    return combined.signal;
  })();

  const checkAbort = () => {
    if (effectiveSignal?.aborted) {
      if (timeoutController.signal.aborted && !signal?.aborted) {
        const elapsed = Math.round((Date.now() - analysisStart) / 1000);
        const err = new Error('Analysis timeout');
        err.name = 'TimeoutError';
        err._structured = { error: 'analysis_timeout', elapsed };
        throw err;
      }
      throw new DOMException('Aborted', 'AbortError');
    }
  };

  try {
    // ── Phase 1: Hash ──
    onPhase('hashing');
    checkAbort();
    const videoHash = await hashFile(file);

    // ── Duration guard ──
    const videoDuration = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      const cleanup = () => { URL.revokeObjectURL(url); tempVideo.src = ''; };
      tempVideo.onloadedmetadata = () => { const d = tempVideo.duration; cleanup(); resolve(d); };
      tempVideo.onerror = () => { cleanup(); resolve(Infinity); };
      tempVideo.src = url;
    });
    if (Number.isFinite(videoDuration) && videoDuration > MAX_VIDEO_DURATION) {
      clearTimeout(timeoutId);
      return { error: 'video_too_long', duration: Math.round(videoDuration), maxDuration: MAX_VIDEO_DURATION };
    }
    const cacheKey = `lm-${videoHash}-${analysisFps}-cpu`;

    // ── Phase 2: Load model ──
    onPhase('model');
    checkAbort();
    const poseInit = await initPoseDetection({ worker });
    if (poseInit.error) { clearTimeout(timeoutId); return poseInit.error; }
    const { useWorker, landmarker } = poseInit;

    // ── Phase 3: Check cache ──
    const frames = [];
    const replayFrames = [];
    let usedCache = false;
    let frameCount = 0;
    let duration = 0;

    checkAbort();
    const cachedLandmarks = await getCachedLandmarks(cacheKey);
    if (cachedLandmarks && cachedLandmarks.length > 0) {
      usedCache = true;
      frameCount = cachedLandmarks.length;
      duration = frameCount / analysisFps;
      const interval = 1 / analysisFps;
      for (let i = 0; i < cachedLandmarks.length; i++) {
        const lm = cachedLandmarks[i];
        const time = i * interval;
        const angles = extractJointAngles(lm);
        frames.push({ landmarks: lm, timestamp: time, angles });
        replayFrames.push({ landmarks: lm, timestamp: time });
      }
      onProgress(99);
    }

    let progressiveDetector = null;

    // ── Phase 4: Extract frames ──
    if (!usedCache) {
      onPhase('extracting');
      checkAbort();

      try {
        const extractResult = await extractAndInferFrames({
          file, analysisFps, maxFrames: MAX_FRAMES, maxWidth,
          exercise, autoDetect, userChangedExercise,
          useWorker, worker, landmarker, cacheKey, effectiveSignal,
          onProgress, onLiveReps, onSuitability, onProgressiveUpdate,
          gymMode, detectorRef,
        });

        frames.push(...extractResult.frames);
        replayFrames.push(...extractResult.replayFrames);
        frameCount = extractResult.frameCount;
        duration = extractResult.duration;
        progressiveDetector = extractResult.progressiveDetector;

        // Cache landmarks and clear partial checkpoint
        if (frames.length > 0) {
          const toCache = frames.map(f => f.landmarks);
          setCachedLandmarks(cacheKey, toCache).catch(() => {});
          clearPartialCheckpoint(cacheKey).catch(() => {});
        }
      } catch (err) {
        if (err.name === 'TimeoutError' && err._structured) {
          clearTimeout(timeoutId);
          return err._structured;
        }
        if (err.name === 'AbortError') {
          clearTimeout(timeoutId);
          return buildPartialResult({
            frames, replayFrames, analysisFps,
            exercise, autoDetect, userChangedExercise,
            weightKg, userInjuries, userProfile,
            file, videoHash, analysisStart, onExerciseDetected,
            aborted: true, progressiveDetector,
          });
        }
        console.error('[analyzeVideo] Streaming extraction failed:', err);
        if (frames.length > 0) {
          console.warn(`[analyzeVideo] Recovering ${frames.length} frames from failed extraction`);
          return buildPartialResult({
            frames, replayFrames, analysisFps,
            exercise, autoDetect, userChangedExercise,
            weightKg, userInjuries, userProfile,
            file, videoHash, analysisStart, onExerciseDetected,
            aborted: false, errorReason: err.message, progressiveDetector,
          });
        }
        return { error: true, errorReason: err.message };
      }
    }

    if (frames.length === 0) {
      clearTimeout(timeoutId);
      return { error: true, errorReason: 'No poses detected in any frame. Ensure your full body is visible with good lighting.' };
    }

    const lockedExercise = progressiveDetector?.state?.locked ? progressiveDetector.state.exercise : null;
    const finalExercise = lockedExercise || exercise;
    const finalAutoDetect = lockedExercise ? false : autoDetect;
    const finalUserChanged = lockedExercise ? true : userChangedExercise;

    clearTimeout(timeoutId);
    return await buildFullResult({
      frames, replayFrames, frameCount, duration, analysisFps,
      exercise: finalExercise, autoDetect: finalAutoDetect, userChangedExercise: finalUserChanged,
      weightKg, userInjuries, userProfile,
      file, videoHash, analysisStart, onProgress, onPhase, onExerciseDetected,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'TimeoutError' && err._structured) return err._structured;
    if (err.name === 'AbortError') return { aborted: true, reps: 0, frames: [], exercise };
    console.error('[analyzeVideo] Unhandled analysis error:', err);
    return { error: true, errorReason: err.message || 'Unknown analysis error' };
  }
}

/**
 * Build the full analysis result after all frames are extracted.
 */
async function buildFullResult({
  frames, replayFrames, frameCount, duration, analysisFps,
  exercise, autoDetect, userChangedExercise, weightKg, userInjuries, userProfile,
  file, videoHash, analysisStart, onProgress = () => {}, onPhase = () => {}, onExerciseDetected = () => {},
}) {
  onPhase('analyzing');

  const isAutoMode = exercise === '__auto__';
  const initialExercise = isAutoMode ? 'squat' : exercise;
  let detectedExercise = initialExercise;
  let detectionConfidence = 1;
  let detectionLowConfidence = false;
  let candidateScores = [];
  let autoDetected = false;

  // Initial rep counting
  let repCounter = countReps({ frames, exercise: initialExercise, analysisFps, userInjuries, weightKg });

  // Auto-detection
  if (isAutoMode || (autoDetect && !userChangedExercise)) {
    const detection = detectExercise({
      frames, initialExercise, isAutoMode, analysisFps, userInjuries, weightKg, onExerciseDetected,
    });
    detectedExercise = detection.detectedExercise;
    detectionConfidence = detection.detectionConfidence;
    detectionLowConfidence = detection.detectionLowConfidence;
    candidateScores = detection.candidateScores;
    autoDetected = detection.autoDetected;
    if (detection.repCounter) {
      repCounter = detection.repCounter;
    }
  }

  repCounter.finalize();

  const interval = 1 / analysisFps;
  const repHistory = enrichRepHistory(repCounter.repHistory, interval);
  const reps = repHistory.length;

  return compileResults({
    frames, replayFrames, frameCount, duration, analysisFps,
    detectedExercise, autoDetected, detectionConfidence, detectionLowConfidence,
    candidateScores, repHistory, reps,
    repCounterDiagnostics: repCounter.diagnostics || {},
    weightKg, userInjuries, userProfile,
    file, videoHash, analysisStart, onProgress,
  });
}

/**
 * Build a partial result when analysis is aborted mid-extraction.
 */
async function buildPartialResult({
  frames, replayFrames, analysisFps, exercise, autoDetect,
  userChangedExercise, weightKg, userInjuries, userProfile,
  file, videoHash, analysisStart, onExerciseDetected,
  aborted, progressiveDetector,
}) {
  const partialLockedEx = progressiveDetector?.state?.locked ? progressiveDetector.state.exercise : null;
  const finalExercise = partialLockedEx || exercise;
  const finalAutoDetect = partialLockedEx ? false : autoDetect;
  const finalUserChanged = partialLockedEx ? true : userChangedExercise;

  if (frames.length === 0) {
    return { aborted: true, reps: 0, frames: [], exercise: finalExercise, fileName: file.name };
  }

  const duration = frames.length / analysisFps;
  const frameCount = frames.length;

  try {
    return await buildFullResult({
      frames, replayFrames, frameCount, duration, analysisFps,
      exercise: finalExercise, autoDetect: finalAutoDetect, userChangedExercise: finalUserChanged,
      weightKg, userInjuries, userProfile,
      file, videoHash, analysisStart, onExerciseDetected,
    });
  } catch {
    return {
      aborted: true,
      fileName: file.name,
      exercise: finalExercise,
      reps: 0,
      frames: replayFrames,
      fps: analysisFps,
      duration: Math.round(duration),
    };
  }
}
