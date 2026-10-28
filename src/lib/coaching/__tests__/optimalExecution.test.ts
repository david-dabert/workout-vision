import { describe, it, expect } from 'vitest';
import {
  getOptimalExecutionBlueprint,
  generateCoachPrescription,
  OPTIMAL_BLUEPRINTS,
} from '../optimalExecution';

describe('Optimal Execution Blueprint & Coach Prescription Engine', () => {
  it('resolves optimal biomechanical blueprints across diverse movement archetypes', () => {
    const squatBlueprint = getOptimalExecutionBlueprint('squat');
    expect(squatBlueprint.optimalStretchAngle).toBe(80);
    expect(squatBlueprint.continuousTensionRequired).toBe(true);
    expect(squatBlueprint.setupAnchorFr).toBeTruthy();
    expect(squatBlueprint.setupAnchorEn).toBeTruthy();

    const pendulumBlueprint = getOptimalExecutionBlueprint('pendulum_squat');
    expect(pendulumBlueprint.optimalStretchAngle).toBe(80);
    expect(pendulumBlueprint.optimalEccentricRangeSec).toEqual([2.5, 4.0]);

    const preacherBlueprint = getOptimalExecutionBlueprint('preacher_curl');
    expect(preacherBlueprint.optimalStretchAngle).toBe(160);
    expect(preacherBlueprint.primaryJoint).toBe('elbow');
  });

  it('generates flawless mastery verdict when athlete executes according to optimal standard', () => {
    const flawlessTelemetry = {
      avgRomDeg: 95,
      minAngleDeg: 74, // Deeper than 80° target
      avgEccentricSec: 3.0, // Inside [2.5, 3.5]
      bounceCount: 0,
      continuousTensionPercent: 95,
      velocityLossPercent: 25,
    };

    const prescription = generateCoachPrescription(flawlessTelemetry, 'squat', false);
    expect(prescription.executionComplianceScore).toBeGreaterThanOrEqual(95);
    expect(prescription.tier).toBe('flawless');
    expect(prescription.limitingFactor.category).toBe('none');
    expect(prescription.nextSetPrescription.cueFr).toContain('Conservez exactement cette rigueur technique');
  });

  it('diagnoses momentum bounce as #1 limiting factor and prescribes dead-stop pause', () => {
    const bounceTelemetry = {
      avgRomDeg: 90,
      minAngleDeg: 78,
      avgEccentricSec: 2.8,
      bounceCount: 3, // Multiple momentum rebounds
      continuousTensionPercent: 85,
      velocityLossPercent: 20,
    };

    const prescription = generateCoachPrescription(bounceTelemetry, 'hack_squat', true);
    expect(prescription.limitingFactor.category).toBe('momentum_bounce');
    expect(prescription.limitingFactor.severity).toBe('high');
    expect(prescription.nextSetPrescription.cueFr).toContain('0,5s de pause morte au point bas');
    expect(prescription.nextSetPrescription.mentalFocusFr).toContain('zéro rebond');
  });

  it('diagnoses stretch depth shortfall and prescribes audio-click depth targeting', () => {
    const shallowTelemetry = {
      avgRomDeg: 70,
      minAngleDeg: 94, // 14° shallower than 80° target
      avgEccentricSec: 2.7,
      bounceCount: 0,
      continuousTensionPercent: 90,
      velocityLossPercent: 15,
    };

    const prescription = generateCoachPrescription(shallowTelemetry, 'leg_press', true);
    expect(prescription.limitingFactor.category).toBe('stretch_depth');
    expect(prescription.nextSetPrescription.cueFr).toContain('déclic audio d’étirement optimal');
    expect(prescription.nextSetPrescription.cueFr).toContain('80°');
  });

  it('diagnoses lockout resting and prescribes continuous tension avoidance of bone lockout', () => {
    const lockoutRestingTelemetry = {
      avgRomDeg: 90,
      minAngleDeg: 78,
      avgEccentricSec: 2.6,
      bounceCount: 0,
      continuousTensionPercent: 50, // Resting 50% of the set at top lockout
      velocityLossPercent: 20,
    };

    const prescription = generateCoachPrescription(lockoutRestingTelemetry, 'pendulum_squat', true);
    expect(prescription.limitingFactor.category).toBe('lockout_resting');
    expect(prescription.nextSetPrescription.cueFr).toContain('2 cm avant la butée articulaire haute');
    expect(prescription.nextSetPrescription.mentalFocusFr).toContain('Arrêt 2 cm avant la butée haute');
  });

  it('enforces French typography non-breaking spaces on all prescription strings', () => {
    for (const [key, bp] of Object.entries(OPTIMAL_BLUEPRINTS)) {
      if (bp.executionCueFr) {
        expect(bp.executionCueFr).not.toMatch(/\s[:;?!]/);
      }
    }
  });
});
