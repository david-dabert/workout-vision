/**
 * Kinetic Injury Flag Engine: Dynamic Biomechanical Risk Detection & Remedial Prescription.
 *
 * Problem:
 * During heavy loaded compound lifts (squats, leg presses, deadlifts), sub-optimal form under fatigue
 * causes acute joint shearing:
 * 1. Dynamic Knee Valgus: Medial collapse of knees during concentric drive, multiplying ACL tear risk
 *    and patellofemoral joint compression.
 * 2. Lumbar Flexion / Rounding: Loss of neutral spinal cylinder during reversal, causing L4-L5/L5-S1
 *    disc anterior wedging and high posterior shear stress under axial loading.
 *
 * Solution:
 * Analyzes multi-frame trajectory windows across individual reps to calculate frontal knee-to-ankle
 * displacement ratios and sagittal spinal-pelvic hinge angles. Flags excessive deviations and pairs
 * them with evidence-based physical therapy corrective drills.
 */

export interface Point3D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export type InjurySeverity = 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE';

export interface CorrectiveDrill {
  name: string;
  prescription: string;
  targetMuscle: string;
  rationale: string;
}

export interface KineticInjuryFlag {
  type: 'KNEE_VALGUS' | 'LUMBAR_FLEXION';
  severity: InjurySeverity;
  affectedJoint: string;
  metricValue: number;
  threshold: number;
  repIndex: number;
  message: string;
  correctiveDrills: CorrectiveDrill[];
}

export interface KineticInjuryAnalysis {
  flags: KineticInjuryFlag[];
  hasHighRiskFlags: boolean;
  overallSafetyScore: number; // 0 to 100
  summaryFeedback: string;
}

// MediaPipe landmark indices
const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

/**
 * Evaluates dynamic knee valgus collapse during concentric ascent.
 *
 * In normal squat mechanics, the knee width tracks directly over or slightly outside the ankle width:
 * W_knee / W_ankle >= 0.95.
 * If W_knee / W_ankle drops below 0.85 during concentric drive, the knees are collapsing medially.
 */
export function evaluateKneeValgus(
  frames: ArrayLike<{ landmarks: Point3D[] }>,
  startFrame: number,
  endFrame: number,
  repIndex: number = 1
): KineticInjuryFlag | null {
  if (!frames || frames.length === 0 || startFrame >= endFrame) {
    return null;
  }

  const s = Math.max(0, startFrame);
  const e = Math.min(frames.length - 1, endFrame);

  let minKneeToAnkleRatio = 1.0;
  let maxMedialDeficit = 0.0;

  for (let i = s; i <= e; i++) {
    const lms = frames[i]?.landmarks;
    if (!lms || lms.length < 29) continue;

    const leftKnee = lms[LM.LEFT_KNEE];
    const rightKnee = lms[LM.RIGHT_KNEE];
    const leftAnkle = lms[LM.LEFT_ANKLE];
    const rightAnkle = lms[LM.RIGHT_ANKLE];

    // Check visibility
    const visMin = Math.min(
      leftKnee.visibility ?? 1,
      rightKnee.visibility ?? 1,
      leftAnkle.visibility ?? 1,
      rightAnkle.visibility ?? 1
    );
    if (visMin < 0.4) continue;

    const kneeWidth = Math.abs(leftKnee.x - rightKnee.x);
    const ankleWidth = Math.abs(leftAnkle.x - rightAnkle.x);

    if (ankleWidth > 0.08) {
      const ratio = kneeWidth / ankleWidth;
      if (ratio < minKneeToAnkleRatio) {
        minKneeToAnkleRatio = ratio;
        maxMedialDeficit = 1.0 - ratio;
      }
    }
  }

  // Thresholds for valgus collapse
  if (minKneeToAnkleRatio < 0.82) {
    const severity: InjurySeverity =
      minKneeToAnkleRatio < 0.65 ? 'SEVERE' : minKneeToAnkleRatio < 0.75 ? 'MODERATE' : 'MILD';

    return {
      type: 'KNEE_VALGUS',
      severity,
      affectedJoint: 'Genou (compartiment fémoro-patellaire et ligament croisé antérieur)',
      metricValue: Math.round((1 - minKneeToAnkleRatio) * 100),
      threshold: 18, // 18% deficit
      repIndex,
      message: `Effondrement en valgus détecté sur la rep ${repIndex}\u00A0: vos genoux rentrent vers l'intérieur lors de la poussée.`,
      correctiveDrills: [
        {
          name: 'Squat avec bande élastique au-dessus des genoux',
          prescription: '3 séries de 12 répétitions en tempo 3-1-1-0 en échauffement',
          targetMuscle: 'Fessier moyen (gluteus medius) et rotateurs externes de hanche',
          rationale: 'Active le recrutement moteur des rotateurs externes pour empêcher le valgus dynamique sous charge axiale.',
        },
        {
          name: 'Fente bulgare contrôlée avec miroir d’alignement',
          prescription: '3 séries de 8 répétitions par jambe',
          targetMuscle: 'Chaîne unilatérale de stabilisation fémoro-tibiale',
          rationale: 'Corrige l’asymétrie de stabilisation et renforce le guidage fémoral dans l’axe du 2e orteil.',
        },
      ],
    };
  }

  return null;
}

/**
 * Evaluates lumbar spine flexion / rounding breakdown during hip flexion under load.
 *
 * Compares the inclination angle of the torso (mid-shoulder to mid-hip) relative to the vertical
 * and checks for sudden flexion displacement (rounding) at bottom turnaround or concentric onset.
 */
export function evaluateLumbarFlexion(
  frames: ArrayLike<{ landmarks: Point3D[] }>,
  startFrame: number,
  endFrame: number,
  repIndex: number = 1
): KineticInjuryFlag | null {
  if (!frames || frames.length === 0 || startFrame >= endFrame) {
    return null;
  }

  const s = Math.max(0, startFrame);
  const e = Math.min(frames.length - 1, endFrame);

  let baselineTorsoInclination: number | null = null;
  let maxSpinalFlexionDeviationDeg = 0;

  for (let i = s; i <= e; i++) {
    const lms = frames[i]?.landmarks;
    if (!lms || lms.length < 25) continue;

    const leftShoulder = lms[LM.LEFT_SHOULDER];
    const rightShoulder = lms[LM.RIGHT_SHOULDER];
    const leftHip = lms[LM.LEFT_HIP];
    const rightHip = lms[LM.RIGHT_HIP];

    const midShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const midShoulderX = (leftShoulder.x + rightShoulder.x) / 2;
    const midHipY = (leftHip.y + rightHip.y) / 2;
    const midHipX = (leftHip.x + rightHip.x) / 2;

    const dy = midHipY - midShoulderY;
    const dx = midHipX - midShoulderX;
    const torsoAngleDeg = Math.abs((Math.atan2(dx, dy) * 180) / Math.PI);

    if (baselineTorsoInclination === null) {
      baselineTorsoInclination = torsoAngleDeg;
    } else {
      // If torso angle collapses downward/forward abruptly beyond hinge capacity
      const deviation = Math.abs(torsoAngleDeg - baselineTorsoInclination);
      if (deviation > maxSpinalFlexionDeviationDeg) {
        maxSpinalFlexionDeviationDeg = deviation;
      }
    }
  }

  // If lumbar flexion deviation exceeds 16 degrees under loading
  if (maxSpinalFlexionDeviationDeg > 16) {
    const severity: InjurySeverity =
      maxSpinalFlexionDeviationDeg > 28 ? 'SEVERE' : maxSpinalFlexionDeviationDeg > 22 ? 'MODERATE' : 'MILD';

    return {
      type: 'LUMBAR_FLEXION',
      severity,
      affectedJoint: 'Colonne lombaire (charnière L4-L5 / L5-S1)',
      metricValue: Math.round(maxSpinalFlexionDeviationDeg),
      threshold: 16,
      repIndex,
      message: `Flexion lombaire excessive (${Math.round(maxSpinalFlexionDeviationDeg)}°) sur la rep ${repIndex}\u00A0: le bas du dos s'arrondit sous la charge.`,
      correctiveDrills: [
        {
          name: 'Soulevé de terre roumain avec baguette en contact tripode',
          prescription: '3 séries de 10 répétitions lentes avec maintien des 3 points de contact',
          targetMuscle: 'Chaîne postérieure et érecteurs du rachis lombaire',
          rationale: 'Rééduque le patron moteur du hinge pur sans compromettre la neutralité du cylindre thoraco-lombaire.',
        },
        {
          name: 'Gainage Bird-Dog et pont fessier avec béquille abdominale',
          prescription: '3 séries de 6 répétitions par côté avec pause isométrique de 5s',
          targetMuscle: 'Transverse de l’abdomen, multifides et carré des lombes',
          rationale: 'Verrouille la stabilité anti-flexion et anti-rotation du rachis sous pression intra-abdominale.',
        },
      ],
    };
  }

  return null;
}

/**
 * Analyzes full set frames and rep boundaries to produce a complete Kinetic Injury Analysis report.
 */
export function analyzeSetKineticSafety(
  frames: ArrayLike<{ landmarks: Point3D[] }>,
  repBoundaries: Array<{ startFrame: number; endFrame: number }>
): KineticInjuryAnalysis {
  const flags: KineticInjuryFlag[] = [];

  for (let r = 0; r < repBoundaries.length; r++) {
    const rep = repBoundaries[r];
    const repNum = r + 1;

    const valgusFlag = evaluateKneeValgus(frames, rep.startFrame, rep.endFrame, repNum);
    if (valgusFlag) flags.push(valgusFlag);

    const lumbarFlag = evaluateLumbarFlexion(frames, rep.startFrame, rep.endFrame, repNum);
    if (lumbarFlag) flags.push(lumbarFlag);
  }

  let penalty = 0;
  for (const flag of flags) {
    if (flag.severity === 'SEVERE') penalty += 25;
    else if (flag.severity === 'MODERATE') penalty += 15;
    else if (flag.severity === 'MILD') penalty += 8;
  }

  const overallSafetyScore = Math.max(20, Math.min(100, 100 - penalty));
  const hasHighRiskFlags = flags.some((f) => f.severity === 'SEVERE' || f.severity === 'MODERATE');

  let summaryFeedback = 'Intégrité biomécanique exemplaire\u00A0: aucun stress articulaire critique détecté.';
  if (hasHighRiskFlags) {
    summaryFeedback =
      'Alerte articulaire\u00A0: des compensations cinématiques sous charge augmentent le risque de lésion. Consultez les consignes correctives ci-dessous.';
  } else if (flags.length > 0) {
    summaryFeedback =
      'Forme acceptable avec légères dérivations posturales en fin de série\u00A0: maintenez la tension de gainage.';
  }

  return {
    flags,
    hasHighRiskFlags,
    overallSafetyScore,
    summaryFeedback,
  };
}
