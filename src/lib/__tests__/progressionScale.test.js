/**
 * Tests for ProgressionScore normalization.
 *
 * Acceptance criteria:
 * - score and every component ∈ [0, 100]
 * - Clamps on garbage inputs (NaN, null, negative)
 * - The strings '173/100' and '120/100' can never happen
 */

import { describe, it, expect } from 'vitest';
import { ProgressionScore } from '../ProgressionScore';

// Helper: assert all outputs are in [0, 100]
function assertNormalized(result) {
  expect(result.score).toBeGreaterThanOrEqual(0);
  expect(result.score).toBeLessThanOrEqual(100);
  for (const [key, val] of Object.entries(result.components)) {
    expect(val, `component "${key}" out of range: ${val}`).toBeGreaterThanOrEqual(0);
    expect(val, `component "${key}" out of range: ${val}`).toBeLessThanOrEqual(100);
  }
}

describe('ProgressionScore normalization', () => {
  it('returns 0 for zero reps', () => {
    const result = ProgressionScore.computeSet({ reps: 0 });
    expect(result.score).toBe(0);
  });

  it('all outputs ∈ [0,100] for a standard set', () => {
    const result = ProgressionScore.computeSet({
      formScores: [85, 90, 88, 82, 87],
      repVelocities: [
        { tempoRatio: 2.0 }, { tempoRatio: 2.2 },
        { tempoRatio: 1.9 }, { tempoRatio: 2.1 }, { tempoRatio: 2.0 },
      ],
      reps: 5,
      weightKg: 60,
    });
    assertNormalized(result);
    expect(result.score).toBeGreaterThan(0);
  });

  it('all outputs ∈ [0,100] for perfect form', () => {
    const result = ProgressionScore.computeSet({
      formScores: [100, 100, 100, 100, 100],
      repVelocities: [
        { tempoRatio: 2.0 }, { tempoRatio: 2.0 },
        { tempoRatio: 2.0 }, { tempoRatio: 2.0 }, { tempoRatio: 2.0 },
      ],
      reps: 5,
      weightKg: 100,
    });
    assertNormalized(result);
    // Perfect form with good weight should score high
    expect(result.components.form).toBeGreaterThanOrEqual(90);
    expect(result.components.consistency).toBe(100);
  });

  it('all outputs ∈ [0,100] for a single rep', () => {
    const result = ProgressionScore.computeSet({
      formScores: [75],
      reps: 1,
      weightKg: 20,
    });
    assertNormalized(result);
  });

  it('all outputs ∈ [0,100] with zero consistency (wildly varying form)', () => {
    const result = ProgressionScore.computeSet({
      formScores: [10, 95, 20, 90, 5],
      reps: 5,
      weightKg: 40,
    });
    assertNormalized(result);
    // High variance should tank consistency
    expect(result.components.consistency).toBeLessThan(50);
  });

  it('all outputs ∈ [0,100] with extreme tempo ratios', () => {
    const result = ProgressionScore.computeSet({
      formScores: [80, 80, 80],
      repVelocities: [
        { tempoRatio: 10.0 }, { tempoRatio: 0.1 }, { tempoRatio: 5.0 },
      ],
      reps: 3,
      weightKg: 50,
    });
    assertNormalized(result);
  });

  it('clamps on NaN form scores', () => {
    const result = ProgressionScore.computeSet({
      formScores: [NaN, NaN],
      reps: 2,
      weightKg: 30,
    });
    assertNormalized(result);
    expect(result.components.form).toBe(0);
  });

  it('clamps on null form scores', () => {
    const result = ProgressionScore.computeSet({
      formScores: [null, null, null],
      reps: 3,
      weightKg: 30,
    });
    assertNormalized(result);
    expect(result.components.form).toBe(0);
  });

  it('clamps on negative form scores', () => {
    const result = ProgressionScore.computeSet({
      formScores: [-50, -20, -10],
      reps: 3,
      weightKg: 30,
    });
    assertNormalized(result);
  });

  it('handles no velocity data gracefully', () => {
    const result = ProgressionScore.computeSet({
      formScores: [70, 75, 72],
      reps: 3,
      weightKg: 40,
    });
    assertNormalized(result);
    // Default tempo is 75/150 = 50%
    expect(result.components.tempo).toBe(50);
  });

  it('handles zero weight', () => {
    const result = ProgressionScore.computeSet({
      formScores: [80, 85],
      reps: 2,
      weightKg: 0,
    });
    assertNormalized(result);
    // Volume should still be > 0 because of Math.max(1, weightKg)
    expect(result.components.volume).toBeGreaterThan(0);
  });

  it('improvement bonus stays within [0,100] when beating previous best', () => {
    const result = ProgressionScore.computeSet({
      formScores: [95, 95, 95, 95, 95],
      repVelocities: [
        { tempoRatio: 2.0 }, { tempoRatio: 2.0 },
        { tempoRatio: 2.0 }, { tempoRatio: 2.0 }, { tempoRatio: 2.0 },
      ],
      reps: 5,
      weightKg: 80,
      previousBest: { score: 30 }, // previous was 30/100
    });
    assertNormalized(result);
    expect(result.components.improvement).toBeGreaterThan(0);
  });

  it('no improvement bonus when below previous best', () => {
    const result = ProgressionScore.computeSet({
      formScores: [50],
      reps: 1,
      weightKg: 10,
      previousBest: { score: 90 },
    });
    assertNormalized(result);
    expect(result.components.improvement).toBe(0);
  });

  it('grade label exists and is a string', () => {
    const result = ProgressionScore.computeSet({
      formScores: [80, 80, 80],
      reps: 3,
      weightKg: 50,
    });
    expect(typeof result.grade.label).toBe('string');
    expect(result.grade.label.length).toBeGreaterThan(0);
  });

  it('empty params produce valid normalized output', () => {
    const result = ProgressionScore.computeSet({
      formScores: [],
      repVelocities: [],
      reps: 1,
      weightKg: 0,
    });
    assertNormalized(result);
  });
});
