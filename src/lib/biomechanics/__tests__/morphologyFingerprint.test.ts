import { describe, it, expect } from 'vitest';
import {
  extractMorphologicalMetrics,
  deriveLiftingPrescription,
  generateMorphologicalFingerprint,
  type Landmark3D,
} from '../morphologyFingerprint';

// Helper to synthesize a 33-point body with precise segment lengths
function makeSyntheticBody(opts: {
  femurLength: number;
  tibiaLength: number;
  torsoLength: number;
  biacromialWidth: number;
  biiliacWidth: number;
  humerusLength: number;
  forearmLength: number;
}): Landmark3D[] {
  const lm: Landmark3D[] = Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));

  const halfShoulder = opts.biacromialWidth / 2;
  const halfHip = opts.biiliacWidth / 2;

  // Shoulders (11, 12)
  lm[11] = { x: 0.5 - halfShoulder, y: 0.2, z: 0, visibility: 0.95 };
  lm[12] = { x: 0.5 + halfShoulder, y: 0.2, z: 0, visibility: 0.95 };

  // Hips (23, 24)
  const hipY = 0.2 + opts.torsoLength;
  lm[23] = { x: 0.5 - halfHip, y: hipY, z: 0, visibility: 0.95 };
  lm[24] = { x: 0.5 + halfHip, y: hipY, z: 0, visibility: 0.95 };

  // Knees (25, 26)
  const kneeY = hipY + opts.femurLength;
  lm[25] = { x: 0.5 - halfHip, y: kneeY, z: 0, visibility: 0.95 };
  lm[26] = { x: 0.5 + halfHip, y: kneeY, z: 0, visibility: 0.95 };

  // Ankles (27, 28)
  const ankleY = kneeY + opts.tibiaLength;
  lm[27] = { x: 0.5 - halfHip, y: ankleY, z: 0, visibility: 0.95 };
  lm[28] = { x: 0.5 + halfHip, y: ankleY, z: 0, visibility: 0.95 };

  // Elbows (13, 14)
  const elbowY = 0.2 + opts.humerusLength;
  lm[13] = { x: 0.5 - halfShoulder, y: elbowY, z: 0, visibility: 0.95 };
  lm[14] = { x: 0.5 + halfShoulder, y: elbowY, z: 0, visibility: 0.95 };

  // Wrists (15, 16)
  const wristY = elbowY + opts.forearmLength;
  lm[15] = { x: 0.5 - halfShoulder, y: wristY, z: 0, visibility: 0.95 };
  lm[16] = { x: 0.5 + halfShoulder, y: wristY, z: 0, visibility: 0.95 };

  return lm;
}

describe('Morphological Fingerprint Engine', () => {
  it('gracefully returns null for incomplete or missing landmarks', () => {
    expect(extractMorphologicalMetrics([])).toBeNull();
    expect(extractMorphologicalMetrics(null as unknown as Landmark3D[])).toBeNull();
    expect(generateMorphologicalFingerprint([])).toBeNull();
  });

  it('correctly classifies a long-femur, short-torso lifter and prescribes wide stance and heel elevation', () => {
    const longFemurBody = makeSyntheticBody({
      femurLength: 0.45,
      tibiaLength: 0.38, // Ratio 0.45 / 0.38 = 1.184
      torsoLength: 0.42,
      biacromialWidth: 0.38,
      biiliacWidth: 0.28,
      humerusLength: 0.30,
      forearmLength: 0.25,
    });

    const fingerprint = generateMorphologicalFingerprint(longFemurBody);
    expect(fingerprint).not.toBeNull();
    expect(fingerprint?.metrics.femurToTibiaRatio).toBeGreaterThan(1.06);

    const squat = fingerprint?.prescriptions.squat;
    expect(squat?.morphologyType).toBe('long_femur_short_torso');
    expect(squat?.stanceWidthMultiplier).toBe(1.25);
    expect(squat?.recommendedToeFlare).toBe(30);
    expect(squat?.heelElevationAdvised).toBe(true);

    const dl = fingerprint?.prescriptions.deadlift;
    expect(dl?.optimalStyle).toBe('sumo_or_trap_bar');
  });

  it('correctly classifies a short-femur, long-torso lifter and prescribes compact upright squat', () => {
    const shortFemurBody = makeSyntheticBody({
      femurLength: 0.35,
      tibiaLength: 0.40, // Ratio 0.35 / 0.40 = 0.875
      torsoLength: 0.55,
      biacromialWidth: 0.38,
      biiliacWidth: 0.28,
      humerusLength: 0.30,
      forearmLength: 0.25,
    });

    const fingerprint = generateMorphologicalFingerprint(shortFemurBody);
    expect(fingerprint).not.toBeNull();
    expect(fingerprint?.metrics.femurToTibiaRatio).toBeLessThan(0.94);

    const squat = fingerprint?.prescriptions.squat;
    expect(squat?.morphologyType).toBe('short_femur_long_torso');
    expect(squat?.stanceWidthMultiplier).toBe(0.95);
    expect(squat?.optimalTorsoInclination.min).toBe(65);
    expect(squat?.heelElevationAdvised).toBe(false);
  });
});
