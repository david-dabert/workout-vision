/**
 * Tests for partial repetition detection and classification (lengthened vs shortened partials).
 *
 * Biomechanics foundations:
 * - Dr. Milo Wolf & Dr. Mike Israetel (hypertrophy at long muscle lengths; Wolf et al. 2023, Pedrosa et al. 2022).
 * - Kassiano et al. (2023): Greater hypertrophy from lengthened partials in trained lifters.
 * - Non-medical copy: strictly biomechanical and athletic training terminology.
 */
import { describe, expect, it } from 'vitest';
import { countReps } from '../core';
import { jointFrame, sample, timestamps, type Segment } from './synthetic';

const SPS = 30;

describe('Partial Repetition Tracking', () => {
  it('detects 5 full bicep curls and 3 lengthened partials to failure', () => {
    // Full reps: rest at 170°, work at 50° (120° ROM)
    // Lengthened partials: rest at 170°, curls halfway to 110° (60° ROM, in stretched position)
    const segs: Segment[] = [{ hold: 170, sec: 0.8 }];
    for (let i = 0; i < 5; i++) {
      segs.push({ to: 50, sec: 1.0 }, { to: 170, sec: 0.8 }, { hold: 170, sec: 0.8 });
    }
    for (let i = 0; i < 3; i++) {
      segs.push({ to: 110, sec: 0.8 }, { to: 170, sec: 0.8 }, { hold: 170, sec: 0.8 });
    }
    const angles = sample(segs, 170, SPS);
    const frames = angles.map(a => jointFrame('elbow', { left: a }));
    const result = countReps(frames, timestamps(angles.length, SPS), 'bicep_curl');

    expect(result.count).toBe(5);
    expect(result.partialCount).toBe(3);
    expect(result.totalCount).toBe(8);
    expect(result.partials).toBeDefined();
    expect(result.partials?.length).toBe(3);

    for (const partial of result.partials || []) {
      expect(partial.isPartial).toBe(true);
      expect(partial.partialType).toBe('lengthened');
      expect(partial.romDegrees).toBeGreaterThanOrEqual(45);
      expect(partial.romDegrees).toBeLessThan(75);
      expect(partial.romFraction).toBeGreaterThan(0.35);
      expect(partial.romFraction).toBeLessThan(0.75);
      expect(partial.peakSpeed).toBeGreaterThan(0);
      expect(partial.meanSpeed).toBeGreaterThan(0);
    }
  });

  it('detects 5 full squats and 2 lengthened partial pulses in the hole', () => {
    // Full reps: standing at 170°, deep flexion at 80° (90° ROM)
    // Then 2 lengthened partial pulses in the bottom stretch: 80° -> 118° -> 80°
    const segs: Segment[] = [{ hold: 170, sec: 0.8 }];
    for (let i = 0; i < 5; i++) {
      segs.push({ to: 80, sec: 1.2 }, { to: 170, sec: 1.0 }, { hold: 170, sec: 0.8 });
    }
    // Bottom pulses
    segs.push({ to: 80, sec: 1.2 });
    for (let i = 0; i < 2; i++) {
      segs.push({ to: 118, sec: 0.7 }, { to: 80, sec: 0.7 });
    }
    segs.push({ to: 170, sec: 1.2 }, { hold: 170, sec: 0.8 });

    const angles = sample(segs, 170, SPS);
    const frames = angles.map(a => jointFrame('knee', { left: a }));
    const result = countReps(frames, timestamps(angles.length, SPS), 'squat');

    expect(result.count).toBe(6); // 5 full + the final rep returning to lockout
    expect(result.partialCount).toBe(2);
    expect(result.totalCount).toBe(8);
    expect(result.partials?.every(p => p.partialType === 'lengthened')).toBe(true);
  });

  it('classifies shallow quarter squats from lockout as shortened partials', () => {
    // 5 full squats to 80°, followed by 3 shallow quarter squats to 132°
    const segs: Segment[] = [{ hold: 170, sec: 0.8 }];
    for (let i = 0; i < 5; i++) {
      segs.push({ to: 80, sec: 1.2 }, { to: 170, sec: 1.0 }, { hold: 170, sec: 0.8 });
    }
    for (let i = 0; i < 3; i++) {
      segs.push({ to: 132, sec: 0.8 }, { to: 170, sec: 0.8 }, { hold: 170, sec: 0.8 });
    }
    const angles = sample(segs, 170, SPS);
    const frames = angles.map(a => jointFrame('knee', { left: a }));
    const result = countReps(frames, timestamps(angles.length, SPS), 'squat');

    expect(result.count).toBe(5); // 5 full reps
    expect(result.partialCount).toBe(3); // 3 shortened partials
    expect(result.totalCount).toBe(8);
    expect(result.partials?.filter(p => p.partialType === 'shortened').length).toBe(3);
  });

  it('reports zero partials on a clean set of full reps', () => {
    const segs: Segment[] = [{ hold: 170, sec: 0.8 }];
    for (let i = 0; i < 10; i++) {
      segs.push({ to: 50, sec: 1.0 }, { to: 170, sec: 0.8 }, { hold: 170, sec: 0.8 });
    }
    const angles = sample(segs, 170, SPS);
    const frames = angles.map(a => jointFrame('elbow', { left: a }));
    const result = countReps(frames, timestamps(angles.length, SPS), 'bicep_curl');

    expect(result.count).toBe(10);
    expect(result.partialCount).toBe(0);
    expect(result.totalCount).toBe(10);
    expect(result.partials?.length).toBe(0);
  });

  it('ignores sub-threshold micro-wobbles and still body at rest', () => {
    // Sub-threshold wobbles of 6 degrees
    const segs: Segment[] = [{ hold: 170, sec: 0.8 }];
    for (let i = 0; i < 10; i++) {
      segs.push({ to: 164, sec: 0.6 }, { to: 170, sec: 0.6 }, { hold: 170, sec: 0.4 });
    }
    const angles = sample(segs, 170, SPS);
    const frames = angles.map(a => jointFrame('elbow', { left: a }));
    const result = countReps(frames, timestamps(angles.length, SPS), 'bicep_curl');

    expect(result.count).toBe(0);
    expect(result.partialCount).toBe(0);
    expect(result.totalCount).toBe(0);
  });
});
