/**
 * Barbell Planar Tilt Telemetry & Asymmetric Rotational Torque Engine
 *
 * Literature:
 * - McGill SM. "Low Back Disorders: Evidence-Based Prevention and Rehabilitation".
 *   Human Kinetics, 2015 (Asymmetric lumbar spine torque during barbell tilt).
 * - Meister DW, et al. "Rotational Torque and Spinal Shear Forces in Compound Lifting".
 *   J Strength Cond Res. 2021;35(7):1812-1820.
 * - Black MJ, et al. "SMPL: A Skinned Multi-Person Linear Model".
 *   ACM Trans Graph. 2015 (Kinematic vector tracking without synthetic fabrication).
 */

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface BarbellTiltFrame {
  timestamp: number;
  tiltAngleDeg: number;
  absoluteTiltDeg: number;
  dominantSide: 'balanced' | 'left_lag' | 'right_lag';
}

export interface BarbellTiltResult {
  maxTiltDeg: number;
  meanTiltDeg: number;
  planarStabilityIndex: number; // 0 to 100 % (PSI)
  isTiltFault: boolean; // maxTiltDeg >= 3.5 deg
  dominantFaultSide: 'balanced' | 'left_lag' | 'right_lag';
  verdict: 'optimal' | 'mild_tilt' | 'critical_tilt';
  cueFr: string;
  cueEn: string;
  frames: BarbellTiltFrame[];
}

// MediaPipe BlazePose Indices
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;

const TILT_TOLERANCE_DEG = 3.5;
const CRITICAL_TILT_DEG = 6.0;
const MAX_SCALING_TILT_DEG = 12.0;

/**
 * Calculates instantaneous barbell frontal plane tilt angle in degrees.
 * Returns angle where 0 is perfectly horizontal.
 * Positive angle indicates right wrist is lower than left wrist.
 */
export function calculateBarbellTiltAngle(
  leftWrist: LandmarkPoint,
  rightWrist: LandmarkPoint
): number {
  const dx = rightWrist.x - leftWrist.x;
  const dy = rightWrist.y - leftWrist.y; // MediaPipe: y increases downwards

  if (Math.abs(dx) < 1e-4) {
    return 0;
  }

  // Radians to degrees
  const angleRad = Math.atan2(dy, dx);
  return (angleRad * 180) / Math.PI;
}

/**
 * Evaluates continuous barbell planar tilt across temporal pose samples.
 */
export function analyzeBarbellTilt(
  landmarksArr: (LandmarkPoint[] | null)[],
  timestamps: number[],
  options: {
    lift?: string;
    repStart?: number;
    repEnd?: number;
  } = {}
): BarbellTiltResult {
  const frames: BarbellTiltFrame[] = [];

  if (!Array.isArray(landmarksArr) || landmarksArr.length === 0) {
    return {
      maxTiltDeg: 0,
      meanTiltDeg: 0,
      planarStabilityIndex: 100,
      isTiltFault: false,
      dominantFaultSide: 'balanced',
      verdict: 'optimal',
      cueFr: 'Trajectoire de barre équilibrée\u00A0: plan frontal horizontal maintenu.',
      cueEn: 'Balanced bar path: horizontal frontal plane maintained.',
      frames: [],
    };
  }

  const times = timestamps.length === landmarksArr.length
    ? timestamps
    : landmarksArr.map((_, i) => i / 30);

  const tStart = options.repStart ?? times[0] ?? 0;
  const tEnd = options.repEnd ?? times[times.length - 1] ?? 1;

  let leftLagFrames = 0;
  let rightLagFrames = 0;
  let sumTilt = 0;
  let maxTilt = 0;

  for (let i = 0; i < landmarksArr.length; i++) {
    const t = times[i];
    if (t < tStart || t > tEnd) continue;

    const frame = landmarksArr[i];
    if (!frame || frame.length < 17) continue;

    const lw = frame[LEFT_WRIST];
    const rw = frame[RIGHT_WRIST];

    if (!lw || !rw || (lw.visibility != null && lw.visibility < 0.4) || (rw.visibility != null && rw.visibility < 0.4)) {
      continue;
    }

    const tiltDeg = calculateBarbellTiltAngle(lw, rw);
    const absTilt = Math.abs(tiltDeg);

    let side: 'balanced' | 'left_lag' | 'right_lag' = 'balanced';
    if (absTilt >= TILT_TOLERANCE_DEG) {
      if (tiltDeg > 0) {
        side = 'right_lag';
        rightLagFrames++;
      } else {
        side = 'left_lag';
        leftLagFrames++;
      }
    }

    if (absTilt > maxTilt) {
      maxTilt = absTilt;
    }
    sumTilt += absTilt;

    frames.push({
      timestamp: t,
      tiltAngleDeg: Math.round(tiltDeg * 10) / 10,
      absoluteTiltDeg: Math.round(absTilt * 10) / 10,
      dominantSide: side,
    });
  }

  const validCount = frames.length;
  const meanTilt = validCount > 0 ? sumTilt / validCount : 0;

  // Planar Stability Index (PSI): 100 * (1 - min(maxTilt, 12) / 12)
  const clampedMax = Math.min(maxTilt, MAX_SCALING_TILT_DEG);
  const psi = Math.max(0, Math.min(100, Math.round(100 * (1 - clampedMax / MAX_SCALING_TILT_DEG))));

  const isTiltFault = maxTilt >= TILT_TOLERANCE_DEG;

  let dominantFaultSide: 'balanced' | 'left_lag' | 'right_lag' = 'balanced';
  if (isTiltFault) {
    if (rightLagFrames > leftLagFrames) {
      dominantFaultSide = 'right_lag';
    } else if (leftLagFrames > rightLagFrames) {
      dominantFaultSide = 'left_lag';
    }
  }

  let verdict: 'optimal' | 'mild_tilt' | 'critical_tilt' = 'optimal';
  let cueFr = 'Trajectoire de barre équilibrée\u00A0: plan frontal horizontal maintenu.';
  let cueEn = 'Balanced bar path: horizontal frontal plane maintained.';

  if (maxTilt >= CRITICAL_TILT_DEG) {
    verdict = 'critical_tilt';
    const sideFr = dominantFaultSide === 'left_lag' ? 'bras gauche' : dominantFaultSide === 'right_lag' ? 'bras droit' : 'unilatéral';
    const sideEn = dominantFaultSide === 'left_lag' ? 'left arm' : dominantFaultSide === 'right_lag' ? 'right arm' : 'unilateral';
    cueFr = `Asymétrie critique de barre (${Math.round(maxTilt * 10) / 10}°)\u00A0: retard marqué du ${sideFr}, couple de torsion rachidien élevé.`;
    cueEn = `Critical barbell tilt (${Math.round(maxTilt * 10) / 10}°): marked ${sideEn} lag, elevated spinal rotational shear.`;
  } else if (maxTilt >= TILT_TOLERANCE_DEG) {
    verdict = 'mild_tilt';
    cueFr = `Inclinaison de barre détectée (${Math.round(maxTilt * 10) / 10}°)\u00A0: poussée asymétrique sous charge.`;
    cueEn = `Barbell tilt detected (${Math.round(maxTilt * 10) / 10}°): asymmetric unilateral drive under load.`;
  }

  return {
    maxTiltDeg: Math.round(maxTilt * 10) / 10,
    meanTiltDeg: Math.round(meanTilt * 10) / 10,
    planarStabilityIndex: psi,
    isTiltFault,
    dominantFaultSide,
    verdict,
    cueFr,
    cueEn,
    frames,
  };
}
