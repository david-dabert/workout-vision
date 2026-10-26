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

export interface RepVelocityProfile {
  repIndex: number;
  durationSec: number;
  concentricSec: number;
  eccentricSec: number;
  romDegrees: number;
  velocityLossPercent: number; // % loss relative to fastest rep in set
  tier: 'speed' | 'optimal_hypertrophy' | 'failure';
}

export interface MovementOptimizationResult {
  romScore: number;            // 0 - 100 %
  controlIndex: number;        // 0 - 100 %
  averageRomDeg: number;       // degrees
  averageEccentricSec: number; // seconds
  averageConcentricSec: number;// seconds
  velocityLossPercent: number; // 0 - 100 %
  fatigueTier: 'speed' | 'optimal_hypertrophy' | 'failure';
  mechanicalWorkKj: number;    // kJ
  caloriesKcal: number;        // kcal (indicative estimate per R8)
  timeUnderTensionSec: number; // seconds
  tempoCadence: string;        // e.g. "2-0-1"
  repVelocityProfiles: RepVelocityProfile[];
  formBadge: FormBadge;
  coachingPoints: string[];
  stickingPointSummary?: string | null;
  formDistortionScore?: number | null;
  audioSyncConfidence?: number | null;
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

// Effective displaced mass (kg) for physics-based mechanical work estimation
const ARCHETYPE_DISPLACED_MASS_KG: Record<KinematicArchetype, number> = {
  squat: 66,      // ~88% of 75kg standard reference adult mass
  hinge: 50,      // ~67% of bodyweight + bar travel
  push: 52,       // ~68% of bodyweight (push-up) or standard working press resistance
  pull: 70,       // ~93% for pull-up / pulldown working resistance
  isolation: 15,  // standard dumbbell / cable isolation effective resistance
};

// Reference vertical travel distance (meters) at 100% target ROM
const ARCHETYPE_DISPLACEMENT_METERS: Record<KinematicArchetype, number> = {
  squat: 0.45,
  hinge: 0.40,
  push: 0.35,
  pull: 0.40,
  isolation: 0.30,
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
      velocityLossPercent: 0,
      fatigueTier: 'speed',
      mechanicalWorkKj: 0,
      caloriesKcal: 0,
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

  // 3. Velocity Loss (%) & VBT Hypertrophic Fatigue Index
  const concTimes = wholeReps.map(r => r.concentricSec || 0).filter(t => t > 0);
  let velocityLossPercent = 0;
  let fatigueTier: 'speed' | 'optimal_hypertrophy' | 'failure' = 'speed';

  const minConc = concTimes.length > 0 ? Math.min(...concTimes) : 0;
  if (concTimes.length >= 2) {
    const lastConc = concTimes[concTimes.length - 1];
    velocityLossPercent = Math.max(0, Math.min(100, Math.round(((lastConc - minConc) / lastConc) * 100)));
    if (velocityLossPercent >= 35) {
      fatigueTier = 'failure';
    } else if (velocityLossPercent >= 20) {
      fatigueTier = 'optimal_hypertrophy';
    } else {
      fatigueTier = 'speed';
    }
  }

  // Construct rep velocity profile for each whole rep
  const repVelocityProfiles: RepVelocityProfile[] = wholeReps.map((r, idx) => {
    const durationSec = Math.round(((r.endTime || 0) - (r.startTime || 0)) * 100) / 100;
    const conc = Math.round((r.concentricSec || 0) * 100) / 100;
    const ecc = Math.round((r.eccentricSec || 0) * 100) / 100;
    const rom = Math.round((r.romDegrees || 0) * 10) / 10;
    const repLoss = (minConc > 0 && conc > 0)
      ? Math.max(0, Math.min(100, Math.round(((conc - minConc) / conc) * 100)))
      : 0;
    let tier: 'speed' | 'optimal_hypertrophy' | 'failure' = 'speed';
    if (repLoss >= 35) {
      tier = 'failure';
    } else if (repLoss >= 20) {
      tier = 'optimal_hypertrophy';
    }
    return {
      repIndex: idx + 1,
      durationSec,
      concentricSec: conc,
      eccentricSec: ecc,
      romDegrees: rom,
      velocityLossPercent: repLoss,
      tier,
    };
  });

  // 4. Physics-based Mechanical Work (kJ) & Caloric Expenditure (kcal)
  const refMass = ARCHETYPE_DISPLACED_MASS_KG[archetype] || 50;
  const refDisp = ARCHETYPE_DISPLACEMENT_METERS[archetype] || 0.40;
  const g = 9.81; // m/s²

  // Sum mechanical work across each rep based on its excursion
  const totalWorkJoules = wholeReps.reduce((sum, r) => {
    const repRom = r.romDegrees || avgRom;
    const disp = refDisp * Math.max(0.3, Math.min(1.5, repRom / targetRom));
    const repJoules = refMass * g * disp;
    return sum + repJoules;
  }, 0);

  const mechanicalWorkKj = Math.round((totalWorkJoules / 1000) * 10) / 10;
  // Metabolic energy: skeletal muscle efficiency ~0.22, eccentric phase factor ~1.25, 4184 Joules/kcal
  const caloriesKcal = Math.round(((totalWorkJoules * 1.25) / (0.22 * 4184)) * 10) / 10;

  // 5. Time Under Tension (TUT) and Tempo Cadence
  const tutSum = wholeReps.reduce((sum, r) => sum + Math.max(0, (r.endTime || 0) - (r.startTime || 0)), 0);
  const timeUnderTensionSec = tutSum > 0
    ? Math.round(tutSum * 10) / 10
    : Math.round(validTimed.reduce((sum, r) => sum + (r.eccentricSec || 0) + (r.concentricSec || 0), 0) * 10) / 10;

  const tempoCadence = `${Math.max(1, Math.round(avgEccentric))}-0-${Math.max(1, Math.round(avgConcentric))}`;

  // 6. Determine Form Quality Badge
  let formBadge: FormBadge;
  if (avgEccentric < MIN_CONTROLLED_ECCENTRIC_SEC) {
    formBadge = {
      id: 'MOMENTUM_DETECTED',
      label: 'Momentum Detected - Control the Descent',
      labelFr: 'Élan détecté — Contrôlez la descente',
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

  // 7. Construct 2–3 Actionable Hypertrophy Coaching Points
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

  // Point 2: Velocity Loss & Fatigue Analysis
  if (fatigueTier === 'optimal_hypertrophy') {
    coachingPoints.push(
      fr
        ? `Perte de vitesse de ${velocityLossPercent}%\u00A0: zone idéale d’hypertrophie mécanique sans épuisement nerveux excessif.`
        : `Velocity loss of ${velocityLossPercent}%: optimal hypertrophy stimulus with high motor unit recruitment.`
    );
  } else if (fatigueTier === 'failure') {
    coachingPoints.push(
      fr
        ? `Perte de vitesse de ${velocityLossPercent}%\u00A0: échec musculaire atteint. Accordez 2 à 3 minutes de repos complet avant la prochaine série.`
        : `Velocity loss of ${velocityLossPercent}%: muscular failure reached. Allow 2–3 minutes of complete rest before your next set.`
    );
  } else if (velocityLossPercent > 0) {
    coachingPoints.push(
      fr
        ? `Perte de vitesse modérée (${velocityLossPercent}%)\u00A0: série dynamique. Pour stimuler l’hypertrophie, rapprochez-vous de l’échec.`
        : `Moderate velocity loss (${velocityLossPercent}%): explosive or warmup set. Train closer to failure for maximal muscle growth.`
    );
  } else if (avgEccentric >= 1.8) {
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

  return {
    romScore,
    controlIndex: controlScore,
    averageRomDeg: Math.round(avgRom * 10) / 10,
    averageEccentricSec: Math.round(avgEccentric * 10) / 10,
    averageConcentricSec: Math.round(avgConcentric * 10) / 10,
    velocityLossPercent,
    fatigueTier,
    mechanicalWorkKj,
    caloriesKcal,
    timeUnderTensionSec,
    tempoCadence,
    repVelocityProfiles,
    formBadge,
    coachingPoints: coachingPoints.slice(0, 3),
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
      label: 'Deceleration (>35%) — Near Failure',
      labelFr: 'Ralentissement (>35\u00A0%) — Proche de l’échec',
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
  let mostSevereSticking: { angle: number; severity: 'mild' | 'moderate' | 'severe' } | null = null;

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
          expectedDirection: def?.rest === 'low' ? 'ascent_first' : 'descent_first',
        });
        totalDistortion += alignment.normalizedDistance;
        repCountWithTrajectory++;

        if (alignment.stickingPoint) {
          if (!mostSevereSticking || alignment.stickingPoint.severity === 'severe') {
            mostSevereSticking = {
              angle: alignment.stickingPoint.normalizedAngle,
              severity: alignment.stickingPoint.severity,
            };
          }
        }
      }
    }
  }

  const formDistortionScore = repCountWithTrajectory > 0
    ? Math.round((totalDistortion / repCountWithTrajectory) * 1000) / 1000
    : null;

  let stickingPointSummary: string | null = null;
  if (mostSevereSticking) {
    const anglePct = Math.round(mostSevereSticking.angle * 100);
    if (fr) {
      stickingPointSummary = `Point de blocage détecté à ${anglePct}\u00A0% d'amplitude\u00A0: maintenez l'accélération dans la transition.`;
    } else {
      stickingPointSummary = `Sticking point detected at ${anglePct}% ROM: focus on explosive acceleration through the transition.`;
    }

    if (!baseResult.coachingPoints.includes(stickingPointSummary)) {
      baseResult.coachingPoints.push(stickingPointSummary);
    }
  }

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

  return {
    ...baseResult,
    stickingPointSummary,
    formDistortionScore,
    audioSyncConfidence,
  };
}

