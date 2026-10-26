/**
 * WorkoutVision Movement Optimization & Kinematic Hypertrophy Engine
 *
 * Evaluates real-time and post-set biomechanical execution:
 * 1. Range of Motion (ROM) Score: % of target stretch achieved based on joint angle thresholds.
 * 2. Control & Tempo Index: ratio of controlled eccentric duration vs. explosive momentum.
 * 3. Form Quality Badges: e.g. "Full Stretch Achieved", "Momentum Detected - Control the Descent".
 * 4. Post-Set Coaching Summary: 2–3 actionable points for maximum hypertrophic stimulus.
 */

import { RepDetail } from '../counting/core';
import { getExercise, getKinematicArchetype, KinematicArchetype } from '../exercises/index';

export interface MovementOptimizationResult {
  romScore: number;            // 0 - 100 %
  controlIndex: number;        // 0 - 100 %
  averageRomDeg: number;       // degrees
  averageEccentricSec: number; // seconds
  averageConcentricSec: number;// seconds
  formBadge: FormBadge;
  coachingPoints: string[];
}

export interface FormBadge {
  id: 'OPTIMAL_STRETCH' | 'CONTROLLED_TEMPO' | 'MOMENTUM_DETECTED' | 'PARTIAL_RANGE' | 'GOOD_FORM';
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

  // 3. Determine Form Quality Badge
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

  // 4. Construct 2–3 Actionable Hypertrophy Coaching Points
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

  // Point 2: Tempo and momentum control
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

  return {
    romScore,
    controlIndex: controlScore,
    averageRomDeg: Math.round(avgRom * 10) / 10,
    averageEccentricSec: Math.round(avgEccentric * 10) / 10,
    averageConcentricSec: Math.round(avgConcentric * 10) / 10,
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
  fr = false
): FormBadge {
  const archetype = getKinematicArchetype(lift);
  const targetRom = ARCHETYPE_ROM_TARGETS[archetype] || 80;

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
