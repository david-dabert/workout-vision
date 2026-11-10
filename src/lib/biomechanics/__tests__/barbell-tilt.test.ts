import { describe, expect, it } from 'vitest';
import {
  analyzeBarbellTilt,
  calculateBarbellTiltAngle,
  LandmarkPoint,
} from '../barbellTilt';

function makeFrame(overrides: Record<number, { x: number; y: number; visibility?: number }>): LandmarkPoint[] {
  const landmarks: LandmarkPoint[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.99,
  }));
  for (const [idxStr, pt] of Object.entries(overrides)) {
    const idx = Number(idxStr);
    landmarks[idx] = { ...landmarks[idx], ...pt };
  }
  return landmarks;
}

describe('Barbell Planar Tilt Telemetry & Asymmetric Torque Engine', () => {
  it('detects 0 tilt when left and right wrists are at identical vertical heights', () => {
    const lw: LandmarkPoint = { x: 0.35, y: 0.45, visibility: 0.99 };
    const rw: LandmarkPoint = { x: 0.65, y: 0.45, visibility: 0.99 };

    const angle = calculateBarbellTiltAngle(lw, rw);
    expect(angle).toBeCloseTo(0, 2);
  });

  it('calculates optimal planar stability (PSI 100%) during a perfectly balanced lift', () => {
    const frames = Array.from({ length: 15 }, (_, i) => {
      const y = 0.6 - i * 0.02; // Moving up concentrically
      return makeFrame({
        15: { x: 0.35, y },
        16: { x: 0.65, y },
      });
    });
    const timestamps = frames.map((_, i) => i * 0.1);

    const result = analyzeBarbellTilt(frames, timestamps);
    expect(result.isTiltFault).toBe(false);
    expect(result.verdict).toBe('optimal');
    expect(result.maxTiltDeg).toBeLessThan(1.0);
    expect(result.planarStabilityIndex).toBeGreaterThanOrEqual(95);
    expect(result.cueFr).toContain('Trajectoire de barre équilibrée\u00A0:');
  });

  it('flags mild tilt and detects right-side lag when right wrist dips under load', () => {
    // dx = 0.30, dy = 0.025 => atan2(0.025, 0.3) = 4.76 deg tilt
    const frames = Array.from({ length: 10 }, () => {
      return makeFrame({
        15: { x: 0.35, y: 0.50 },
        16: { x: 0.65, y: 0.525 },
      });
    });
    const timestamps = frames.map((_, i) => i * 0.1);

    const result = analyzeBarbellTilt(frames, timestamps);
    expect(result.isTiltFault).toBe(true);
    expect(result.verdict).toBe('mild_tilt');
    expect(result.dominantFaultSide).toBe('right_lag');
    expect(result.maxTiltDeg).toBeCloseTo(4.8, 1);
    expect(result.planarStabilityIndex).toBeLessThan(80);
    expect(result.cueFr).toContain('Inclinaison de barre détectée');
    expect(result.cueFr).toContain('\u00A0:');
  });

  it('flags critical tilt (> 6.0 deg) and warns about asymmetric spinal rotational shear', () => {
    // dx = 0.30, dy = -0.045 => atan2(-0.045, 0.3) = -8.53 deg tilt (left side lag)
    const frames = Array.from({ length: 10 }, () => {
      return makeFrame({
        15: { x: 0.35, y: 0.545 },
        16: { x: 0.65, y: 0.500 },
      });
    });
    const timestamps = frames.map((_, i) => i * 0.1);

    const result = analyzeBarbellTilt(frames, timestamps);
    expect(result.isTiltFault).toBe(true);
    expect(result.verdict).toBe('critical_tilt');
    expect(result.dominantFaultSide).toBe('left_lag');
    expect(result.maxTiltDeg).toBeGreaterThanOrEqual(8.0);
    expect(result.planarStabilityIndex).toBeLessThan(40);
    expect(result.cueFr).toContain('Asymétrie critique de barre');
    expect(result.cueFr).toContain('bras gauche');
    expect(result.cueFr).toContain('\u00A0:');
  });

  it('handles low visibility landmarks without crashing or fabricating tilt', () => {
    const frames = [
      makeFrame({
        15: { x: 0.35, y: 0.5, visibility: 0.1 }, // occluded
        16: { x: 0.65, y: 0.5, visibility: 0.99 },
      }),
    ];
    const result = analyzeBarbellTilt(frames, [0]);
    expect(result.frames.length).toBe(0);
    expect(result.isTiltFault).toBe(false);
  });
});
