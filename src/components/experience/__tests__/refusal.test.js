import { describe, it, expect } from 'vitest';
import { refusal } from '../refusal';

// A refused set says only which limbs were really out of sight (verifier of step 2, R8, 29 September
// 2026): for a both-sides exercise, the sides are judged one by one.
const seen = () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 });
const gone = () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.1 });
// Knee joints: left 23, 25, 27; right 24, 26, 28 (core.ts JOINT_POINTS).
function frames(n, { left = true, right = true } = {}) {
  return Array.from({ length: n }, () => Array.from({ length: 33 }, (_, k) => {
    if ([25, 27].includes(k)) return left ? seen() : gone();
    if ([26, 28].includes(k)) return right ? seen() : gone();
    return seen();
  }));
}

describe('refusal', () => {
  it('names only the left leg when the left leg alone was hidden in a both-sides set', () => {
    const why = refusal({ arm: 'both', imageLandmarks: frames(30, { left: false }) }, 'walking_lunge');
    expect(why.cause).toBe('hidden');
    expect(why.side).toBe('left');
  });

  it('names only the right leg when the right leg alone was hidden', () => {
    expect(refusal({ arm: 'both', imageLandmarks: frames(30, { right: false }) }, 'walking_lunge').side).toBe('right');
  });

  it('names both legs when both were hidden', () => {
    expect(refusal({ arm: 'both', imageLandmarks: frames(30, { left: false, right: false }) }, 'walking_lunge').side).toBe('both');
  });

  it('keeps the tracked side of a one-sided set', () => {
    const why = refusal({ arm: 'right', imageLandmarks: frames(30, { right: false }) }, 'squat');
    expect(why).toMatchObject({ cause: 'hidden', side: 'right' });
  });

  it('says the limbs were not clear enough, for the side counted, when none was hidden most of the set', () => {
    expect(refusal({ arm: 'both', imageLandmarks: frames(30) }, 'walking_lunge')).toMatchObject({ cause: 'unclear', side: 'both' });
    expect(refusal({ arm: 'left', imageLandmarks: frames(30) }, 'squat')).toMatchObject({ cause: 'unclear', side: 'left' });
  });

  // Review 04: a side is lost as the core loses it, when any of its three landmarks is hidden in a frame.
  const custom = (n, hiddenAt) => Array.from({ length: n }, (_, t) => Array.from({ length: 33 }, (_, k) => (hiddenAt(k, t) ? gone() : seen())));

  it('names the left leg when its hip is hidden for the first half and its ankle for the second', () => {
    const f = custom(30, (k, t) => (k === 23 && t < 15) || (k === 27 && t >= 15));
    const why = refusal({ arm: 'both', imageLandmarks: f }, 'walking_lunge');
    expect(why.side).toBe('left');
    expect(why.cause).not.toBe('unclear');
  });

  it('speaks of one side, not of the hips, when only one hip is hidden in a both-sides set', () => {
    const why = refusal({ arm: 'both', imageLandmarks: custom(30, k => k === 23) }, 'walking_lunge');
    expect(why).toMatchObject({ side: 'left', hips: false });
  });

  it('still speaks of the hips when both are hidden in a both-sides set, or the tracked one in a one-sided set', () => {
    expect(refusal({ arm: 'both', imageLandmarks: custom(30, k => k === 23 || k === 24) }, 'walking_lunge')).toMatchObject({ side: 'both', hips: true });
    expect(refusal({ arm: 'right', imageLandmarks: custom(30, k => k === 24) }, 'squat')).toMatchObject({ side: 'right', hips: true });
  });
});
