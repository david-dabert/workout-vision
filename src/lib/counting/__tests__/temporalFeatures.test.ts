import { describe, it, expect } from 'vitest';
import {
  standardizeTrajectory,
  extractTemporalFeatureWindows,
  cosineSimilarity,
  computeTrajectorySimilarityMatrix,
} from '../temporalFeatures';
import { extractTemporalFeatureWindows as fromCore } from '../core';

describe('Temporal Kinematic Feature Extractor', () => {
  it('standardizes trajectory array into zero-mean, unit-variance vector', () => {
    const raw = [10, 20, 30, 40, 50, 60];
    const std = standardizeTrajectory(raw, 16);
    expect(std.length).toBe(16);

    // Mean should be approximately 0
    let sum = 0;
    for (let i = 0; i < std.length; i++) sum += std[i];
    expect(sum / std.length).toBeCloseTo(0, 3);
  });

  it('computes cosine similarity accurately between identical and opposite vectors', () => {
    const v1 = new Float32Array([1, 0, 0]);
    const v2 = new Float32Array([1, 0, 0]);
    const v3 = new Float32Array([-1, 0, 0]);
    const v4 = new Float32Array([0, 1, 0]);

    expect(cosineSimilarity(v1, v2)).toBeCloseTo(1.0, 5);
    expect(cosineSimilarity(v1, v3)).toBeCloseTo(-1.0, 5);
    expect(cosineSimilarity(v1, v4)).toBeCloseTo(0.0, 5);
  });

  it('extracts sliding windows across synthetic sinusoidal kinematic trajectories', () => {
    // Generate 4 seconds of a repeating sinusoidal exercise at 15 fps
    const fps = 15;
    const durationSec = 4.0;
    const n = Math.floor(fps * durationSec);
    const timestamps: number[] = [];
    const angles: number[] = [];

    for (let i = 0; i < n; i++) {
      const t = i / fps;
      timestamps.push(t);
      // Sine wave with 2.0s period (2 reps total), oscillating 60 to 140 deg
      const angle = 100 + 40 * Math.sin((2 * Math.PI * t) / 2.0);
      angles.push(angle);
    }

    const windows = extractTemporalFeatureWindows(angles, timestamps, {
      windowSec: 1.5,
      hopSec: 0.25,
      resamplePoints: 16,
    });

    expect(windows.length).toBeGreaterThan(0);
    const w0 = windows[0];
    expect(w0.duration).toBeCloseTo(1.5, 2);
    expect(w0.rom).toBeGreaterThan(20);
    expect(w0.featureVector.length).toBe(8);
    expect(w0.normalizedTrajectory.length).toBe(16);
  });

  it('computes pairwise trajectory similarity matrix across windows', () => {
    const fps = 15;
    const timestamps = Array.from({ length: 45 }, (_, i) => i / fps);
    const angles = timestamps.map(t => 90 + 30 * Math.sin(2 * Math.PI * t));

    const windows = extractTemporalFeatureWindows(angles, timestamps, {
      windowSec: 1.0,
      hopSec: 0.2,
      resamplePoints: 16,
    });

    const matrix = computeTrajectorySimilarityMatrix(windows);
    expect(matrix.length).toBe(windows.length * windows.length);
    // Diagonal must be self-similarity = 1.0
    for (let i = 0; i < windows.length; i++) {
      expect(matrix[i * windows.length + i]).toBeCloseTo(1.0, 4);
    }
  });

  it('is cleanly exported from core.ts', () => {
    expect(typeof fromCore).toBe('function');
  });
});
