/**
 * Multi-Morphology Anthropometric Retargeting (MMAR)
 *
 * Grounded in Dempster (1955), Winter (2009), and Chaffin & Andersson (1991).
 * Athletes have vastly different skeletal proportions:
 * - A lifter with long femurs and a short torso MUST lean forward (~40°-48°) in a parallel squat
 *   to maintain the combined center of mass over the midfoot.
 * - A lifter with short femurs and a long torso squats almost completely upright (~18°-25°).
 *
 * Without morphology retargeting, generic computer vision tools falsely penalize long-femured
 * lifters for "excessive forward lean". This engine computes individual segment ratios,
 * classifies morphotype, and normalizes kinematic tolerances and coaching cues.
 */

import { Landmark3D } from './kinematicFootLocking';

export type MorphotypeCategory = 'long_femur_leverage' | 'short_femur_upright' | 'balanced';

export interface MorphologyProfile {
  femurTibiaRatio: number;      // Thigh length / Shank length (normal: ~1.05)
  torsoFemurRatio: number;      // Torso length / Thigh length (normal: ~1.20)
  armSpanHeightRatio: number;   // Arm span / Total height (normal: ~1.00)
  morphotype: MorphotypeCategory;
  morphotypeLabel: { fr: string; en: string };
  expectedTrunkAngleDeg: number;// Optimal forward lean angle at parallel depth
  biomechanicalInsight: { fr: string; en: string };
}

export function computeDistance3D(a: Landmark3D, b: Landmark3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.hypot(dx, dy, dz);
}

export function analyzeMorphology(landmarks: Landmark3D[]): MorphologyProfile | null {
  if (!landmarks || landmarks.length < 33) return null;

  // MediaPipe landmarks:
  // 11/12: Shoulders
  // 23/24: Hips
  // 25/26: Knees
  // 27/28: Ankles
  // 15/16: Wrists

  const lShoulder = landmarks[11];
  const rShoulder = landmarks[12];
  const lHip = landmarks[23];
  const rHip = landmarks[24];
  const lKnee = landmarks[25];
  const rKnee = landmarks[26];
  const lAnkle = landmarks[27];
  const rAnkle = landmarks[28];
  const lWrist = landmarks[15];
  const rWrist = landmarks[16];

  // Segment lengths (average bilateral to resist single-side perspective noise)
  const lTibia = computeDistance3D(lAnkle, lKnee);
  const rTibia = computeDistance3D(rAnkle, rKnee);
  const tibiaLen = (lTibia + rTibia) / 2;

  const lFemur = computeDistance3D(lKnee, lHip);
  const rFemur = computeDistance3D(rKnee, rHip);
  const femurLen = (lFemur + rFemur) / 2;

  const lTorso = computeDistance3D(lHip, lShoulder);
  const rTorso = computeDistance3D(rHip, rShoulder);
  const torsoLen = (lTorso + rTorso) / 2;

  const armSpan = computeDistance3D(lWrist, rWrist);
  const totalHeight = tibiaLen + femurLen + torsoLen;

  if (tibiaLen < 1e-3 || femurLen < 1e-3 || totalHeight < 1e-3) {
    return null;
  }

  const femurTibiaRatio = Math.round((femurLen / tibiaLen) * 100) / 100;
  const torsoFemurRatio = Math.round((torsoLen / femurLen) * 100) / 100;
  const armSpanHeightRatio = Math.round((armSpan / totalHeight) * 100) / 100;

  // Classification based on population standard deviations
  let morphotype: MorphotypeCategory = 'balanced';
  let expectedTrunkAngleDeg = 32;
  let morphotypeLabel = {
    fr: 'Morphologie équilibrée',
    en: 'Balanced morphology',
  };
  let biomechanicalInsight = {
    fr: 'Leviers standards\u00A0: répartition équilibrée des moments de force entre hanches et genoux.',
    en: 'Standard levers: balanced torque distribution between hips and knees.',
  };

  if (femurTibiaRatio >= 1.15) {
    morphotype = 'long_femur_leverage';
    expectedTrunkAngleDeg = 42;
    morphotypeLabel = {
      fr: 'Fémurs longs (dominant hanches)',
      en: 'Long femurs (hip dominant)',
    };
    biomechanicalInsight = {
      fr: 'Fémurs longs\u00A0: une inclinaison naturelle du buste de 38° à 45° est biomécaniquement requise pour garder le centre de gravité au milieu du pied.',
      en: 'Long femurs: natural 38°-45° trunk lean is mechanically required to maintain center of mass over midfoot.',
    };
  } else if (femurTibiaRatio <= 0.95) {
    morphotype = 'short_femur_upright';
    expectedTrunkAngleDeg = 22;
    morphotypeLabel = {
      fr: 'Fémurs courts (dominant genoux)',
      en: 'Short femurs (knee dominant)',
    };
    biomechanicalInsight = {
      fr: 'Fémurs courts\u00A0: morphologie favorisant un buste droit et une forte flexion de genoux sans contrainte lombaire excessive.',
      en: 'Short femurs: morphology naturally favoring upright posture and deep knee flexion with lower lumbar shear.',
    };
  }

  return {
    femurTibiaRatio,
    torsoFemurRatio,
    armSpanHeightRatio,
    morphotype,
    morphotypeLabel,
    expectedTrunkAngleDeg,
    biomechanicalInsight,
  };
}
