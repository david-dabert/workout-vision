import { describe, it, expect } from 'vitest';
import {
  resampleSignal,
  computeSPARC,
  dtwDistance,
  analyzeMovementQuality,
} from '../smoothness';

describe('resampleSignal', () => {
  it('resamples an array to target length with linear interpolation', () => {
    const input = [0, 10, 20];
    const resampled = resampleSignal(input, 5);
    expect(resampled.length).toBe(5);
    expect(resampled[0]).toBe(0);
    expect(resampled[2]).toBe(10);
    expect(resampled[4]).toBe(20);
  });

  it('handles edge cases', () => {
    expect(resampleSignal([], 10)).toEqual([]);
    expect(resampleSignal([5], 3)).toEqual([5, 5, 5]);
    const same = [1, 2, 3];
    expect(resampleSignal(same, 3)).toEqual([1, 2, 3]);
  });
});

describe('computeSPARC (movement smoothness)', () => {
  it('returns a high (less negative) SPARC for a smooth bell-shaped speed profile', () => {
    // Generate a bell-shaped velocity profile (smooth minimum-jerk profile)
    const n = 30;
    const smoothProfile = Array.from({ length: n }, (_, i) => {
      const x = i / (n - 1);
      return Math.sin(Math.PI * x) ** 2 * 100;
    });

    const sparc = computeSPARC(smoothProfile, 15);
    expect(sparc).toBeTypeOf('number');
    // Smooth bell-shaped curve has SPARC between -1.0 and -2.2
    expect(sparc).toBeGreaterThan(-2.2);
  });

  it('returns a significantly lower (more negative) SPARC for a jerky, noisy speed profile', () => {
    const n = 45;
    const jerkyProfile = Array.from({ length: n }, (_, i) => {
      // Multiple submovement bursts / hesitations
      return (Math.sin((Math.PI * i) / 10) ** 2) * 50 + (Math.sin((Math.PI * i) / 6) ** 2) * 40;
    });

    const sparc = computeSPARC(jerkyProfile, 15);
    expect(sparc).toBeTypeOf('number');
    expect(sparc).toBeLessThan(-2.2);
  });

  it('returns null for signals that are too short', () => {
    expect(computeSPARC([1, 2, 3], 15)).toBe(null);
    expect(computeSPARC([], 15)).toBe(null);
  });
});

describe('dtwDistance (Dynamic Time Warping)', () => {
  it('returns 0 for identical signals', () => {
    const a = [10, 20, 30, 40, 30, 20, 10];
    expect(dtwDistance(a, a)).toBe(0);
  });

  it('aligns time-shifted or stretched signals with low warping distance', () => {
    const a = [10, 20, 30, 40, 30, 20, 10];
    // Slightly stretched in time
    const b = [10, 15, 20, 25, 30, 35, 40, 35, 30, 25, 20, 15, 10];
    const dist = dtwDistance(a, b);
    expect(dist).toBeLessThan(3);
  });

  it('returns larger distance for fundamentally different shapes', () => {
    const a = [10, 20, 30, 40, 30, 20, 10];
    const b = [50, 40, 30, 20, 30, 40, 50]; // inverted shape
    const dist = dtwDistance(a, b);
    expect(dist).toBeGreaterThanOrEqual(10);
  });
});

describe('analyzeMovementQuality', () => {
  // Helper to generate mock landmark frames
  function generateMockSet(numReps = 3, pointsPerRep = 15) {
    const timestamps = [];
    const worldLandmarks = [];
    const reps = [];
    let currentTime = 0;

    for (let r = 0; r < numReps; r++) {
      const startTime = currentTime;
      for (let p = 0; p < pointsPerRep; p++) {
        timestamps.push(currentTime);
        currentTime += 1 / 15;

        // Simulate elbow curl angle (11 shoulder, 13 elbow, 15 wrist)
        // Normalized 0 to 1 progress
        const prog = p / (pointsPerRep - 1);
        const yWrist = 0.5 - 0.4 * Math.sin(Math.PI * prog); // moves up and down

        const frame = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));
        frame[11] = { x: 0, y: 0, z: 0, visibility: 0.9 };
        frame[13] = { x: 0, y: 0.3, z: 0, visibility: 0.9 };
        frame[15] = { x: 0.2, y: yWrist, z: 0, visibility: 0.9 };
        worldLandmarks.push(frame);
      }
      const endTime = currentTime;
      reps.push({
        index: r + 1,
        startTime,
        endTime,
        romDegrees: 85,
        concentricSec: 0.5,
        eccentricSec: 0.5,
      });
      currentTime += 0.5; // pause between reps
    }

    return { timestamps, worldLandmarks, reps };
  }

  it('computes smoothness and high consistency score on consistent reps', () => {
    const { timestamps, worldLandmarks, reps } = generateMockSet(3, 15);
    const result = analyzeMovementQuality(worldLandmarks, timestamps, 'bicep_curl', reps, 'left');

    expect(result).not.toBe(null);
    expect(result.smoothness).not.toBe(null);
    expect(result.smoothness.avgSparc).toBeTypeOf('number');
    expect(result.smoothness.perRep.length).toBe(3);

    expect(result.consistency).not.toBe(null);
    expect(result.consistency.score).toBeGreaterThanOrEqual(80);
    expect(result.consistency.rating).toBe('high');
  });

  it('returns null if fewer than 2 reps', () => {
    const { timestamps, worldLandmarks, reps } = generateMockSet(1, 15);
    const result = analyzeMovementQuality(worldLandmarks, timestamps, 'bicep_curl', reps, 'left');
    expect(result).toBe(null);
  });
});
