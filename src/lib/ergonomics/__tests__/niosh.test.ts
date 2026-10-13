import { describe, it, expect } from 'vitest';
import {
  calculateNioshLifting,
  calculateRebaScore,
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
});
