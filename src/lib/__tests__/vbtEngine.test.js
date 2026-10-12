import { describe, it, expect } from 'vitest';
import { analyzeVbtAndStickingPoint } from '../vbtEngine';

describe('vbtEngine — Velocity-Based Training & Sticking Point Analysis', () => {
  it('returns null for insufficient reps (< 2 valid reps)', () => {
    expect(analyzeVbtAndStickingPoint([], [], [], 'squat')).toBeNull();
    expect(analyzeVbtAndStickingPoint([{ index: 1, romDegrees: 90, concentricSec: 1.0 }], [], [], 'squat')).toBeNull();
    expect(analyzeVbtAndStickingPoint(null, [], [], 'squat')).toBeNull();
  });

  it('calculates velocity loss, fatigue zone, and RIR for valid reps', () => {
    // Rep 1: 90 deg in 1.0s = 90 deg/s
    // Rep 2: 90 deg in 1.2s = 75 deg/s
    // Rep 3: 90 deg in 1.5s = 60 deg/s
    // Fastest = Rep 1 (90 deg/s), Last = Rep 3 (60 deg/s)
    // Loss = (90 - 60) / 90 * 100 = 33.3% -> 33% (high fatigue)
    const reps = [
      { index: 1, romDegrees: 90, concentricSec: 1.0, startTime: 0, endTime: 2.0, clipped: false },
      { index: 2, romDegrees: 90, concentricSec: 1.2, startTime: 3.0, endTime: 5.2, clipped: false },
      { index: 3, romDegrees: 90, concentricSec: 1.5, startTime: 6.0, endTime: 8.5, clipped: false },
    ];

    const result = analyzeVbtAndStickingPoint(reps, [], [], 'squat');
    expect(result).not.toBeNull();
    expect(result.velocityLossPercent).toBe(33);
    expect(result.fatigueZone).toBe('high');
    expect(result.estimatedRir).toBe('0-1');
    expect(result.fastestRepVelocity).toBe(90);
    expect(result.lastRepVelocity).toBe(60);
    expect(result.slowestRepIndex).toBe(3);
    expect(result.cueFr).toContain('33\u00A0%');
    expect(result.cueEn).toContain('33%');
  });

  it('classifies low fatigue (< 10% velocity loss)', () => {
    const reps = [
      { index: 1, romDegrees: 90, concentricSec: 1.0, startTime: 0, endTime: 2.0 },
      { index: 2, romDegrees: 90, concentricSec: 1.05, startTime: 3.0, endTime: 5.0 },
    ];

    const result = analyzeVbtAndStickingPoint(reps, [], [], 'bench_press');
    expect(result).not.toBeNull();
    expect(result.velocityLossPercent).toBeLessThan(10);
    expect(result.fatigueZone).toBe('low');
    expect(result.estimatedRir).toBe('3+');
    expect(result.cueFr).toContain('modérée');
  });

  it('classifies optimal hypertrophy/strength fatigue (10-20% velocity loss)', () => {
    const reps = [
      { index: 1, romDegrees: 100, concentricSec: 1.0, startTime: 0, endTime: 2.0 }, // 100 deg/s
      { index: 2, romDegrees: 100, concentricSec: 1.2, startTime: 3.0, endTime: 5.0 }, // 83.3 deg/s (16.7% loss)
    ];

    const result = analyzeVbtAndStickingPoint(reps, [], [], 'squat');
    expect(result).not.toBeNull();
    expect(result.velocityLossPercent).toBe(17);
    expect(result.fatigueZone).toBe('optimal');
    expect(result.estimatedRir).toBe('1-2');
    expect(result.cueFr).toContain('Zone idéale');
  });

  it('identifies sticking point angle during slowest concentric phase', () => {
    // Rep 1: 0 to 2s, Rep 2 (slowest): 3 to 6s with ascent in 4.5 to 6.0s (squat: eccentric first)
    const reps = [
      { index: 1, romDegrees: 90, concentricSec: 1.0, startTime: 0.0, endTime: 2.0 },
      { index: 2, romDegrees: 90, concentricSec: 1.5, startTime: 3.0, endTime: 6.0 },
    ];

    // Simulate timestamps and angles during concentric ascent (4.5 to 6.0s)
    // Turnaround at 4.5s (angle 70 deg), slow down at 5.2s (angle 95 deg), lockout at 6.0s (angle 160 deg)
    const timestamps = [
      4.5, 4.7, 4.9, 5.1, 5.3, 5.5, 5.7, 5.9, 6.0
    ];
    // Notice between 5.1s and 5.3s, angle changes very slowly (92 to 94 deg)
    const angles = [
      70, 78, 88, 92, 94, 110, 130, 150, 160
    ];

    const result = analyzeVbtAndStickingPoint(reps, timestamps, angles, 'squat');
    expect(result).not.toBeNull();
    expect(result.stickingAngleDeg).toBeDefined();
    expect(typeof result.stickingAngleDeg).toBe('number');
    // The sticking point should be around 92-94 deg
    expect(result.stickingAngleDeg).toBeGreaterThanOrEqual(90);
    expect(result.stickingAngleDeg).toBeLessThanOrEqual(100);
    expect(result.cueFr).toContain(`${result.stickingAngleDeg}°`);
  });

  it('contains zero medical words in generated coaching cues', () => {
    const reps = [
      { index: 1, romDegrees: 90, concentricSec: 1.0, startTime: 0, endTime: 2.0 },
      { index: 2, romDegrees: 90, concentricSec: 2.0, startTime: 3.0, endTime: 6.0 },
    ];

    const result = analyzeVbtAndStickingPoint(reps, [3, 4, 5, 6], [80, 90, 100, 120], 'squat');
    const MEDICAL = /\bpatients?\b|r[ée][ée]ducation|rehabilitat|diagnos|traitement|th[ée]rap|\binjur|\bbless/i;
    expect(MEDICAL.test(result.cueFr)).toBe(false);
    expect(MEDICAL.test(result.cueEn)).toBe(false);
  });
});
