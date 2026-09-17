/**
 * Benchmark test suite for rep counting accuracy.
 *
 * Tests the full valley counting pipeline against synthetic signals with
 * known rep counts. This is the first layer of validation — synthetic signals
 * with perfect periodicity, controlled noise, and known edge conditions.
 *
 * Real video benchmarks require labelled video files (future work).
 * This suite validates the algorithm's behavior on controlled inputs.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('localforage', () => ({
  default: {
    createInstance: () => ({
      getItem: vi.fn().mockResolvedValue(null),
      setItem: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import {
  findValleys,
  autocorrelationEdgeCorrect,
  templateEdgeCorrect,
} from '../valleyCounter';

// ---------------------------------------------------------------------------
// Synthetic signal generator
// ---------------------------------------------------------------------------

/**
 * Generate a sinusoidal signal simulating rep motion.
 * @param {number} reps - Number of complete reps
 * @param {number} fps - Frames per second
 * @param {number} repDuration - Duration of one rep in seconds
 * @param {object} opts - Options
 * @param {number} opts.low - Valley angle (default 60)
 * @param {number} opts.high - Peak angle (default 150)
 * @param {number} opts.noise - Noise amplitude in degrees (default 0)
 * @param {number} opts.leadIn - Seconds of flat signal before reps start (default 0)
 * @param {number} opts.leadOut - Seconds of flat signal after reps end (default 0)
 * @returns {number[]} Signal array
 */
function generateRepSignal(reps, fps, repDuration, opts = {}) {
  const low = opts.low ?? 60;
  const high = opts.high ?? 150;
  const noise = opts.noise ?? 0;
  const leadIn = opts.leadIn ?? 0;
  const leadOut = opts.leadOut ?? 0;

  const amplitude = (high - low) / 2;
  const center = (high + low) / 2;
  const framesPerRep = Math.round(fps * repDuration);
  const leadInFrames = Math.round(fps * leadIn);
  const leadOutFrames = Math.round(fps * leadOut);
  const repFrames = framesPerRep * reps;
  const totalFrames = leadInFrames + repFrames + leadOutFrames;

  const signal = [];
  for (let i = 0; i < totalFrames; i++) {
    let value;
    if (i < leadInFrames) {
      value = high; // Start at top position
    } else if (i >= leadInFrames + repFrames) {
      value = high; // End at top position
    } else {
      const t = (i - leadInFrames) / framesPerRep;
      // Cosine wave: starts at peak, valley at 0.5 of each cycle
      value = center + amplitude * Math.cos(2 * Math.PI * t);
    }
    if (noise > 0) {
      value += (Math.random() - 0.5) * 2 * noise;
    }
    signal.push(value);
  }
  return signal;
}

// Default exercise config matching a standard compound movement
const defaultExercise = {
  downThreshold: 90,
  upThreshold: 150,
  amplitudeRatio: 0.25,
  minSpacing: 0.5,
};

const curlExercise = {
  downThreshold: 80,
  upThreshold: 145,
  amplitudeRatio: 0.30,
  minSpacing: 0.6,
};

const shrugExercise = {
  downThreshold: 60,
  upThreshold: 90,
  amplitudeRatio: 0.10,
  minSpacing: 0.4,
};

const crunchExercise = {
  downThreshold: 15,
  upThreshold: 30,
  amplitudeRatio: 0.12,
  minSpacing: 0.3,
};

// ---------------------------------------------------------------------------
// Core valley counting accuracy
// ---------------------------------------------------------------------------

describe('Rep counting accuracy — synthetic signals', () => {

  describe('Clean signals (zero noise)', () => {
    const fps = 30;

    it.each([
      [5, 2.0],
      [8, 1.5],
      [10, 1.2],
      [12, 1.0],
      [15, 0.8],
    ])('counts %i reps at %is/rep exactly', (expectedReps, repDuration) => {
      const signal = generateRepSignal(expectedReps, fps, repDuration);
      const result = findValleys(signal, fps, defaultExercise);
      expect(result.reps).toBe(expectedReps);
    });

    it('counts 9 curl reps exactly', () => {
      const signal = generateRepSignal(9, fps, 1.5, { low: 40, high: 145 });
      const result = findValleys(signal, fps, curlExercise);
      expect(result.reps).toBe(9);
    });

    it('counts shrug reps with narrow ROM', () => {
      const signal = generateRepSignal(10, fps, 1.0, { low: 60, high: 90 });
      const result = findValleys(signal, fps, shrugExercise);
      expect(result.reps).toBe(10);
    });

    it('counts crunch reps with very narrow ROM', () => {
      const signal = generateRepSignal(12, fps, 0.8, { low: 15, high: 30 });
      const result = findValleys(signal, fps, crunchExercise);
      expect(result.reps).toBe(12);
    });
  });

  describe('Noisy signals', () => {
    const fps = 30;

    it('tolerates 3° noise on 10-rep signal', () => {
      const signal = generateRepSignal(10, fps, 1.5, { noise: 3 });
      const result = findValleys(signal, fps, defaultExercise);
      // Allow ±1 rep tolerance with noise
      expect(result.reps).toBeGreaterThanOrEqual(9);
      expect(result.reps).toBeLessThanOrEqual(11);
    });

    it('tolerates 5° noise on 8-rep signal', () => {
      const signal = generateRepSignal(8, fps, 1.5, { noise: 5 });
      const result = findValleys(signal, fps, defaultExercise);
      expect(result.reps).toBeGreaterThanOrEqual(7);
      expect(result.reps).toBeLessThanOrEqual(9);
    });
  });

  describe('Edge correction cap', () => {
    const fps = 30;

    it('edge correction adds at most 1 rep total', () => {
      // Signal with lead-in and lead-out that could trigger both edges
      const signal = generateRepSignal(8, fps, 1.5, { leadIn: 1.2, leadOut: 1.2 });
      const valleyResult = findValleys(signal, fps, defaultExercise);
      const afterAC = autocorrelationEdgeCorrect(signal, valleyResult, fps);
      const acAdded = afterAC.reps > valleyResult.reps;

      let finalResult;
      if (acAdded) {
        // Template should be skipped (per index.ts logic)
        finalResult = afterAC;
      } else {
        finalResult = templateEdgeCorrect(signal, afterAC, fps, defaultExercise);
      }

      // Total edge additions should be at most 1
      expect(finalResult.reps - valleyResult.reps).toBeLessThanOrEqual(1);
    });
  });

  describe('Zero-rep signals', () => {
    const fps = 30;

    it('returns 0 reps for flat signal', () => {
      const signal = new Array(300).fill(120);
      const result = findValleys(signal, fps, defaultExercise);
      expect(result.reps).toBe(0);
    });

    it('returns 0 reps for random noise without periodicity', () => {
      const signal = Array.from({ length: 300 }, () => 90 + Math.random() * 10);
      const result = findValleys(signal, fps, defaultExercise);
      // Should find 0 or very few reps — noise should not produce false reps
      expect(result.reps).toBeLessThanOrEqual(2);
    });
  });

  describe('Period bounds enforcement', () => {
    const fps = 30;

    it('rejects reps faster than minSpacing', () => {
      // Generate signal at 0.3s/rep which is below the 0.5s minSpacing
      const signal = generateRepSignal(20, fps, 0.3);
      const result = findValleys(signal, fps, defaultExercise);
      // Should find fewer reps than generated (spacing filter removes close valleys)
      expect(result.reps).toBeLessThan(20);
    });
  });
});

// ---------------------------------------------------------------------------
// Benchmark ground truth format (for future real video tests)
// ---------------------------------------------------------------------------

describe('Benchmark ground truth format', () => {
  it('validates the ground truth schema', () => {
    // This defines the format for labelled video benchmarks
    const groundTruth = {
      videoFile: 'bicep_curl_9reps.mp4',
      exercise: 'bicep_curl',
      expectedReps: 9,
      tolerance: 0, // exact match required
      fps: 30,
      cameraAngle: 'side', // side | front | angle
      notes: 'Clean form, full ROM, controlled tempo',
    };

    expect(groundTruth.expectedReps).toBeGreaterThan(0);
    expect(groundTruth.tolerance).toBeGreaterThanOrEqual(0);
    expect(['side', 'front', 'angle']).toContain(groundTruth.cameraAngle);
  });
});
