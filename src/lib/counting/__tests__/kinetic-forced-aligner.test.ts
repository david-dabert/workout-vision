import { describe, it, expect } from 'vitest';
import {
  getCanonicalTemplate,
  normalizeQueryTrajectory,
  alignKineticTrajectory,
} from '../KineticForcedAligner';

describe('KineticForcedAligner', () => {
  it('generates canonical templates with valid kinemes and progression', () => {
    const squatTmpl = getCanonicalTemplate('squat');
    expect(squatTmpl.exercise).toBe('squat');
    expect(squatTmpl.trajectory.length).toBe(50);
    expect(squatTmpl.kinemes.length).toBe(6);
    expect(squatTmpl.kinemes[0].id).toBe('UNRACK');
    expect(squatTmpl.kinemes[2].id).toBe('INFLECTION');
    expect(squatTmpl.kinemes[3].id).toBe('STICKING_REGION');
    expect(squatTmpl.kinemes[5].id).toBe('LOCKOUT');

    // Squat trajectory starts near 1.0 (top), drops to ~0.0 at midpoint, rises to 1.0
    expect(squatTmpl.trajectory[0]).toBeCloseTo(1.0, 1);
    expect(squatTmpl.trajectory[25]).toBeCloseTo(0.0, 1);
    expect(squatTmpl.trajectory[49]).toBeCloseTo(1.0, 1);
  });

  it('normalizes query trajectories correctly', () => {
    const rawSquat = [170, 150, 130, 90, 80, 90, 130, 150, 170];
    const norm = normalizeQueryTrajectory(rawSquat, 'descent_first');
    expect(norm[0]).toBeCloseTo(1.0, 2);
    expect(norm[4]).toBeCloseTo(0.0, 2);
    expect(norm[8]).toBeCloseTo(1.0, 2);
  });

  it('aligns clean synthetic repetition with low distortion score', () => {
    const template = getCanonicalTemplate('squat');
    // Query that closely matches template with slight time stretch (60 frames)
    const N = 60;
    const query: number[] = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const angle = 90 + 80 * (0.5 * (1 + Math.cos(2 * Math.PI * t)));
      query.push(angle);
    }

    const result = alignKineticTrajectory(query, template);
    expect(result.path.length).toBeGreaterThan(0);
    expect(result.normalizedDistance).toBeLessThan(0.15); // Low form distortion
    expect(result.kinemeAlignments.length).toBe(6);
    expect(result.kinemeAlignments[0].startFrame).toBe(0);
    expect(result.kinemeAlignments[5].endFrame).toBe(N - 1);
    // Sub-frame inflection should be close to center (N/2 = 30)
    expect(result.subFrameInflectionIndex).toBeGreaterThan(25);
    expect(result.subFrameInflectionIndex).toBeLessThan(35);
  });

  it('detects a sticking point when movement stalls during concentric drive', () => {
    const template = getCanonicalTemplate('squat');
    // Synthetic squat rep that descends normally, turns around, but hangs for 12 frames at ~115°
    const query: number[] = [];
    // Descent (frames 0 to 15): 170° down to 90°
    for (let i = 0; i <= 15; i++) {
      query.push(170 - (80 * i) / 15);
    }
    // Sticking stall (frames 16 to 28): barely moves around 110°
    for (let i = 1; i <= 12; i++) {
      query.push(105 + 2 * Math.sin(i));
    }
    // Completion drive (frames 29 to 40): 110° up to 170°
    for (let i = 1; i <= 12; i++) {
      query.push(110 + (60 * i) / 12);
    }

    const result = alignKineticTrajectory(query, template);
    expect(result.stickingPoint).not.toBeNull();
    if (result.stickingPoint) {
      expect(result.stickingPoint.warpVelocity).toBeLessThan(0.75);
      expect(result.stickingPoint.severity).toMatch(/moderate|severe/);
      expect(result.stickingPoint.frameIndex).toBeGreaterThanOrEqual(15);
      expect(result.stickingPoint.frameIndex).toBeLessThanOrEqual(30);
    }
  });

  it('handles degenerate short sequences gracefully', () => {
    const template = getCanonicalTemplate('squat');
    const emptyResult = alignKineticTrajectory([], template);
    expect(emptyResult.path).toEqual([]);
    expect(emptyResult.totalDistance).toBe(0);

    const singleResult = alignKineticTrajectory([100], template);
    expect(singleResult.path).toEqual([]);
  });
});
