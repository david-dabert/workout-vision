/**
 * dynamicValgus.ts: Real-Time Dynamic Knee Valgus & ACL Injury Prevention Screener.
 *
 * Literature:
 * - Hewett TE, Myer GD, Ford KR, et al.
 *   "Biomechanical measures of neuromuscular control and valgus loading of the knee
 *   predict anterior cruciate ligament injury risk in female athletes".
 *   Am J Sports Med. 2005;33(4):492-501.
 * - Munro A, Herrington L, Comfort P.
 *   "Comparison of 2D and 3D knee valgus angles during drop jump and squat tasks".
 *   Gait Posture. 2012;35(4):618-622.
 * - Powers CM.
 *   "The influence of abnormal hip mechanics on knee injury: a biomechanical perspective".
 *   J Orthop Sports Phys Ther. 2010;40(2):42-51.
 */

export interface DynamicValgusTelemetry {
  leftPeakValgusDeg: number;
  rightPeakValgusDeg: number;
  maxValgusDeg: number;
  valgusRiskFlag: boolean;
  severeRiskFlag: boolean;
  dominantSide: 'left' | 'right' | 'bilateral' | 'none';
  tier: 'safe' | 'moderate' | 'severe';
  cueFr: string;
  cueEn: string;
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/**
 * Calculates frontal plane projection angle (FPPA) deviation in degrees.
 * Returns positive degrees representing medial collapse (valgus).
 */
function calculateFrontalValgusAngle(
  hip: LandmarkPoint,
  knee: LandmarkPoint,
  ankle: LandmarkPoint,
  midlineX: number
): number | null {
  if (
    !hip || !knee || !ankle ||
    (hip.visibility ?? 1) < 0.35 ||
    (knee.visibility ?? 1) < 0.35 ||
    (ankle.visibility ?? 1) < 0.35
  ) {
    return null;
  }

  // Vector knee -> hip
  const v1x = hip.x - knee.x;
  const v1y = hip.y - knee.y;

  // Vector knee -> ankle
  const v2x = ankle.x - knee.x;
  const v2y = ankle.y - knee.y;

  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

  if (mag1 < 1e-4 || mag2 < 1e-4) return null;

  const dot = v1x * v2x + v1y * v2y;
  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  const angleDeg = (Math.acos(cosAngle) * 180) / Math.PI;

  const angularDeficit = Math.max(0, 180 - angleDeg);

  // Check medial vs lateral direction relative to midline
  const ankleHipSpanY = ankle.y - hip.y;
  let lineX = hip.x;
  if (Math.abs(ankleHipSpanY) > 1e-4) {
    const frac = (knee.y - hip.y) / ankleHipSpanY;
    lineX = hip.x + frac * (ankle.x - hip.x);
  }

  const distLineToMid = Math.abs(lineX - midlineX);
  const distKneeToMid = Math.abs(knee.x - midlineX);

  // Valgus: knee moved closer to the body midline than the neutral hip-ankle line
  if (distKneeToMid < distLineToMid) {
    return angularDeficit;
  }

  // Varus (outward flare)
  return 0;
}

/**
 * Analyzes continuous dynamic knee valgus across a set of movement frames.
 */
export function analyzeDynamicKneeValgus(
  frames: LandmarkPoint[][] | null | undefined,
  _timestamps?: number[] | null,
  lift = 'squat'
): DynamicValgusTelemetry | null {
  if (!Array.isArray(frames) || frames.length < 5) {
    return null;
  }

  const isLowerBody = /squat|lunge|deadlift|clean|snatch|jump|leg/i.test(lift);
  if (!isLowerBody) {
    return null;
  }

  let peakLeftValgus = 0;
  let peakRightValgus = 0;
  let validFrames = 0;

  for (const frame of frames) {
    if (!frame) continue;

    const leftHip = frame[23];
    const rightHip = frame[24];
    if (!leftHip || !rightHip) continue;

    const midlineX = (leftHip.x + rightHip.x) / 2;

    // Left leg: Hip 23, Knee 25, Ankle 27
    const leftValgus = calculateFrontalValgusAngle(leftHip, frame[25], frame[27], midlineX);
    // Right leg: Hip 24, Knee 26, Ankle 28
    const rightValgus = calculateFrontalValgusAngle(rightHip, frame[26], frame[28], midlineX);

    if (leftValgus !== null) {
      if (leftValgus > peakLeftValgus) peakLeftValgus = leftValgus;
      validFrames++;
    }

    if (rightValgus !== null) {
      if (rightValgus > peakRightValgus) peakRightValgus = rightValgus;
      validFrames++;
    }
  }

  if (validFrames < 5) {
    return null;
  }

  const roundedLeft = Math.round(peakLeftValgus * 10) / 10;
  const roundedRight = Math.round(peakRightValgus * 10) / 10;
  const maxValgus = Math.max(roundedLeft, roundedRight);

  const valgusRiskFlag = maxValgus >= 8.0;
  const severeRiskFlag = maxValgus >= 12.0;

  let dominantSide: 'left' | 'right' | 'bilateral' | 'none' = 'none';
  if (valgusRiskFlag) {
    const diff = Math.abs(roundedLeft - roundedRight);
    if (diff <= 2.0) {
      dominantSide = 'bilateral';
    } else if (roundedLeft > roundedRight) {
      dominantSide = 'left';
    } else {
      dominantSide = 'right';
    }
  }

  let tier: 'safe' | 'moderate' | 'severe';
  let cueFr: string;
  let cueEn: string;

  if (severeRiskFlag) {
    tier = 'severe';
    cueFr = `Valgus dynamique prononcé (${maxValgus}°)\u00A0: effondrement médial du genou, contrainte ligamentaire accrue.`;
    cueEn = `Pronounced dynamic valgus (${maxValgus}°): medial knee collapse, elevated ligament stress.`;
  } else if (valgusRiskFlag) {
    tier = 'moderate';
    cueFr = `Valgus médial modéré (${maxValgus}°)\u00A0: légère abduction à surveiller sous charge.`;
    cueEn = `Moderate medial valgus (${maxValgus}°): slight abduction under load.`;
  } else {
    tier = 'safe';
    cueFr = `Alignement fémoro-tibial optimal (< 8°)\u00A0: genoux stables dans l'axe des pointes.`;
    cueEn = `Optimal femorotibial alignment (< 8°): knees tracking steadily over toes.`;
  }

  return {
    leftPeakValgusDeg: roundedLeft,
    rightPeakValgusDeg: roundedRight,
    maxValgusDeg: maxValgus,
    valgusRiskFlag,
    severeRiskFlag,
    dominantSide,
    tier,
    cueFr,
    cueEn,
  };
}
