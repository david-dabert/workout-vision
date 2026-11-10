/**
 * morphologyFingerprint.ts
 *
 * Computes individual anthropometric proportions from 3D pose landmarks
 * to establish a personalized "Biomechanical Fingerprint".
 *
 * Eliminates the hazard of forced imitation by translating raw anatomical leverage
 * into individualized, joint-safe movement profiles.
 *
 * Grounded in anthropometric literature (Winter DA, Biomechanics and Motor Control;
 * Cholewicki & McGill, Lumbar Spine Mechanics).
 */

export interface Landmark3D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface MorphologicalMetrics {
  femurLength: number;
  tibiaLength: number;
  torsoLength: number;
  totalLegLength: number;
  biacromialWidth: number;
  biiliacWidth: number;
  humerusLength: number;
  forearmLength: number;
  femurToTibiaRatio: number;
  torsoToLegRatio: number;
  shoulderToHipRatio: number;
  armToTorsoRatio: number;
}

export interface LiftingArchetypePrescription {
  squat: {
    morphologyType: 'long_femur_short_torso' | 'short_femur_long_torso' | 'balanced';
    stanceWidthMultiplier: number;
    recommendedToeFlare: number;
    optimalTorsoInclination: { min: number; max: number };
    heelElevationAdvised: boolean;
    cueEn: string;
    cueFr: string;
  };
  deadlift: {
    optimalStyle: 'conventional' | 'sumo_or_trap_bar' | 'semi_sumo';
    hipStartingHeight: 'low' | 'moderate' | 'high';
    cueEn: string;
    cueFr: string;
  };
  benchPress: {
    recommendedGripWidthMultiplier: number;
    recommendedElbowTuckAngle: number;
    cueEn: string;
    cueFr: string;
  };
}

export interface MorphologicalFingerprint {
  timestamp: string;
  metrics: MorphologicalMetrics;
  prescriptions: LiftingArchetypePrescription;
  summaryEn: string;
  summaryFr: string;
}

function dist3D(a: Landmark3D, b: Landmark3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function midPoint3D(a: Landmark3D, b: Landmark3D): Landmark3D {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z || 0) + (b.z || 0)) / 2,
  };
}

/**
 * Extracts morphological metrics from standing frontal or 3/4 pose landmarks.
 * Expects MediaPipe 33 keypoints.
 */
export function extractMorphologicalMetrics(landmarks: Landmark3D[]): MorphologicalMetrics | null {
  if (!landmarks || landmarks.length < 33) return null;

  const ls = landmarks[11]; // Left shoulder
  const rs = landmarks[12]; // Right shoulder
  const le = landmarks[13]; // Left elbow
  const re = landmarks[14]; // Right elbow
  const lw = landmarks[15]; // Left wrist
  const rw = landmarks[16]; // Right wrist
  const lh = landmarks[23]; // Left hip
  const rh = landmarks[24]; // Right hip
  const lk = landmarks[25]; // Left knee
  const rk = landmarks[26]; // Right knee
  const la = landmarks[27]; // Left ankle
  const ra = landmarks[28]; // Right ankle

  if (!ls || !rs || !lh || !rh || !lk || !rk || !la || !ra) {
    return null;
  }

  const leftFemur = dist3D(lh, lk);
  const rightFemur = dist3D(rh, rk);
  const femurLength = (leftFemur + rightFemur) / 2;

  const leftTibia = dist3D(lk, la);
  const rightTibia = dist3D(rk, ra);
  const tibiaLength = (leftTibia + rightTibia) / 2;

  const totalLegLength = femurLength + tibiaLength;

  const midShoulders = midPoint3D(ls, rs);
  const midHips = midPoint3D(lh, rh);
  const torsoLength = dist3D(midShoulders, midHips);

  const biacromialWidth = dist3D(ls, rs);
  const biiliacWidth = dist3D(lh, rh);

  const leftHumerus = le ? dist3D(ls, le) : 0;
  const rightHumerus = re ? dist3D(rs, re) : 0;
  const humerusLength = (leftHumerus + rightHumerus) / 2;

  const leftForearm = le && lw ? dist3D(le, lw) : 0;
  const rightForearm = re && rw ? dist3D(re, rw) : 0;
  const forearmLength = (leftForearm + rightForearm) / 2;

  if (tibiaLength <= 0 || totalLegLength <= 0 || biiliacWidth <= 0 || torsoLength <= 0) {
    return null;
  }

  const femurToTibiaRatio = femurLength / tibiaLength;
  const torsoToLegRatio = torsoLength / totalLegLength;
  const shoulderToHipRatio = biacromialWidth / biiliacWidth;
  const armToTorsoRatio = (humerusLength + forearmLength) / torsoLength;

  return {
    femurLength: Math.round(femurLength * 1000) / 1000,
    tibiaLength: Math.round(tibiaLength * 1000) / 1000,
    torsoLength: Math.round(torsoLength * 1000) / 1000,
    totalLegLength: Math.round(totalLegLength * 1000) / 1000,
    biacromialWidth: Math.round(biacromialWidth * 1000) / 1000,
    biiliacWidth: Math.round(biiliacWidth * 1000) / 1000,
    humerusLength: Math.round(humerusLength * 1000) / 1000,
    forearmLength: Math.round(forearmLength * 1000) / 1000,
    femurToTibiaRatio: Math.round(femurToTibiaRatio * 100) / 100,
    torsoToLegRatio: Math.round(torsoToLegRatio * 100) / 100,
    shoulderToHipRatio: Math.round(shoulderToHipRatio * 100) / 100,
    armToTorsoRatio: Math.round(armToTorsoRatio * 100) / 100,
  };
}

/**
 * Derives personalized biomechanical prescriptions based on the extracted ratios.
 */
export function deriveLiftingPrescription(metrics: MorphologicalMetrics): LiftingArchetypePrescription {
  // Squat morphology derivation
  let squatMorph: 'long_femur_short_torso' | 'short_femur_long_torso' | 'balanced' = 'balanced';
  let squatStance = 1.0;
  let squatToeFlare = 20;
  let squatTorsoAngle = { min: 55, max: 70 };
  let heelElevation = false;
  let squatCueEn = 'Maintain even balance over midfoot with synchronized hip and knee extension.';
  let squatCueFr = 'Maintenez l\u2019équilibre sur le milieu du pied avec extension synchronisée des hanches et des genoux.';

  if (metrics.femurToTibiaRatio > 1.06 || metrics.torsoToLegRatio < 0.65) {
    squatMorph = 'long_femur_short_torso';
    squatStance = 1.25;
    squatToeFlare = 30;
    squatTorsoAngle = { min: 42, max: 55 };
    heelElevation = true;
    squatCueEn = 'Long femurs require a wider stance (1.25x shoulders) and natural forward trunk lean to protect knees and lumbar spine. Heel wedge strongly advised.';
    squatCueFr = 'Fémurs longs\u00A0: écartez vos appuis (1,25x épaules) et acceptez une inclinaison naturelle du buste vers l\u2019avant. Cales sous les talons recommandées.';
  } else if (metrics.femurToTibiaRatio < 0.94 && metrics.torsoToLegRatio >= 0.72) {
    squatMorph = 'short_femur_long_torso';
    squatStance = 0.95;
    squatToeFlare = 15;
    squatTorsoAngle = { min: 65, max: 80 };
    heelElevation = false;
    squatCueEn = 'Favorable squat levers allow a narrow upright stance with minimal forward trunk displacement.';
    squatCueFr = 'Leviers courts très favorables\u00A0: squat vertical compact avec faible inclinaison du tronc.';
  }

  // Deadlift morphology derivation
  let dlStyle: 'conventional' | 'sumo_or_trap_bar' | 'semi_sumo' = 'conventional';
  let dlHipHeight: 'low' | 'moderate' | 'high' = 'moderate';
  let dlCueEn = 'Balanced setup with shins grazing bar and lats engaged.';
  let dlCueFr = 'Départ équilibré tibias proches de la barre, dorsaux verrouillés.';

  if (squatMorph === 'long_femur_short_torso') {
    dlStyle = 'sumo_or_trap_bar';
    dlHipHeight = 'moderate';
    dlCueEn = 'Long femurs increase spinal shear in conventional pulls. Sumo or Trap Bar provides optimal vertical trunk alignment.';
    dlCueFr = 'Fémurs longs\u00A0: privilégiez le Soulevé de Terre Sumo ou la Trap Bar pour réduire la contrainte de cisaillement lombaire.';
  } else if (metrics.armToTorsoRatio > 1.15) {
    dlStyle = 'conventional';
    dlHipHeight = 'high';
    dlCueEn = 'Long arm reach grants an ideal conventional deadlift lever. High hip hinge setup recommended.';
    dlCueFr = 'Bras longs\u00A0: levier d\u2019arraché conventionnel exceptionnel. Hanches hautes stables recommandées.';
  }

  // Bench Press morphology derivation
  const bpGrip = metrics.shoulderToHipRatio > 1.2 ? 1.5 : 1.35;
  const bpElbowTuck = metrics.shoulderToHipRatio > 1.2 ? 55 : 45;
  const bpCueEn = `Optimal grip width is ${bpGrip}x biacromial distance, tucking elbows to ${bpElbowTuck} degrees to eliminate subacromial impingement.`;
  const bpCueFr = `Prise optimale à ${bpGrip}x la largeur d\u2019épaules, coudes resserrés à ${bpElbowTuck}\u00B0 pour préserver le conflit sous-acromial.`;

  return {
    squat: {
      morphologyType: squatMorph,
      stanceWidthMultiplier: squatStance,
      recommendedToeFlare: squatToeFlare,
      optimalTorsoInclination: squatTorsoAngle,
      heelElevationAdvised: heelElevation,
      cueEn: squatCueEn,
      cueFr: squatCueFr,
    },
    deadlift: {
      optimalStyle: dlStyle,
      hipStartingHeight: dlHipHeight,
      cueEn: dlCueEn,
      cueFr: dlCueFr,
    },
    benchPress: {
      recommendedGripWidthMultiplier: bpGrip,
      recommendedElbowTuckAngle: bpElbowTuck,
      cueEn: bpCueEn,
      cueFr: bpCueFr,
    },
  };
}

/**
 * Main entrypoint: generates the full Morphological Fingerprint from raw 3D pose landmarks.
 */
export function generateMorphologicalFingerprint(landmarks: Landmark3D[]): MorphologicalFingerprint | null {
  const metrics = extractMorphologicalMetrics(landmarks);
  if (!metrics) return null;

  const prescriptions = deriveLiftingPrescription(metrics);

  const summaryEn = `Morphological Fingerprint: Femur/Tibia ratio ${metrics.femurToTibiaRatio}, Torso/Leg ratio ${metrics.torsoToLegRatio}. Recommended squat archetype: ${prescriptions.squat.morphologyType}.`;
  const summaryFr = `Empreinte Morphologique\u00A0: Ratio Fémur/Tibia ${metrics.femurToTibiaRatio}, Ratio Buste/Jambes ${metrics.torsoToLegRatio}. Archétype squat recommandé\u00A0: ${prescriptions.squat.morphologyType}.`;

  return {
    timestamp: new Date().toISOString(),
    metrics,
    prescriptions,
    summaryEn,
    summaryFr,
  };
}
