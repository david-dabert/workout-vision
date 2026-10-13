import { describe, it, expect } from 'vitest';
import {
  calculateNioshLifting,
  calculateRebaScore,
  extractNioshParametersFromLandmarks,
} from '../niosh';

describe('Industrial Ergonomics & NIOSH Lifting Equation Engine', () => {
  it('computes baseline safe lifting parameters at optimal geometry', () => {
    // Optimal lift: H = 25 cm, V = 75 cm (knuckle height), D = 25 cm, A = 0 deg, Load = 15 kg
    const result = calculateNioshLifting({
      loadWeightKg: 15,
      horizontalDistanceCm: 25,
      verticalOriginCm: 75,
      verticalTravelDistanceCm: 25,
      asymmetryAngleDeg: 0,
    });

    expect(result.horizontalMultiplierHM).toBe(1.0);
    expect(result.verticalMultiplierVM).toBe(1.0);
    expect(result.asymmetricMultiplierAM).toBe(1.0);
    expect(result.recommendedWeightLimitKg).toBeCloseTo(23.0, 1);
    expect(result.liftingIndexLI).toBeLessThan(1.0);
    expect(result.riskCategory).toBe('safe');
    expect(result.estimatedL5S1CompressionNewtons).toBeLessThan(2500);
  });

  it('detects high ergonomic risk for extended reach and asymmetric twist', () => {
    // High-risk lift: H = 50 cm (extended reach), V = 30 cm (deep bending), D = 60 cm, A = 45 deg twist, Load = 25 kg
    const result = calculateNioshLifting({
      loadWeightKg: 25,
      horizontalDistanceCm: 50,
      verticalOriginCm: 30,
      verticalTravelDistanceCm: 60,
      asymmetryAngleDeg: 45,
    });

    expect(result.horizontalMultiplierHM).toBe(0.5); // 25 / 50
    expect(result.asymmetricMultiplierAM).toBeLessThan(0.9);
    expect(result.recommendedWeightLimitKg).toBeLessThan(10.0);
    expect(result.liftingIndexLI).toBeGreaterThan(2.5);
    expect(result.riskCategory).not.toBe('safe');
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('evaluates REBA postural scores correctly', () => {
    // Severe trunk and arm flexion
    const res = calculateRebaScore({
      trunkFlexionDeg: 65,
      neckFlexionDeg: 25,
      legsFlexionDeg: 30,
      upperArmFlexionDeg: 50,
    });

    expect(res.rebaScore).toBeGreaterThanOrEqual(8);
    expect(res.actionLevel).toContain('High Risk');
  });

  it('extracts NIOSH lifting variables accurately from 33-point skeletal landmarks', () => {
    // Create synthetic landmark array for a lifter with hands at knuckle height (V ~ 75cm)
    const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    // Shoulders at y = 0.25
    landmarks[11] = { x: 0.45, y: 0.25, z: 0 };
    landmarks[12] = { x: 0.55, y: 0.25, z: 0 };
    // Hips at y = 0.50
    landmarks[23] = { x: 0.47, y: 0.50, z: 0 };
    landmarks[24] = { x: 0.53, y: 0.50, z: 0 };
    // Ankles at y = 0.85 (span = 0.60, representing 175cm stature)
    landmarks[27] = { x: 0.46, y: 0.85, z: 0 };
    landmarks[28] = { x: 0.54, y: 0.85, z: 0 };
    // Wrists at y = 0.52 (slightly below hips, knuckle level)
    landmarks[15] = { x: 0.50, y: 0.52, z: -0.1 };
    landmarks[16] = { x: 0.50, y: 0.52, z: -0.1 };

    const extracted = extractNioshParametersFromLandmarks(landmarks, 175);
    expect(extracted.verticalOriginCm).toBeGreaterThan(65);
    expect(extracted.verticalOriginCm).toBeLessThan(85);
    expect(extracted.horizontalDistanceCm).toBeGreaterThanOrEqual(25);
    expect(extracted.horizontalDistanceCm).toBeLessThanOrEqual(63);
    expect(extracted.asymmetryAngleDeg).toBeLessThanOrEqual(10);
  });
});

