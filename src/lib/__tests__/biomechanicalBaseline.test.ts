import { describe, it, expect } from 'vitest';
import {
  calibrateBaselineSignature,
  calculateSmasScore,
  evaluateRepAdaptation,
  evaluateSetBaselines,
  RepKinematics,
} from '../biomechanicalBaseline';

describe('Biomechanical Baseline & Movement Adaptation Engine (S-MAS)', () => {
  const mockSet: RepKinematics[] = [
    { repIndex: 1, concentricVelocity: 0.65, peakConcentricVelocity: 0.85, concentricDuration: 0.9, romDegrees: 95, trunkLeanDegrees: 18, symmetryIndex: 98 },
    { repIndex: 2, concentricVelocity: 0.63, peakConcentricVelocity: 0.82, concentricDuration: 0.95, romDegrees: 94, trunkLeanDegrees: 19, symmetryIndex: 97 },
    { repIndex: 3, concentricVelocity: 0.60, peakConcentricVelocity: 0.80, concentricDuration: 1.0, romDegrees: 93, trunkLeanDegrees: 19, symmetryIndex: 96 },
    { repIndex: 4, concentricVelocity: 0.52, peakConcentricVelocity: 0.70, concentricDuration: 1.15, romDegrees: 91, trunkLeanDegrees: 21, symmetryIndex: 94 },
    { repIndex: 5, concentricVelocity: 0.44, peakConcentricVelocity: 0.58, concentricDuration: 1.4, romDegrees: 89, trunkLeanDegrees: 24, symmetryIndex: 91 },
    { repIndex: 6, concentricVelocity: 0.32, peakConcentricVelocity: 0.42, concentricDuration: 1.9, romDegrees: 85, trunkLeanDegrees: 32, symmetryIndex: 82, stickingDeceleration: 3.1 },
  ];

  it('calibrates uncompromised baseline signature from the first 3 reps', () => {
    const sig = calibrateBaselineSignature(mockSet);
    expect(sig.calibratedRepsCount).toBe(3);
    // (0.65 + 0.63 + 0.60) / 3 = 0.627
    expect(sig.baselineConcentricVelocity).toBeCloseTo(0.627, 2);
    expect(sig.baselineRomDegrees).toBeCloseTo(94, 0);
    expect(sig.baselineTrunkLeanDegrees).toBeCloseTo(18.7, 1);
    expect(sig.baselineSymmetryIndex).toBeCloseTo(97, 0);
  });

  it('calculates S-MAS score correctly with velocity, drift, and symmetry penalties', () => {
    // 0 loss, 0 drift, 0 deficit -> 100
    expect(calculateSmasScore(0, 0, 0)).toBe(100);

    // 20% velocity loss, 4 deg drift, 5% symmetry deficit
    // 100 - (0.8*20 + 1.5*4 + 0.6*5) = 100 - (16 + 6 + 3) = 75
    expect(calculateSmasScore(20, 4, 5)).toBe(75);

    // Severe failure: 50% loss, 15 deg drift, 25% asymmetry -> 23 < 50
    const low = calculateSmasScore(50, 15, 25);
    expect(low).toBeLessThan(50);
  });

  it('detects intentional tempo pacing vs authentic fatigue breakdown', () => {
    const sig = calibrateBaselineSignature(mockSet);

    // Intentional tempo: slow velocity (0.40 vs 0.63 baseline), but long eccentric (3.0s), no sticking deceleration, low drift (2 deg)
    const tempoRep: RepKinematics = {
      repIndex: 4,
      concentricVelocity: 0.40,
      concentricDuration: 1.8,
      eccentricDuration: 3.0,
      romDegrees: 94,
      trunkLeanDegrees: 19,
      symmetryIndex: 96,
      stickingDeceleration: 0.5,
    };

    const tempoResult = evaluateRepAdaptation(tempoRep, sig);
    expect(tempoResult.neuromuscularState).toBe('INTENTIONAL_PACING');
    expect(tempoResult.smasScore).toBeGreaterThan(85);

    // Severe fatigue breakdown (Rep 6): 50% velocity loss, 13 deg drift, sticking deceleration 3.1
    const breakdownResult = evaluateRepAdaptation(mockSet[5], sig);
    expect(breakdownResult.neuromuscularState).toBe('BIOMECHANICAL_BREAKDOWN');
    expect(breakdownResult.stickingPointDetected).toBe(true);
    expect(breakdownResult.smasScore).toBeLessThan(65);
  });

  it('evaluates entire set report and pinpoints fatigue onset repetition', () => {
    const report = evaluateSetBaselines(mockSet);
    expect(report.repAdaptations).toHaveLength(6);
    // Rep 5 triggers HIGH_FATIGUE (29.8% velocity loss > 25%), rep 6 is breakdown
    expect(report.fatigueOnsetRep).toBe(5);
    expect(report.breakdownDetected).toBe(true);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.recommendationsFr.length).toBeGreaterThan(0);
  });

  it('handles empty set inputs gracefully with safe defaults', () => {
    const report = evaluateSetBaselines([]);
    expect(report.repAdaptations).toEqual([]);
    expect(report.overallSmasScore).toBe(100);
    expect(report.fatigueOnsetRep).toBeNull();
  });
});
