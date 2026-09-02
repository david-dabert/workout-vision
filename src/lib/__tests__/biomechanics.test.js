/**
 * Tests for the biomechanical analysis engine.
 *
 * Covers:
 *   - analyzeSet: end-to-end set analysis producing velocity, TUT, ROM,
 *     asymmetry, fatigue, and movement quality metrics
 *   - Edge cases: empty frames, missing reps, invalid exercise keys
 *
 * The biomechanics module delegates rep detection to RepCounter (single source
 * of truth). If RepCounter provides no rep boundaries, biomechanics returns
 * an empty result — it does not attempt its own rep detection.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock localforage before importing modules that transitively depend on poseAnalysis
vi.mock('localforage', () => ({
  default: {
    createInstance: () => ({
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { analyzeSet, setUserHeight } from '../biomechanics';
import { fakeSquatFrame, fakeLandmarks } from './helpers';

// ---------------------------------------------------------------------------
// analyzeSet — empty/invalid inputs
// ---------------------------------------------------------------------------

describe('analyzeSet — edge cases', () => {
  it('returns empty result for null frames', () => {
    const result = analyzeSet(null, 30, 'squat', []);
    expect(result).toHaveProperty('velocity');
    expect(result).toHaveProperty('timeUnderTension');
    expect(result).toHaveProperty('rangeOfMotion');
    expect(result).toHaveProperty('asymmetry');
    expect(result).toHaveProperty('fatigue');
    expect(result).toHaveProperty('movementQuality');
    expect(result.velocity.avg).toBe(0);
    expect(result.movementQuality).toBe(0);
  });

  it('returns empty result for empty frames array', () => {
    const result = analyzeSet([], 30, 'squat', []);
    expect(result.velocity.avg).toBe(0);
    expect(result.rangeOfMotion.avgDegrees).toBe(0);
  });

  it('returns empty result for single frame (need >= 2)', () => {
    const result = analyzeSet([fakeSquatFrame(120, 0)], 30, 'squat', []);
    expect(result.velocity.avg).toBe(0);
  });

  it('returns empty result for unknown exercise key', () => {
    const frames = [fakeSquatFrame(120, 0), fakeSquatFrame(90, 0.1)];
    const result = analyzeSet(frames, 30, 'nonexistent_exercise', []);
    expect(result.velocity.avg).toBe(0);
  });

  it('returns empty result when no rep boundaries are provided', () => {
    const frames = [];
    for (let i = 0; i < 60; i++) {
      frames.push(fakeSquatFrame(125 + 45 * Math.cos((i / 60) * 2 * Math.PI), i / 30));
    }
    // No externalReps — biomechanics does not rescue
    const result = analyzeSet(frames, 30, 'squat', []);
    expect(result.velocity.avg).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// analyzeSet — with valid rep boundaries
// ---------------------------------------------------------------------------

describe('analyzeSet — valid analysis', () => {
  it('produces non-zero metrics when given valid frames and rep boundaries', () => {
    const fps = 10;
    const frames = [];
    // Generate 100 frames (10 seconds) with 2 squat reps
    for (let i = 0; i < 100; i++) {
      const phase = (i % 50) / 50;
      const kneeAngle = 125 + 45 * Math.cos(phase * 2 * Math.PI);
      frames.push(fakeSquatFrame(kneeAngle, i / fps));
    }

    const repBoundaries = [
      { startFrame: 0, bottomFrame: 25, endFrame: 49 },
      { startFrame: 50, bottomFrame: 75, endFrame: 99 },
    ];

    const result = analyzeSet(frames, fps, 'squat', repBoundaries);

    // ROM should be non-zero since the angle oscillates ~90 degrees
    expect(result.rangeOfMotion.avgDegrees).toBeGreaterThan(0);

    // TUT should be non-zero for 2 reps
    expect(result.timeUnderTension.total).toBeGreaterThan(0);
    expect(result.timeUnderTension.perRep).toHaveLength(2);

    // Velocity should have per-rep entries
    expect(result.velocity.perRep).toHaveLength(2);

    // Movement quality should be a score 0-100
    expect(result.movementQuality).toBeGreaterThanOrEqual(0);
    expect(result.movementQuality).toBeLessThanOrEqual(100);
  });

  it('calculates ROM consistency correctly for identical reps', () => {
    const fps = 10;
    const frames = [];
    // 2 identical squat reps
    for (let i = 0; i < 100; i++) {
      const phase = (i % 50) / 50;
      const kneeAngle = 125 + 45 * Math.cos(phase * 2 * Math.PI);
      frames.push(fakeSquatFrame(kneeAngle, i / fps));
    }

    const repBoundaries = [
      { startFrame: 0, bottomFrame: 25, endFrame: 49 },
      { startFrame: 50, bottomFrame: 75, endFrame: 99 },
    ];

    const result = analyzeSet(frames, fps, 'squat', repBoundaries);

    // Identical reps should yield high consistency (low coefficient of variation)
    expect(result.rangeOfMotion.consistency).toBeGreaterThanOrEqual(90);
  });

  it('reports low asymmetry for symmetric landmarks', () => {
    const fps = 10;
    const frames = [];
    for (let i = 0; i < 50; i++) {
      // Symmetric standing landmarks — left/right are mirror images
      frames.push(fakeLandmarks());
    }

    const repBoundaries = [
      { startFrame: 0, bottomFrame: 25, endFrame: 49 },
    ];

    const result = analyzeSet(frames, fps, 'squat', repBoundaries);

    // Symmetric landmarks should have low asymmetry
    expect(result.asymmetry.score).toBeLessThan(15);
    expect(result.asymmetry.risk).toBe('low');
  });

  it('accepts both raw arrays and {landmarks} objects', () => {
    const fps = 10;
    const rawFrame = fakeSquatFrame(120, 0);
    const wrappedFrame = { landmarks: fakeSquatFrame(90, 0.1) };

    const frames = [rawFrame, wrappedFrame];
    const repBoundaries = [{ startFrame: 0, bottomFrame: 1, endFrame: 1 }];

    // Should not throw — the normalizer handles both formats
    const result = analyzeSet(frames, fps, 'squat', repBoundaries);
    expect(result).toHaveProperty('velocity');
  });
});

// ---------------------------------------------------------------------------
// setUserHeight
// ---------------------------------------------------------------------------

describe('setUserHeight', () => {
  it('accepts valid height values without error', () => {
    expect(() => setUserHeight(175)).not.toThrow();
    expect(() => setUserHeight(155)).not.toThrow();
  });

  it('ignores out-of-range values', () => {
    // Should not throw for extreme values; just ignores them
    expect(() => setUserHeight(50)).not.toThrow();
    expect(() => setUserHeight(300)).not.toThrow();
    expect(() => setUserHeight(null)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Time under tension calculation
// ---------------------------------------------------------------------------

describe('analyzeSet — time under tension', () => {
  it('calculates eccentric and concentric phases separately', () => {
    const fps = 10;
    const frames = [];
    for (let i = 0; i < 50; i++) {
      const phase = i / 50;
      const kneeAngle = 125 + 45 * Math.cos(phase * 2 * Math.PI);
      frames.push(fakeSquatFrame(kneeAngle, i / fps));
    }

    const repBoundaries = [
      { startFrame: 0, bottomFrame: 25, endFrame: 49 },
    ];

    const result = analyzeSet(frames, fps, 'squat', repBoundaries);

    const tut = result.timeUnderTension;
    expect(tut.eccentric).toBeGreaterThan(0);
    expect(tut.concentric).toBeGreaterThan(0);
    // Total should equal eccentric + concentric
    expect(tut.total).toBeCloseTo(tut.eccentric + tut.concentric, 1);
  });
});

// ---------------------------------------------------------------------------
// Fatigue detection
// ---------------------------------------------------------------------------

describe('analyzeSet — fatigue detection', () => {
  it('reports fatigue metrics with sufficient reps', () => {
    const fps = 10;
    const frames = [];
    // 4 reps, each 30 frames (3 seconds)
    for (let i = 0; i < 120; i++) {
      const phase = (i % 30) / 30;
      const kneeAngle = 125 + 45 * Math.cos(phase * 2 * Math.PI);
      frames.push(fakeSquatFrame(kneeAngle, i / fps));
    }

    const repBoundaries = [
      { startFrame: 0, bottomFrame: 15, endFrame: 29 },
      { startFrame: 30, bottomFrame: 45, endFrame: 59 },
      { startFrame: 60, bottomFrame: 75, endFrame: 89 },
      { startFrame: 90, bottomFrame: 105, endFrame: 119 },
    ];

    const result = analyzeSet(frames, fps, 'squat', repBoundaries);

    expect(result.fatigue).toHaveProperty('index');
    expect(result.fatigue).toHaveProperty('velocityDropoff');
    expect(result.fatigue).toHaveProperty('recommendation');
    expect(typeof result.fatigue.index).toBe('number');
    expect(result.fatigue.index).toBeGreaterThanOrEqual(0);
    expect(result.fatigue.index).toBeLessThanOrEqual(100);
  });
});
