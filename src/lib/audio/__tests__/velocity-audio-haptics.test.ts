import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  dispatchVelocityFeedback,
  calculateConcentricMeanVelocity,
  getOrCreateAudioContext,
} from '../velocityAudioHaptics';

describe('velocityAudioHaptics engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('dispatchVelocityFeedback tier classification', () => {
    it('classifies loss < 10% as speed_preserved with resonant 520Hz chime', () => {
      const res = dispatchVelocityFeedback(6.5, false, false);
      expect(res.tier).toBe('speed_preserved');
      expect(res.frequencyHz).toBe(520);
      expect(res.toneDurationMs).toBe(80);
      expect(res.hapticPattern).toEqual([25]);
      expect(res.cueFr).toContain('Vitesse préservée (6.5\u00A0% de perte)\u00A0: puissance intacte au verrouillage.');
      expect(res.cueEn).toContain('Speed preserved (6.5% loss): intact power at lockout.');
    });

    it('classifies loss between 10% and 20% as moderate_decline', () => {
      const res = dispatchVelocityFeedback(15.2, false, false);
      expect(res.tier).toBe('moderate_decline');
      expect(res.frequencyHz).toBe(440);
      expect(res.toneDurationMs).toBe(90);
      expect(res.hapticPattern).toEqual([35]);
      expect(res.cueFr).toContain('Ralentissement modéré (15.2\u00A0% de perte)\u00A0: cadence stable.');
      expect(res.cueEn).toContain('Moderate deceleration (15.2% loss): stable cadence.');
    });

    it('classifies loss between 20% and 30% as optimal_hypertrophy horizon with dual pulse', () => {
      const res = dispatchVelocityFeedback(25.0, false, false);
      expect(res.tier).toBe('optimal_hypertrophy');
      expect(res.frequencyHz).toBe(340);
      expect(res.toneDurationMs).toBe(120);
      expect(res.hapticPattern).toEqual([40, 60, 40]);
      expect(res.cueFr).toContain("Horizon d'hypertrophie optimal (25\u00A0% de perte)\u00A0: recrutement moteur maximal.");
      expect(res.cueEn).toContain('Optimal hypertrophy horizon (25% loss): maximum motor unit recruitment.');
    });

    it('classifies loss > 35% as termination_failure warning with 220Hz horn', () => {
      const res = dispatchVelocityFeedback(38.4, false, false);
      expect(res.tier).toBe('termination_failure');
      expect(res.frequencyHz).toBe(220);
      expect(res.toneDurationMs).toBe(180);
      expect(res.hapticPattern).toEqual([60, 50, 60, 50, 100]);
      expect(res.cueFr).toContain('Seuil critique de fatigue atteint (38.4\u00A0% de perte)\u00A0: terminez la série.');
      expect(res.cueEn).toContain('Critical fatigue threshold reached (38.4% loss): terminate set.');
    });

    it('clamps negative velocity loss to zero', () => {
      const res = dispatchVelocityFeedback(-5.0, false, false);
      expect(res.tier).toBe('speed_preserved');
      expect(res.velocityLossPercent).toBe(0);
    });

    it('triggers navigator.vibrate when enabled', () => {
      const vibrateMock = vi.fn();
      vi.stubGlobal('navigator', { vibrate: vibrateMock });

      dispatchVelocityFeedback(24, false, true);
      expect(vibrateMock).toHaveBeenCalledWith([40, 60, 40]);
    });
  });

  describe('calculateConcentricMeanVelocity', () => {
    it('returns null on insufficient angle samples', () => {
      expect(calculateConcentricMeanVelocity([])).toBeNull();
      expect(calculateConcentricMeanVelocity([{ angle: 90, timestamp: 1.0 }])).toBeNull();
      expect(
        calculateConcentricMeanVelocity([
          { angle: 90, timestamp: 1.0 },
          { angle: 95, timestamp: 1.05 },
        ])
      ).toBeNull();
    });

    it('computes correct mean and peak angular velocity for smooth concentric samples', () => {
      const samples = [
        { angle: 90, timestamp: 1.0 },
        { angle: 100, timestamp: 1.1 }, // 10 deg / 0.1s = 100 deg/s
        { angle: 115, timestamp: 1.2 }, // 15 deg / 0.1s = 150 deg/s
        { angle: 135, timestamp: 1.3 }, // 20 deg / 0.1s = 200 deg/s
      ];

      const metrics = calculateConcentricMeanVelocity(samples);
      expect(metrics).not.toBeNull();
      expect(metrics?.peakVelocityDegS).toBe(200);
      expect(metrics?.meanVelocityDegS).toBe(150);
    });

    it('filters out invalid time intervals', () => {
      const samples = [
        { angle: 90, timestamp: 1.0 },
        { angle: 92, timestamp: 1.001 }, // dt = 0.001s, ignored (< 0.005)
        { angle: 100, timestamp: 1.5 },   // dt = 0.499s, ignored (> 0.25)
        { angle: 120, timestamp: 1.6 },   // dt = 0.1s, valid: 200 deg/s
        { angle: 140, timestamp: 1.7 },   // dt = 0.1s, valid: 200 deg/s
      ];

      const metrics = calculateConcentricMeanVelocity(samples);
      expect(metrics).not.toBeNull();
      expect(metrics?.meanVelocityDegS).toBe(200);
    });
  });

  describe('getOrCreateAudioContext', () => {
    it('handles audio context creation gracefully in testing environment', () => {
      const ctx = getOrCreateAudioContext();
      // In node/vitest environment without AudioContext, gracefully returns null
      expect(ctx === null || typeof ctx === 'object').toBe(true);
    });
  });
});
