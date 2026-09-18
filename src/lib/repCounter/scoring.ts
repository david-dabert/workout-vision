/**
 * Form evaluation functions extracted from RepCounter.
 *
 * Pure functions for:
 * - Trunk swing detection on isolation exercises
 * - Building form history from cycle boundaries (video mode)
 * - Live rep form evaluation
 * - Real-time form feedback
 */

import type {
  LandmarkArray,
  JointAngles,
  RepHistoryEntry,
  FormResultEntry,
  FormFeedbackItem,
} from '../types';
import type { Exercise, Cycle } from './types';
import { extractJointAngles } from '../poseAnalysis';
import { shouldSkipCheck } from '../injuries';
import { detectViewpointFromFrames } from '../cameraViewpoint';
import { AnthropometricNormalizer } from '../AnthropometricNormalizer';

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

export function isTrunkSwingCheck(fc: Exercise, exercise: Exercise): boolean {
  const swingNames = /swing|momentum|strict|upright.*torso|no.*lean|stable.*torso|body.*sway/i;
  const isIsolation = exercise.category === 'isolation';
  const nameMatches = swingNames.test(fc.name);
  // Also check the "bad" text for swing-related language
  const badMatches = fc.bad && /swing|momentum|lean|sway|upright/i.test(fc.bad);
  // Only convert for isolation exercises where the check name or bad text indicates trunk sway
  return isIsolation && (nameMatches || badMatches);
}

// ─── Build form history from cycle boundaries (video mode) ───

export function buildFormHistoryFromCycles(
  cycles: Cycle[],
  landmarks: LandmarkArray[],
  exercise: Exercise,
  exerciseKey: string,
  fps: number,
  userInjuries: string[],
  anthropometricNormalizer: AnthropometricNormalizer,
): RepHistoryEntry[] {
  if (cycles.length === 0) return [];

  const lm = landmarks;
  const N = lm.length;
  const checks = exercise.formChecks || [];
  const history: RepHistoryEntry[] = [];

  // Detect camera viewpoint once from a sample of frames.
  // Form checks tagged with viewpoint: 'frontal' (e.g. knee valgus,
  // symmetry) only work from a front-facing camera. From a side view
  // they fire false positives because x-coordinates overlap.
  const hasViewpointChecks = checks.some((fc: Exercise) => fc.viewpoint && fc.viewpoint !== 'any');
  let detectedViewpoint = 'unknown';
  if (hasViewpointChecks) {
    // Sample up to 20 evenly-spaced frames for viewpoint detection
    const sampleCount = Math.min(20, N);
    const step = Math.max(1, Math.floor(N / sampleCount));
    const sampleFrames: LandmarkArray[] = [];
    for (let i = 0; i < N; i += step) {
      if (lm[i]) sampleFrames.push(lm[i]);
    }
    const vpResult = detectViewpointFromFrames(sampleFrames);
    detectedViewpoint = vpResult.angle; // 'front', 'side', 'rear', 'unknown'
  }

  for (let r = 0; r < cycles.length; r++) {
    const cycle = cycles[r];
    const startFrame = cycle.start;
    const endFrame = Math.min(cycle.end, N - 1);
    const midFrame = Math.round((startFrame + endFrame) / 2);

    let score: number | null = null;
    const issues: string[] = [];
    let formResults: FormResultEntry[] | null = null;

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
      const cycleTrunkAngles: number[] = [];
      for (let i = startFrame; i <= endFrame && i < N; i += sampleStep) {
        const frameLm = lm[i];
        if (!frameLm) continue;
        const a = extractJointAngles(frameLm);
        if (a && a.trunk != null) cycleTrunkAngles.push(a.trunk);
      }
      const trunkSwing = cycleTrunkAngles.length > 2
        ? Math.max(...cycleTrunkAngles) - Math.min(...cycleTrunkAngles)
        : 0;

      formResults = checks.map((fc: Exercise) => {
        if (shouldSkipCheck(fc.name, userInjuries)) {
          return { name: fc.name, passed: true, quality: 1, bad: fc.bad, severity: 'minor', skipped: true };
        }

        // Skip form checks whose required viewpoint doesn't match the detected
        // camera angle. 'frontal' checks require 'front' viewpoint; 'sagittal'
        // checks require 'side'. Checks without viewpoint (or 'any') always run.
        // When viewpoint is 'unknown' or 'rear', frontal checks are also skipped
        // to avoid false positives.
        if (fc.viewpoint && fc.viewpoint !== 'any') {
          const viewpointMatch =
            (fc.viewpoint === 'frontal' && detectedViewpoint === 'front') ||
            (fc.viewpoint === 'sagittal' && detectedViewpoint === 'side');
          if (!viewpointMatch) {
            return { name: fc.name, passed: true, quality: 1, bad: fc.bad, severity: fc.severity || 'minor', skipped: true, skippedReason: 'viewpoint' };
          }
        }

        // Detect trunk-swing checks on isolation exercises. These checks use
        // angles.trunk < N where N <= 25. Convert to relative swing measurement
        // so seated/incline positions don't produce false failures.
        if (isTrunkSwingCheck(fc, exercise)) {
          // Trunk swing < 15 deg within the cycle = good form
          const swingLimit = 15;
          const quality = trunkSwing <= swingLimit ? 1.0
            : Math.max(0, 1 - (trunkSwing - swingLimit) / 20);
          const passed = quality >= 0.70;
          return { name: fc.name, passed, quality: Math.round(quality * 100) / 100, bad: fc.bad, severity: fc.severity };
        }

        // Phase-aware frame selection: checks with phase='bottom' evaluate
        // near the valley (mid-cycle), phase='top' near the peaks (start/end).
        // Without phase, evaluate all frames (original behaviour).
        let evalStart = startFrame;
        let evalEnd = endFrame;
        const cycleLen = endFrame - startFrame;
        if (fc.phase === 'bottom') {
          // Evaluate the middle 40% of the cycle (where contraction/valley occurs)
          const margin = Math.max(1, Math.round(cycleLen * 0.3));
          evalStart = startFrame + margin;
          evalEnd = endFrame - margin;
        } else if (fc.phase === 'top') {
          // Evaluate the outer 30% at each end (where extension/peak occurs)
          const margin = Math.max(1, Math.round(cycleLen * 0.3));
          evalStart = startFrame;
          evalEnd = startFrame + margin;
          // We'll also sample the end zone below
        }

        let failCount = 0, sampleCount = 0;
        let qualitySum = 0;
        const hasQualityFn = typeof fc.quality === 'function';

        for (let i = evalStart; i <= Math.min(evalEnd, N - 1); i += sampleStep) {
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
        // For 'top' phase, also sample frames near the end of the cycle
        if (fc.phase === 'top') {
          const tailStart = endFrame - Math.max(1, Math.round(cycleLen * 0.3));
          for (let i = Math.max(tailStart, evalEnd + 1); i <= Math.min(endFrame, N - 1); i += sampleStep) {
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
        }

        const failRate = sampleCount > 0 ? failCount / sampleCount : 0;
        // Continuous quality: use explicit quality function if available, else derive from failRate
        const quality = sampleCount > 0
          ? (hasQualityFn ? qualitySum / sampleCount : 1 - failRate)
          : 0;
        let passed = quality >= 0.70;

        // Apply anthropometric normalization: adjust quality threshold based on body proportions
        if (!passed && anthropometricNormalizer.isCalibrated) {
          // Map form check names to normalizer check names
          const checkMap: Record<string, string> = {
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
            const adjustedThreshold = anthropometricNormalizer.normalizeThreshold(
              exerciseKey, normCheckName, 70
            );
            passed = quality >= (adjustedThreshold / 100);
          }
        }

        return { name: fc.name, passed, quality: Math.round(quality * 100) / 100, bad: fc.bad, severity: fc.severity };
      });

      // Weighted quality score: major checks count 2x, minor 1x.
      // Skipped checks (injury exclusions, viewpoint mismatches) are excluded
      // entirely — they must NOT inflate the score by contributing quality=1.
      const activeResults = formResults!.filter((f: FormResultEntry) => !f.skipped);
      const totalWeight = activeResults.reduce((sum: number, f: FormResultEntry) => sum + (f.severity === 'major' ? 2 : 1), 0);
      const weightedQuality = activeResults.reduce((sum: number, f: FormResultEntry) => sum + f.quality * (f.severity === 'major' ? 2 : 1), 0);
      score = totalWeight > 0 ? Math.round((weightedQuality / totalWeight) * 100) : null;
      for (const f of formResults!) {
        if (!f.passed) issues.push(f.bad || '');
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
      startTime: startFrame / fps,
      endTime: endFrame / fps,
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

// ─── Live rep form evaluation ───

export function evaluateLiveRep(
  cycleAngles: JointAngles[],
  cycleLandmarks: LandmarkArray[],
  fallbackAngles: JointAngles,
  fallbackLandmarks: LandmarkArray,
  exercise: Exercise,
): { score: number | null; issues: string[]; formResults: FormResultEntry[] } {
  const angles = cycleAngles.length > 0 ? cycleAngles : [fallbackAngles];
  const landmarks = cycleLandmarks.length > 0 ? cycleLandmarks : [fallbackLandmarks];
  const sampleStep = 1;

  // Pre-collect trunk angles for relative-swing detection (same logic as video mode)
  const liveTrunkAngles: number[] = [];
  for (let i = 0; i < angles.length; i += sampleStep) {
    const a = angles[i];
    if (a && a.trunk != null) liveTrunkAngles.push(a.trunk);
  }
  const liveTrunkSwing = liveTrunkAngles.length > 2
    ? Math.max(...liveTrunkAngles) - Math.min(...liveTrunkAngles)
    : 0;

  // Detect viewpoint from cycle landmarks for live-mode viewpoint filtering
  const hasViewpointChecks = exercise.formChecks.some((fc: Exercise) => fc.viewpoint && fc.viewpoint !== 'any');
  let liveViewpoint = 'unknown';
  if (hasViewpointChecks) {
    const vpResult = detectViewpointFromFrames(landmarks);
    liveViewpoint = vpResult.angle;
  }

  const formResults: FormResultEntry[] = exercise.formChecks.map((fc: Exercise) => {
    // Skip form checks whose required viewpoint doesn't match (same as video mode)
    if (fc.viewpoint && fc.viewpoint !== 'any') {
      const viewpointMatch =
        (fc.viewpoint === 'frontal' && liveViewpoint === 'front') ||
        (fc.viewpoint === 'sagittal' && liveViewpoint === 'side');
      if (!viewpointMatch) {
        return { name: fc.name, passed: true, quality: 1, bad: fc.bad, severity: fc.severity || 'minor', skipped: true, skippedReason: 'viewpoint' };
      }
    }

    // Relative trunk-swing check for isolation exercises (same as video mode)
    if (isTrunkSwingCheck(fc, exercise)) {
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

    for (let i = 0; i < angles.length; i += sampleStep) {
      const a = angles[i];
      const frameLm = landmarks[i];
      if (!a) continue;
      sampleCount++;
      if (!fc.check(a, frameLm)) failCount++;
      if (hasQualityFn) qualitySum += fc.quality(a, frameLm);
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
  const issues = formResults.filter(f => !f.passed).map(f => f.bad || '');

  return { score, issues, formResults };
}

// ─── Real-time form feedback ───

export function evaluateFormFeedback(
  angles: JointAngles,
  landmarks: LandmarkArray,
  exercise: Exercise,
  anthropometricNormalizer: AnthropometricNormalizer,
): FormFeedbackItem[] {
  return exercise.formChecks.map((fc: Exercise) => {
    let passed: boolean = fc.check(angles, landmarks);

    if (!passed && anthropometricNormalizer.isCalibrated) {
      const bodyType = anthropometricNormalizer.getBodyType();
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
