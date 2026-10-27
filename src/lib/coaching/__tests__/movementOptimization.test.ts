import { describe, it, expect } from 'vitest';
import {
  analyzeMovementOptimization,
  analyzeContinuousBiomechanics,
  evaluateLiveRepQuality,
} from '../movementOptimization';
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

  it('calculates velocity loss and classifies fatigue tier correctly', () => {
    // Rep 1: 1.0s conc (fastest); Rep 2: 1.2s; Rep 3: 1.5s (fatigued) -> (1.5 - 1.0)/1.5 = 33% (optimal_hypertrophy)
    const hypertrophyReps: RepDetail[] = [
      { index: 1, startTime: 0, endTime: 3.5, concentricSec: 1.0, eccentricSec: 2.5, romDegrees: 85, peakSpeed: 100, meanSpeed: 60 },
      { index: 2, startTime: 4, endTime: 7.7, concentricSec: 1.2, eccentricSec: 2.5, romDegrees: 85, peakSpeed: 100, meanSpeed: 60 },
      { index: 3, startTime: 8, endTime: 12.0, concentricSec: 1.5, eccentricSec: 2.5, romDegrees: 85, peakSpeed: 100, meanSpeed: 60 },
    ];
    const hypResult = analyzeMovementOptimization(hypertrophyReps, 'squat', false);
    expect(hypResult.velocityLossPercent).toBe(33);
    expect(hypResult.fatigueTier).toBe('optimal_hypertrophy');

    // Reps with severe fatigue (>35% velocity loss): 1.0s -> 2.0s = 50%
    const failureReps: RepDetail[] = [
      { index: 1, startTime: 0, endTime: 3.5, concentricSec: 1.0, eccentricSec: 2.5, romDegrees: 85, peakSpeed: 100, meanSpeed: 60 },
      { index: 2, startTime: 4, endTime: 8.5, concentricSec: 2.0, eccentricSec: 2.5, romDegrees: 85, peakSpeed: 100, meanSpeed: 60 },
    ];
    const failResult = analyzeMovementOptimization(failureReps, 'squat', false);
    expect(failResult.velocityLossPercent).toBe(50);
    expect(failResult.fatigueTier).toBe('failure');

    // Constant speed reps (<20% velocity loss)
    const speedReps: RepDetail[] = [
      { index: 1, startTime: 0, endTime: 3.5, concentricSec: 1.0, eccentricSec: 2.5, romDegrees: 85, peakSpeed: 100, meanSpeed: 60 },
      { index: 2, startTime: 4, endTime: 7.5, concentricSec: 1.05, eccentricSec: 2.5, romDegrees: 85, peakSpeed: 100, meanSpeed: 60 },
    ];
    const speedResult = analyzeMovementOptimization(speedReps, 'squat', false);
    expect(speedResult.velocityLossPercent).toBeLessThan(20);
    expect(speedResult.fatigueTier).toBe('speed');
  });

  it('computes physics-based mechanical work, calories, and time under tension', () => {
    const reps: RepDetail[] = [
      { index: 1, startTime: 1.0, endTime: 4.5, concentricSec: 1.2, eccentricSec: 2.3, romDegrees: 85, peakSpeed: 100, meanSpeed: 60 },
      { index: 2, startTime: 5.0, endTime: 8.5, concentricSec: 1.2, eccentricSec: 2.3, romDegrees: 85, peakSpeed: 100, meanSpeed: 60 },
      { index: 3, startTime: 9.0, endTime: 12.5, concentricSec: 1.2, eccentricSec: 2.3, romDegrees: 85, peakSpeed: 100, meanSpeed: 60 },
    ];

    const result = analyzeMovementOptimization(reps, 'squat', false);
    expect(result.mechanicalWorkKj).toBeGreaterThan(0.5);
    expect(result.caloriesKcal).toBeGreaterThan(0.5);
    expect(result.averagePowerWatts).toBeGreaterThan(100);
    expect(result.peakPowerWatts).toBeGreaterThan(100);
    expect(result.powerLossPercent).toBeGreaterThanOrEqual(0);
    expect(result.timeUnderTensionSec).toBeCloseTo(10.5, 1);
    expect(result.tempoCadence).toBe('2-0-1');
    expect(result.repVelocityProfiles.length).toBe(3);
    expect(result.repVelocityProfiles[0].repIndex).toBe(1);
    expect(result.repVelocityProfiles[0].concentricSec).toBe(1.2);
    expect(result.repVelocityProfiles[0].eccentricSec).toBe(2.3);
    expect(result.repVelocityProfiles[0].powerWatts).toBeGreaterThan(100);
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

    it('flags velocity loss when rep decelerates significantly', () => {
      const badgeEn = evaluateLiveRepQuality(85, 2.0, 'squat', false, true);
      expect(badgeEn.id).toBe('VELOCITY_LOSS');
      expect(badgeEn.label).toContain('Deceleration');

      const badgeFr = evaluateLiveRepQuality(85, 2.0, 'squat', true, true);
      expect(badgeFr.id).toBe('VELOCITY_LOSS');
      expect(badgeFr.labelFr).toContain('Ralentissement');
    });
  });

  describe('Continuous Biomechanics Decoding Integration', () => {
    it('decodes continuous angles through the BiomechanicalDecoder and evaluates hypertrophy metrics', () => {
      const fps = 20;
      const dt = 1 / fps;
      const timestamps: number[] = [];
      const angles: number[] = [];

      let cur = 0;
      // 2 clean squat reps: 170 -> 80 -> 170
      for (let r = 0; r < 2; r++) {
        for (let t = 0; t <= 1.5; t += dt) {
          timestamps.push(cur);
          angles.push(170 - (t / 1.5) * 90);
          cur += dt;
        }
        for (let t = 0; t <= 1.0; t += dt) {
          timestamps.push(cur);
          angles.push(80 + (t / 1.0) * 90);
          cur += dt;
        }
      }

      const result = analyzeContinuousBiomechanics(angles, timestamps, 'squat', false);
      expect(result.romScore).toBeGreaterThanOrEqual(90);
      expect(result.repVelocityProfiles.length).toBe(2);
      expect(result.coachingPoints.length).toBeGreaterThanOrEqual(3);
      expect(result.formDistortionScore).toBeDefined();
      expect(result.formDistortionScore).not.toBeNull();
      expect(result.pathEfficiencyPercent).toBeDefined();
      expect(result.pathEfficiencyPercent).toBeGreaterThanOrEqual(50);
      expect(result.sagittalDriftPercent).toBeDefined();
      expect(result.sagittalDriftPercent).toBeGreaterThanOrEqual(0);
    });

    it('identifies sticking points and surfaces French coaching guidance with non-breaking space', () => {
      const fps = 20;
      const dt = 1 / fps;
      const timestamps: number[] = [];
      const angles: number[] = [];

      let cur = 0;
      // Rep with severe sticking point at 110 degrees
      // Descent: 170 -> 80
      for (let t = 0; t <= 1.5; t += dt) {
        timestamps.push(cur);
        angles.push(170 - (t / 1.5) * 90);
        cur += dt;
      }
      // Sticking stall around 110 degrees for 12 frames
      for (let i = 0; i < 12; i++) {
        timestamps.push(cur);
        angles.push(108 + Math.sin(i));
        cur += dt;
      }
      // Concentric completion: 110 -> 170
      for (let t = 0; t <= 1.0; t += dt) {
        timestamps.push(cur);
        angles.push(110 + (t / 1.0) * 60);
        cur += dt;
      }

      const resultFr = analyzeContinuousBiomechanics(angles, timestamps, 'squat', true);
      expect(resultFr.stickingPointSummary).toBeDefined();
      expect(resultFr.stickingPointSummary).toContain('Point de blocage');
      expect(resultFr.stickingPointSummary).toContain('\u00A0:'); // French non-breaking space before colon
      expect(resultFr.stickingPoints).toBeDefined();
      expect(resultFr.stickingPoints!.length).toBeGreaterThan(0);
      const sp = resultFr.stickingPoints![0];
      expect(sp.timestamp).toBeGreaterThan(0);
      expect(sp.angleDeg).toBeGreaterThan(80);
      expect(sp.velocityDropPercent).toBeGreaterThan(0);
    });

    it('evaluates audio sync confidence when audio track is provided', () => {
      const fps = 30;
      const dt = 1 / fps;
      const timestamps: number[] = [];
      const angles: number[] = [];

      let cur = 0;
      // 1 squat rep: 170 -> 80 -> 170
      for (let t = 0; t <= 1.0; t += dt) {
        timestamps.push(cur);
        angles.push(170 - (t / 1.0) * 90);
        cur += dt;
      }
      for (let t = 0; t <= 1.0; t += dt) {
        timestamps.push(cur);
        angles.push(80 + (t / 1.0) * 90);
        cur += dt;
      }

      // Synthetic audio sample with click at turnaround (~1.0s)
      const sampleRate = 44100;
      const audioSamples = new Float32Array(sampleRate * 3);
      const clickIdx = Math.floor(sampleRate * 1.0);
      for (let i = 0; i < 300; i++) {
        audioSamples[clickIdx + i] = 0.8 * Math.sin(2 * Math.PI * 3500 * (i / sampleRate));
      }

      const result = analyzeContinuousBiomechanics(
        angles,
        timestamps,
        'squat',
        false,
        undefined,
        { audioSamples, sampleRate }
      );

      expect(result.audioSyncConfidence).toBeDefined();
      expect(result.audioSyncConfidence).toBeGreaterThan(0.5);
    });
  });
});


