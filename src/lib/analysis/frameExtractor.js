/**
 * Frame extraction orchestration — worker pipeline and serial mode.
 *
 * Handles: memory-aware frame limits, iOS workarounds, worker-based
 * pipelined inference, serial main-thread inference fallback,
 * per-frame commit with live rep counting and progressive detection.
 */

import { extractJointAngles, detectPoseImage, selectSubjectPose } from '../poseAnalysis';
import { extractFramesStreaming } from '../frameExtractor';
import { RepCounter } from '../repCounter';
import { HierarchicalDetector } from '../hierarchicalDetector';
import { VideoSuitabilityDetector } from '../videoSuitability';
import {
  savePartialCheckpoint,
  loadPartialCheckpoint,
} from '../landmarkCache';

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const CHECKPOINT_INTERVAL = 50;

/**
 * Detect available device memory and return an appropriate frame limit.
 */
export function getMaxFrames() {
  const base = IS_IOS ? 300 : 600;
  try {
    const deviceGB = navigator.deviceMemory;
    if (deviceGB != null && deviceGB <= 2) return Math.min(base, 200);
    if (deviceGB != null && deviceGB <= 4) return Math.min(base, 400);

    const mem = performance.memory;
    if (mem) {
      const usedRatio = mem.usedJSHeapSize / mem.jsHeapSizeLimit;
      if (usedRatio > 0.6) return Math.min(base, 300);
    }
  } catch { /* memory APIs unavailable; use default */ }
  return base;
}

export { IS_IOS };

/**
 * Extract frames from a video file, running pose inference either via
 * worker pipeline or serial main-thread mode.
 *
 * Returns { frames, replayFrames, frameCount, duration, progressiveDetector }.
 */
export async function extractAndInferFrames({
  file,
  analysisFps,
  maxFrames,
  maxWidth,
  exercise,
  autoDetect,
  userChangedExercise,
  useWorker,
  worker,
  landmarker,
  cacheKey,
  effectiveSignal,
  onProgress,
  onLiveReps,
  onSuitability,
  onProgressiveUpdate,
  gymMode,
  detectorRef,
}) {
  const frames = [];
  const replayFrames = [];

  // Check for partial checkpoint to resume from
  let startFrame = 0;
  const partialCheckpoint = await loadPartialCheckpoint(cacheKey);
  if (partialCheckpoint && partialCheckpoint.landmarks && partialCheckpoint.lastFrame > 0) {
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
    onProgress(Math.round((startFrame / maxFrames) * 95));
  }

  const liveState = {
    repCounter: new RepCounter(exercise === '__auto__' ? 'squat' : exercise, { fps: analysisFps, mode: 'live' }),
    exercise: exercise === '__auto__' ? 'squat' : exercise,
    lastProgressiveUpdate: 0,
  };
  const progressiveDetector = (exercise === '__auto__' || (autoDetect && !userChangedExercise))
    ? new HierarchicalDetector({ fps: analysisFps, mode: gymMode, deterministic: true })
    : null;
  if (detectorRef && progressiveDetector) detectorRef.current = progressiveDetector;
  const PROGRESSIVE_INTERVAL = 50;
  let suitabilityChecked = false;

  const landmarksForCache = frames.map(f => f.landmarks);

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
  let frameCount = 0;
  let duration = 0;

  try {
    if (useWorker) {
      // ── Pipeline mode: overlap extraction and inference ──
      const MAX_CONCURRENT = 4;
      let inFlight = 0;
      const slotWaiters = [];
      const pendingInferences = [];

      const acquireSlot = () => {
        if (inFlight < MAX_CONCURRENT) { inFlight++; return Promise.resolve(); }
        return new Promise(r => slotWaiters.push(r));
      };
      const releaseSlot = () => {
        inFlight--;
        if (slotWaiters.length > 0) { inFlight++; slotWaiters.shift()(); }
      };

      const inferenceResults = new Map();
      let lastProcessedIdx = -1;

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
        maxFrames,
        maxWidth,
        async (canvas, frameIndex) => {
          const bitmap = await createImageBitmap(canvas);
          const deterministicTs = frameIndex * (1000 / analysisFps);

          await acquireSlot();

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
          onProgress(Math.round((streamFrameCount / maxFrames) * 95));
        },
        undefined,
        { signal: effectiveSignal, startFrame, deterministic: true },
      );

      await Promise.all(pendingInferences);
      drainOrderedResults();

      frameCount = streamResult.frameCount;
      duration = streamResult.duration;

    } else {
      // ── Serial mode: main-thread inference ──
      const streamResult = await extractFramesStreaming(
        file,
        analysisFps,
        maxFrames,
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
          onProgress(Math.round((streamFrameCount / maxFrames) * 95));
        },
        undefined,
        { signal: effectiveSignal, startFrame, deterministic: true },
      );

      frameCount = streamResult.frameCount;
      duration = streamResult.duration;
    }
  } catch (err) {
    // Save partial checkpoint before re-throwing
    if (err.name === 'AbortError' && landmarksForCache.length > 0) {
      await savePartialCheckpoint(cacheKey, landmarksForCache, streamFrameCount - 1).catch(() => {});
    }
    throw err;
  }

  return {
    frames,
    replayFrames,
    frameCount,
    duration,
    landmarksForCache,
    streamFrameCount,
    progressiveDetector,
  };
}
