// counting/doubt.js: where the body went unseen during a set, by the refusal's own rule (swarm review, 6 October).
import { describe, it, expect } from 'vitest';
import { poseDoubt, HOLE_FALLBACK_SEC } from '../doubt';

const ts = n => Array.from({ length: n }, (_, i) => i / 15);
const reps = (k, sec) => Array.from({ length: k }, (_, i) => ({ startTime: i * sec, endTime: (i + 1) * sec }));

describe('poseDoubt', () => {
  it('finds no doubt in a set seen throughout', () => {
    const d = poseDoubt({ angles: Array(300).fill(90), reps: reps(10, 2) }, ts(300));
    expect(d).toEqual({ coverage: 1, holes: 0, unseenSec: 0, longestGapSec: 0, flagged: false });
  });

  it('flags a hole as long as half a rep, and not a shorter gap', () => {
    const angles = Array(300).fill(90);
    for (let i = 100; i < 115; i++) angles[i] = null;   // 1 s unseen; reps last 2 s
    expect(poseDoubt({ angles, reps: reps(10, 2) }, ts(300))).toMatchObject({ holes: 1, unseenSec: 1, flagged: true });
    const short = Array(300).fill(90);
    for (let i = 100; i < 110; i++) short[i] = null;    // 0.67 s
    expect(poseDoubt({ angles: short, reps: reps(10, 2) }, ts(300))).toMatchObject({ holes: 0, flagged: false });
  });

  it('flags a set seen less than 80% of the time, even in scattered gaps (the hip thrust of 5 October)', () => {
    const angles = Array(300).fill(90).map((a, i) => (i % 3 === 0 ? null : a));   // 67% seen, gaps of one sample
    expect(poseDoubt({ angles, reps: reps(10, 2) }, ts(300))).toMatchObject({ coverage: 0.67, holes: 0, flagged: true });
  });

  it('uses a fixed hole length when fewer than two reps were counted', () => {
    const angles = Array(300).fill(90);
    for (let i = 0; i < HOLE_FALLBACK_SEC * 15; i++) angles[100 + i] = null;
    expect(poseDoubt({ angles, reps: [] }, ts(300))).toMatchObject({ holes: 1, flagged: true });
  });

  it('needs both sides in sight for a both-sides lift, either side for a lift whose sides move together', () => {
    const left = Array(300).fill(90), right = Array(300).fill(90).map((a, i) => (i < 100 ? null : a));
    const core = { sides: { left: { angles: left }, right: { angles: right } }, reps: reps(10, 2) };
    expect(poseDoubt(core, ts(300)).flagged).toBe(true);
    expect(poseDoubt(core, ts(300), { together: true }).flagged).toBe(false);
  });
});

describe('the saved set', () => {
  it('keeps the doubt measured on the set, and none for a count typed after a refusal', async () => {
    const { savedSet } = await import('../../../components/experience/saved-set');
    const doubt = { coverage: 0.64, holes: 0, unseenSec: 0, longestGapSec: 1.2, flagged: true };
    expect(savedSet({ result: { count: 7, reps: [], arm: 'left', confidence: 0.64, doubt, metadata: { duration: 40 } }, lift: 'hip_thrust', n: 7 }).doubt).toEqual(doubt);
    expect(savedSet({ result: { refused: true, metadata: { duration: 12 } }, lift: 'squat', n: 8, manual: true }).doubt).toBeUndefined();
  });
});
