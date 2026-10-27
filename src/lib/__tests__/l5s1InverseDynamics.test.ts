import { describe, it, expect } from 'vitest';
import { computeL5S1InverseDynamics } from '../biomechanics/l5s1InverseDynamics';

describe('L5/S1 Lumbar Spine Biomechanical Inverse Dynamics Engine', () => {
  // Helper to create synthetic landmarks
  function makePose(trunkAngleDeg = 0) {
    const rad = (trunkAngleDeg * Math.PI) / 180;
    const trunkLen = 0.4;
    const hipX = 0.5, hipY = 0.6;
    const shoulderX = hipX + trunkLen * Math.sin(rad);
    const shoulderY = hipY - trunkLen * Math.cos(rad);

    const lms = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
    lms[11] = { x: shoulderX - 0.05, y: shoulderY, z: 0, visibility: 0.95 };
    lms[12] = { x: shoulderX + 0.05, y: shoulderY, z: 0, visibility: 0.95 };
    lms[23] = { x: hipX - 0.05, y: hipY, z: 0, visibility: 0.95 };
    lms[24] = { x: hipX + 0.05, y: hipY, z: 0, visibility: 0.95 };
    return lms;
  }

  it('returns null for insufficient or missing landmarks', () => {
    expect(computeL5S1InverseDynamics({ landmarks: [] })).toBeNull();
    // @ts-expect-error test null
    expect(computeL5S1InverseDynamics({ landmarks: null })).toBeNull();
  });

  it('computes near-zero shear force for upright vertical posture (0 deg trunk angle)', () => {
    const lms = makePose(0);
    const result = computeL5S1InverseDynamics({ landmarks: lms, bodyMassKg: 75, loadKg: 0, lift: 'squat' });
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.trunkAngleDeg).toBeLessThanOrEqual(2);
    expect(result.shearForceN).toBeLessThan(50); // sin(0) = 0
    expect(result.reactionTorqueNm).toBeLessThan(15);
    expect(result.safetyTier).toBe('optimal');
    expect(result.advice.fr).toContain('optimal');
  });

  it('computes substantial torque and compressive force during a 45 degree forward trunk tilt (e.g. Romanian Deadlift)', () => {
    const lms = makePose(45);
    const result = computeL5S1InverseDynamics({ landmarks: lms, bodyMassKg: 80, loadKg: 50, lift: 'romanian_deadlift' });
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.trunkAngleDeg).toBeCloseTo(45, 0);
    expect(result.reactionTorqueNm).toBeGreaterThan(100); // Heavy bending moment
    expect(result.erectorSpinaeForceN).toBeGreaterThan(2000); // High back extensor demand
    expect(result.compressiveForceN).toBeGreaterThan(2500); // Substantial axial compression
    expect(result.shearForceN).toBeGreaterThan(400); // Substantial shear
  });

  it('detects high shear risk (> 500 N) when heavy load is tilted past 55 degrees', () => {
    const lms = makePose(60);
    const result = computeL5S1InverseDynamics({ landmarks: lms, bodyMassKg: 80, loadKg: 60, lift: 'deadlift' });
    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.shearForceN).toBeGreaterThan(500);
    expect(result.safetyTier).toBe('high_shear_risk');
    expect(result.advice.fr).toContain('Alerte cisaillement lombaire');
    expect(result.advice.en).toContain('Lumbar shear warning');
  });
});
