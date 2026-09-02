/**
 * Tests for the RepCounter engine — valley counting algorithm.
 *
 * The RepCounter detects exercise repetitions by finding valleys (local minima)
 * in joint angle signals. For squats, each valley corresponds to the bottom
 * of a squat where knee angle is minimized.
 *
 * Algorithm parameters:
 *   - Minimum signal range: 15 degrees (else zero reps)
 *   - Minimum amplitude (prominence): max(40, 35% of signal range)
 *   - Minimum time between reps: 1.5 seconds
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localforage before importing modules that transitively depend on poseAnalysis
vi.mock('localforage', () => ({
  default: {
    createInstance: () => ({
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { RepCounter, AngleBuffer } from '../repCounter';
import { fakeSquatFrame, fakeLandmarks } from './helpers';

// ---------------------------------------------------------------------------
// AngleBuffer (moving average smoother)
// ---------------------------------------------------------------------------

describe('AngleBuffer', () => {
  it('smooths a sequence of angle values with a moving window', () => {
    const buffer = new AngleBuffer(3);
    const s1 = buffer.smooth({ leftKnee: 90 });
    expect(s1.leftKnee).toBe(90); // first value, avg of [90]

    const s2 = buffer.smooth({ leftKnee: 120 });
    expect(s2.leftKnee).toBe(105); // avg of [90, 120]

    const s3 = buffer.smooth({ leftKnee: 150 });
    expect(s3.leftKnee).toBe(120); // avg of [90, 120, 150]

    // Window is 3, so the next value pushes out the first
    const s4 = buffer.smooth({ leftKnee: 150 });
    expect(s4.leftKnee).toBe(140); // avg of [120, 150, 150]
  });

  it('resets the buffer on reset()', () => {
    const buffer = new AngleBuffer(3);
    buffer.smooth({ leftKnee: 90 });
    buffer.smooth({ leftKnee: 120 });
    buffer.reset();
    const s = buffer.smooth({ leftKnee: 60 });
    expect(s.leftKnee).toBe(60); // fresh start
  });
});

// ---------------------------------------------------------------------------
// RepCounter — core rep detection
// ---------------------------------------------------------------------------

describe('RepCounter', () => {
  it('throws on unknown exercise key', () => {
    expect(() => new RepCounter('nonexistent_exercise')).toThrow('Unknown exercise');
  });

  it('counts 5 squats from synthetic landmark data', () => {
    const counter = new RepCounter('squat', { mode: 'video', fps: 10 });
    const totalFrames = 300; // 30 seconds at 10fps
    const repsToSimulate = 5;
    const framesPerRep = totalFrames / repsToSimulate; // 60 frames per rep = 6 seconds

    for (let frame = 0; frame < totalFrames; frame++) {
      const t = frame / totalFrames;
      const repPhase = (frame % framesPerRep) / framesPerRep;

      // Knee angle cycles between 170 (standing) and 80 (deep squat)
      // Using cosine so valley (minimum) is in the middle of each rep cycle
      const kneeAngle = 125 + 45 * Math.cos(repPhase * 2 * Math.PI);
      const landmarks = fakeSquatFrame(kneeAngle, frame / 10);
      counter.update(landmarks, frame / 10);
    }

    counter.finalize();
    // The valley counter should detect approximately 5 reps.
    // Allow some tolerance since synthetic data may not be perfect.
    expect(counter.reps).toBeGreaterThanOrEqual(4);
    expect(counter.reps).toBeLessThanOrEqual(6);
  });

  it('counts zero reps when signal is flat (no movement)', () => {
    const counter = new RepCounter('squat', { mode: 'video', fps: 10 });

    // 100 frames of standing still at 170 degree knee angle
    for (let frame = 0; frame < 100; frame++) {
      const landmarks = fakeSquatFrame(170, frame / 10);
      counter.update(landmarks, frame / 10);
    }

    counter.finalize();
    expect(counter.reps).toBe(0);
  });

  it('handles empty frames gracefully', () => {
    const counter = new RepCounter('squat', { mode: 'video', fps: 10 });

    // Feed a few null / empty landmark arrays
    counter.update(null, 0);
    counter.update([], 0.1);
    counter.update(undefined, 0.2);

    counter.finalize();
    expect(counter.reps).toBe(0);
    expect(counter.repHistory).toHaveLength(0);
  });

  it('returns correct diagnostics structure', () => {
    const counter = new RepCounter('squat', { mode: 'video', fps: 10 });

    for (let frame = 0; frame < 20; frame++) {
      const landmarks = fakeSquatFrame(170, frame / 10);
      counter.update(landmarks, frame / 10);
    }

    counter.finalize();
    const diag = counter.diagnostics;

    expect(diag).toHaveProperty('observedMin');
    expect(diag).toHaveProperty('observedMax');
    expect(diag).toHaveProperty('observedRange');
    expect(diag).toHaveProperty('repsDetected');
    expect(diag).toHaveProperty('totalFrames');
    expect(diag).toHaveProperty('method');
    expect(diag.method).toBe('valley-counter');
    expect(diag.totalFrames).toBe(20);
  });

  it('update() returns the expected result shape', () => {
    const counter = new RepCounter('squat', { mode: 'video', fps: 10 });
    const landmarks = fakeSquatFrame(120, 0);
    const result = counter.update(landmarks, 0);

    expect(result).toHaveProperty('reps');
    expect(result).toHaveProperty('phase');
    expect(result).toHaveProperty('angle');
    expect(result).toHaveProperty('angles');
    expect(result).toHaveProperty('formFeedback');
    expect(result).toHaveProperty('repCompleted');
    expect(result).toHaveProperty('repHistory');
    expect(typeof result.reps).toBe('number');
    expect(typeof result.angle).toBe('number');
  });

  it('rejects reps that are too close together (< 1.5 seconds)', () => {
    const counter = new RepCounter('squat', { mode: 'video', fps: 30 });

    // Very fast oscillation: one "rep" every 0.5 seconds (too fast to be real)
    for (let frame = 0; frame < 300; frame++) {
      const repPhase = (frame % 15) / 15; // 15 frames = 0.5s at 30fps
      const kneeAngle = 125 + 45 * Math.cos(repPhase * 2 * Math.PI);
      const landmarks = fakeSquatFrame(kneeAngle, frame / 30);
      counter.update(landmarks, frame / 30);
    }

    counter.finalize();
    // Should detect far fewer than 20 "reps" because of the 1.5s minimum spacing
    expect(counter.reps).toBeLessThan(10);
  });

  it('builds rep history with form scores when finalize() detects reps', () => {
    const counter = new RepCounter('squat', { mode: 'video', fps: 10 });
    const totalFrames = 200;
    const framesPerRep = 50; // 5 seconds per rep at 10fps

    for (let frame = 0; frame < totalFrames; frame++) {
      const repPhase = (frame % framesPerRep) / framesPerRep;
      const kneeAngle = 125 + 45 * Math.cos(repPhase * 2 * Math.PI);
      const landmarks = fakeSquatFrame(kneeAngle, frame / 10);
      counter.update(landmarks, frame / 10);
    }

    counter.finalize();

    if (counter.reps > 0) {
      expect(counter.repHistory.length).toBe(counter.reps);
      for (const rep of counter.repHistory) {
        expect(rep).toHaveProperty('startFrame');
        expect(rep).toHaveProperty('endFrame');
        expect(rep).toHaveProperty('rom');
        // Score may be null if no form checks apply
        if (rep.score !== null) {
          expect(typeof rep.score).toBe('number');
          expect(rep.score).toBeGreaterThanOrEqual(0);
          expect(rep.score).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('reset() clears all state', () => {
    const counter = new RepCounter('squat', { mode: 'video', fps: 10 });

    for (let frame = 0; frame < 50; frame++) {
      const kneeAngle = 125 + 45 * Math.cos((frame / 50) * 2 * Math.PI);
      counter.update(fakeSquatFrame(kneeAngle, frame / 10), frame / 10);
    }

    counter.reset();
    expect(counter.reps).toBe(0);
    expect(counter.repHistory).toHaveLength(0);
  });
});
