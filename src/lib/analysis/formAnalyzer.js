/**
 * Form analysis — quality gate, biomechanical analysis, coaching,
 * scoring, report generation, baseline comparison, and result compilation.
 */

import { EXERCISES } from '../exercises';
import { ProgressionScore } from '../ProgressionScore';
import { analyzeSet } from '../biomechanics';
import { generateWorkoutReport } from '../coach';
import { analyzeCoaching } from '../coachingEngine';
import { saveWorkout, getLastWorkoutForExercise } from '../storage';
import { hashLandmarks } from '../frameExtractor';
import { extractJointAngles } from '../poseAnalysis';
import { updateBaseline, compareToBaseline } from '../formBaselines';
import { computeCalibration, applyCalibration } from '../calibration';
import { runInputQualityGate } from '../inputQualityGate';

/**
 * Apply auto-calibration from first ~1 second of standing pose.
 */
export function applyAutoCalibration(frames, replayFrames, analysisFps) {
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
}

/**
 * Compute confidence metrics from landmark visibility.
 */
export function computeConfidence(frames, frameCount) {
  let totalVis = 0, visCount = 0;
  for (const f of frames) {
    if (!f.landmarks) continue;
    for (const lm of f.landmarks) {
      if (lm.visibility != null) { totalVis += lm.visibility; visCount++; }
    }
  }
  const avgVisibility = visCount > 0 ? totalVis / visCount : 0;
  const confidenceLevel = avgVisibility > 0.7 ? 'high' : avgVisibility > 0.5 ? 'medium' : 'low';
  return {
    visibility: Math.round(avgVisibility * 100) / 100,
    level: confidenceLevel,
    framesWithPose: frames.length,
    totalFrames: frameCount,
  };
}

/**
 * Run the input quality gate and adjust detection confidence if needed.
 */
export function runQualityGate({
  detectedExercise,
  reps,
  frames,
  frameCount,
  detectionLowConfidence,
  enrichedRepHistory,
  analysisFps,
  repCounterDiagnostics,
}) {
  const frameTimestamps = enrichedRepHistory.length > 0
    ? frames.map(f => f.timestamp)
    : [];
  const videoDurationSec = frames.length > 0
    ? frames[frames.length - 1].timestamp - frames[0].timestamp
    : 0;
  const poseDetectionRate = frameCount > 0 ? frames.length / frameCount : 0;

  return runInputQualityGate({
    exercise: detectedExercise,
    reps,
    durationSec: videoDurationSec,
    detectionLowConfidence,
    frameTimestamps,
    fps: analysisFps,
    observedRange: repCounterDiagnostics.observedRange,
    medianRepAmplitude: repCounterDiagnostics.medianRepAmplitude,
    poseDetectionRate,
  });
}

/**
 * Run biomechanical analysis, coaching, scoring, and report generation.
 * Returns the full result object.
 */
export async function compileResults({
  frames,
  replayFrames,
  frameCount,
  duration,
  analysisFps,
  detectedExercise,
  autoDetected,
  detectionConfidence,
  detectionLowConfidence,
  candidateScores,
  repHistory,
  reps,
  repCounterDiagnostics,
  weightKg,
  userInjuries,
  userProfile,
  file,
  videoHash,
  analysisStart,
  onProgress,
}) {
  const analysisTime = ((Date.now() - analysisStart) / 1000).toFixed(1);

  // Auto-calibration
  applyAutoCalibration(frames, replayFrames, analysisFps);

  // Landmark hash and confidence
  const landmarkHashValue = await hashLandmarks(frames.map(f => f.landmarks));
  const confidence = computeConfidence(frames, frameCount);
  const debug = { videoHash, frameCount: frames.length, landmarkHash: landmarkHashValue, confidence };

  // Quality gate
  const qualityGate = runQualityGate({
    detectedExercise,
    reps,
    frames,
    frameCount,
    detectionLowConfidence,
    enrichedRepHistory: repHistory,
    analysisFps,
    repCounterDiagnostics,
  });

  // Adjust detection confidence based on quality gate
  let adjustedDetectionConfidence = detectionConfidence;
  let adjustedDetectionLowConfidence = detectionLowConfidence;
  if (!qualityGate.pass && adjustedDetectionConfidence > 0) {
    adjustedDetectionConfidence = adjustedDetectionConfidence * 0.5;
    adjustedDetectionLowConfidence = true;
  }

  const landmarkFrames = frames.map(f => f.landmarks);
  const safeForFormChecks = !adjustedDetectionLowConfidence && qualityGate.pass;

  // Biomechanical analysis
  let bioAnalysis = null;
  try { bioAnalysis = analyzeSet(landmarkFrames, analysisFps, detectedExercise, repHistory, userProfile?.height); }
  catch (err) { console.error('Bio analysis error:', err); }

  if (bioAnalysis && !safeForFormChecks) {
    bioAnalysis = {
      ...bioAnalysis,
      compensationPatterns: [],
      formCheckResults: [],
      movementQuality: null,
      _lowConfidenceGated: true,
    };
  }

  // Coaching engine
  let coaching = null;
  try { coaching = analyzeCoaching(landmarkFrames, repHistory, detectedExercise, analysisFps); }
  catch (err) { console.error('Coaching analysis error:', err); }

  // Release frames array: only replayFrames survives in the result
  frames.length = 0;

  // Report generation
  let report = null;
  try {
    report = generateWorkoutReport(userProfile, [{
      exerciseKey: detectedExercise, exercise: detectedExercise,
      reps, analysis: bioAnalysis, bioAnalysis, repHistory,
    }]);
  } catch (err) { console.error('Report error:', err); }

  const diagnostics = repCounterDiagnostics || null;
  const exerciseDef = EXERCISES[detectedExercise];
  const hasFormChecks = safeForFormChecks && exerciseDef?.formChecks?.length > 0;
  const scoredReps = repHistory.filter(r => r.score !== null && r.score !== undefined);
  const avgScore = !hasFormChecks ? null
    : scoredReps.length > 0
      ? Math.round(scoredReps.reduce((s, r) => s + r.score, 0) / scoredReps.length)
      : bioAnalysis?.movementQuality || 0;

  // Progression score
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

  if (onProgress) onProgress(100);

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
    detectionConfidence: adjustedDetectionConfidence,
    detectionLowConfidence: adjustedDetectionLowConfidence,
    detectionCandidates: candidateScores.slice(0, 3),
    insufficientFootage: qualityGate.insufficientFootage,
    hardRefuse: qualityGate.hardRefuse,
    qualityGateReasons: qualityGate.reasons,
    weight: w,
    debug,
    aborted: false,
  };
}
