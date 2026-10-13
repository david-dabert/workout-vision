/**
 * Industrial Ergonomics & Postural Biomechanics Engine
 *
 * Implements the Revised NIOSH Lifting Equation (Waters et al., 1993)
 * and REBA (Rapid Entire Body Assessment) risk scoring.
 *
 * Evaluates occupational lifting tasks, spinal compressive loads (L5/S1),
 * and ergonomic injury risk with 100% on-device processing.
 */

export interface NioshInput {
  loadWeightKg: number;
  horizontalDistanceCm: number; // H: distance from hands to midpoint between ankles (25 - 63 cm)
  verticalOriginCm: number; // V: vertical height of the hands at lift origin (0 - 175 cm)
  verticalTravelDistanceCm: number; // D: vertical travel distance (25 - 260 cm)
  asymmetryAngleDeg: number; // A: angle of trunk twist / asymmetry (0 - 135 deg)
  frequencyLiftsPerMin?: number; // F: lifts/min (default 0.2 = intermittent)
  couplingQuality?: 'good' | 'fair' | 'poor'; // CM multiplier
}

export interface NioshResult {
  loadConstantKg: number;
  horizontalMultiplierHM: number;
  verticalMultiplierVM: number;
  distanceMultiplierDM: number;
  asymmetricMultiplierAM: number;
  frequencyMultiplierFM: number;
  couplingMultiplierCM: number;
  recommendedWeightLimitKg: number; // RWL
  liftingIndexLI: number; // LI = Load / RWL
  riskCategory: 'safe' | 'moderate' | 'high';
  estimatedL5S1CompressionNewtons: number; // L5/S1 spinal compressive load
  recommendations: string[];
}

/**
 * Computes the Revised NIOSH Lifting Equation parameters.
 */
export function calculateNioshLifting(input: NioshInput): NioshResult {
  const LC = 23; // Load Constant: 23 kg (51 lbs)

  // Horizontal Multiplier (HM = 25 / H)
  const H = Math.max(25, Math.min(63, input.horizontalDistanceCm));
  const HM = 25 / H;

  // Vertical Multiplier (VM = 1 - 0.003 * |V - 75|)
  const V = Math.max(0, Math.min(175, input.verticalOriginCm));
  const VM = Math.max(0, 1 - 0.003 * Math.abs(V - 75));

  // Distance Multiplier (DM = 0.82 + 4.5 / D)
  const D = Math.max(25, Math.min(260, input.verticalTravelDistanceCm));
  const DM = Math.min(1.0, 0.82 + 4.5 / D);

  // Asymmetric Multiplier (AM = 1 - 0.0032 * A)
  const A = Math.max(0, Math.min(135, input.asymmetryAngleDeg));
  const AM = Math.max(0, 1 - 0.0032 * A);

  // Frequency Multiplier (FM): for standard single/intermittent lifts (< 1/min), FM = 1.0
  const FM = 1.0;

  // Coupling Multiplier (CM): good handles = 1.0, fair = 0.95, poor = 0.90
  const CM = input.couplingQuality === 'poor' ? 0.90 : input.couplingQuality === 'fair' ? 0.95 : 1.0;

  // Recommended Weight Limit: RWL = LC * HM * VM * DM * AM * FM * CM
  const RWL = LC * HM * VM * DM * AM * FM * CM;

  // Lifting Index: LI = Load / RWL
  const LI = input.loadWeightKg / Math.max(0.1, RWL);

  let riskCategory: 'safe' | 'moderate' | 'high' = 'safe';
  if (LI > 3.0) riskCategory = 'high';
  else if (LI > 1.0) riskCategory = 'moderate';

  // L5/S1 Spinal Compressive Load estimation (Chaffin & Andersson, 1991):
  // Baseline body weight compression ~ 800-1200 N, plus load moment arm force:
  // F_comp ~= 1000 + (Load * 9.81 * (H / 5.0)) + (TrunkAngle * 25)
  const estimatedL5S1CompressionNewtons = Math.round(
    1000 + (input.loadWeightKg * 9.81 * (H / 5.0)) + (A * 15)
  );

  const recommendations: string[] = [];
  if (HM < 0.7) {
    recommendations.push('Bring the load closer to the body to reduce horizontal moment arm.');
  }
  if (VM < 0.8) {
    recommendations.push('Elevate the origin height of the load to avoid deep trunk flexion.');
  }
  if (AM < 0.85) {
    recommendations.push('Eliminate rotational twist: reposition feet squarely toward the target.');
  }
  if (LI > 1.0) {
    recommendations.push(`Split load into smaller batches: recommended threshold is ${RWL.toFixed(1)} kg.`);
  }

  return {
    loadConstantKg: LC,
    horizontalMultiplierHM: parseFloat(HM.toFixed(3)),
    verticalMultiplierVM: parseFloat(VM.toFixed(3)),
    distanceMultiplierDM: parseFloat(DM.toFixed(3)),
    asymmetricMultiplierAM: parseFloat(AM.toFixed(3)),
    frequencyMultiplierFM: FM,
    couplingMultiplierCM: CM,
    recommendedWeightLimitKg: parseFloat(RWL.toFixed(2)),
    liftingIndexLI: parseFloat(LI.toFixed(2)),
    riskCategory,
    estimatedL5S1CompressionNewtons,
    recommendations,
  };
}

/**
 * REBA (Rapid Entire Body Assessment) ergonomic posture scoring.
 */
export function calculateRebaScore(angles: {
  trunkFlexionDeg: number; // 0 - 90
  neckFlexionDeg: number; // 0 - 60
  legsFlexionDeg: number; // 0 - 90
  upperArmFlexionDeg: number; // 0 - 90
}): { rebaScore: number; actionLevel: string } {
  let scoreA = 1; // Trunk, Neck, Legs
  if (angles.trunkFlexionDeg > 60) scoreA += 4;
  else if (angles.trunkFlexionDeg > 20) scoreA += 2;

  if (angles.neckFlexionDeg > 20) scoreA += 2;

  let scoreB = 1; // Upper Arm
  if (angles.upperArmFlexionDeg > 45) scoreB += 3;
  else if (angles.upperArmFlexionDeg > 20) scoreB += 2;

  const total = scoreA + scoreB;
  let actionLevel = 'Low Risk (Change may be needed)';
  if (total >= 8) actionLevel = 'High Risk (Investigate & implement change immediately)';
  else if (total >= 4) actionLevel = 'Medium Risk (Action required soon)';

  return { rebaScore: total, actionLevel };
}
