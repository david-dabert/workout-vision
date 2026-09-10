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

import { getImageLandmarker, detectPoseImage, extractJointAngles, resetKalmanFilters, selectSubjectPose } from './poseAnalysis';
import { EXERCISES } from './exercises';
import { RepCounter } from './repCounter';
import { ExerciseAutoDetector } from './exerciseDetector';
import { analyzeSet } from './biomechanics';
import { generateWorkoutReport } from './coach';
import { saveWorkout, getLastWorkoutForExercise } from './storage';
import { extractFramesStreaming, hashFile, hashLandmarks } from './frameExtractor';
import { updateBaseline, compareToBaseline } from './formBaselines';
import { computeCalibration, applyCalibration } from './calibration';
import {
  getCachedLandmarks,
  setCachedLandmarks,
  savePartialCheckpoint,
  loadPartialCheckpoint,
  clearPartialCheckpoint,
} from './landmarkCache';

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const MAX_FRAMES = IS_IOS ? 300 : 600;
const CHECKPOINT_INTERVAL = 50; // Save partial checkpoint every N frames

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
  signal,
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
    const cacheKey = `lm-${videoHash}-${analysisFps}`;

    // ── Phase 2: Load model ──
    onPhase('model');
    checkAbort();
    resetKalmanFilters();
    const useWorker = worker.ready || (worker.supported && await worker.init().catch(() => false));
    if (useWorker) worker.reset();
    let landmarker = null;
    if (!useWorker) {
      landmarker = await getImageLandmarker();
      if (!landmarker) return null;
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

      const liveRepCounter = new RepCounter(exercise === '__auto__' ? 'squat' : exercise, { fps: analysisFps, mode: 'live' });
      let lockedSubjectIdx = null;
      let streamFrameCount = startFrame;
      const landmarksForCache = frames.map(f => f.landmarks);

      try {
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
            if (useWorker) {
              const workerResult = await worker.detect(canvas, deterministicTs, frameIndex);
              if (workerResult) {
                landmarks = workerResult.landmarks;
                angles = workerResult.angles;
                worldLandmarks = workerResult.worldLandmarks || null;
              }
            } else {
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
            }

            if (landmarks) {
              const time = frameIndex / analysisFps;
              if (!angles) angles = extractJointAngles(landmarks);
              const frameData = { landmarks, timestamp: time, angles };
              if (worldLandmarks) frameData.worldLandmarks = worldLandmarks;
              frames.push(frameData);
              replayFrames.push({ landmarks, timestamp: time });
              landmarksForCache.push(landmarks);

              const liveResult = liveRepCounter.update(landmarks, time);
              if (liveResult?.reps != null) {
                onLiveReps(liveResult.reps);
              }
            }

            streamFrameCount++;
            onProgress(Math.round((streamFrameCount / MAX_FRAMES) * 95));

            // Progressive checkpoint: save partial cache every N frames
            if (landmarksForCache.length > 0 && landmarksForCache.length % CHECKPOINT_INTERVAL === 0) {
              savePartialCheckpoint(cacheKey, landmarksForCache, streamFrameCount - 1).catch(() => {});
            }
          },
          undefined, // onProgress handled inside onFrame
          { signal, startFrame },
        );

        frameCount = streamResult.frameCount;
        duration = streamResult.duration;
      } catch (err) {
        if (err.name === 'AbortError') {
          // Save what we have as a partial checkpoint before returning
          if (landmarksForCache.length > 0) {
            await savePartialCheckpoint(cacheKey, landmarksForCache, streamFrameCount - 1).catch(() => {});
          }
          // Return partial results with aborted flag
          return buildPartialResult({
            frames, replayFrames, analysisFps, exercise, autoDetect,
            userChangedExercise, weightKg, userInjuries, userProfile,
            file, videoHash, analysisStart, onExerciseDetected,
            aborted: true,
          });
        }
        console.error('[analyzeVideo] Streaming extraction failed:', err);
        return null;
      }

      // Cache landmarks and clear partial checkpoint
      if (frames.length > 0) {
        const toCache = frames.map(f => f.landmarks);
        setCachedLandmarks(cacheKey, toCache).catch(() => {});
        clearPartialCheckpoint(cacheKey).catch(() => {});
      }
    }

    if (frames.length === 0) return null;

    return await buildFullResult({
      frames, replayFrames, frameCount, duration, analysisFps,
      exercise, autoDetect, userChangedExercise, weightKg, userInjuries, userProfile,
      file, videoHash, analysisStart, onProgress, onPhase, onExerciseDetected,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      // Aborted before extraction started; no partial results available
      return { aborted: true, reps: 0, frames: [], exercise };
    }
    throw err;
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
    const candidates = Object.keys(tallies);
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
        if (score > bestScore) { bestScore = score; bestEx = ex; }
      }
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

  // Biomechanical analysis
  let bioAnalysis = null;
  try { bioAnalysis = analyzeSet(landmarkFrames, analysisFps, detectedExercise, repHistory, userProfile?.height); }
  catch (err) { console.error('Bio analysis error:', err); }

  let report = null;
  try {
    report = generateWorkoutReport(userProfile, [{
      exerciseKey: detectedExercise, exercise: detectedExercise,
      reps, analysis: bioAnalysis, bioAnalysis, repHistory,
    }]);
  } catch (err) { console.error('Report error:', err); }

  const diagnostics = repCounter.diagnostics || null;
  const exerciseDef = EXERCISES[detectedExercise];
  const hasFormChecks = exerciseDef?.formChecks?.length > 0;
  const scoredReps = repHistory.filter(r => r.score !== null && r.score !== undefined);
  const avgScore = !hasFormChecks ? null
    : scoredReps.length > 0
      ? Math.round(scoredReps.reduce((s, r) => s + r.score, 0) / scoredReps.length)
      : bioAnalysis?.movementQuality || 0;

  const w = weightKg;
  const workout = {
    date: new Date().toISOString(),
    exercise: detectedExercise,
    exerciseName: EXERCISES[detectedExercise]?.name || detectedExercise,
    reps, duration: Math.round(duration), formScore: avgScore,
    repHistory, weight: w, volume: w * reps, source: 'upload',
    avgRom: bioAnalysis?.rangeOfMotion?.avgDegrees || 0,
    machineReps: reps,
    machineFormScore: avgScore,
    bioAnalysis,
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
    machineReps: reps, machineFormScore: avgScore,
    hasFormChecks,
    bioAnalysis, repHistory, progression, baselineComparison, report, diagnostics, confidence,
    frames: replayFrames,
    fps: analysisFps,
    autoDetected,
    detectionFailed: autoDetected === 'failed',
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
