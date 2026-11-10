/**
 * WorkoutVision Movement Optimization & Kinematic Hypertrophy Engine
 *
 * Evaluates real-time and post-set biomechanical execution:
 * 1. Range of Motion (ROM) Score: % of target stretch achieved based on joint angle thresholds.
 * 2. Control & Tempo Index: ratio of controlled eccentric duration vs. explosive momentum.
 * 3. Form Quality Badges: e.g. "Full Stretch Achieved", "Momentum Detected - Control the Descent".
 * 4. Post-Set Coaching Summary: 2–3 actionable points for maximum hypertrophic stimulus.
 */

import { RepDetail, liftDefinition } from '../counting/core';
import { decodeBiomechanicalPhases } from '../counting/BiomechanicalDecoder';
import { getExercise, getKinematicArchetype, KinematicArchetype } from '../exercises/index';
import { alignKineticTrajectory, getCanonicalTemplate } from '../counting/KineticForcedAligner';
import { synchronizeRepetitionsWithAudio } from '../counting/AudioKinematicSync';
import { analyzeMorphology, MorphologyProfile } from '../biomechanics/morphologyRetargeting';
import { KinematicFootLocker, Landmark3D } from '../biomechanics/kinematicFootLocking';
import { exportToBVH } from '../biomechanics/bvhExport';
import { resolveKinematicAlias, KinematicMachineProfile } from '../biomechanics/kinematicAliasing';
import { analyzeSetHypertrophy, SetHypertrophyReport, TrajectorySample } from '../biomechanics/hypertrophyDiagnostics';
import {
  getOptimalExecutionBlueprint,
  generateCoachPrescription,
  OptimalExecutionBlueprint,
  CoachPrescription,
  SetExecutionTelemetry,
} from './optimalExecution';
import {
  calculateIntraSetVelocityLoss,
  detectSetStickingPoints,
  VelocityLossTelemetry,
} from '../biomechanics/stickingPoint';

export interface RepVelocityProfile {
  repIndex: number;
  durationSec: number;
  concentricSec: number;
  eccentricSec: number;
  romDegrees: number;
  velocityLossPercent?: number | null;
  tier?: 'speed' | 'optimal_hypertrophy' | 'failure' | null;
  powerWatts?: number | null;
}

export interface StickingPointMarker {
  repIndex: number;
  timestamp: number;
  angleDeg: number;
  velocityDropPercent: number;
  severity: 'mild' | 'moderate' | 'severe';
}

export interface LumbarKineticsSummary {
  peakCompressiveForceN: number;
  peakShearForceN: number;
  peakReactionTorqueNm: number;
  safetyTier: 'optimal' | 'moderate' | 'high_shear_risk';
  advice: { fr: string; en: string };
}

export interface MovementOptimizationResult {
  romScore: number;            // 0 - 100 %
  controlIndex: number;        // 0 - 100 %
  averageRomDeg: number;       // degrees
  averageEccentricSec: number; // seconds
  averageConcentricSec: number;// seconds
  velocityLossPercent?: number | null;
  fatigueTier?: 'speed' | 'optimal_hypertrophy' | 'failure' | null;
  velocityLoss?: VelocityLossTelemetry | null;
  mechanicalWorkKj?: number | null;
  caloriesKcal?: number | null;
  averagePowerWatts?: number | null;
  peakPowerWatts?: number | null;
  powerLossPercent?: number | null;
  timeUnderTensionSec: number; // seconds
  tempoCadence: string;        // e.g. "2-0-1"
  repVelocityProfiles: RepVelocityProfile[];
  formBadge: FormBadge;
  coachingPoints: string[];
  stickingPoints?: StickingPointMarker[];
  stickingPointSummary?: string | null;
  formDistortionScore?: number | null;
  pathEfficiencyPercent?: number | null;
  sagittalDriftPercent?: number | null;
  audioSyncConfidence?: number | null;
  lumbarKinetics?: LumbarKineticsSummary | null;
  morphology?: MorphologyProfile | null;
  groundStabilityScore?: number | null;
  bvhData?: string | null;
  hypertrophyReport?: SetHypertrophyReport;
  machineProfile?: KinematicMachineProfile;
  optimalBlueprint?: OptimalExecutionBlueprint;
  coachPrescription?: CoachPrescription;
}

export interface FormBadge {
  id: 'OPTIMAL_STRETCH' | 'CONTROLLED_TEMPO' | 'MOMENTUM_DETECTED' | 'PARTIAL_RANGE' | 'GOOD_FORM' | 'VELOCITY_LOSS';
  label: string;
  labelFr: string;
  severity: 'positive' | 'warning' | 'neutral';
}

// Reference optimal range of motion thresholds (degrees) by kinematic archetype
const ARCHETYPE_ROM_TARGETS: Record<KinematicArchetype, number> = {
  squat: 85,      // knee flexion range (85°+ indicates deep parallel/sub-parallel squat)
  hinge: 70,      // hip hinge range (70°+ indicates deep hamstring stretch)
  push: 75,       // elbow excursion on presses/dips
  pull: 80,       // elbow excursion on pulldowns/pull-ups/rows
  isolation: 80,  // curl, pushdown, lateral raise excursion
};

// Target eccentric time (seconds) for controlled hypertrophic tempo
const TARGET_ECCENTRIC_SEC = 2.0;
const MIN_CONTROLLED_ECCENTRIC_SEC = 1.0;

/**
 * Computes movement optimization metrics and actionable hypertrophy coaching summary.
 */
export function analyzeMovementOptimization(
  reps: RepDetail[] = [],
  lift = 'squat',
  fr = false
): MovementOptimizationResult {
  const wholeReps = (reps || []).filter(r => !r.clipped && (r.romDegrees || 0) > 0);
  const archetype = getKinematicArchetype(lift);
  const targetRom = ARCHETYPE_ROM_TARGETS[archetype] || 80;

  if (wholeReps.length === 0) {
    return {
      romScore: 0,
      controlIndex: 0,
      averageRomDeg: 0,
      averageEccentricSec: 0,
      averageConcentricSec: 0,
      velocityLossPercent: null,
      fatigueTier: null,
      mechanicalWorkKj: null,
      caloriesKcal: null,
      averagePowerWatts: null,
      peakPowerWatts: null,
      powerLossPercent: null,
      timeUnderTensionSec: 0,
      tempoCadence: '0-0-0',
      repVelocityProfiles: [],
      formBadge: {
        id: 'GOOD_FORM',
        label: 'Awaiting Reps',
        labelFr: 'En attente de répétitions',
        severity: 'neutral',
      },
      coachingPoints: fr
        ? ['Effectuez vos répétitions pour afficher l’analyse biomécanique.']
        : ['Perform your reps to display biomechanical feedback.'],
      stickingPoints: [],
    };
  }

  // Calculate average ROM and average phase times
  const totalRom = wholeReps.reduce((sum, r) => sum + (r.romDegrees || 0), 0);
  const avgRom = totalRom / wholeReps.length;

  const validTimed = wholeReps.filter(r => (r.eccentricSec || 0) > 0 && (r.concentricSec || 0) > 0);
  const avgEccentric = validTimed.length
    ? validTimed.reduce((sum, r) => sum + r.eccentricSec!, 0) / validTimed.length
    : 1.5;
  const avgConcentric = validTimed.length
    ? validTimed.reduce((sum, r) => sum + r.concentricSec!, 0) / validTimed.length
    : 1.0;

  // 1. ROM Score (0 - 100%)
  const rawRomRatio = avgRom / targetRom;
  const romScore = Math.min(100, Math.round(rawRomRatio * 100));

  // 2. Control & Tempo Index (0 - 100%)
  // Rewards controlled eccentric (1.5 - 3.0s), penalizes dropping load (<1.0s)
  let controlScore = 75;
  if (avgEccentric >= TARGET_ECCENTRIC_SEC) {
    controlScore = Math.min(100, Math.round(85 + (avgEccentric - TARGET_ECCENTRIC_SEC) * 10));
  } else if (avgEccentric < MIN_CONTROLLED_ECCENTRIC_SEC) {
    controlScore = Math.max(20, Math.round((avgEccentric / MIN_CONTROLLED_ECCENTRIC_SEC) * 50));
  } else {
    // Between 1.0s and 2.0s
    controlScore = Math.round(50 + ((avgEccentric - MIN_CONTROLLED_ECCENTRIC_SEC) / (TARGET_ECCENTRIC_SEC - MIN_CONTROLLED_ECCENTRIC_SEC)) * 35);
  }

  // 3. Construct rep profile for each whole rep (genuinely measured timings & degrees only)
  const repVelocityProfiles: RepVelocityProfile[] = wholeReps.map((r, idx) => {
    const durationSec = Math.round(((r.endTime || 0) - (r.startTime || 0)) * 100) / 100;
    const conc = Math.round((r.concentricSec || 0) * 100) / 100;
    const ecc = Math.round((r.eccentricSec || 0) * 100) / 100;
    const rom = Math.round((r.romDegrees || 0) * 10) / 10;
    return {
      repIndex: idx + 1,
      durationSec,
      concentricSec: conc,
      eccentricSec: ecc,
      romDegrees: rom,
      velocityLossPercent: null,
      tier: null,
      powerWatts: null,
    };
  });

  // 4. Time Under Tension (TUT) and Tempo Cadence
  const tutSum = wholeReps.reduce((sum, r) => sum + Math.max(0, (r.endTime || 0) - (r.startTime || 0)), 0);
  const timeUnderTensionSec = tutSum > 0
    ? Math.round(tutSum * 10) / 10
    : Math.round(validTimed.reduce((sum, r) => sum + (r.eccentricSec || 0) + (r.concentricSec || 0), 0) * 10) / 10;

  const tempoCadence = `${Math.max(1, Math.round(avgEccentric))}-0-${Math.max(1, Math.round(avgConcentric))}`;

  // 5. Determine Form Quality Badge
  let formBadge: FormBadge;
  if (avgEccentric < MIN_CONTROLLED_ECCENTRIC_SEC) {
    formBadge = {
      id: 'MOMENTUM_DETECTED',
      label: 'Momentum Detected - Control the Descent',
      labelFr: 'Élan détecté\u00A0: contrôlez la descente',
      severity: 'warning',
    };
  } else if (romScore < 75) {
    formBadge = {
      id: 'PARTIAL_RANGE',
      label: 'Incomplete Stretch',
      labelFr: 'Amplitude partielle',
      severity: 'warning',
    };
  } else if (romScore >= 92 && controlScore >= 70) {
    formBadge = {
      id: 'OPTIMAL_STRETCH',
      label: 'Full Stretch Achieved',
      labelFr: 'Étirement complet validé',
      severity: 'positive',
    };
  } else if (controlScore >= 80) {
    formBadge = {
      id: 'CONTROLLED_TEMPO',
      label: 'Controlled Tempo',
      labelFr: 'Tempo maîtrisé',
      severity: 'positive',
    };
  } else {
    formBadge = {
      id: 'GOOD_FORM',
      label: 'Good Execution',
      labelFr: 'Bonne exécution',
      severity: 'neutral',
    };
  }

  // 6. Construct Actionable Hypertrophy Coaching Points
  const coachingPoints: string[] = [];
  const exercise = getExercise(lift);

  // Point 1: Range of motion and muscle stretch tension
  if (romScore >= 90) {
    coachingPoints.push(
      fr
        ? `Excellente amplitude (${Math.round(avgRom)}°)\u00A0: le muscle a atteint son étirement maximal, stimulant la tension mécanique passive.`
        : `Excellent range of motion (${Math.round(avgRom)}°): targeted muscles reached full stretch excursion for optimal passive mechanical tension.`
    );
  } else {
    coachingPoints.push(
      fr
        ? `Amplitude mesurée à ${Math.round(avgRom)}° (cible\u00A0: ${targetRom}°). Descendez de quelques degrés supplémentaires pour charger le muscle en position étirée.`
        : `Measured range was ${Math.round(avgRom)}° (target: ${targetRom}°). Reach deeper into the stretch to load muscles at longer muscle lengths.`
    );
  }

  // Point 2: Eccentric phase tempo control
  if (avgEccentric >= 1.8) {
    coachingPoints.push(
      fr
        ? `Phase excentrique de ${avgEccentric.toFixed(1)}s bien contrôlée\u00A0: suppression totale de l'élan et tension mécanique continue.`
        : `Controlled ${avgEccentric.toFixed(1)}s eccentric phase: total elimination of momentum and sustained mechanical tension.`
    );
  } else {
    coachingPoints.push(
      fr
        ? `Descente rapide (${avgEccentric.toFixed(1)}s). Ralentissez la descente sur 2 à 3 secondes pour éliminer les rebonds articulaires et maximiser le recrutement moteur.`
        : `Fast lowering phase (${avgEccentric.toFixed(1)}s). Slow down the descent to 2–3 seconds to eliminate momentum bouncing and maximize motor unit recruitment.`
    );
  }

  // Point 3: Specific exercise biomechanical cue (from exercise catalog or archetype default)
  if (exercise && exercise.hypertrophy_tips_en.length > 0) {
    const tip = fr ? exercise.hypertrophy_tips_fr[0] : exercise.hypertrophy_tips_en[0];
    if (tip) coachingPoints.push(tip);
  } else {
    // Archetype general cue
    const genericCue = fr
      ? (archetype === 'squat' ? 'Gardez les genoux alignés avec les orteils et poussez à travers le milieu du pied.'
        : archetype === 'hinge' ? 'Reculez les hanches sans arrondir les lombaires pour isoler les ischio-jambiers.'
        : archetype === 'push' ? 'Maintenez les omoplates stables et les coudes à angle naturel.'
        : archetype === 'pull' ? 'Initiez le tirage par l’abaissement des omoplates avant de fléchir les coudes.'
        : 'Isolez le muscle cible sans balancer le buste.')
      : (archetype === 'squat' ? 'Keep knees tracking over toes and drive through mid-foot.'
        : archetype === 'hinge' ? 'Hinge hips backward without lumbar flexion to isolate hamstrings.'
        : archetype === 'push' ? 'Maintain packed scapulae and a natural 45–70° elbow tuck.'
        : archetype === 'pull' ? 'Initiate pull by depressing shoulder blades before flexing elbows.'
        : 'Isolate target muscles without torso swaying.');
    coachingPoints.push(genericCue);
  }

  // Point 7: Machine Aliasing & Hypertrophy Diagnostics
  const machineProfile = resolveKinematicAlias(lift);
  const repSamples = wholeReps.map(r => {
    const startMs = (r.startTime || 0) * 1000;
    const endMs = (r.endTime || 0) * 1000;
    const eccMs = (r.eccentricSec || 1.5) * 1000;
    const peakRom = r.romDegrees || avgRom;
    const restAngle = machineProfile.restPosition === 'high' ? 165 : 45;
    const bottomAngle = machineProfile.restPosition === 'high' ? Math.max(50, 165 - peakRom) : Math.min(170, 45 + peakRom);

    const samples: TrajectorySample[] = [
      { timestampMs: startMs, jointAngle: restAngle },
      { timestampMs: startMs + eccMs * 0.5, jointAngle: (restAngle + bottomAngle) / 2 },
      { timestampMs: startMs + eccMs, jointAngle: bottomAngle },
      { timestampMs: startMs + eccMs + 100, jointAngle: bottomAngle },
      { timestampMs: startMs + eccMs + (endMs - (startMs + eccMs)) * 0.5, jointAngle: (restAngle + bottomAngle) / 2 },
      { timestampMs: endMs, jointAngle: restAngle },
    ];
    return { samples };
  });

  const hypertrophyReport = analyzeSetHypertrophy(repSamples, machineProfile);
  if (hypertrophyReport.bounceCount > 0 && coachingPoints.length < 3) {
    coachingPoints.push(fr ? hypertrophyReport.primaryCoachingTakeawayFr : hypertrophyReport.primaryCoachingTakeawayEn);
  }

  // Point 8: Optimal Execution Blueprint & Coach Prescription Engine
  const optimalBlueprint = getOptimalExecutionBlueprint(lift);
  const minAngleDeg = machineProfile.restPosition === 'high' ? Math.max(45, 165 - avgRom) : undefined;
  const maxAngleDeg = machineProfile.restPosition === 'low' ? Math.min(170, 45 + avgRom) : undefined;

  const setTelemetry: SetExecutionTelemetry = {
    avgRomDeg: avgRom,
    minAngleDeg,
    maxAngleDeg,
    avgEccentricSec: avgEccentric,
    bounceCount: hypertrophyReport.bounceCount,
    continuousTensionPercent: hypertrophyReport.continuousTensionPercentage,
  };

  const coachPrescription = generateCoachPrescription(setTelemetry, lift, fr);
  const velocityLoss = calculateIntraSetVelocityLoss(wholeReps);

  return {
    romScore,
    controlIndex: controlScore,
    averageRomDeg: Math.round(avgRom * 10) / 10,
    averageEccentricSec: Math.round(avgEccentric * 10) / 10,
    averageConcentricSec: Math.round(avgConcentric * 10) / 10,
    velocityLossPercent: null,
    fatigueTier: null,
    velocityLoss,
    mechanicalWorkKj: null,
    caloriesKcal: null,
    averagePowerWatts: null,
    peakPowerWatts: null,
    powerLossPercent: null,
    timeUnderTensionSec,
    tempoCadence,
    repVelocityProfiles,
    formBadge,
    coachingPoints: coachingPoints.slice(0, 3),
    stickingPoints: [],
    lumbarKinetics: null,
    morphology: null,
    groundStabilityScore: null,
    bvhData: null,
    hypertrophyReport,
    machineProfile,
    optimalBlueprint,
    coachPrescription,
  };
}

/**
 * Real-time per-rep quality evaluation during live capture.
 */
export function evaluateLiveRepQuality(
  romDeg: number,
  eccentricSec: number,
  lift = 'squat',
  fr = false,
  velocitySlowed = false
): FormBadge {
  const archetype = getKinematicArchetype(lift);
  const targetRom = ARCHETYPE_ROM_TARGETS[archetype] || 80;

  if (velocitySlowed) {
    return {
      id: 'VELOCITY_LOSS',
      label: 'Deceleration (>35%): Near Failure',
      labelFr: 'Ralentissement (>35\u00A0%)\u00A0: proche de l’échec',
      severity: 'warning',
    };
  }

  if (eccentricSec > 0 && eccentricSec < 0.8) {
    return {
      id: 'MOMENTUM_DETECTED',
      label: 'Control the Descent',
      labelFr: 'Contrôlez la descente',
      severity: 'warning',
    };
  }

  if (romDeg >= targetRom * 0.95) {
    return {
      id: 'OPTIMAL_STRETCH',
      label: 'Full Stretch',
      labelFr: 'Étirement complet',
      severity: 'positive',
    };
  }

  if (romDeg < targetRom * 0.7) {
    return {
      id: 'PARTIAL_RANGE',
      label: 'Incomplete Stretch',
      labelFr: 'Amplitude partielle',
      severity: 'warning',
    };
  }

  if (eccentricSec >= 1.6) {
    return {
      id: 'CONTROLLED_TEMPO',
      label: 'Controlled Tempo',
      labelFr: 'Tempo maîtrisé',
      severity: 'positive',
    };
  }

  return {
    id: 'GOOD_FORM',
    label: 'Good Form',
    labelFr: 'Bonne exécution',
    severity: 'neutral',
  };
}

/**
 * Analyzes continuous biomechanical angles directly using the BiomechanicalDecoder.
 */
export function analyzeContinuousBiomechanics(
  angles: (number | null)[],
  timestamps: number[],
  lift = 'squat',
  fr = false,
  angleUncertainties?: (number | null)[],
  audioOptions?: {
    audioSamples?: Float32Array;
    sampleRate?: number;
  }
): MovementOptimizationResult {
  const def = liftDefinition(lift);
  const restType = def?.rest === 'low' ? 'low' : 'high';
  const decoded = decodeBiomechanicalPhases(angles, timestamps, { restType, angleUncertainties });

  // Map decoded reps to RepDetail for movement optimization
  const reps: RepDetail[] = decoded.reps.map(r => ({
    index: r.repIndex,
    startTime: r.startTime,
    endTime: r.endTime,
    concentricSec: r.concentricSec,
    eccentricSec: r.eccentricSec,
    romDegrees: r.romDegrees,
    peakSpeed: r.peakVelocityDegPerSec,
    meanSpeed: r.meanVelocityDegPerSec,
  }));

  const baseResult = analyzeMovementOptimization(reps, lift, fr);

  // Helper to map time to frame index
  function timeToFrame(time: number): number {
    if (timestamps.length === 0) return 0;
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < timestamps.length; i++) {
      const diff = Math.abs(timestamps[i] - time);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    return closestIdx;
  }

  // Kinetic Forced Alignment per repetition
  let totalDistortion = 0;
  let repCountWithTrajectory = 0;
  const stickingPoints: StickingPointMarker[] = [];
  const detectedInflections = detectSetStickingPoints(decoded.reps, angles, timestamps, lift);
  for (const inf of detectedInflections) {
    stickingPoints.push({
      repIndex: inf.repIndex,
      timestamp: inf.timestamp,
      angleDeg: inf.angleDeg,
      velocityDropPercent: inf.velocityDropPercent,
      severity: inf.severity,
    });
  }

  const template = getCanonicalTemplate(lift);

  for (const r of decoded.reps) {
    const startFrame = timeToFrame(r.startTime);
    const endFrame = timeToFrame(r.endTime);

    if (startFrame < endFrame && endFrame < angles.length) {
      const slice: number[] = [];
      for (let f = startFrame; f <= endFrame; f++) {
        const val = angles[f];
        if (val !== null && !isNaN(val)) {
          slice.push(val);
        }
      }

      if (slice.length >= 4) {
        const alignment = alignKineticTrajectory(slice, template, {
          expectedDirection: template.trajectory[0] >= 0.5 ? 'descent_first' : 'ascent_first',
        });
        totalDistortion += alignment.normalizedDistance;
        repCountWithTrajectory++;
      }
    }
  }

  const formDistortionScore = repCountWithTrajectory > 0
    ? Math.round((totalDistortion / repCountWithTrajectory) * 1000) / 1000
    : null;

  const pathEfficiencyPercent = formDistortionScore !== null
    ? Math.max(50, Math.min(100, Math.round((1 - formDistortionScore * 0.8) * 100)))
    : null;
  const sagittalDriftPercent = pathEfficiencyPercent !== null
    ? Math.max(0, 100 - pathEfficiencyPercent)
    : null;

  if (sagittalDriftPercent !== null && sagittalDriftPercent >= 20) {
    const driftCue = fr
      ? `Dérive de trajectoire (${sagittalDriftPercent}%)\u00A0: verrouillez l'axe vertical pour éviter les déperditions de force.`
      : `Trajectory drift detected (${sagittalDriftPercent}%): lock your vertical path to prevent axial force loss.`;
    if (!baseResult.coachingPoints.includes(driftCue) && baseResult.coachingPoints.length < 3) {
      baseResult.coachingPoints.push(driftCue);
    }
  }

  const stickingPointSummary: string | null = null;

  // Multimodal Audio Synchronization if audio track is provided
  let audioSyncConfidence: number | null = null;
  if (audioOptions?.audioSamples && audioOptions.sampleRate && decoded.reps.length > 0) {
    const visualInflections = decoded.reps.map(r => timeToFrame(r.turnaroundTime));
    // Estimate fps from timestamps
    let fps = 30;
    if (timestamps.length >= 2) {
      const dt = (timestamps[timestamps.length - 1] - timestamps[0]) / (timestamps.length - 1);
      if (dt > 0) fps = Math.round(1 / dt);
    }

    const syncResults = synchronizeRepetitionsWithAudio(
      visualInflections,
      fps,
      audioOptions.audioSamples,
      audioOptions.sampleRate
    );

    const validConfidences = syncResults.map(s => s.syncConfidence);
    if (validConfidences.length > 0) {
      const avgConf = validConfidences.reduce((a, b) => a + b, 0) / validConfidences.length;
      audioSyncConfidence = Math.round(avgConf * 100) / 100;
    }
  }

  // Continuous frame-accurate hypertrophy telemetry
  const continuousRepSamples: { samples: TrajectorySample[] }[] = [];
  for (const r of decoded.reps) {
    const startFrame = timeToFrame(r.startTime);
    const endFrame = timeToFrame(r.endTime);
    if (startFrame < endFrame && endFrame < angles.length) {
      const sliceSamples: TrajectorySample[] = [];
      for (let f = startFrame; f <= endFrame; f++) {
        const val = angles[f];
        if (val !== null && !isNaN(val)) {
          const tMs = (timestamps[f] ?? f / 30) * 1000;
          sliceSamples.push({ timestampMs: tMs, jointAngle: val });
        }
      }
      if (sliceSamples.length >= 4) {
        continuousRepSamples.push({ samples: sliceSamples });
      }
    }
  }

  const continuousHypertrophyReport = continuousRepSamples.length > 0
    ? analyzeSetHypertrophy(continuousRepSamples, baseResult.machineProfile || resolveKinematicAlias(lift))
    : baseResult.hypertrophyReport;

  const continuousPrescription = continuousHypertrophyReport
    ? generateCoachPrescription({
        avgRomDeg: baseResult.averageRomDeg,
        minAngleDeg: baseResult.machineProfile?.restPosition === 'high' ? Math.max(45, 165 - baseResult.averageRomDeg) : undefined,
        maxAngleDeg: baseResult.machineProfile?.restPosition === 'low' ? Math.min(170, 45 + baseResult.averageRomDeg) : undefined,
        avgEccentricSec: baseResult.averageEccentricSec,
        bounceCount: continuousHypertrophyReport.bounceCount,
        continuousTensionPercent: continuousHypertrophyReport.continuousTensionPercentage,
        velocityLossPercent: baseResult.velocityLossPercent,
      }, lift, fr)
    : baseResult.coachPrescription;

  return {
    ...baseResult,
    stickingPoints,
    stickingPointSummary,
    formDistortionScore,
    pathEfficiencyPercent,
    sagittalDriftPercent,
    audioSyncConfidence,
    hypertrophyReport: continuousHypertrophyReport,
    coachPrescription: continuousPrescription,
  };
}

