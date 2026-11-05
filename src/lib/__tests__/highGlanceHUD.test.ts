import { describe, it, expect } from 'vitest';
import {
  estimateDistanceMeters,
  calculateGlanceScale,
  generateHighGlanceHUD,
} from '../highGlanceHUD';

describe('highGlanceHUD', () => {
  it('estimates lifter distance from shoulder span pixels', () => {
    // Large shoulder span (e.g. close to camera, 300px on 640px frame)
    const closeDistance = estimateDistanceMeters(300, 640);
    expect(closeDistance).toBeLessThan(1.5);

    // Small shoulder span (e.g. 3m away, 80px on 640px frame)
    const farDistance = estimateDistanceMeters(80, 640);
    expect(farDistance).toBeGreaterThan(2.0);

    // Fallback on invalid inputs
    expect(estimateDistanceMeters(0, 640)).toBe(2.5);
  });

  it('scales typography proportionally to distance', () => {
    const scale1m = calculateGlanceScale(1.0);
    const scale3m = calculateGlanceScale(3.0);

    expect(scale1m.fontScaleRem).toBe(4.5);
    expect(scale1m.fontScalePx).toBe(72);

    expect(scale3m.fontScaleRem).toBeGreaterThan(8.5);
    expect(scale3m.fontScalePx).toBeGreaterThan(130);
  });

  it('generates high-contrast concentric HUD state with design tokens', () => {
    const hud = generateHighGlanceHUD({
      repsCount: 8,
      phase: 'concentric',
      velocityMps: 0.48,
      estimatedDistanceMeters: 3.0,
    });

    expect(hud.numeralText).toBe('8');
    expect(hud.cueText).toBe('POUSSER');
    expect(hud.perimeterToken).toBe('var(--lamp-hi)');
    expect(hud.pulseIntensity).toBeGreaterThan(0.9);
    expect(hud.velocityDisplay).toBe('0.48 m/s');
    expect(hud.isGlanceActive).toBe(true);
    // Asserts zero raw color literals
    expect(hud.perimeterToken).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(/);
  });

  it('generates eccentric HUD state with control token', () => {
    const hud = generateHighGlanceHUD({
      repsCount: 7,
      phase: 'eccentric',
      estimatedDistanceMeters: 2.0,
    });

    expect(hud.cueText).toBe('CONTRÔLE');
    expect(hud.perimeterToken).toBe('var(--c-fg)');
    expect(hud.pulseIntensity).toBe(0.6);
  });

  it('handles idle state without active pulse', () => {
    const hud = generateHighGlanceHUD({
      repsCount: 0,
      phase: 'idle',
    });

    expect(hud.cueText).toBe('PRÊT');
    expect(hud.isGlanceActive).toBe(false);
    expect(hud.pulseIntensity).toBeLessThan(0.2);
  });
});
