/**
 * Video analysis engine — pure function, no React dependency.
 *
 * Takes a video file and configuration, returns analysis results.
 * Orchestrates: hashing → cache check → frame extraction → MediaPipe inference →
 * exercise detection → rep counting → biomechanical analysis → coaching report.
 *
 * Extracted from VideoUpload.jsx to decouple domain logic from UI rendering.
 *
 * Supports:
 * - AbortSignal for cancellation (returns partial results with aborted flag)
 * - Partial landmark cache checkpoints (resume from where extraction stopped)
 * - RVFC-based frame extraction with seek fallback
 */

import { getImageLandmarker, detectPoseImage, extractJointAngles, resetKalmanFilters, selectSubjectPose, disposeAllLandmarkers } from './poseAnalysis';
import { EXERCISES } from './exercises';
import { RepCounter } from './repCounter';
import { ProgressionScore } from './ProgressionScore';
import { ExerciseAutoDetector } from './exerciseDetector';
import { HierarchicalDetector } from './hierarchicalDetector';
import { analyzeSet } from './biomechanics';
import { generateWorkoutReport } from './coach';
import { analyzeCoaching } from './coachingEngine';
import { saveWorkout, getLastWorkoutForExercise } from './storage';
import { extractFramesStreaming, hashFile, hashLandmarks } from './frameExtractor';
import { updateBaseline, compareToBaseline } from './formBaselines';
import { computeCalibration, applyCalibration } from './calibration';
import { VideoSuitabilityDetector } from './videoSuitability';
import {
  getCachedLandmarks,
  setCachedLandmarks,
  savePartialCheckpoint,
  loadPartialCheckpoint,
  clearPartialCheckpoint,
} from './landmarkCache';
import { runInputQualityGate } from './inputQualityGate';

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const CHECKPOINT_INTERVAL = 50; // Save partial checkpoint every N frames

/**
 * Detect available device memory and return an appropriate frame limit.
 * Uses navigator.deviceMemory (Chrome) and performance.memory (Chrome)
 * with conservative fallbacks for browsers that don't expose memory info.
 */
function getMaxFrames() {
  const base = IS_IOS ? 300 : 600;
  try {
    // navigator.deviceMemory: approximate RAM in GB (Chrome 63+)
    const deviceGB = navigator.deviceMemory;
    if (deviceGB != null && deviceGB <= 2) return Math.min(base, 200);
    if (deviceGB != null && deviceGB <= 4) return Math.min(base, 400);

    // performance.memory: JS heap info (Chrome only, non-standard)
    const mem = performance.memory;
    if (mem) {
      const usedRatio = mem.usedJSHeapSize / mem.jsHeapSizeLimit;
      // If heap is already >60% used before analysis, reduce frame count
      if (usedRatio > 0.6) return Math.min(base, 300);
    }
  } catch { /* memory APIs unavailable; use default */ }
  return base;
}

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
  file,
  exercise,
  autoDetect,
  userChangedExercise,
  weightKg,
  userInjuries,
  userProfile,
  worker,
  onProgress = () => {},
  onPhase = () => {},
  onLiveReps = () => {},
  onExerciseDetected = () => {},
  onSuitability,
  onProgressiveUpdate,
  signal,
  gymMode = 'gym',
  detectorRef,
}) {
  const analysisStart = Date.now();
  const analysisFps = IS_IOS ? 10 : 15;
  const maxWidth = IS_IOS ? 480 : 720;

  // Helper to check abort state
  const checkAbort = () => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  };

  try {
    // ── Phase 1: Hash ──
    onPhase('hashing');
    checkAbort();
    const videoHash = await hashFile(file);
    // Cache key includes 'cpu' to invalidate stale GPU-derived landmarks
    // from before the deterministic CPU delegate fix
    const cacheKey = `lm-${videoHash}-${analysisFps}-cpu`;

    // ── Phase 2: Load model ──
    onPhase('model');
    checkAbort();
    resetKalmanFilters();
    let useWorker = false;
    let workerInitError = null;
    if (worker.ready) {
      useWorker = true;
    } else if (worker.supported) {
      try {
        // Force CPU delegate for deterministic landmark extraction.
        // GPU floating-point ops produce non-deterministic results:
        // the same video yields different rep counts on different runs.
        useWorker = await worker.init({ forceCPU: true, useImageMode: true });
      } catch (e) {
        workerInitError = e;
        console.warn('[analyzeVideo] Worker init failed, falling back to main thread:', e.message);
        useWorker = false;
      }
    }
    if (useWorker) {
      // Reinit the landmarker with CPU delegate for deterministic results.
      // Also releases WebGL context on iOS (prevents GPU memory exhaustion
      // after 2-3 sequential analyses).
      if (worker.reinit) {
        try {
          await worker.reinit({ forceCPU: true, useImageMode: true });
        } catch (e) {
          console.warn('[analyzeVideo] Worker reinit failed, trying reset:', e.message);
          worker.reset();
        }
      } else {
        worker.reset();
      }
    }
    let landmarker = null;
    if (!useWorker) {
      // Dispose any existing GPU landmarker so getImageLandmarker() creates
      // a fresh one with CPU delegate for deterministic results.
      disposeAllLandmarkers();
      try {
        landmarker = await getImageLandmarker();
      } catch (e) {
        console.error('[analyzeVideo] Model loading failed:', e.message);
        return { error: true, errorReason: `Model failed to load: ${e.message}${workerInitError ? ` (worker also failed: ${workerInitError.message})` : ''}` };
      }
      if (!landmarker) {
        return { error: true, errorReason: `Pose model unavailable${workerInitError ? ` (worker failed: ${workerInitError.message})` : ''}` };
      }
    }

    // ── Phase 3: Check cache (full + partial) ──
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

    // Progressive detector – declared here so it's in scope after the cache/extract branch
    let progressiveDetector = null;

    // ── Phase 4: Extract frames ──
    if (!usedCache) {
      onPhase('extracting');
      checkAbort();

      // Check for partial checkpoint to resume from
      let startFrame = 0;
      const partialCheckpoint = await loadPartialCheckpoint(cacheKey);
      if (partialCheckpoint && partialCheckpoint.landmarks && partialCheckpoint.lastFrame > 0) {
        // Restore frames from checkpoint
        const interval = 1 / analysisFps;
        for (let i = 0; i < partialCheckpoint.landmarks.length; i++) {
          const lm = partialCheckpoint.landmarks[i];
          const time = i * interval;
          if (lm) {
            const angles = extractJointAngles(lm);
            frames.push({ landmarks: lm, timestamp: time, angles });
            replayFrames.push({ landmarks: lm, timestamp: time });
          }
        }
        startFrame = partialCheckpoint.lastFrame + 1;
        onProgress(Math.round((startFrame / MAX_FRAMES) * 95));
      }

      const liveState = {
        repCounter: new RepCounter(exercise === '__auto__' ? 'squat' : exercise, { fps: analysisFps, mode: 'live' }),
        exercise: exercise === '__auto__' ? 'squat' : exercise,
        lastProgressiveUpdate: 0,
      };
      progressiveDetector = (exercise === '__auto__' || (autoDetect && !userChangedExercise))
        ? new HierarchicalDetector({ fps: analysisFps, mode: gymMode, deterministic: true })
        : null;
      if (detectorRef && progressiveDetector) detectorRef.current = progressiveDetector;
      const PROGRESSIVE_INTERVAL = 50;
      let suitabilityChecked = false;

      // Shared per-frame processing for both worker and non-worker paths
      const commitFrame = (landmarks, worldLandmarks, angles, time, frameIdx) => {
        if (!angles) angles = extractJointAngles(landmarks);
        const frameData = { landmarks, timestamp: time, angles };
        if (worldLandmarks) frameData.worldLandmarks = worldLandmarks;
        frames.push(frameData);
        replayFrames.push({ landmarks, timestamp: time });
        landmarksForCache.push(landmarks);

        const liveResult = liveState.repCounter.update(landmarks, time);
        if (liveResult?.reps != null) onLiveReps(liveResult.reps);

        if (progressiveDetector) {
          progressiveDetector.update({ landmarks, worldLandmarks, timestampMs: frameIdx * (1000 / analysisFps) });
          const lockedEx = progressiveDetector.state?.locked ? progressiveDetector.state.exercise : null;
          if (lockedEx && lockedEx !== liveState.exercise) {
            try {
              liveState.repCounter = new RepCounter(lockedEx, { fps: analysisFps, mode: 'live' });
              liveState.exercise = lockedEx;
            } catch { /* exercise not in EXERCISES registry; keep current counter */ }
          }
        }

        if (onProgressiveUpdate && frames.length - liveState.lastProgressiveUpdate >= PROGRESSIVE_INTERVAL) {
          liveState.lastProgressiveUpdate = frames.length;
          if (progressiveDetector) onProgressiveUpdate(progressiveDetector.state);
        }

        if (landmarksForCache.length > 0 && landmarksForCache.length % CHECKPOINT_INTERVAL === 0) {
          savePartialCheckpoint(cacheKey, landmarksForCache, frameIdx).catch(() => {});
        }

        if (!suitabilityChecked && frames.length >= 30 && onSuitability) {
          suitabilityChecked = true;
          const suitabilityDetector = new VideoSuitabilityDetector();
          const earlyLandmarks = frames.slice(0, 30).map(f => f.landmarks);
          onSuitability(suitabilityDetector.assess(earlyLandmarks));
        }
      };
      let lockedSubjectIdx = null;
      let streamFrameCount = startFrame;
      const landmarksForCache = frames.map(f => f.landmarks);

      try {
        if (useWorker) {
          // ── Pipeline mode: overlap extraction and inference ──
          // Extract frames as fast as possible (bitmap capture ~1ms per frame).
          // Fire inferences to the worker with concurrency limit to avoid
          // accumulating too many transferred bitmaps in the worker message queue.
          const MAX_CONCURRENT = 4;
          let inFlight = 0;
          const slotWaiters = [];
          const pendingInferences = []; // { promise, frameIndex }

          const acquireSlot = () => {
            if (inFlight < MAX_CONCURRENT) { inFlight++; return Promise.resolve(); }
            return new Promise(r => slotWaiters.push(r));
          };
          const releaseSlot = () => {
            inFlight--;
            if (slotWaiters.length > 0) { inFlight++; slotWaiters.shift()(); }
          };

          // Ordered results collector: results arrive out-of-order, we process in-order
          const inferenceResults = new Map(); // frameIndex → result
          let lastProcessedIdx = -1;

          // Process in-order results for live rep counting and progress
          const drainOrderedResults = () => {
            while (inferenceResults.has(lastProcessedIdx + 1)) {
              lastProcessedIdx++;
              const result = inferenceResults.get(lastProcessedIdx);
              inferenceResults.delete(lastProcessedIdx);

              if (result?.landmarks) {
                const time = lastProcessedIdx / analysisFps;
                const angles = result.angles || extractJointAngles(result.landmarks);
                commitFrame(result.landmarks, result.worldLandmarks, angles, time, lastProcessedIdx);
              }
            }
          };

          const streamResult = await extractFramesStreaming(
            file,
            analysisFps,
            MAX_FRAMES,
            maxWidth,
            async (canvas, frameIndex) => {
              // Capture bitmap from canvas (~1ms, non-blocking for video playback)
              const bitmap = await createImageBitmap(canvas);
              const deterministicTs = frameIndex * (1000 / analysisFps);

              // Wait for an inference slot (back-pressure)
              await acquireSlot();

              // Fire inference without awaiting result
              const inferPromise = (async () => {
                try {
                  const workerResult = await worker.detect(bitmap, deterministicTs, frameIndex);
                  inferenceResults.set(frameIndex, workerResult);
                  drainOrderedResults();
                } finally {
                  releaseSlot();
                }
              })();
              pendingInferences.push(inferPromise);

              streamFrameCount++;
              onProgress(Math.round((streamFrameCount / MAX_FRAMES) * 95));
            },
            undefined,
            { signal, startFrame, deterministic: true },
          );

          // Wait for all in-flight inferences to complete
          await Promise.all(pendingInferences);
          drainOrderedResults();

          frameCount = streamResult.frameCount;
          duration = streamResult.duration;

        } else {
          // ── Serial mode: main-thread inference (no parallelism possible) ──
          const streamResult = await extractFramesStreaming(
            file,
            analysisFps,
            MAX_FRAMES,
            maxWidth,
            async (canvas, frameIndex) => {
              const deterministicTs = frameIndex * (1000 / analysisFps);
              let landmarks = null;
              let angles = null;
              let worldLandmarks = null;

              const result = detectPoseImage(landmarker, canvas, deterministicTs);
              if (result?.landmarks?.length) {
                if (result.landmarks.length === 1) {
                  landmarks = result.landmarks[0];
                  worldLandmarks = result.worldLandmarks?.[0] || null;
                } else {
                  if (lockedSubjectIdx === null) {
                    landmarks = selectSubjectPose(result.landmarks);
                    lockedSubjectIdx = result.landmarks.indexOf(landmarks);
                  } else {
                    landmarks = result.landmarks[lockedSubjectIdx] || selectSubjectPose(result.landmarks);
                  }
                  worldLandmarks = result.worldLandmarks?.[lockedSubjectIdx] || null;
                }
                angles = extractJointAngles(landmarks);
              }

              if (landmarks) {
                const time = frameIndex / analysisFps;
                commitFrame(landmarks, worldLandmarks, angles, time, frameIndex);
              }

              streamFrameCount++;
              onProgress(Math.round((streamFrameCount / MAX_FRAMES) * 95));
            },
            undefined,
            { signal, startFrame, deterministic: true },
          );

          frameCount = streamResult.frameCount;
          duration = streamResult.duration;
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          // Save what we have as a partial checkpoint before returning
          if (landmarksForCache.length > 0) {
            await savePartialCheckpoint(cacheKey, landmarksForCache, streamFrameCount - 1).catch(() => {});
          }
          // Return partial results with aborted flag
          const partialLockedEx = progressiveDetector?.state?.locked ? progressiveDetector.state.exercise : null;
          return buildPartialResult({
            frames, replayFrames, analysisFps,
            exercise: partialLockedEx || exercise,
            autoDetect: partialLockedEx ? false : autoDetect,
            userChangedExercise: partialLockedEx ? true : userChangedExercise,
            weightKg, userInjuries, userProfile,
            file, videoHash, analysisStart, onExerciseDetected,
            aborted: true,
          });
        }
        console.error('[analyzeVideo] Streaming extraction failed:', err);
        // If we have partial frames, return them instead of failing completely
        if (frames.length > 0) {
          console.warn(`[analyzeVideo] Recovering ${frames.length} frames from failed extraction`);
          const partialLockedEx = progressiveDetector?.state?.locked ? progressiveDetector.state.exercise : null;
          return buildPartialResult({
            frames, replayFrames, analysisFps,
            exercise: partialLockedEx || exercise,
            autoDetect: partialLockedEx ? false : autoDetect,
            userChangedExercise: partialLockedEx ? true : userChangedExercise,
            weightKg, userInjuries, userProfile,
            file, videoHash, analysisStart, onExerciseDetected,
            aborted: false,
            errorReason: err.message,
          });
        }
        return { error: true, errorReason: err.message };
      }

      // Cache landmarks and clear partial checkpoint
      if (frames.length > 0) {
        const toCache = frames.map(f => f.landmarks);
        setCachedLandmarks(cacheKey, toCache).catch(() => {});
        clearPartialCheckpoint(cacheKey).catch(() => {});
      }
    }

    if (frames.length === 0) {
      return { error: true, errorReason: 'No poses detected in any frame. Ensure your full body is visible with good lighting.' };
    }

    // If user locked an exercise via chips during progressive detection,
    // honour that choice and skip post-hoc auto-detect.
    const lockedExercise = progressiveDetector?.state?.locked ? progressiveDetector.state.exercise : null;
    const finalExercise = lockedExercise || exercise;
    const finalAutoDetect = lockedExercise ? false : autoDetect;
    const finalUserChanged = lockedExercise ? true : userChangedExercise;

    return await buildFullResult({
      frames, replayFrames, frameCount, duration, analysisFps,
      exercise: finalExercise, autoDetect: finalAutoDetect, userChangedExercise: finalUserChanged,
      weightKg, userInjuries, userProfile,
      file, videoHash, analysisStart, onProgress, onPhase, onExerciseDetected,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      // Aborted before extraction started; no partial results available
      return { aborted: true, reps: 0, frames: [], exercise };
    }
    console.error('[analyzeVideo] Unhandled analysis error:', err);
    return { error: true, errorReason: err.message || 'Unknown analysis error' };
  }
}

/**
 * Build the full analysis result after all frames are extracted.
 * Shared between normal completion and partial result building.
 */
async function buildFullResult({
  frames, replayFrames, frameCount, duration, analysisFps,
  exercise, autoDetect, userChangedExercise, weightKg, userInjuries, userProfile,
  file, videoHash, analysisStart, onProgress = () => {}, onPhase = () => {}, onExerciseDetected = () => {},
}) {
  const analysisTime = ((Date.now() - analysisStart) / 1000).toFixed(1);

  // ── Phase 5: Post-processing ──
  onPhase('analyzing');

  // Auto-calibration from first ~1 second of standing pose
  const calibFrameCount = Math.min(Math.ceil(analysisFps * 1), frames.length);
  if (calibFrameCount >= analysisFps * 0.5) {
    const calibLandmarks = frames.slice(0, calibFrameCount).map(f => f.landmarks);
    const calibration = computeCalibration(calibLandmarks, analysisFps);
    if (calibration && Math.abs(calibration.rotationAngle) > 0.05) {
      for (const f of frames) {
        f.landmarks = applyCalibration(f.landmarks, calibration);
        f.angles = extractJointAngles(f.landmarks);
      }
      for (const f of replayFrames) {
        f.landmarks = applyCalibration(f.landmarks, calibration);
      }
    }
  }

  // Landmark hash and confidence
  const landmarkHashValue = await hashLandmarks(frames.map(f => f.landmarks));
  let totalVis = 0, visCount = 0;
  for (const f of frames) {
    if (!f.landmarks) continue;
    for (const lm of f.landmarks) {
      if (lm.visibility != null) { totalVis += lm.visibility; visCount++; }
    }
  }
  const avgVisibility = visCount > 0 ? totalVis / visCount : 0;
  const confidenceLevel = avgVisibility > 0.7 ? 'high' : avgVisibility > 0.5 ? 'medium' : 'low';
  const confidence = { visibility: Math.round(avgVisibility * 100) / 100, level: confidenceLevel, framesWithPose: frames.length, totalFrames: frameCount };
  const debug = { videoHash, frameCount: frames.length, landmarkHash: landmarkHashValue, confidence };

  // ── Phase 6: Exercise detection and rep counting ──
  const isAutoMode = exercise === '__auto__';
  const initialExercise = isAutoMode ? 'squat' : exercise;
  let detectedExercise = initialExercise;
  let detectionConfidence = 1; // 1.0 when user manually selected
  let detectionLowConfidence = false;
  let candidateScores = []; // top detection candidates for diagnostics
  const interval = 1 / analysisFps;
  let repCounter = new RepCounter(initialExercise, { fps: analysisFps, userInjuries, mode: 'video', weightKg });
  let autoDetected = false;

  for (const f of frames) repCounter.update(f.landmarks, f.timestamp);

  if (isAutoMode || (autoDetect && !userChangedExercise)) {
    const tallies = {};
    const detector = new ExerciseAutoDetector({ fps: analysisFps });
    for (const f of frames) {
      const det = detector.update(f.landmarks);
      if (det) tallies[det] = (tallies[det] || 0) + 1;
    }
    const detectionInfo = detector.getDetectionInfo();
    detectionConfidence = detectionInfo.confidence;
    detectionLowConfidence = detectionInfo.isLowConfidence;

    const candidates = Object.keys(tallies);
    candidateScores = []; // top-3 candidates for diagnostics
    if (candidates.length > 0) {
      let bestEx = initialExercise;
      let bestScore = -1;
      for (const ex of candidates) {
        const rc = new RepCounter(ex, { fps: analysisFps, userInjuries, mode: 'video', weightKg });
        for (const f of frames) rc.update(f.landmarks, f.timestamp);
        rc.finalize();
        const reps = rc.repHistory ? rc.repHistory.length : 0;
        const hasChecks = EXERCISES[ex]?.formChecks?.length > 0 ? 500 : 0;
        const score = reps * 1000 + hasChecks + tallies[ex];
        candidateScores.push({ exercise: ex, score, reps, tally: tallies[ex] });
        if (score > bestScore) { bestScore = score; bestEx = ex; }
      }
      candidateScores.sort((a, b) => b.score - a.score);
      if (bestEx !== initialExercise || candidates.includes(initialExercise)) {
        detectedExercise = bestEx;
        autoDetected = true;
        onExerciseDetected(detectedExercise);
        repCounter = new RepCounter(detectedExercise, { fps: analysisFps, userInjuries, mode: 'video', weightKg });
        for (const f of frames) repCounter.update(f.landmarks, f.timestamp);
      }
    } else if (isAutoMode) {
      autoDetected = 'failed';
    }
  }

  repCounter.finalize();

  const enrichedRepHistory = repCounter.repHistory.map(r => ({
    ...r,
    startTime: (r.startFrame * interval),
    peakTime: ((r.peakFrame || r.bottomFrame) * interval),
    endTime: (r.endFrame * interval),
  }));

  const landmarkFrames = frames.map(f => f.landmarks);
  const repHistory = enrichedRepHistory;
  const reps = repHistory.length;

  // Input quality gate — runs AFTER detection + rep counting, BEFORE form scoring.
  // Flags insufficient footage so the UI can show a degraded result instead of
  // misleading grades derived from bad data.
  const frameTimestamps = enrichedRepHistory.length > 0
    ? frames.map(f => f.timestamp)
    : [];
  const videoDurationSec = frames.length > 0
    ? frames[frames.length - 1].timestamp - frames[0].timestamp
    : 0;
  const repCounterDiagnostics = repCounter.diagnostics || {};
  const qualityGate = runInputQualityGate({
    exercise: detectedExercise,
    reps,
    durationSec: videoDurationSec,
    detectionLowConfidence,
    frameTimestamps,
    fps: analysisFps,
    observedRange: repCounterDiagnostics.observedRange,
    medianRepAmplitude: repCounterDiagnostics.medianRepAmplitude,
  });

  // Halve detection confidence when plausibility fails — the primary signal
  // is suspect, so downstream consumers (form scoring, coach) should be cautious.
  if (!qualityGate.pass && detectionConfidence > 0) {
    detectionConfidence = detectionConfidence * 0.5;
    detectionLowConfidence = true;
  }

  // Biomechanical analysis — skip exercise-specific form checks when detection
  // is low-confidence to avoid unsafe coaching on a potentially wrong exercise.
  let bioAnalysis = null;
  const safeForFormChecks = !detectionLowConfidence && qualityGate.pass;
  try { bioAnalysis = analyzeSet(landmarkFrames, analysisFps, detectedExercise, repHistory, userProfile?.height); }
  catch (err) { console.error('Bio analysis error:', err); }

  // When detection confidence is low, strip exercise-specific form advice
  // (compensation patterns, ROM targets) — keep only universal metrics.
  if (bioAnalysis && !safeForFormChecks) {
    bioAnalysis = {
      ...bioAnalysis,
      compensationPatterns: [],
      formCheckResults: [],
      movementQuality: null,
      _lowConfidenceGated: true,
    };
  }

  // Coaching engine — SPARC smoothness, DTW consistency, fatigue, form detections
  let coaching = null;
  try { coaching = analyzeCoaching(landmarkFrames, repHistory, detectedExercise, analysisFps); }
  catch (err) { console.error('Coaching analysis error:', err); }

  // Release frames array: only replayFrames survives in the result.
  // This frees the duplicate angles data (~40% of frame memory).
  frames.length = 0;

  let report = null;
  try {
    report = generateWorkoutReport(userProfile, [{
      exerciseKey: detectedExercise, exercise: detectedExercise,
      reps, analysis: bioAnalysis, bioAnalysis, repHistory,
    }]);
  } catch (err) { console.error('Report error:', err); }

  const diagnostics = repCounter.diagnostics || null;
  const exerciseDef = EXERCISES[detectedExercise];
  const hasFormChecks = safeForFormChecks && exerciseDef?.formChecks?.length > 0;
  const scoredReps = repHistory.filter(r => r.score !== null && r.score !== undefined);
  const avgScore = !hasFormChecks ? null
    : scoredReps.length > 0
      ? Math.round(scoredReps.reduce((s, r) => s + r.score, 0) / scoredReps.length)
      : bioAnalysis?.movementQuality || 0;

  // Compute composite progression score (form 60% + consistency 20% + tempo 20%)
  // for every analysis, not just recalibration. This is the number that belongs
  // in the WorkoutHistory and VisionScoreHero, not the raw formScore average.
  let progressionScore = null;
  try {
    const formScores = repHistory.map(r => r.score).filter(s => s != null);
    const repVelocities = repHistory.map(r => r.velocity).filter(Boolean);
    if (formScores.length > 0 || reps > 0) {
      const ps = ProgressionScore.computeSet({
        formScores,
        repVelocities,
        reps,
        weightKg: weightKg || 0,
      });
      progressionScore = ps.score;
    }
  } catch (_) {}

  const w = weightKg;
  const workout = {
    date: new Date().toISOString(),
    exercise: detectedExercise,
    exerciseName: EXERCISES[detectedExercise]?.name || detectedExercise,
    reps, duration: Math.round(duration), formScore: avgScore,
    progressionScore,
    repHistory, weight: w, volume: w * reps, source: 'upload',
    avgRom: bioAnalysis?.rangeOfMotion?.avgDegrees || 0,
    machineReps: reps,
    machineFormScore: avgScore,
    bioAnalysis,
    coaching,
    analysisVersion: '1.0.0',
    fps: analysisFps,
    videoHash,
    landmarkHash: landmarkHashValue,
  };
  let workoutId = null;
  try { workoutId = await saveWorkout(workout); } catch (err) { console.error('Save error:', err); }

  // Progression comparison
  let progression = null;
  try {
    const prev = await getLastWorkoutForExercise(detectedExercise, workoutId);
    if (prev) {
      progression = { prevReps: prev.reps, prevScore: prev.formScore, prevRom: prev.avgRom || 0, prevWeight: prev.weight || 0, prevDate: prev.date };
    }
  } catch (_) {}

  // Baseline comparison
  let baselineComparison = null;
  try {
    await updateBaseline(detectedExercise, repHistory, avgScore);
    baselineComparison = await compareToBaseline(detectedExercise, avgScore, repHistory);
  } catch (_) {}

  onProgress(100);

  return {
    workoutId,
    fileName: file.name, exercise: detectedExercise,
    exerciseName: EXERCISES[detectedExercise]?.name || detectedExercise,
    reps, duration: Math.round(duration), analysisTime, formScore: avgScore,
    progressionScore,
    machineReps: reps, machineFormScore: avgScore,
    hasFormChecks,
    bioAnalysis, coaching, repHistory, progression, baselineComparison, report, diagnostics, confidence,
    frames: replayFrames,
    fps: analysisFps,
    autoDetected,
    detectionFailed: autoDetected === 'failed',
    detectionConfidence,
    detectionLowConfidence,
    detectionCandidates: candidateScores.slice(0, 3),
    insufficientFootage: qualityGate.insufficientFootage,
    qualityGateReasons: qualityGate.reasons,
    weight: w,
    debug,
    aborted: false,
  };
}

/**
 * Build a partial result when analysis is aborted mid-extraction.
 * Runs post-processing on whatever frames were collected.
 */
async function buildPartialResult({
  frames, replayFrames, analysisFps, exercise, autoDetect,
  userChangedExercise, weightKg, userInjuries, userProfile,
  file, videoHash, analysisStart, onExerciseDetected,
  aborted,
}) {
  if (frames.length === 0) {
    return { aborted: true, reps: 0, frames: [], exercise, fileName: file.name };
  }

  const duration = frames.length / analysisFps;
  const frameCount = frames.length;

  try {
    return await buildFullResult({
      frames, replayFrames, frameCount, duration, analysisFps,
      exercise, autoDetect, userChangedExercise, weightKg, userInjuries, userProfile,
      file, videoHash, analysisStart, onExerciseDetected,
    });
  } catch {
    // If post-processing fails on partial data, return minimal result
    return {
      aborted: true,
      fileName: file.name,
      exercise,
      reps: 0,
      frames: replayFrames,
      fps: analysisFps,
      duration: Math.round(duration),
    };
  }
}
