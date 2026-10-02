/**
 * The standing and the lying barbell curl (David, 2 October 2026: the curls of science-based lifting). Both are
 * counted as the curl is, by the elbow (guide-families.json); the guide holds no drawing of either, so both
 * borrow the EZ-bar curl's and say so (exerciseGuide.js, `similar`). Status: experimental, not measured on
 * our clips; the lying posture changes nothing in the angle the core reads, which is taken in 3D.
 */
import { describe, expect, it } from 'vitest';
import { summarizeCount } from '../../coreAnalysis';
import { getGuideExercise } from '../../exerciseGuide';
import { isOffered, tierOf } from '../../offer';
import { liftDefinition } from '../core';
import { cycles, jointFrame, sample, timestamps } from './synthetic';

const SPS = 15;
const curl = (reps: number) => {
  const a = sample(cycles({ rest: 165, work: 50, reps, firstSec: 0.9, secondSec: 1.2, restSec: 0.6 }), 165, SPS);
  return { wl: a.map(x => jointFrame('elbow', { left: x, right: x })), ts: timestamps(a.length, SPS) };
};

describe('the barbell curls', () => {
  for (const key of ['barbell_curl', 'lying_barbell_curl']) {
    it(`${key} is offered, experimental, and counted as the curl`, () => {
      expect(isOffered(key)).toBe(true);
      expect(tierOf(key)).toBe('experimental');
      expect(liftDefinition(key)).toEqual(liftDefinition('bicep_curl'));
      const { wl, ts } = curl(8);
      expect((summarizeCount(wl, ts, key) as { count: number }).count).toBe(8);
    });
    it(`${key} shows the EZ-bar curl's drawing, marked as a similar movement`, () => {
      const g = getGuideExercise(key)!;
      expect(g.similar).toBe(true);
      expect(g.frames[0]).toMatch(/guide\/ez-bar-curl\/frame-1\.webp$/);
    });
  }
  it('an exercise with its own drawing is not marked similar', () => expect(getGuideExercise('ez_bar_curl')!.similar).toBe(false));
});
