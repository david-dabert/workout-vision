import { describe, it, expect, beforeEach } from 'vitest';
import { JointReadinessEngine } from '../jointReadiness';

describe('JointReadinessEngine (Musculoskeletal Strain)', () => {
  let engine: JointReadinessEngine;

  beforeEach(() => {
    engine = new JointReadinessEngine();
  });

  it('starts at 100 readiness when no sets are logged', () => {
    const res = engine.evaluateReadiness();
    expect(res.readinessScore).toBe(100);
    expect(res.isDeloadRecommended).toBe(false);
    expect(res.mostStressedJoint).toBe('balanced');
  });

  it('accumulates shoulder strain and flags overhead deload when excessive shrug signs occur', () => {
    // Log 3 heavy sets of overhead press with high shrug sign compensation
    for (let i = 0; i < 3; i++) {
      engine.logSet({
        exerciseId: 'overhead_press',
        completedReps: 10,
        meanRomDegrees: 90,
        peakVelocityDegPerSec: 120,
        shrugSignsCount: 8, // High motor compensation
        bilateralAsymmetryDegrees: 6,
      });
    }

    const res = engine.evaluateReadiness();
    expect(res.mostStressedJoint).toBe('shoulder');
    expect(res.readinessScore).toBeLessThan(50);
    expect(res.isDeloadRecommended).toBe(true);
    expect(res.recommendationFr).toContain('Alerte surcharge articulaire');
    expect(res.recommendationFr).toContain('l’épaule');
  });

  it('accumulates lumbar shear on heavy deadlifts and warns on spinal flexion', () => {
    for (let i = 0; i < 3; i++) {
      engine.logSet({
        exerciseId: 'deadlift',
        completedReps: 8,
        meanRomDegrees: 95,
        peakVelocityDegPerSec: 90,
        spinalFlexionViolationsCount: 5,
        bilateralAsymmetryDegrees: 4,
      });
    }

    const res = engine.evaluateReadiness();
    expect(res.mostStressedJoint).toBe('lumbar_spine');
    expect(res.readinessScore).toBeLessThan(60);
    expect(res.recommendationFr).toContain('lombaire');
  });
});
