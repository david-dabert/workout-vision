import { describe, it, expect } from 'vitest';
import {
  evaluateKneeValgus,
  evaluateLumbarFlexion,
  analyzeSetKineticSafety,
  Point3D,
} from '../injuryFlags';

function createNeutralFrame(kneeWidth: number = 0.3, ankleWidth: number = 0.3, torsoAngleDeg: number = 10): { landmarks: Point3D[] } {
  const lms: Point3D[] = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 }));

  // Shoulders & Hips
  const rad = (torsoAngleDeg * Math.PI) / 180;
  const torsoLen = 0.4;
  const midHipX = 0.5;
  const midHipY = 0.6;
  const midShoulderX = midHipX - torsoLen * Math.sin(rad);
  const midShoulderY = midHipY - torsoLen * Math.cos(rad);

  lms[11] = { x: midShoulderX - 0.15, y: midShoulderY, z: 0, visibility: 0.95 };
  lms[12] = { x: midShoulderX + 0.15, y: midShoulderY, z: 0, visibility: 0.95 };
  lms[23] = { x: midHipX - 0.12, y: midHipY, z: 0, visibility: 0.95 };
  lms[24] = { x: midHipX + 0.12, y: midHipY, z: 0, visibility: 0.95 };

  // Knees & Ankles
  lms[25] = { x: 0.5 - kneeWidth / 2, y: 0.8, z: 0, visibility: 0.95 };
  lms[26] = { x: 0.5 + kneeWidth / 2, y: 0.8, z: 0, visibility: 0.95 };
  lms[27] = { x: 0.5 - ankleWidth / 2, y: 1.0, z: 0, visibility: 0.95 };
  lms[28] = { x: 0.5 + ankleWidth / 2, y: 1.0, z: 0, visibility: 0.95 };

  return { landmarks: lms };
}

describe('Kinetic Injury Flag Engine', () => {
  it('returns null when knees track symmetrically over ankles (neutral alignment)', () => {
    const frames = [
      createNeutralFrame(0.3, 0.3),
      createNeutralFrame(0.32, 0.3),
      createNeutralFrame(0.3, 0.3),
    ];

    const flag = evaluateKneeValgus(frames, 0, 2, 1);
    expect(flag).toBeNull();
  });

  it('detects dynamic knee valgus collapse during concentric ascent', () => {
    const frames = [
      createNeutralFrame(0.3, 0.3), // Stance
      createNeutralFrame(0.28, 0.3), // Bottom
      createNeutralFrame(0.18, 0.3), // Severe cave inward (18cm knee vs 30cm ankle = ratio 0.60)
      createNeutralFrame(0.25, 0.3), // Lockout recovery
    ];

    const flag = evaluateKneeValgus(frames, 0, 3, 1);
    expect(flag).not.toBeNull();
    expect(flag?.type).toBe('KNEE_VALGUS');
    expect(flag?.severity).toBe('SEVERE');
    expect(flag?.affectedJoint).toContain('fémoro-patellaire');
    expect(flag?.correctiveDrills.length).toBeGreaterThan(0);
    expect(flag?.correctiveDrills[0].name).toContain('bande élastique');
  });

  it('returns null when torso inclination remains locked in neutral hip hinge', () => {
    const frames = [
      createNeutralFrame(0.3, 0.3, 15),
      createNeutralFrame(0.3, 0.3, 20),
      createNeutralFrame(0.3, 0.3, 22),
    ];

    const flag = evaluateLumbarFlexion(frames, 0, 2, 1);
    expect(flag).toBeNull();
  });

  it('detects severe lumbar flexion rounding breakdown (>20 deg sudden deviation)', () => {
    const frames = [
      createNeutralFrame(0.3, 0.3, 10), // Upright start
      createNeutralFrame(0.3, 0.3, 25), // Normal hinge
      createNeutralFrame(0.3, 0.3, 42), // Sudden lumbar rounding breakdown: 32 deg deviation from baseline
      createNeutralFrame(0.3, 0.3, 20),
    ];

    const flag = evaluateLumbarFlexion(frames, 0, 3, 2);
    expect(flag).not.toBeNull();
    expect(flag?.type).toBe('LUMBAR_FLEXION');
    expect(flag?.severity).toBe('SEVERE');
    expect(flag?.affectedJoint).toContain('L4-L5 / L5-S1');
    expect(flag?.correctiveDrills[0].name).toContain('Soulevé de terre roumain');
  });

  it('aggregates multi-rep set analysis into overall safety score and diagnostic summary', () => {
    const frames = [
      createNeutralFrame(0.3, 0.3, 10),
      createNeutralFrame(0.3, 0.3, 15),
      createNeutralFrame(0.18, 0.3, 35), // Valgus + Lumbar break
      createNeutralFrame(0.3, 0.3, 10),
    ];

    const analysis = analyzeSetKineticSafety(frames, [{ startFrame: 0, endFrame: 3 }]);
    expect(analysis.flags.length).toBe(2);
    expect(analysis.hasHighRiskFlags).toBe(true);
    expect(analysis.overallSafetyScore).toBeLessThan(70);
    expect(analysis.summaryFeedback).toContain('Alerte articulaire');
  });
});
