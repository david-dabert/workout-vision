import { describe, it, expect } from 'vitest';
import { analyzeMovementOptimization, evaluateLiveRepQuality } from '../movementOptimization';
import { RepDetail } from '../../counting/core';

describe('Movement Optimization & Kinematic Hypertrophy Engine', () => {
  it('returns safe default values when no reps are provided', () => {
    const result = analyzeMovementOptimization([], 'squat', false);
    expect(result.romScore).toBe(0);
    expect(result.controlIndex).toBe(0);
    expect(result.coachingPoints.length).toBeGreaterThan(0);
  });

  it('evaluates optimal stretch and controlled tempo when reps hit target ROM and tempo', () => {
    const sampleReps: RepDetail[] = [
      { index: 1, startTime: 1.0, endTime: 4.5, concentricSec: 1.2, eccentricSec: 2.3, romDegrees: 92, peakSpeed: 100, meanSpeed: 60 },
      { index: 2, startTime: 5.0, endTime: 8.4, concentricSec: 1.1, eccentricSec: 2.3, romDegrees: 90, peakSpeed: 100, meanSpeed: 60 },
      { index: 3, startTime: 9.0, endTime: 12.5, concentricSec: 1.2, eccentricSec: 2.3, romDegrees: 91, peakSpeed: 100, meanSpeed: 60 },
    ];

    const result = analyzeMovementOptimization(sampleReps, 'squat', false);
    expect(result.romScore).toBeGreaterThanOrEqual(95);
    expect(result.controlIndex).toBeGreaterThanOrEqual(85);
    expect(result.formBadge.id).toBe('OPTIMAL_STRETCH');
    expect(result.coachingPoints.length).toBe(3);
    expect(result.coachingPoints[0]).toContain('stretch excursion');
  });

  it('detects momentum when eccentric lowering is excessively fast', () => {
    const ballisticReps: RepDetail[] = [
      { index: 1, startTime: 1.0, endTime: 2.2, concentricSec: 0.8, eccentricSec: 0.4, romDegrees: 85, peakSpeed: 180, meanSpeed: 120 },
      { index: 2, startTime: 2.5, endTime: 3.7, concentricSec: 0.7, eccentricSec: 0.5, romDegrees: 85, peakSpeed: 180, meanSpeed: 120 },
    ];

    const result = analyzeMovementOptimization(ballisticReps, 'squat', false);
    expect(result.formBadge.id).toBe('MOMENTUM_DETECTED');
    expect(result.controlIndex).toBeLessThan(50);
    expect(result.coachingPoints[1]).toContain('momentum');
  });

  it('flags partial range when depth is cut short', () => {
    const partialReps: RepDetail[] = [
      { index: 1, startTime: 1.0, endTime: 4.0, concentricSec: 1.0, eccentricSec: 2.0, romDegrees: 50, peakSpeed: 80, meanSpeed: 50 },
      { index: 2, startTime: 4.5, endTime: 7.5, concentricSec: 1.0, eccentricSec: 2.0, romDegrees: 52, peakSpeed: 80, meanSpeed: 50 },
    ];

    const result = analyzeMovementOptimization(partialReps, 'squat', false);
    expect(result.romScore).toBeLessThan(75);
    expect(result.formBadge.id).toBe('PARTIAL_RANGE');
  });

  it('provides bilingual coaching output in French when fr=true', () => {
    const reps: RepDetail[] = [
      { index: 1, startTime: 1.0, endTime: 4.5, concentricSec: 1.2, eccentricSec: 2.3, romDegrees: 92, peakSpeed: 100, meanSpeed: 60 },
      { index: 2, startTime: 5.0, endTime: 8.4, concentricSec: 1.1, eccentricSec: 2.3, romDegrees: 90, peakSpeed: 100, meanSpeed: 60 },
    ];

    const result = analyzeMovementOptimization(reps, 'pendulum_squat', true);
    expect(result.formBadge.labelFr).toBe('Étirement complet validé');
    expect(result.coachingPoints[0]).toContain('étirement');
  });

  describe('Live rep quality evaluation', () => {
    it('flags momentum on fast eccentric in live stream', () => {
      const badge = evaluateLiveRepQuality(85, 0.4, 'bench_press', false);
      expect(badge.id).toBe('MOMENTUM_DETECTED');
    });

    it('identifies full stretch when ROM exceeds 95% of archetype target', () => {
      const badge = evaluateLiveRepQuality(90, 1.8, 'squat', false);
      expect(badge.id).toBe('OPTIMAL_STRETCH');
    });

    it('identifies partial range when ROM is cut short', () => {
      const badge = evaluateLiveRepQuality(45, 1.8, 'squat', false);
      expect(badge.id).toBe('PARTIAL_RANGE');
    });
  });
});
