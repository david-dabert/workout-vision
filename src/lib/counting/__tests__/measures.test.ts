/**
 * Per-rep measures taken from the smoothed angle: angular speed and tempo phases.
 * Each test fails before its measure exists on RepDetail, then passes once core.ts
 * computes it. No parameter is taken from the clips.
 *
 * Angular speed: the frame-to-frame change in the smoothed angle, in degrees per
 * second. Peak is the highest instantaneous speed within the rep; mean is the
 * average over the rep's duration (pauses included, so it is always lower than
 * the moving-phase speed).
 *
 * A linear ramp from rest to work over 1 s at 30 sps covers 120° in 30 steps:
 * each step is 4° / (1/30 s) = 120 °/s. Savitzky–Golay preserves linear
 * trends, so the speed at the ramp's interior should be close to 120 °/s.
 * The pauses at each end pull the mean below the peak.
 */
import { describe, it, expect } from 'vitest';
import { countReps } from '../core';
import { jointFrame, sample, cycles, timestamps, type Joint } from './synthetic';

const SPS = 30;

function run(joint: Joint, rest: number, work: number, lift: 'bicep_curl' | 'lateral_raise' | 'squat') {
  const angles = sample(cycles({ rest, work, reps: 5, firstSec: 1, secondSec: 1, restSec: 0.8 }), rest, SPS);
  const frames = angles.map(a => jointFrame(joint, { left: a }));
  return countReps(frames, timestamps(angles.length, SPS), lift);
}

describe('Angular speed on RepDetail', () => {
  const result = run('elbow', 170, 50, 'bicep_curl');

  it('counts 5 reps', () => {
    expect(result.count).toBe(5);
  });

  it('each rep carries peakSpeed in degrees per second', () => {
    for (const r of result.reps) {
      expect(r).toHaveProperty('peakSpeed');
      expect(typeof r.peakSpeed).toBe('number');
      // A 120° ramp over 1 s: peak should be near 120, within smoothing tolerance.
      expect(r.peakSpeed).toBeGreaterThan(80);
      expect(r.peakSpeed).toBeLessThan(200);
    }
  });

  it('each rep carries meanSpeed in degrees per second', () => {
    for (const r of result.reps) {
      expect(r).toHaveProperty('meanSpeed');
      expect(typeof r.meanSpeed).toBe('number');
      // Mean includes pauses at ends, so lower than peak.
      expect(r.meanSpeed).toBeGreaterThan(20);
      expect(r.meanSpeed).toBeLessThan(r.peakSpeed! + 1);
    }
  });

  it('peak speed is at least as high as mean speed', () => {
    for (const r of result.reps) {
      expect(r.peakSpeed).toBeGreaterThanOrEqual(r.meanSpeed! - 0.01);
    }
  });

  it('a clipped rep still carries speed (from whatever samples it has)', () => {
    // Start the recording mid-rep so the first rep is clipped.
    const angles = sample(cycles({ rest: 170, work: 50, reps: 5, firstSec: 1, secondSec: 1, restSec: 0.8 }), 170, SPS);
    const cut = angles.slice(Math.round(1.3 * SPS));
    const frames = cut.map(a => jointFrame('elbow', { left: a }));
    const r = countReps(frames, timestamps(cut.length, SPS), 'bicep_curl');
    expect(r.count).toBe(5);
    const clipped = r.reps.find(x => x.clipped);
    expect(clipped).toBeDefined();
    expect(typeof clipped!.peakSpeed).toBe('number');
    expect(typeof clipped!.meanSpeed).toBe('number');
  });
});

describe('Angular speed varies with tempo', () => {
  it('a slow set has lower peak speed than a fast set', () => {
    const slow = sample(cycles({ rest: 170, work: 50, reps: 5, firstSec: 2, secondSec: 2, restSec: 0.8 }), 170, SPS);
    const fast = sample(cycles({ rest: 170, work: 50, reps: 5, firstSec: 0.6, secondSec: 0.6, restSec: 0.8 }), 170, SPS);
    const sSlow = countReps(slow.map(a => jointFrame('elbow', { left: a })), timestamps(slow.length, SPS), 'bicep_curl');
    const sFast = countReps(fast.map(a => jointFrame('elbow', { left: a })), timestamps(fast.length, SPS), 'bicep_curl');
    const peakSlow = sSlow.reps.reduce((s, r) => s + r.peakSpeed!, 0) / sSlow.reps.length;
    const peakFast = sFast.reps.reduce((s, r) => s + r.peakSpeed!, 0) / sFast.reps.length;
    expect(peakFast).toBeGreaterThan(peakSlow * 1.5);
  });
});
