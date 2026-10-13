/**
 * Precision Sports Biomechanics Engine
 * Kinematics calculations for high-affluence precision sports:
 * - Golf (PGA Tour X-Factor, 3:1 Tempo, Pelvis Sway, Clubhead Speed)
 * - Tennis & Padel (Serve Trophy Pose, Bandeja Contact, Kinetic Chain Sequencing)
 * - Cycling & Triathlon (BDC Knee Extension, Aerodynamic Torso Angle)
 */

export interface GolfSwingMetrics {
  shoulderTurnDeg: number;
  pelvisTurnDeg: number;
  xFactorDeg: number;
  xFactorRating: 'optimal_tour' | 'restricted' | 'excessive';
  backswingMs: number;
  downswingMs: number;
  tempoRatio: number;
  tempoRating: 'tour_tempo' | 'quick_rush' | 'slow_lag';
  pelvisSwayCm: number;
  isEarlyExtension: boolean;
  estimatedClubheadSpeedMph: number;
}

export interface TennisServeMetrics {
  shoulderTiltDeg: number;
  rearKneeFlexionDeg: number;
  isTrophyPoseSound: boolean;
  kineticChainSequenced: boolean;
  contactHeightMeters: number;
  estimatedServeSpeedKmh: number;
}

export interface PadelBandejaMetrics {
  contactHeightMeters: number;
  lateralShoulderTiltDeg: number;
  elbowAngleDeg: number;
  verdict: 'optimal_bandeja' | 'too_high_smash' | 'too_low';
  reboundSuppressionIndex: number; // 0-100 score for low glass rebound
}

export interface BikeFitMetrics {
  bdcKneeAngleDeg: number;
  torsoAeroAngleDeg: number;
  saddleHeightVerdict: 'optimal' | 'too_high' | 'too_low';
  aeroComfortVerdict: 'aero_pro' | 'endurance' | 'excessive_drop';
}

/**
 * Calculates Golf X-Factor: separation angle between shoulder line and pelvis line.
 * Optimal Tour range: 45° - 55°.
 */
export function calculateGolfXFactor(shoulderTurnDeg: number, pelvisTurnDeg: number): {
  xFactorDeg: number;
  xFactorRating: 'optimal_tour' | 'restricted' | 'excessive';
} {
  const xFactorDeg = Math.abs(shoulderTurnDeg - pelvisTurnDeg);
  let xFactorRating: 'optimal_tour' | 'restricted' | 'excessive' = 'optimal_tour';
  if (xFactorDeg < 42) {
    xFactorRating = 'restricted';
  } else if (xFactorDeg > 58) {
    xFactorRating = 'excessive';
  }
  return { xFactorDeg: Math.round(xFactorDeg * 10) / 10, xFactorRating };
}

/**
 * Calculates Golf Swing Tempo Ratio (Backswing Duration / Downswing Duration).
 * PGA Tour standard is 3.0 : 1.0 (Novosel Tour Tempo).
 */
export function calculateGolfTempo(backswingMs: number, downswingMs: number): {
  tempoRatio: number;
  tempoRating: 'tour_tempo' | 'quick_rush' | 'slow_lag';
} {
  if (downswingMs <= 0) {
    return { tempoRatio: 3.0, tempoRating: 'tour_tempo' };
  }
  const tempoRatio = Math.round((backswingMs / downswingMs) * 10) / 10;
  let tempoRating: 'tour_tempo' | 'quick_rush' | 'slow_lag' = 'tour_tempo';
  if (tempoRatio < 2.7) {
    tempoRating = 'quick_rush';
  } else if (tempoRatio > 3.4) {
    tempoRating = 'slow_lag';
  }
  return { tempoRatio, tempoRating };
}

/**
 * Estimates golf clubhead speed in mph from lead wrist angular velocity and kinetic chain efficiency.
 */
export function estimateGolfClubheadSpeed(
  wristAngularVelocityDegPerSec: number,
  armSpanMeters: number = 1.15
): number {
  const radPerSec = (wristAngularVelocityDegPerSec * Math.PI) / 180;
  const tipSpeedMps = radPerSec * armSpanMeters;
  const tipSpeedMph = tipSpeedMps * 2.23694;
  return Math.round(Math.min(135, Math.max(65, tipSpeedMph)));
}

/**
 * Assesses Tennis Serve Trophy Pose:
 * - Upward shoulder tilt (25° - 35°)
 * - Deep rear knee flexion (105° - 125°)
 */
export function calculateTennisTrophyPose(
  shoulderTiltDeg: number,
  rearKneeFlexionDeg: number
): {
  isTrophyPoseSound: boolean;
  shoulderTiltDeg: number;
  rearKneeFlexionDeg: number;
} {
  const isShoulderOptimal = shoulderTiltDeg >= 20 && shoulderTiltDeg <= 40;
  const isKneeOptimal = rearKneeFlexionDeg >= 100 && rearKneeFlexionDeg <= 135;
  return {
    isTrophyPoseSound: isShoulderOptimal && isKneeOptimal,
    shoulderTiltDeg: Math.round(shoulderTiltDeg),
    rearKneeFlexionDeg: Math.round(rearKneeFlexionDeg),
  };
}

/**
 * Evaluates Padel Bandeja stroke mechanics:
 * Hit slightly behind head height with 10°-20° shoulder tilt to keep low glass rebound.
 */
export function calculatePadelBandeja(
  contactHeightMeters: number,
  shoulderTiltDeg: number,
  userHeightMeters: number = 1.80
): PadelBandejaMetrics {
  const relContact = contactHeightMeters / userHeightMeters;
  let verdict: 'optimal_bandeja' | 'too_high_smash' | 'too_low' = 'optimal_bandeja';
  let reboundSuppression = 92;

  if (relContact > 1.35) {
    verdict = 'too_high_smash';
    reboundSuppression = 55; // High bounce risk off glass
  } else if (relContact < 1.05) {
    verdict = 'too_low';
    reboundSuppression = 68;
  }

  const lateralShoulderTilt = Math.min(45, Math.max(5, shoulderTiltDeg));
  return {
    contactHeightMeters: Math.round(contactHeightMeters * 100) / 100,
    lateralShoulderTiltDeg: Math.round(lateralShoulderTilt),
    elbowAngleDeg: 125,
    verdict,
    reboundSuppressionIndex: reboundSuppression,
  };
}

/**
 * Evaluates road cycling / triathlon bike fit knee extension angle at Bottom Dead Center (BDC).
 * Optimal range: 25° - 35° knee flexion (Holmes method).
 */
export function calculateBikeFitKneeAngle(bdcKneeAngleDeg: number): {
  saddleHeightVerdict: 'optimal' | 'too_high' | 'too_low';
  bdcKneeAngleDeg: number;
} {
  let saddleHeightVerdict: 'optimal' | 'too_high' | 'too_low' = 'optimal';
  if (bdcKneeAngleDeg < 25) {
    saddleHeightVerdict = 'too_high'; // Overextension, risk of hamstring/achilles strain
  } else if (bdcKneeAngleDeg > 38) {
    saddleHeightVerdict = 'too_low'; // Excessive flexion, patellofemoral overload
  }
  return { saddleHeightVerdict, bdcKneeAngleDeg: Math.round(bdcKneeAngleDeg) };
}

export interface BaseballPitchMetrics {
  shoulderAbductionDeg: number;
  elbowFlexionDeg: number;
  uclSafetyVerdict: 'optimal_safe' | 'high_valgus_torque' | 'dropped_elbow';
  estimatedUclStressNm: number;
}

/**
 * Assesses baseball pitching mechanics at front foot contact (ASMI / Fleisig standards):
 * - Shoulder abduction: 85° - 100°
 * - Elbow flexion: 80° - 105° (prevents excessive UCL valgus torque)
 */
export function calculateBaseballPitchMechanics(
  shoulderAbductionDeg: number,
  elbowFlexionDeg: number
): BaseballPitchMetrics {
  let uclSafetyVerdict: 'optimal_safe' | 'high_valgus_torque' | 'dropped_elbow' = 'optimal_safe';
  let estimatedUclStressNm = 52; // physiological baseline torque

  if (shoulderAbductionDeg < 80) {
    uclSafetyVerdict = 'dropped_elbow';
    estimatedUclStressNm = 78;
  } else if (elbowFlexionDeg < 75 || elbowFlexionDeg > 115) {
    uclSafetyVerdict = 'high_valgus_torque';
    estimatedUclStressNm = 84;
  }

  return {
    shoulderAbductionDeg: Math.round(shoulderAbductionDeg),
    elbowFlexionDeg: Math.round(elbowFlexionDeg),
    uclSafetyVerdict,
    estimatedUclStressNm,
  };
}

/**
 * Evaluates rowing drive-to-recovery rhythm ratio (optimal 1:2 ratio).
 */
export function calculateRowingRhythm(
  driveMs: number,
  recoveryMs: number
): { rhythmRatio: number; verdict: 'optimal_ratio' | 'rushed_slide' | 'slow_hands' } {
  const ratio = Math.round((recoveryMs / (driveMs || 1)) * 10) / 10;
  let verdict: 'optimal_ratio' | 'rushed_slide' | 'slow_hands' = 'optimal_ratio';
  if (ratio < 1.7) {
    verdict = 'rushed_slide';
  } else if (ratio > 2.4) {
    verdict = 'slow_hands';
  }
  return { rhythmRatio: ratio, verdict };
}

/**
 * Evaluates alpine skiing carving lateral angulation and edge grip.
 */
export function calculateSkiingAngulation(
  edgeAngleDeg: number,
  kneeAngulationDeg: number
): { edgeAngleDeg: number; kneeAngulationDeg: number; verdict: 'optimal_carve' | 'under_angulated' | 'excessive_banking'; gForceEst: number } {
  let verdict: 'optimal_carve' | 'under_angulated' | 'excessive_banking' = 'optimal_carve';
  if (edgeAngleDeg < 38) {
    verdict = 'under_angulated';
  } else if (edgeAngleDeg > 68) {
    verdict = 'excessive_banking';
  }
  const gForceEst = Math.round((1 / Math.cos((Math.min(edgeAngleDeg, 75) * Math.PI) / 180)) * 10) / 10;
  return { edgeAngleDeg: Math.round(edgeAngleDeg), kneeAngulationDeg: Math.round(kneeAngulationDeg), verdict, gForceEst };
}

/**
 * Evaluates freestyle swimming Early Vertical Forearm (EVF) and body roll.
 */
export function calculateSwimmingEvf(
  elbowCatchAngleDeg: number,
  bodyRollDeg: number
): { elbowCatchAngleDeg: number; bodyRollDeg: number; verdict: 'optimal_evf' | 'dropped_elbow' | 'flat_roll'; propulsionScore: number } {
  let verdict: 'optimal_evf' | 'dropped_elbow' | 'flat_roll' = 'optimal_evf';
  if (elbowCatchAngleDeg < 100) {
    verdict = 'dropped_elbow';
  } else if (bodyRollDeg < 35 || bodyRollDeg > 55) {
    verdict = 'flat_roll';
  }
  const propulsionScore = verdict === 'optimal_evf' ? 94 : verdict === 'dropped_elbow' ? 62 : 71;
  return { elbowCatchAngleDeg: Math.round(elbowCatchAngleDeg), bodyRollDeg: Math.round(bodyRollDeg), verdict, propulsionScore };
}
