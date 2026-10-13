import { describe, it, expect } from 'vitest';
import {
  calculateGolfXFactor,
  calculateGolfTempo,
  estimateGolfClubheadSpeed,
  calculateTennisTrophyPose,
  calculatePadelBandeja,
  calculateBikeFitKneeAngle,
  calculateBaseballPitchMechanics,
  calculateRowingRhythm,
} from '../kinematics';

describe('Precision Sports Kinematics Engine', () => {
  describe('Golf Swing Kinematics', () => {
    it('calculates optimal Tour X-Factor separation angle', () => {
      const res = calculateGolfXFactor(92, 45); // 47° separation
      expect(res.xFactorDeg).toBe(47);
      expect(res.xFactorRating).toBe('optimal_tour');
    });

    it('identifies restricted pelvic separation', () => {
      const res = calculateGolfXFactor(70, 40); // 30° separation
      expect(res.xFactorDeg).toBe(30);
      expect(res.xFactorRating).toBe('restricted');
    });

    it('computes Tour Tempo 3:1 ratio correctly', () => {
      const res = calculateGolfTempo(750, 250);
      expect(res.tempoRatio).toBe(3.0);
      expect(res.tempoRating).toBe('tour_tempo');
    });

    it('flags rushed transition tempo', () => {
      const res = calculateGolfTempo(500, 250);
      expect(res.tempoRatio).toBe(2.0);
      expect(res.tempoRating).toBe('quick_rush');
    });

    it('estimates clubhead speed within physiological bounds', () => {
      const speed = estimateGolfClubheadSpeed(1800, 1.15);
      expect(speed).toBeGreaterThanOrEqual(70);
      expect(speed).toBeLessThanOrEqual(135);
    });
  });

  describe('Tennis & Padel Kinematics', () => {
    it('validates sound tennis serve trophy pose', () => {
      const res = calculateTennisTrophyPose(28, 115);
      expect(res.isTrophyPoseSound).toBe(true);
      expect(res.shoulderTiltDeg).toBe(28);
      expect(res.rearKneeFlexionDeg).toBe(115);
    });

    it('evaluates optimal Padel bandeja contact point and glass suppression', () => {
      const res = calculatePadelBandeja(2.15, 18, 1.80);
      expect(res.verdict).toBe('optimal_bandeja');
      expect(res.reboundSuppressionIndex).toBe(92);
    });

    it('flags smash-height contact in padel as risk for high glass rebound', () => {
      const res = calculatePadelBandeja(2.65, 12, 1.80);
      expect(res.verdict).toBe('too_high_smash');
      expect(res.reboundSuppressionIndex).toBeLessThan(70);
    });
  });

  describe('Cycling & Bike Fit Kinematics', () => {
    it('validates optimal BDC knee angle', () => {
      const res = calculateBikeFitKneeAngle(30);
      expect(res.saddleHeightVerdict).toBe('optimal');
    });

    it('identifies saddle too high (overextension)', () => {
      const res = calculateBikeFitKneeAngle(20);
      expect(res.saddleHeightVerdict).toBe('too_high');
    });

    it('identifies saddle too low (excessive flexion)', () => {
      const res = calculateBikeFitKneeAngle(42);
      expect(res.saddleHeightVerdict).toBe('too_low');
    });
  });

  describe('Baseball & Overhead Throwing Kinematics', () => {
    it('validates UCL-safe pitching mechanics at foot strike', () => {
      const res = calculateBaseballPitchMechanics(92, 90);
      expect(res.uclSafetyVerdict).toBe('optimal_safe');
      expect(res.estimatedUclStressNm).toBe(52);
    });

    it('detects dropped elbow risk', () => {
      const res = calculateBaseballPitchMechanics(72, 90);
      expect(res.uclSafetyVerdict).toBe('dropped_elbow');
      expect(res.estimatedUclStressNm).toBeGreaterThan(70);
    });
  });

  describe('Rowing & Ergometer Rhythm Kinematics', () => {
    it('validates 1:2 drive-to-recovery rhythm', () => {
      const res = calculateRowingRhythm(600, 1200);
      expect(res.rhythmRatio).toBe(2.0);
      expect(res.verdict).toBe('optimal_ratio');
    });

    it('flags rushed slide ratio', () => {
      const res = calculateRowingRhythm(600, 800);
      expect(res.verdict).toBe('rushed_slide');
    });
  });
});
