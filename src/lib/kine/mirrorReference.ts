/**
 * mirrorReference.ts — Healthy-side self-reference mirror generator & Limb Symmetry Index (LSI).
 *
 * Implements David Dabert's clinical concept discussed with Monsieur Lamine:
 * Using the patient's own unaffected limb as their personalized biomechanical reference avatar.
 *
 * Principles:
 *   1. Non-operator dependent: Algorithmic 3D symmetry measurement with zero inter-rater variability.
 *   2. Patient-centric avatar: Mirrors the healthy limb's trajectory across the sagittal plane.
 *   3. Limb Symmetry Index (LSI): Targets 95% to 105% recovery compared to the healthy baseline.
 *   4. Observance tracking: Quantifies both adherence (frequency) and movement quality (ROM).
 */

import type { LandmarkPoint, FrameLandmarks } from './shoulderDyskinesis';

export interface MirrorOptions {
  healthySide: 'left' | 'right';
  targetLsiMin?: number; // default 95%
  targetLsiMax?: number; // default 105%
}

export interface LsiProgressionMilestone {
  currentLsiPercent: number;
  baselineLsiPercent: number;
  targetLsiMin: number;
  targetLsiMax: number;
  isWithinTargetZone: boolean;
  gainFromBaselinePercent: number;
  statusFr: string;
}

export interface MirroredAvatarTrajectory {
  healthySide: 'left' | 'right';
  targetSide: 'left' | 'right';
  frameCount: number;
  mirroredLandmarks: FrameLandmarks[];
  referenceRomDeg: number;
}

/**
 * Bilateral landmark pairs in MediaPipe Pose Landmarker:
 * Left (odd) <-> Right (even)
 */
const BILATERAL_SWAP_MAP: Record<number, number> = {
  // Ears
  7: 8, 8: 7,
  // Shoulders
  11: 12, 12: 11,
  // Elbows
  13: 14, 14: 13,
  // Wrists
  15: 16, 16: 15,
  // Hips
  23: 24, 24: 23,
  // Knees
  25: 26, 26: 25,
  // Ankles
  27: 28, 28: 27,
};

/**
 * Mirrors a frame's landmarks horizontally across the mid-sagittal line,
 * swapping left/right joint indices so the healthy limb becomes the target limb's reference.
 */
export function mirrorLandmarksFrame(frame: FrameLandmarks): FrameLandmarks {
  const mirrored: FrameLandmarks = {};

  // Find mid-sagittal X reference (midpoint of hips or shoulders)
  let midX = 0.5;
  const shL = frame[11], shR = frame[12];
  const hipL = frame[23], hipR = frame[24];

  if (shL && shR) {
    midX = (shL.x + shR.x) / 2;
  } else if (hipL && hipR) {
    midX = (hipL.x + hipR.x) / 2;
  }

  for (const [keyStr, pt] of Object.entries(frame)) {
    const idx = Number(keyStr);
    if (!pt || Number.isNaN(idx)) continue;

    // Mirror X across mid-sagittal line: x' = 2 * midX - x
    const mirroredPt: LandmarkPoint = {
      x: Math.round((2 * midX - pt.x) * 10000) / 10000,
      y: pt.y,
      z: pt.z,
      visibility: pt.visibility,
    };

    // Swap index to opposite side if bilateral
    const swappedIdx = BILATERAL_SWAP_MAP[idx] ?? idx;
    mirrored[swappedIdx] = mirroredPt;
  }

  return mirrored;
}

/**
 * Generates a full mirrored trajectory from the patient's healthy limb recordings.
 */
export function createHealthySideMirrorAvatar(
  healthyTrajectory: FrameLandmarks[],
  options: MirrorOptions
): MirroredAvatarTrajectory {
  const mirroredLandmarks: FrameLandmarks[] = [];

  for (const frame of healthyTrajectory) {
    mirroredLandmarks.push(mirrorLandmarksFrame(frame));
  }

  const targetSide = options.healthySide === 'left' ? 'right' : 'left';

  return {
    healthySide: options.healthySide,
    targetSide,
    frameCount: mirroredLandmarks.length,
    mirroredLandmarks,
    referenceRomDeg: 180, // placeholder updated upon evaluation
  };
}

/**
 * Computes Limb Symmetry Index (LSI) progress toward the 95% - 105% objective.
 */
export function computeLsiProgress(
  currentRomPathological: number,
  healthyReferenceRom: number,
  baselinePathologicalRom: number = currentRomPathological,
  targetMin = 95,
  targetMax = 105
): LsiProgressionMilestone {
  if (healthyReferenceRom <= 0) {
    return {
      currentLsiPercent: 0,
      baselineLsiPercent: 0,
      targetLsiMin: targetMin,
      targetLsiMax: targetMax,
      isWithinTargetZone: false,
      gainFromBaselinePercent: 0,
      statusFr: 'Référence saine invalide',
    };
  }

  const currentLsi = Math.round((currentRomPathological / healthyReferenceRom) * 1000) / 10;
  const baselineLsi = Math.round((baselinePathologicalRom / healthyReferenceRom) * 1000) / 10;
  const gain = Math.round((currentLsi - baselineLsi) * 10) / 10;
  const isWithinTargetZone = currentLsi >= targetMin && currentLsi <= targetMax;

  let statusFr = `En progression (${currentLsi}\u00A0% de l’amplitude du côté sain).`;
  if (isWithinTargetZone) {
    statusFr = `Objectif atteint\u00A0: symétrie optimale restaurée (${currentLsi}\u00A0%).`;
  } else if (currentLsi > targetMax) {
    statusFr = `Surcompensation observée (${currentLsi}\u00A0% par rapport au côté sain).`;
  } else if (currentLsi < 70) {
    statusFr = `Déficit significatif (${currentLsi}\u00A0%). Rééducation prioritaire.`;
  }

  return {
    currentLsiPercent: currentLsi,
    baselineLsiPercent: baselineLsi,
    targetLsiMin: targetMin,
    targetLsiMax: targetMax,
    isWithinTargetZone,
    gainFromBaselinePercent: gain,
    statusFr,
  };
}
