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

export interface SkeletalLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/**
 * Extracts NIOSH lifting variables (H, V, A) directly from a 33-point MediaPipe pose landmark array.
 * Uses anatomical proportional scaling to estimate real-world metric values.
 */
export function extractNioshParametersFromLandmarks(
  landmarks: SkeletalLandmark[],
  userHeightCm = 175
): {
  horizontalDistanceCm: number;
  verticalOriginCm: number;
  asymmetryAngleDeg: number;
} {
  if (!landmarks || landmarks.length < 29) {
    return {
      horizontalDistanceCm: 35,
      verticalOriginCm: 75,
      asymmetryAngleDeg: 0,
    };
  }

  // 11/12 = Shoulders, 15/16 = Wrists, 23/24 = Hips, 27/28 = Ankles
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  const midShoulder = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  const midWrist = {
    x: (leftWrist.x + rightWrist.x) / 2,
    y: (leftWrist.y + rightWrist.y) / 2,
    z: ((leftWrist.z || 0) + (rightWrist.z || 0)) / 2,
  };
  const midHip = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
    z: ((leftHip.z || 0) + (rightHip.z || 0)) / 2,
  };
  const midAnkle = {
    x: (leftAnkle.x + rightAnkle.x) / 2,
    y: (leftAnkle.y + rightAnkle.y) / 2,
    z: ((leftAnkle.z || 0) + (rightAnkle.z || 0)) / 2,
  };

  // Shoulder to ankle span in normalized image coordinate space (typically ~78% of stature)
  const verticalBodySpan = Math.abs(midAnkle.y - midShoulder.y);
  const pxToCm = (userHeightCm * 0.78) / Math.max(0.2, verticalBodySpan);

  // Vertical Origin (V): height of hands (midWrist) from the ankle floor line
  const rawVerticalCm = (midAnkle.y - midWrist.y) * pxToCm;
  const verticalOriginCm = Math.round(Math.max(10, Math.min(160, rawVerticalCm)));

  // Horizontal Reach (H): distance between midWrist and midAnkle in the horizontal ground/depth plane
  const dx = Math.abs(midWrist.x - midAnkle.x) * pxToCm;
  const dz = Math.abs((midWrist.z || 0) - (midAnkle.z || 0)) * pxToCm * 0.8;
  const rawHorizontalCm = Math.sqrt(dx * dx + dz * dz) + 20; // 20cm base offset from ankle center to neutral hand reach
  const horizontalDistanceCm = Math.round(Math.max(25, Math.min(63, rawHorizontalCm)));

  // Asymmetry Angle (A): rotational twist between hips and shoulders in the transverse plane
  const hipVectorX = rightHip.x - leftHip.x;
  const hipVectorZ = (rightHip.z || 0) - (leftHip.z || 0);
  const shoulderVectorX = rightShoulder.x - leftShoulder.x;
  const shoulderVectorZ = (rightShoulder.z || 0) - (leftShoulder.z || 0);

  const hipAngle = Math.atan2(hipVectorZ, hipVectorX);
  const shoulderAngle = Math.atan2(shoulderVectorZ, shoulderVectorX);
  let twistDeg = Math.round(Math.abs(shoulderAngle - hipAngle) * (180 / Math.PI));
  if (twistDeg > 90) twistDeg = 180 - twistDeg;
  const asymmetryAngleDeg = Math.max(0, Math.min(90, twistDeg));

  return {
    horizontalDistanceCm,
    verticalOriginCm,
    asymmetryAngleDeg,
  };
}

