import { describe, it, expect } from 'vitest';
import {
  standardizeTrajectory,
  extractTemporalFeatureWindows,
  cosineSimilarity,
  computeTrajectorySimilarityMatrix,
  computeAutocorrelationPeriodicity,
  classify1DTemporalRepPhase,
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

  describe('Harmonic Autocorrelation Periodicity', () => {
    it('detects fundamental repetition period and estimated reps on repeating sinusoidal wave', () => {
      const fps = 20;
      const durationSec = 10.0;
      const periodSec = 2.0;
      const n = Math.floor(fps * durationSec);
      const timestamps = Array.from({ length: n }, (_, i) => i / fps);
      // 5 full repetitions (10s / 2s per rep)
      const angles = timestamps.map(t => 100 + 40 * Math.cos((2 * Math.PI * t) / periodSec));

      const result = computeAutocorrelationPeriodicity(angles, timestamps, {
        minPeriodSec: 1.0,
        maxPeriodSec: 4.0,
      });

      expect(result.fundamentalPeriodSec).toBeCloseTo(periodSec, 1);
      expect(result.cadenceRegularity).toBeGreaterThan(0.7);
      expect(result.estimatedReps).toBe(5);
      expect(result.autocorrelationCurve.length).toBeGreaterThan(0);
    });

    it('gracefully handles small or zero-variance signals', () => {
      const empty = computeAutocorrelationPeriodicity([], []);
      expect(empty.fundamentalPeriodSec).toBe(0);
      expect(empty.estimatedReps).toBe(0);

      const flat = computeAutocorrelationPeriodicity([90, 90, 90, 90, 90, 90, 90, 90, 90, 90], [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
      expect(flat.fundamentalPeriodSec).toBe(0);
      expect(flat.cadenceRegularity).toBe(0);
    });
  });

  describe('1D Micro-Sequence Kinematic Phase Classifier', () => {
    it('accurately classifies eccentric, concentric, sticking, and lockout phases', () => {
      // Squat (rest: 'high'):
      // 1. Descending rapidly (-60 deg/s) -> eccentric
      const ecc = classify1DTemporalRepPhase([160, 150, 140], -60, 0, 'high');
      expect(ecc.phase).toBe('eccentric');
      expect(ecc.confidence).toBeGreaterThan(0.6);

      // 2. Ascending rapidly (+60 deg/s) -> concentric
      const conc = classify1DTemporalRepPhase([100, 110, 120], 60, 0, 'high');
      expect(conc.phase).toBe('concentric');
      expect(conc.confidence).toBeGreaterThan(0.6);

      // 3. Stalling at turnaround (velocity near 0, high turnaround acceleration +40 deg/s^2) -> amortization_sticking
      const stick = classify1DTemporalRepPhase([80, 80, 81], 2, 40, 'high');
      expect(stick.phase).toBe('amortization_sticking');
      expect(stick.probabilities.amortization_sticking).toBeGreaterThan(0.5);

      // 4. Standing at rest (velocity near 0, acceleration near 0) -> lockout_rest
      const rest = classify1DTemporalRepPhase([175, 175, 175], 0, 1, 'high');
      expect(rest.phase).toBe('lockout_rest');
      expect(rest.probabilities.lockout_rest).toBeGreaterThan(0.5);
    });
  });
});
