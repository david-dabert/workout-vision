import { describe, it, expect, vi } from 'vitest';
import {
  dispatchVelocityFeedback,
  calculateConcentricMeanVelocity,
} from '../../../lib/audio/velocityAudioHaptics';

describe('Live velocity HUD telemetry & audio-haptic feedback', () => {
  it('dispatches tone and haptic feedback tiers according to Carmack-Contreras specifications', () => {
    // Speed preserved (< 10% loss)
    const tier1 = dispatchVelocityFeedback(4.2, false, false);
    expect(tier1.tier).toBe('speed_preserved');
    expect(tier1.frequencyHz).toBe(520);
    expect(tier1.toneDurationMs).toBe(80);
    expect(tier1.hapticPattern).toEqual([25]);

    // Moderate deceleration (10-20% loss)
    const tier2 = dispatchVelocityFeedback(14.8, false, false);
    expect(tier2.tier).toBe('moderate_decline');
    expect(tier2.frequencyHz).toBe(440);
    expect(tier2.toneDurationMs).toBe(90);
    expect(tier2.hapticPattern).toEqual([35]);

    // Optimal hypertrophy horizon (20-30% loss)
    const tier3 = dispatchVelocityFeedback(26.5, false, false);
    expect(tier3.tier).toBe('optimal_hypertrophy');
    expect(tier3.frequencyHz).toBe(340);
    expect(tier3.toneDurationMs).toBe(120);
    expect(tier3.hapticPattern).toEqual([40, 60, 40]);

    // Termination horn / acute fatigue (> 35% loss)
    const tier4 = dispatchVelocityFeedback(37.0, false, false);
    expect(tier4.tier).toBe('termination_failure');
    expect(tier4.frequencyHz).toBe(220);
    expect(tier4.toneDurationMs).toBe(180);
    expect(tier4.hapticPattern).toEqual([60, 50, 60, 50, 100]);
  });

  it('computes instantaneous concentric angular velocities from angle samples', () => {
    const samples = [
      { angle: 80, timestamp: 0.1 },
      { angle: 95, timestamp: 0.2 },
      { angle: 115, timestamp: 0.3 },
      { angle: 140, timestamp: 0.4 },
    ];

    const stats = calculateConcentricMeanVelocity(samples);
    expect(stats).not.toBeNull();
    expect(stats?.meanVelocityDegS).toBeGreaterThan(150);
    expect(stats?.peakVelocityDegS).toBe(250);
  });

  it('contains zero em-dashes in any feedback cues', () => {
    for (const loss of [5, 15, 25, 40]) {
      const res = dispatchVelocityFeedback(loss, false, false);
      expect(res.cueFr).not.toContain('\u2014');
      expect(res.cueEn).not.toContain('\u2014');
    }
  });
});
