// The sports lab's calculators (honesty pass of 14 October 2026, SP-11, SP-16, SP-17, SP-20): a ratio of two
// durations, or no ratio when a duration is missing; no verdict, score, torque, speed or G exists any more.
import { describe, it, expect } from 'vitest';
import * as sports from '../kinematics';
import { golfTempoRatio, rowingRhythmRatio, GOLF_TEMPO_REFERENCE, ROWING_RATIO_REFERENCE } from '../kinematics';

describe('sports calculators', () => {
  it('computes the golf tempo as backswing over downswing', () => {
    expect(golfTempoRatio(750, 250)).toBe(3);
    expect(golfTempoRatio(700, 300)).toBe(2.3);
  });

  it('gives no golf tempo when a duration is missing, rather than the reference (SP-20)', () => {
    expect(golfTempoRatio(750, 0)).toBeNull();
    expect(golfTempoRatio(0, 250)).toBeNull();
    expect(golfTempoRatio(750, -10)).toBeNull();
    expect(golfTempoRatio(Number.NaN, 250)).toBeNull();
  });

  it('computes the rowing rhythm as recovery over drive, and none without a drive', () => {
    expect(rowingRhythmRatio(600, 1200)).toBe(2);
    expect(rowingRhythmRatio(800, 1300)).toBe(1.6);
    expect(rowingRhythmRatio(0, 1200)).toBeNull();
  });

  it('holds the two references the screen cites', () => {
    expect(GOLF_TEMPO_REFERENCE).toBe(3);
    expect(ROWING_RATIO_REFERENCE).toBe(2);
  });

  it('exports nothing that grades, scores or estimates a force, a speed or a torque', () => {
    expect(Object.keys(sports).sort()).toEqual(['GOLF_TEMPO_REFERENCE', 'ROWING_RATIO_REFERENCE', 'golfTempoRatio', 'rowingRhythmRatio']);
  });
});
