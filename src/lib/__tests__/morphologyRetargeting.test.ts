import { describe, it, expect } from 'vitest';
import { analyzeMorphology } from '../biomechanics/morphologyRetargeting';
import { Landmark3D } from '../biomechanics/kinematicFootLocking';

function createProportionalSkeleton(femurLen: number, tibiaLen: number, torsoLen: number): Landmark3D[] {
  const lms: Landmark3D[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.95,
  }));

  // Ankles at y = 0.90
  lms[27] = { x: 0.45, y: 0.90, z: 0, visibility: 0.95 };
  lms[28] = { x: 0.55, y: 0.90, z: 0, visibility: 0.95 };

  // Knees at y = 0.90 - tibiaLen
  const kneeY = 0.90 - tibiaLen;
  lms[25] = { x: 0.45, y: kneeY, z: 0, visibility: 0.95 };
  lms[26] = { x: 0.55, y: kneeY, z: 0, visibility: 0.95 };

  // Hips at y = kneeY - femurLen
  const hipY = kneeY - femurLen;
  lms[23] = { x: 0.45, y: hipY, z: 0, visibility: 0.95 };
  lms[24] = { x: 0.55, y: hipY, z: 0, visibility: 0.95 };

  // Shoulders at y = hipY - torsoLen
  const shoulderY = hipY - torsoLen;
  lms[11] = { x: 0.45, y: shoulderY, z: 0, visibility: 0.95 };
  lms[12] = { x: 0.55, y: shoulderY, z: 0, visibility: 0.95 };

  // Wrists
  lms[15] = { x: 0.20, y: hipY, z: 0, visibility: 0.95 };
  lms[16] = { x: 0.80, y: hipY, z: 0, visibility: 0.95 };

  return lms;
}

describe('analyzeMorphology (Multi-Morphology Anthropometric Retargeting)', () => {
  it('returns null on empty or insufficient landmarks', () => {
    expect(analyzeMorphology([])).toBeNull();
  });

  it('classifies balanced morphology when ratios are standard (~1.05)', () => {
    const lms = createProportionalSkeleton(0.35, 0.33, 0.40);
    const profile = analyzeMorphology(lms);

    expect(profile).not.toBeNull();
    expect(profile?.morphotype).toBe('balanced');
    expect(profile?.femurTibiaRatio).toBeCloseTo(1.06, 1);
    expect(profile?.expectedTrunkAngleDeg).toBe(32);
  });

  it('classifies long_femur_leverage when femur is disproportionately long', () => {
    // Femur 0.42, Tibia 0.32 -> ratio = 1.31 >= 1.15
    const lms = createProportionalSkeleton(0.42, 0.32, 0.35);
    const profile = analyzeMorphology(lms);

    expect(profile).not.toBeNull();
    expect(profile?.morphotype).toBe('long_femur_leverage');
    expect(profile?.expectedTrunkAngleDeg).toBe(42);
    expect(profile?.morphotypeLabel.fr).toContain('Fémurs longs');
  });

  it('classifies short_femur_upright when femur is short relative to tibia', () => {
    // Femur 0.28, Tibia 0.34 -> ratio = 0.82 <= 0.95
    const lms = createProportionalSkeleton(0.28, 0.34, 0.42);
    const profile = analyzeMorphology(lms);

    expect(profile).not.toBeNull();
    expect(profile?.morphotype).toBe('short_femur_upright');
    expect(profile?.expectedTrunkAngleDeg).toBe(22);
    expect(profile?.morphotypeLabel.fr).toContain('Fémurs courts');
  });
});
