/**
 * Personal Biomechanical Baseline & Movement Adaptation Engine (S-MAS)
 *
 * Implements the athlete-specific baseline comparison paradigm (as seen in clinical
 * sports science and Premier League kinematic analytics, e.g. FitWise AI):
 * Rather than measuring lifters against arbitrary population-average stereotypes,
 * this engine calibrates each individual's uncompromised movement signature from early,
 * non-fatigued repetitions (Reps 1–3) and monitors real-time neuromuscular fatigue,
 * kinematic drift, sticking-point struggles, and intentional tempo pacing.
 */

export interface RepKinematics {
  repIndex: number;
  concentricVelocity: number; // m/s or normalized units/sec
  peakConcentricVelocity?: number;
  concentricDuration: number; // seconds
  eccentricDuration?: number; // seconds
  romDegrees: number; // degrees
  trunkLeanDegrees: number; // degrees of forward spinal tilt
  symmetryIndex?: number; // 0 to 100% (100 = perfectly balanced)
  stickingDeceleration?: number; // peak deceleration during concentric sticking zone
}

export interface BaselineMovementSignature {
  calibratedRepsCount: number;
  baselineConcentricVelocity: number;
  baselinePeakVelocity: number;
  baselineConcentricDuration: number;
  baselineRomDegrees: number;
  baselineTrunkLeanDegrees: number;
  baselineSymmetryIndex: number;
}

export type NeuromuscularState =
  | 'FRESH'
  | 'INTENTIONAL_PACING'
  | 'PRODUCTIVE_FATIGUE'
  | 'HIGH_FATIGUE'
  | 'BIOMECHANICAL_BREAKDOWN';

export interface RepAdaptationResult {
  repIndex: number;
  velocityLossPercent: number;
  romChangePercent: number;
  trunkDriftDegrees: number;
  symmetryDeficit: number;
  stickingPointDetected: boolean;
  neuromuscularState: NeuromuscularState;
  smasScore: number; // Strength-Movement Adaptation Score (0 to 100)
}

export interface SetBaselineReport {
  signature: BaselineMovementSignature;
  repAdaptations: RepAdaptationResult[];
  overallSmasScore: number; // 0 to 100
  fatigueOnsetRep: number | null;
  meanKinematicDriftDegrees: number;
  maxVelocityLossPercent: number;
  breakdownDetected: boolean;
  recommendations: string[];
  recommendationsFr: string[];
}

/**
 * Calibrates an athlete's uncompromised baseline signature from their initial clean repetitions.
 * Uses up to the first 3 reps (or all reps if fewer than 3).
 */
export function calibrateBaselineSignature(reps: RepKinematics[]): BaselineMovementSignature {
  if (!Array.isArray(reps) || reps.length === 0) {
    return {
      calibratedRepsCount: 0,
      baselineConcentricVelocity: 0.5,
      baselinePeakVelocity: 0.7,
      baselineConcentricDuration: 1.0,
      baselineRomDegrees: 90,
      baselineTrunkLeanDegrees: 15,
      baselineSymmetryIndex: 100,
    };
  }

  // Use up to the first 3 reps for baseline calibration
  const baselineSet = reps.slice(0, Math.min(3, reps.length));
  const count = baselineSet.length;

  const sumVel = baselineSet.reduce((acc, r) => acc + r.concentricVelocity, 0);
  const sumPeakVel = baselineSet.reduce((acc, r) => acc + (r.peakConcentricVelocity ?? r.concentricVelocity * 1.3), 0);
  const sumDur = baselineSet.reduce((acc, r) => acc + r.concentricDuration, 0);
  const sumRom = baselineSet.reduce((acc, r) => acc + r.romDegrees, 0);
  const sumTrunk = baselineSet.reduce((acc, r) => acc + r.trunkLeanDegrees, 0);
  const sumSym = baselineSet.reduce((acc, r) => acc + (r.symmetryIndex ?? 100), 0);

  return {
    calibratedRepsCount: count,
    baselineConcentricVelocity: Number((sumVel / count).toFixed(3)),
    baselinePeakVelocity: Number((sumPeakVel / count).toFixed(3)),
    baselineConcentricDuration: Number((sumDur / count).toFixed(3)),
    baselineRomDegrees: Number((sumRom / count).toFixed(1)),
    baselineTrunkLeanDegrees: Number((sumTrunk / count).toFixed(1)),
    baselineSymmetryIndex: Number((sumSym / count).toFixed(1)),
  };
}

/**
 * Calculates the Strength-Movement Adaptation Score (S-MAS) on a 0-100 scale.
 * 100 = uncompromised neuromuscular output matching baseline.
 */
export function calculateSmasScore(
  velocityLossPercent: number,
  trunkDriftDegrees: number,
  symmetryDeficit: number
): number {
  // Biomechanically weighted penalties:
  // - Velocity loss: 20% loss = 16 pts, 40% loss = 32 pts, 50% loss = 40 pts
  const velPenalty = 0.8 * Math.max(0, velocityLossPercent);
  // - Kinematic spinal drift: 4° drift = 6 pts, 10° drift = 15 pts, 15° drift = 22.5 pts
  const driftPenalty = 1.5 * Math.max(0, trunkDriftDegrees);
  // - Bilateral symmetry deficit: 5% deficit = 3 pts, 20% deficit = 12 pts
  const symPenalty = 0.6 * Math.max(0, symmetryDeficit);

  const rawScore = 100 - (velPenalty + driftPenalty + symPenalty);
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

/**
 * Evaluates a single repetition against the calibrated baseline signature.
 * Discerns between intentional tempo pacing and authentic neuromuscular breakdown.
 */
export function evaluateRepAdaptation(
  rep: RepKinematics,
  sig: BaselineMovementSignature
): RepAdaptationResult {
  // Velocity Loss %
  const v0 = sig.baselineConcentricVelocity;
  const vi = rep.concentricVelocity;
  const velocityLossPercent = v0 > 0 ? Math.max(0, Number((((v0 - vi) / v0) * 100).toFixed(1))) : 0;

  // ROM Change %
  const rom0 = sig.baselineRomDegrees;
  const romChangePercent = rom0 > 0 ? Number((((rep.romDegrees - rom0) / rom0) * 100).toFixed(1)) : 0;

  // Kinematic Drift (Trunk inclination divergence in degrees)
  const trunkDriftDegrees = Number(Math.abs(rep.trunkLeanDegrees - sig.baselineTrunkLeanDegrees).toFixed(1));

  // Symmetry Deficit
  const currentSym = rep.symmetryIndex ?? 100;
  const symmetryDeficit = Math.max(0, Number((sig.baselineSymmetryIndex - currentSym).toFixed(1)));

  // Sticking Point Detection
  // Marked deceleration during the concentric mid-phase (> 2.5 m/s² or normalized drop)
  const stickingPointDetected = (rep.stickingDeceleration ?? 0) > 2.2;

  // State Classification (Distinguishing intentional tempo from fatigue breakdown)
  let state: NeuromuscularState;

  const isIntentionalTempo =
    velocityLossPercent > 15 &&
    trunkDriftDegrees <= 4.0 &&
    !stickingPointDetected &&
    (rep.eccentricDuration ?? 0) >= 2.0 &&
    symmetryDeficit <= 5.0;

  if (isIntentionalTempo) {
    state = 'INTENTIONAL_PACING';
  } else if (velocityLossPercent > 40 || trunkDriftDegrees > 12.0 || symmetryDeficit > 18.0) {
    state = 'BIOMECHANICAL_BREAKDOWN';
  } else if (velocityLossPercent > 25 || stickingPointDetected || trunkDriftDegrees > 6.0) {
    state = 'HIGH_FATIGUE';
  } else if (velocityLossPercent >= 10 || trunkDriftDegrees > 3.0) {
    state = 'PRODUCTIVE_FATIGUE';
  } else {
    state = 'FRESH';
  }

  // Adjusted S-MAS (Intentional tempo is not penalized for planned velocity reduction)
  const effectiveVelLoss = state === 'INTENTIONAL_PACING' ? Math.min(5, velocityLossPercent * 0.1) : velocityLossPercent;
  const smasScore = calculateSmasScore(effectiveVelLoss, trunkDriftDegrees, symmetryDeficit);

  return {
    repIndex: rep.repIndex,
    velocityLossPercent,
    romChangePercent,
    trunkDriftDegrees,
    symmetryDeficit,
    stickingPointDetected,
    neuromuscularState: state,
    smasScore,
  };
}

/**
 * Evaluates an entire workout set against its calibrated baseline signature.
 */
export function evaluateSetBaselines(
  reps: RepKinematics[],
  customSignature?: BaselineMovementSignature
): SetBaselineReport {
  if (!Array.isArray(reps) || reps.length === 0) {
    const emptySig = customSignature ?? calibrateBaselineSignature([]);
    return {
      signature: emptySig,
      repAdaptations: [],
      overallSmasScore: 100,
      fatigueOnsetRep: null,
      meanKinematicDriftDegrees: 0,
      maxVelocityLossPercent: 0,
      breakdownDetected: false,
      recommendations: ['No repetitions recorded for baseline comparison.'],
      recommendationsFr: ['Aucune répétition enregistrée pour la comparaison de référence.'],
    };
  }

  const signature = customSignature ?? calibrateBaselineSignature(reps);
  const repAdaptations: RepAdaptationResult[] = reps.map((r) => evaluateRepAdaptation(r, signature));

  // Determine overall S-MAS (average of all reps)
  const smasSum = repAdaptations.reduce((acc, r) => acc + r.smasScore, 0);
  const overallSmasScore = Math.round(smasSum / repAdaptations.length);

  // Fatigue onset: first rep where state becomes HIGH_FATIGUE or BIOMECHANICAL_BREAKDOWN
  const fatigueRep = repAdaptations.find(
    (r) => r.neuromuscularState === 'HIGH_FATIGUE' || r.neuromuscularState === 'BIOMECHANICAL_BREAKDOWN'
  );
  const fatigueOnsetRep = fatigueRep ? fatigueRep.repIndex : null;

  // Mean Kinematic Drift
  const totalDrift = repAdaptations.reduce((acc, r) => acc + r.trunkDriftDegrees, 0);
  const meanKinematicDriftDegrees = Number((totalDrift / repAdaptations.length).toFixed(1));

  // Max Velocity Loss
  const maxVelocityLossPercent = Math.max(...repAdaptations.map((r) => r.velocityLossPercent), 0);

  // Breakdown Detected
  const breakdownDetected = repAdaptations.some((r) => r.neuromuscularState === 'BIOMECHANICAL_BREAKDOWN');

  // Clinical Coaching Recommendations
  const recommendations: string[] = [];
  const recommendationsFr: string[] = [];

  if (breakdownDetected) {
    recommendations.push(
      `Biomechanical breakdown detected at rep ${fatigueOnsetRep ?? reps.length}. Terminate set 1-2 reps earlier to avoid lumbar compensation.`
    );
    recommendationsFr.push(
      `Rupture biomécanique détectée à la rep ${fatigueOnsetRep ?? reps.length}. Arrêtez la série 1 à 2 répétitions plus tôt pour éviter la compensation lombaire.`
    );
  } else if (maxVelocityLossPercent > 30) {
    recommendations.push('Optimal hypertrophy stimulus achieved with controlled velocity loss. Solid mechanical stability.');
    recommendationsFr.push('Stimulus d\'hypertrophie optimal atteint avec une perte de vitesse maîtrisée. Bonne stabilité mécanique.');
  } else {
    recommendations.push('Clean neuromuscular execution throughout the set. High power reserve remaining.');
    recommendationsFr.push('Exécution neuromusculaire propre sur toute la série. Réserve de puissance élevée.');
  }

  return {
    signature,
    repAdaptations,
    overallSmasScore,
    fatigueOnsetRep,
    meanKinematicDriftDegrees,
    maxVelocityLossPercent,
    breakdownDetected,
    recommendations,
    recommendationsFr,
  };
}
