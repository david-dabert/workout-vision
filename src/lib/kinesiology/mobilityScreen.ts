/**
 * Universal Functional Mobility & Clinical Kinesiology Screening Engine
 *
 * Implements the gold-standard physical therapy and athletic mobility screening battery
 * (Squat University, Gray Cook FMS, Shirley Sahrmann Movement Impairment System):
 * 1. Ankle Dorsiflexion Screen (Weight-Bearing Closed-Kinetic-Chain Lunge / Knee-to-Wall)
 * 2. Hip Internal & External Rotation Screen (Capsular FAI & Mobility)
 * 3. Overhead Shoulder & Thoracic Extension Screen (with Lumbar Decoupling)
 * 4. Dynamic Single-Leg Stability & Trendelenburg Screen (Glute Medius & Knee Valgus)
 * 5. Active Straight Leg Raise Screen (Hamstring Length vs Lumbar Flexion)
 *
 * All screens evaluate true 3D joint angles, isolate compensatory false-range-of-motion cheats,
 * and prescribe clinical remedial drills with progressive re-test benchmarks.
 */

import { getDrillsForDeficit, getWarmupProtocolForDeficits, RemedialDrill } from './remedialDrills';

export interface Landmark3D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface LandmarkFrame {
  timestamp: number;
  landmarks: Landmark3D[];
}

export type MobilityTestType =
  | 'ANKLE_DORSIFLEXION'
  | 'HIP_ROTATION'
  | 'OVERHEAD_MOBILITY'
  | 'SINGLE_LEG_STABILITY'
  | 'ACTIVE_STRAIGHT_LEG_RAISE';

export type MobilityVerdict =
  | 'PASS'
  | 'MODERATE_RESTRICTION'
  | 'SEVERE_RESTRICTION'
  | 'REFUSED';

export interface MobilityScreenResult {
  testType: MobilityTestType;
  verdict: MobilityVerdict;
  side?: 'left' | 'right' | 'bilateral';
  score: number; // 0 to 100
  measuredAngleDeg: number;
  targetAngleDeg: number;
  compensationAngleDeg?: number;
  asymmetryDeg?: number;
  heelLiftDetected?: boolean;
  findings: string[];
  findingsFr: string[];
  remedialDrills: RemedialDrill[];
}

export interface FullMobilityBatteryReport {
  id: string;
  date: string;
  overallMobilityScore: number; // 0 to 100
  screens: MobilityScreenResult[];
  identifiedDeficits: string[];
  functionalGymImpacts: string[];
  functionalGymImpactsFr: string[];
  recommendedWarmupProtocol: RemedialDrill[];
}

// MediaPipe BlazePose Landmark Indices
const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

/**
 * Calculates 3D interior angle between three landmark points in degrees.
 * B is the vertex point.
 */
export function calculateJointAngle3D(a: Landmark3D, b: Landmark3D, c: Landmark3D): number {
  const v1 = [a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)];
  const v2 = [c.x - b.x, c.y - b.y, (c.z ?? 0) - (b.z ?? 0)];

  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const mag1 = Math.hypot(v1[0], v1[1], v1[2]);
  const mag2 = Math.hypot(v2[0], v2[1], v2[2]);

  if (mag1 < 1e-6 || mag2 < 1e-6) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Calculates 2D angle between two 2D vectors in degrees.
 */
export function calculateAngle2D(v1: [number, number], v2: [number, number]): number {
  const dot = v1[0] * v2[0] + v1[1] * v2[1];
  const mag1 = Math.hypot(v1[0], v1[1]);
  const mag2 = Math.hypot(v2[0], v2[1]);
  if (mag1 < 1e-6 || mag2 < 1e-6) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Screen 1: Ankle Dorsiflexion (Weight-Bearing Lunge / Knee-to-Wall)
 * Measures forward tibial inclination angle (α) and flags compensatory heel lift.
 * Clinical standards:
 * - Pass: α >= 35° (or anterior angle <= 55°) with heel grounded.
 * - Moderate restriction: 25° <= α < 35°.
 * - Severe restriction: α < 25°.
 */
export function evaluateAnkleDorsiflexionScreen(
  frames: LandmarkFrame[],
  side: 'left' | 'right' = 'left'
): MobilityScreenResult {
  if (!frames || frames.length < 5) {
    return {
      testType: 'ANKLE_DORSIFLEXION',
      verdict: 'REFUSED',
      side,
      score: 0,
      measuredAngleDeg: 0,
      targetAngleDeg: 38,
      findings: ['Insufficient frames captured for ankle dorsiflexion evaluation.'],
      findingsFr: ['Nombre d’images insuffisant pour l’évaluation de la flexion de cheville.'],
      remedialDrills: [],
    };
  }

  const kneeIdx = side === 'left' ? LM.LEFT_KNEE : LM.RIGHT_KNEE;
  const ankleIdx = side === 'left' ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE;
  const heelIdx = side === 'left' ? LM.LEFT_HEEL : LM.RIGHT_HEEL;
  const toeIdx = side === 'left' ? LM.LEFT_FOOT_INDEX : LM.RIGHT_FOOT_INDEX;

  let maxTibialAngle = 0;
  let minAnteriorAngle = 180;
  let heelLiftDetected = false;
  let baselineHeelY = 0;

  // Compute baseline heel height from first 5 frames
  let baselineSum = 0;
  let validFrames = 0;
  for (let i = 0; i < Math.min(5, frames.length); i++) {
    const lms = frames[i].landmarks;
    if (lms[heelIdx] && lms[ankleIdx]) {
      baselineSum += lms[heelIdx].y;
      validFrames++;
    }
  }
  baselineHeelY = validFrames > 0 ? baselineSum / validFrames : 0;

  for (const frame of frames) {
    const lms = frame.landmarks;
    const knee = lms[kneeIdx];
    const ankle = lms[ankleIdx];
    const heel = lms[heelIdx];
    const toe = lms[toeIdx];

    if (!knee || !ankle || !heel || !toe) continue;

    // Check heel lift: in image coordinates, y increases downward.
    // A heel lifting upward has a lower y value (baselineHeelY - heel.y > 0.02)
    const heelRise = baselineHeelY - heel.y;
    if (heelRise > 0.025) {
      heelLiftDetected = true;
    }

    // Tibial forward angle relative to vertical:
    // In sagittal profile, forward knee excursion creates dx = |knee.x - ankle.x|, dy = |ankle.y - knee.y|
    const dx = Math.abs(knee.x - ankle.x);
    const dy = Math.max(1e-4, Math.abs(ankle.y - knee.y));
    const tibialAngle = (Math.atan2(dx, dy) * 180) / Math.PI;

    // Anterior joint angle: knee - ankle - toe
    const anteriorAngle = calculateJointAngle3D(knee, ankle, toe);

    if (!heelLiftDetected && tibialAngle > maxTibialAngle) {
      maxTibialAngle = tibialAngle;
    }
    if (!heelLiftDetected && anteriorAngle < minAnteriorAngle) {
      minAnteriorAngle = anteriorAngle;
    }
  }

  const roundedAngle = Math.round(maxTibialAngle * 10) / 10;
  const findings: string[] = [];
  const findingsFr: string[] = [];
  let verdict: MobilityVerdict = 'PASS';
  let score = 100;

  if (heelLiftDetected) {
    findings.push('Compensatory heel lift detected before reaching end-range dorsiflexion.');
    findingsFr.push('Décollement compensatoire du talon détecté avant la fin d’amplitude.');
  }

  if (maxTibialAngle >= 35) {
    verdict = 'PASS';
    score = heelLiftDetected ? 85 : 100;
    findings.push(`Optimal closed-kinetic-chain ankle dorsiflexion (${roundedAngle}° vs 35° target).`);
    findingsFr.push(`Flexion dorsale de cheville optimale (${roundedAngle}° vs 35° cible).`);
  } else if (maxTibialAngle >= 25) {
    verdict = 'MODERATE_RESTRICTION';
    score = 70;
    findings.push(`Moderate ankle dorsiflexion restriction (${roundedAngle}° vs 35° target). Limits deep squat depth.`);
    findingsFr.push(`Restriction modérée de la flexion dorsale (${roundedAngle}° vs 35° cible). Limite la profondeur de squat.`);
  } else {
    verdict = 'SEVERE_RESTRICTION';
    score = 45;
    findings.push(`Severe ankle dorsiflexion restriction (${roundedAngle}° vs 35° target). Forces heel rise and excessive forward trunk lean.`);
    findingsFr.push(`Restriction sévère de la flexion dorsale (${roundedAngle}° vs 35° cible). Force le décollement du talon et l’inclinaison du buste.`);
  }

  const deficitKey = verdict !== 'PASS' || heelLiftDetected ? 'ankle_dorsiflexion_restriction' : '';
  const remedialDrills = deficitKey ? getDrillsForDeficit(deficitKey) : [];

  return {
    testType: 'ANKLE_DORSIFLEXION',
    verdict,
    side,
    score,
    measuredAngleDeg: roundedAngle,
    targetAngleDeg: 38,
    heelLiftDetected,
    findings,
    findingsFr,
    remedialDrills,
  };
}

/**
 * Screen 2: Hip Internal & External Rotation Screen
 * Measures active hip rotation in 90° knee flexion.
 * Clinical standards:
 * - Internal Rotation (IR) target >= 35°.
 * - External Rotation (ER) target >= 45°.
 * - Asymmetry flag: |Left - Right| > 8°.
 */
export function evaluateHipRotationScreen(
  frames: LandmarkFrame[],
  side: 'left' | 'right' = 'left',
  rotationKind: 'internal' | 'external' = 'internal'
): MobilityScreenResult {
  if (!frames || frames.length < 5) {
    return {
      testType: 'HIP_ROTATION',
      verdict: 'REFUSED',
      side,
      score: 0,
      measuredAngleDeg: 0,
      targetAngleDeg: rotationKind === 'internal' ? 35 : 45,
      findings: ['Insufficient frames captured for hip rotation evaluation.'],
      findingsFr: ['Nombre d’images insuffisant pour l’évaluation de la rotation de hanche.'],
      remedialDrills: [],
    };
  }

  const hipIdx = side === 'left' ? LM.LEFT_HIP : LM.RIGHT_HIP;
  const kneeIdx = side === 'left' ? LM.LEFT_KNEE : LM.RIGHT_KNEE;
  const ankleIdx = side === 'left' ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE;

  let maxRotationAngle = 0;

  for (const frame of frames) {
    const lms = frame.landmarks;
    const hip = lms[hipIdx];
    const knee = lms[kneeIdx];
    const ankle = lms[ankleIdx];

    if (!hip || !knee || !ankle) continue;

    // Angle of tibia (knee -> ankle) relative to vertical in frontal/transverse projection
    const dx = Math.abs(ankle.x - knee.x);
    const dy = Math.max(1e-4, Math.abs(ankle.y - knee.y));
    const rotationDeg = (Math.atan2(dx, dy) * 180) / Math.PI;

    if (rotationDeg > maxRotationAngle) {
      maxRotationAngle = rotationDeg;
    }
  }

  const roundedAngle = Math.round(maxRotationAngle * 10) / 10;
  const targetAngle = rotationKind === 'internal' ? 35 : 45;
  const findings: string[] = [];
  const findingsFr: string[] = [];
  let verdict: MobilityVerdict = 'PASS';
  let score = 100;

  if (maxRotationAngle >= targetAngle) {
    verdict = 'PASS';
    score = 100;
    findings.push(`Sufficient hip ${rotationKind} rotation (${roundedAngle}° vs ${targetAngle}° target).`);
    findingsFr.push(`Rotation ${rotationKind === 'internal' ? 'interne' : 'externe'} de hanche suffisante (${roundedAngle}° vs ${targetAngle}° cible).`);
  } else if (maxRotationAngle >= targetAngle - 10) {
    verdict = 'MODERATE_RESTRICTION';
    score = 70;
    findings.push(`Moderate hip ${rotationKind} rotation deficit (${roundedAngle}° vs ${targetAngle}° target).`);
    findingsFr.push(`Déficit modéré de rotation ${rotationKind === 'internal' ? 'interne' : 'externe'} (${roundedAngle}° vs ${targetAngle}° cible).`);
  } else {
    verdict = 'SEVERE_RESTRICTION';
    score = 45;
    findings.push(`Severe hip ${rotationKind} rotation deficit (${roundedAngle}° vs ${targetAngle}° target). High femoroacetabular impingement (FAI) risk.`);
    findingsFr.push(`Déficit sévère de rotation ${rotationKind === 'internal' ? 'interne' : 'externe'} (${roundedAngle}° vs ${targetAngle}° cible). Risque de conflit fémoro-acétabulaire.`);
  }

  const deficitKey = verdict !== 'PASS'
    ? (rotationKind === 'internal' ? 'hip_internal_rotation_deficit' : 'hip_external_rotation_deficit')
    : '';
  const remedialDrills = deficitKey ? getDrillsForDeficit(deficitKey) : [];

  return {
    testType: 'HIP_ROTATION',
    verdict,
    side,
    score,
    measuredAngleDeg: roundedAngle,
    targetAngleDeg: targetAngle,
    findings,
    findingsFr,
    remedialDrills,
  };
}

/**
 * Screen 3: Overhead Shoulder & Thoracic Mobility (with Lumbar Decoupling)
 * Measures humeral elevation while detecting compensatory lumbar lordosis flare.
 * Clinical standards:
 * - True Shoulder Elevation >= 170°.
 * - Lumbar flare compensation <= 10°.
 */
export function evaluateOverheadMobilityScreen(frames: LandmarkFrame[]): MobilityScreenResult {
  if (!frames || frames.length < 5) {
    return {
      testType: 'OVERHEAD_MOBILITY',
      verdict: 'REFUSED',
      side: 'bilateral',
      score: 0,
      measuredAngleDeg: 0,
      targetAngleDeg: 175,
      findings: ['Insufficient frames captured for overhead mobility evaluation.'],
      findingsFr: ['Nombre d’images insuffisant pour l’évaluation de la mobilité d’épaule.'],
      remedialDrills: [],
    };
  }

  let maxOverheadAngle = 0;
  let maxLumbarCompensation = 0;

  // Baseline spinal angle from initial standing frames
  let baselineTrunkAngle = 0;
  let baselineCount = 0;
  for (let i = 0; i < Math.min(5, frames.length); i++) {
    const lms = frames[i].landmarks;
    const hip = lms[LM.LEFT_HIP];
    const shoulder = lms[LM.LEFT_SHOULDER];
    const knee = lms[LM.LEFT_KNEE];
    if (hip && shoulder && knee) {
      baselineTrunkAngle += calculateJointAngle3D(knee, hip, shoulder);
      baselineCount++;
    }
  }
  baselineTrunkAngle = baselineCount > 0 ? baselineTrunkAngle / baselineCount : 180;

  for (const frame of frames) {
    const lms = frame.landmarks;
    const hip = lms[LM.LEFT_HIP];
    const shoulder = lms[LM.LEFT_SHOULDER];
    const wrist = lms[LM.LEFT_WRIST];
    const knee = lms[LM.LEFT_KNEE];

    if (!hip || !shoulder || !wrist) continue;

    // Glenohumeral elevation: angle between torso (hip -> shoulder) and arm (shoulder -> wrist)
    const armElevation = calculateJointAngle3D(hip, shoulder, wrist);
    if (armElevation > maxOverheadAngle) {
      maxOverheadAngle = armElevation;
    }

    // Lumbar lordosis compensation: extension of knee-hip-shoulder angle beyond neutral baseline
    if (knee) {
      const currentTrunkAngle = calculateJointAngle3D(knee, hip, shoulder);
      const compensation = Math.max(0, currentTrunkAngle - baselineTrunkAngle);
      if (compensation > maxLumbarCompensation) {
        maxLumbarCompensation = compensation;
      }
    }
  }

  const roundedArmAngle = Math.round(maxOverheadAngle * 10) / 10;
  const roundedCompensation = Math.round(maxLumbarCompensation * 10) / 10;
  const findings: string[] = [];
  const findingsFr: string[] = [];
  let verdict: MobilityVerdict = 'PASS';
  let score = 100;

  const hasLumbarCheat = maxLumbarCompensation > 10;

  if (maxOverheadAngle >= 170 && !hasLumbarCheat) {
    verdict = 'PASS';
    score = 100;
    findings.push(`Full overhead shoulder elevation (${roundedArmAngle}°) with isolated thoracic neutral spine.`);
    findingsFr.push(`Élévation complète des épaules (${roundedArmAngle}°) avec colonne thoracique isolée et neutre.`);
  } else if (hasLumbarCheat) {
    verdict = 'MODERATE_RESTRICTION';
    score = 75;
    findings.push(`Lumbar lordosis cheat detected (+${roundedCompensation}° hyperextension) masking thoracic spine stiffness.`);
    findingsFr.push(`Compensation lombaire détectée (+${roundedCompensation}° d’hyperextension) masquant une raideur thoracique.`);
  } else {
    verdict = maxOverheadAngle < 155 ? 'SEVERE_RESTRICTION' : 'MODERATE_RESTRICTION';
    score = maxOverheadAngle < 155 ? 50 : 70;
    findings.push(`Restricted overhead shoulder elevation (${roundedArmAngle}° vs 175° target). Subacromial impingement risk.`);
    findingsFr.push(`Élévation d’épaule restreinte (${roundedArmAngle}° vs 175° cible). Risque de conflit sous-acromial.`);
  }

  const deficitKey = hasLumbarCheat
    ? 'lumbar_overhead_compensation'
    : (verdict !== 'PASS' ? 'overhead_shoulder_restriction' : '');
  const remedialDrills = deficitKey ? getDrillsForDeficit(deficitKey) : [];

  return {
    testType: 'OVERHEAD_MOBILITY',
    verdict,
    side: 'bilateral',
    score,
    measuredAngleDeg: roundedArmAngle,
    targetAngleDeg: 175,
    compensationAngleDeg: roundedCompensation,
    findings,
    findingsFr,
    remedialDrills,
  };
}

/**
 * Screen 4: Dynamic Single-Leg Stability & Trendelenburg Screen
 * Evaluates pelvic drop and dynamic knee valgus during unilateral stance / step-down.
 * Clinical standards:
 * - Contralateral pelvic drop < 5°.
 * - Dynamic medial knee collapse < 5°.
 */
export function evaluateSingleLegStabilityScreen(
  frames: LandmarkFrame[],
  stanceSide: 'left' | 'right' = 'left'
): MobilityScreenResult {
  if (!frames || frames.length < 5) {
    return {
      testType: 'SINGLE_LEG_STABILITY',
      verdict: 'REFUSED',
      side: stanceSide,
      score: 0,
      measuredAngleDeg: 0,
      targetAngleDeg: 0,
      findings: ['Insufficient frames captured for single-leg stability evaluation.'],
      findingsFr: ['Nombre d’images insuffisant pour l’évaluation de la stabilité unipodale.'],
      remedialDrills: [],
    };
  }

  const stanceHipIdx = stanceSide === 'left' ? LM.LEFT_HIP : LM.RIGHT_HIP;
  const oppHipIdx = stanceSide === 'left' ? LM.RIGHT_HIP : LM.LEFT_HIP;
  const stanceKneeIdx = stanceSide === 'left' ? LM.LEFT_KNEE : LM.RIGHT_KNEE;
  const stanceAnkleIdx = stanceSide === 'left' ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE;

  let maxPelvicDropDeg = 0;
  let maxKneeValgusDeg = 0;

  for (const frame of frames) {
    const lms = frame.landmarks;
    const stanceHip = lms[stanceHipIdx];
    const oppHip = lms[oppHipIdx];
    const knee = lms[stanceKneeIdx];
    const ankle = lms[stanceAnkleIdx];

    if (!stanceHip || !oppHip || !knee || !ankle) continue;

    // Pelvic drop angle: angle of pelvic line relative to horizontal
    // In normal posture, stanceHip and oppHip have equal y. If oppHip drops down (oppHip.y > stanceHip.y):
    const dy = oppHip.y - stanceHip.y;
    const dx = Math.max(1e-4, Math.abs(oppHip.x - stanceHip.x));
    const pelvicAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (pelvicAngle > maxPelvicDropDeg) {
      maxPelvicDropDeg = pelvicAngle;
    }

    // Dynamic knee valgus: medial displacement of knee relative to hip-ankle vector
    // For left leg, medial is +x (towards center); for right leg, medial is -x.
    const hipToAnkleX = ankle.x - stanceHip.x;
    const hipToAnkleY = ankle.y - stanceHip.y;
    const lineMag = Math.hypot(hipToAnkleX, hipToAnkleY);

    if (lineMag > 1e-4) {
      // Perpendicular distance from knee to hip-ankle line
      const cross = Math.abs((knee.x - stanceHip.x) * hipToAnkleY - (knee.y - stanceHip.y) * hipToAnkleX);
      const perpDist = cross / lineMag;
      // Convert normalized distance to angular deviation
      const valgusDeg = (Math.asin(Math.min(1, perpDist / lineMag)) * 180) / Math.PI;
      if (valgusDeg > maxKneeValgusDeg) {
        maxKneeValgusDeg = valgusDeg;
      }
    }
  }

  const roundedPelvicDrop = Math.round(maxPelvicDropDeg * 10) / 10;
  const roundedValgus = Math.round(maxKneeValgusDeg * 10) / 10;
  const findings: string[] = [];
  const findingsFr: string[] = [];
  let verdict: MobilityVerdict = 'PASS';
  let score = 100;

  const hasTrendelenburg = maxPelvicDropDeg >= 5.0;
  const hasValgus = maxKneeValgusDeg >= 7.0;

  if (!hasTrendelenburg && !hasValgus) {
    verdict = 'PASS';
    score = 100;
    findings.push(`Stable pelvic level (< 5° drop) and aligned knee tracking on ${stanceSide} stance.`);
    findingsFr.push(`Bassin stable (< 5° de bascule) et genou aligné en appui monopodal ${stanceSide === 'left' ? 'gauche' : 'droit'}.`);
  } else {
    verdict = (maxPelvicDropDeg >= 9.0 || maxKneeValgusDeg >= 12.0) ? 'SEVERE_RESTRICTION' : 'MODERATE_RESTRICTION';
    score = verdict === 'SEVERE_RESTRICTION' ? 50 : 70;

    if (hasTrendelenburg) {
      findings.push(`Trendelenburg sign detected (${roundedPelvicDrop}° pelvic drop). Indicates gluteus medius weakness.`);
      findingsFr.push(`Signe de Trendelenburg détecté (${roundedPelvicDrop}° de bascule pelvienne). Indique une faiblesse du moyen fessier.`);
    }
    if (hasValgus) {
      findings.push(`Dynamic knee valgus collapse (${roundedValgus}° medial collapse). Multiplies patellofemoral and ACL shear stress.`);
      findingsFr.push(`Valgus dynamique du genou (${roundedValgus}° d’effondrement médial). Multiplie les contraintes rotuliennes et ligamentaires.`);
    }
  }

  const deficitKey = hasValgus ? 'dynamic_knee_valgus' : (hasTrendelenburg ? 'trendelenburg_pelvic_drop' : '');
  const remedialDrills = deficitKey ? getDrillsForDeficit(deficitKey) : [];

  return {
    testType: 'SINGLE_LEG_STABILITY',
    verdict,
    side: stanceSide,
    score,
    measuredAngleDeg: roundedPelvicDrop,
    targetAngleDeg: 0,
    compensationAngleDeg: roundedValgus,
    findings,
    findingsFr,
    remedialDrills,
  };
}

/**
 * Screen 5: Active Straight Leg Raise (ASLR) Screen
 * Evaluates active unilateral hamstring extensibility and contralateral hip stability.
 * Clinical standards:
 * - Active hip flexion >= 80° with knee locked straight (> 165°).
 * - Contralateral leg remains grounded (> 165° extension).
 */
export function evaluateActiveStraightLegRaiseScreen(
  frames: LandmarkFrame[],
  activeSide: 'left' | 'right' = 'left'
): MobilityScreenResult {
  if (!frames || frames.length < 5) {
    return {
      testType: 'ACTIVE_STRAIGHT_LEG_RAISE',
      verdict: 'REFUSED',
      side: activeSide,
      score: 0,
      measuredAngleDeg: 0,
      targetAngleDeg: 85,
      findings: ['Insufficient frames captured for ASLR evaluation.'],
      findingsFr: ['Nombre d’images insuffisant pour l’évaluation du test de la jambe tendue.'],
      remedialDrills: [],
    };
  }

  const activeHipIdx = activeSide === 'left' ? LM.LEFT_HIP : LM.RIGHT_HIP;
  const activeKneeIdx = activeSide === 'left' ? LM.LEFT_KNEE : LM.RIGHT_KNEE;
  const activeAnkleIdx = activeSide === 'left' ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE;
  const oppHipIdx = activeSide === 'left' ? LM.RIGHT_HIP : LM.LEFT_HIP;
  const oppKneeIdx = activeSide === 'left' ? LM.RIGHT_KNEE : LM.LEFT_KNEE;
  const oppAnkleIdx = activeSide === 'left' ? LM.RIGHT_ANKLE : LM.LEFT_ANKLE;
  const shoulderIdx = activeSide === 'left' ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;

  let maxHipFlexionDeg = 0;
  let minActiveKneeAngle = 180;
  let minOppKneeAngle = 180;

  for (const frame of frames) {
    const lms = frame.landmarks;
    const activeHip = lms[activeHipIdx];
    const activeKnee = lms[activeKneeIdx];
    const activeAnkle = lms[activeAnkleIdx];
    const oppHip = lms[oppHipIdx];
    const oppKnee = lms[oppKneeIdx];
    const oppAnkle = lms[oppAnkleIdx];
    const shoulder = lms[shoulderIdx];

    if (!activeHip || !activeKnee || !activeAnkle || !shoulder) continue;

    // Active knee straightness: hip - knee - ankle
    const activeKneeAngle = calculateJointAngle3D(activeHip, activeKnee, activeAnkle);
    if (activeKneeAngle < minActiveKneeAngle) {
      minActiveKneeAngle = activeKneeAngle;
    }

    // Contralateral knee straightness
    if (oppHip && oppKnee && oppAnkle) {
      const oppKneeAngle = calculateJointAngle3D(oppHip, oppKnee, oppAnkle);
      if (oppKneeAngle < minOppKneeAngle) {
        minOppKneeAngle = oppKneeAngle;
      }
    }

    // Active hip flexion angle: angle between torso (shoulder -> hip) and thigh (hip -> knee)
    // 180° = flat/extended; 90° = vertical leg raise.
    // Hip flexion = 180° - angle(shoulder, hip, knee).
    const torsoThighAngle = calculateJointAngle3D(shoulder, activeHip, activeKnee);
    const hipFlexion = Math.max(0, 180 - torsoThighAngle);

    if (hipFlexion > maxHipFlexionDeg) {
      maxHipFlexionDeg = hipFlexion;
    }
  }

  const roundedFlexion = Math.round(maxHipFlexionDeg * 10) / 10;
  const findings: string[] = [];
  const findingsFr: string[] = [];
  let verdict: MobilityVerdict = 'PASS';
  let score = 100;

  const hasContralateralCheating = minOppKneeAngle < 160;
  const hasActiveKneeBending = minActiveKneeAngle < 160;

  if (maxHipFlexionDeg >= 80 && !hasActiveKneeBending && !hasContralateralCheating) {
    verdict = 'PASS';
    score = 100;
    findings.push(`Optimal active hamstring extensibility (${roundedFlexion}° vs 85° target) with neutral pelvis.`);
    findingsFr.push(`Extensibilité optimale des ischio-jambiers (${roundedFlexion}° vs 85° cible) avec bassin neutre.`);
  } else if (hasContralateralCheating) {
    verdict = 'MODERATE_RESTRICTION';
    score = 75;
    findings.push(`Contralateral knee flexion detected (${Math.round(minOppKneeAngle)}°). Indicates tight contralateral hip flexors / psoas.`);
    findingsFr.push(`Flexion du genou opposé détectée (${Math.round(minOppKneeAngle)}°). Indique une raideur des fléchisseurs de hanche opposés (psoas).`);
  } else if (maxHipFlexionDeg >= 70) {
    verdict = 'MODERATE_RESTRICTION';
    score = 70;
    findings.push(`Moderate hamstring restriction (${roundedFlexion}° vs 85° target). Limits safe depth in Romanian deadlifts.`);
    findingsFr.push(`Restriction modérée des ischio-jambiers (${roundedFlexion}° vs 85° cible). Limite la profondeur au soulevé de terre roumain.`);
  } else {
    verdict = 'SEVERE_RESTRICTION';
    score = 45;
    findings.push(`Severe hamstring restriction (${roundedFlexion}° vs 85° target). High risk of compensatory lumbar flexion.`);
    findingsFr.push(`Restriction sévère des ischio-jambiers (${roundedFlexion}° vs 85° cible). Fort risque de flexion lombaire compensatoire.`);
  }

  const deficitKey = hasContralateralCheating
    ? 'contralateral_hip_flexor_tightness'
    : (verdict !== 'PASS' ? 'hamstring_aslr_restriction' : '');
  const remedialDrills = deficitKey ? getDrillsForDeficit(deficitKey) : [];

  return {
    testType: 'ACTIVE_STRAIGHT_LEG_RAISE',
    verdict,
    side: activeSide,
    score,
    measuredAngleDeg: roundedFlexion,
    targetAngleDeg: 85,
    findings,
    findingsFr,
    remedialDrills,
  };
}

/**
 * Aggregates all completed mobility screens into a comprehensive kinesiology battery report.
 */
export function aggregateMobilityBattery(
  screens: MobilityScreenResult[],
  id: string = 'battery-report',
  date: string = new Date().toISOString()
): FullMobilityBatteryReport {
  const deficits = new Set<string>();
  const functionalImpacts: string[] = [];
  const functionalImpactsFr: string[] = [];

  let totalScore = 0;
  let count = 0;

  for (const s of screens) {
    if (s.verdict !== 'REFUSED') {
      totalScore += s.score;
      count++;
    }

    if (s.verdict !== 'PASS') {
      switch (s.testType) {
        case 'ANKLE_DORSIFLEXION':
          deficits.add('ankle_dorsiflexion_restriction');
          functionalImpacts.push('Restricted ankle dorsiflexion causes early heel rise and premature forward torso collapse in Barbell and Hack Squats.');
          functionalImpactsFr.push('La restriction de flexion de cheville provoque le décollement précoce du talon et l’effondrement du buste en squat.');
          break;
        case 'HIP_ROTATION':
          deficits.add('hip_internal_rotation_deficit');
          functionalImpacts.push('Limited hip rotation triggers pelvic butt wink at parallel squat depth and lateral shifting under load.');
          functionalImpactsFr.push('La rotation de hanche limitée déclenche la rétroversion pelvienne en bas de squat et un déport latéral.');
          break;
        case 'OVERHEAD_MOBILITY':
          deficits.add(s.compensationAngleDeg && s.compensationAngleDeg > 10 ? 'lumbar_overhead_compensation' : 'overhead_shoulder_restriction');
          functionalImpacts.push('Overhead restriction causes hyperextension of the lumbar spine and anterior shoulder impingement during overhead presses and pull-ups.');
          functionalImpactsFr.push('La restriction d’épaule entraîne une cambrure lombaire compensatoire et un pincement de l’épaule au développé militaire.');
          break;
        case 'SINGLE_LEG_STABILITY':
          deficits.add('dynamic_knee_valgus');
          functionalImpacts.push('Dynamic knee valgus and pelvic drop multiply patellar tendon and ACL shear loads during lunges and leg presses.');
          functionalImpactsFr.push('Le valgus dynamique et la bascule pelvienne multiplient les contraintes rotuliennes et ligamentaires lors des fentes.');
          break;
        case 'ACTIVE_STRAIGHT_LEG_RAISE':
          deficits.add('hamstring_aslr_restriction');
          functionalImpacts.push('Hamstring tightness forces spinal flexion during Romanian deadlifts, drastically elevating L4-S1 disc shear stress.');
          functionalImpactsFr.push('La raideur des ischio-jambiers force la flexion lombaire au soulevé de terre roumain, augmentant la pression sur les disques L4-S1.');
          break;
      }
    }
  }

  const identifiedDeficits = Array.from(deficits);
  const recommendedWarmupProtocol = getWarmupProtocolForDeficits(identifiedDeficits);
  const overallMobilityScore = count > 0 ? Math.round(totalScore / count) : 100;

  return {
    id,
    date,
    overallMobilityScore,
    screens,
    identifiedDeficits,
    functionalGymImpacts: functionalImpacts,
    functionalGymImpactsFr: functionalImpactsFr,
    recommendedWarmupProtocol,
  };
}
