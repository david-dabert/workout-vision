/**
 * The fitness tests (fitness-tests.js) on synthetic sets: the chair stand and the arm curl are counted by their
 * own definitions, and the score keeps the reps past halfway up within 30 seconds from the first rise
 * (Jones, Rikli & Beam 1999). Written before the definitions existed: both counts were 0 then.
 */
import { describe, expect, it } from 'vitest';
import { countReps } from '../core';
import { summarizeCount } from '../../coreAnalysis';
import { scoreTest, FITNESS_TESTS } from '../../fitness-tests';
import { cycles, jointFrame, sample, timestamps } from './synthetic';

const SPS = 15;
function set(joint: 'knee' | 'elbow', rest: number, work: number, reps: number, firstSec: number, secondSec: number, restSec: number) {
  const angles = sample(cycles({ rest, work, reps, firstSec, secondSec, restSec }), rest, SPS);
  return { wl: angles.map(a => jointFrame(joint, { left: a, right: a })), ts: timestamps(angles.length, SPS) };
}

describe('the 30-second chair stand', () => {
  // Seated at 90°, standing at 170°: rise 0.8 s, sit 0.8 s, 0.6 s on the chair (whole samples at 15 per second,
  // so each stand takes exactly 2.2 s); 16 stands over about 36 s.
  const s = set('knee', 90, 170, 16, 0.8, 0.8, 0.6);
  const c = countReps(s.wl, s.ts, 'chair_stand_test');
  it('counts every stand of the set', () => expect(c.count).toBe(16));
  it('scores the stands past halfway up within 30 s of the first rise', () => {
    const r = scoreTest(c.reps, s.ts.at(-1)!, FITNESS_TESTS.chair_stand_test.windowSec);
    // Stands start every 2.2 s from the first; the 14th is halfway up 29 s after it, the 15th 31.2 s after.
    expect(r.score).toBe(14);
    expect(r.beyond).toBe(2);
    expect(r.complete).toBe(true);
  });
  it('says the test is incomplete when the video ends before 30 s', () => {
    const cut = 25 * SPS;
    const c2 = countReps(s.wl.slice(0, cut), s.ts.slice(0, cut), 'chair_stand_test');
    expect(scoreTest(c2.reps, s.ts[cut - 1], 30).complete).toBe(false);
  });
});

describe('the 30-second arm curl', () => {
  // Elbow 165° at rest, 50° at the top: up 0.6 s, down 1.0 s, 0.4 s between (whole samples at 15 per second,
  // so each curl takes exactly 2 s); 18 curls over 36 s.
  const s = set('elbow', 165, 50, 18, 0.6, 1.0, 0.4);
  const c = countReps(s.wl, s.ts, 'arm_curl_test');
  it('counts every curl of the set', () => expect(c.count).toBe(18));
  it('scores the curls past halfway up within 30 s', () => {
    // Curls start every 2 s; the 15th is halfway up about 28.3 s after the first, the 16th about 30.3 s after.
    expect(scoreTest(c.reps, s.ts.at(-1)!, 30).score).toBe(15);
  });
});

describe('the halfway rule', () => {
  const rep = (startTime: number, concentricSec: number) => ({ startTime, endTime: startTime + 2 * concentricSec, concentricSec });
  it('keeps a rep halfway up before the window ends, and not one after', () => {
    expect(scoreTest([rep(0, 1), rep(29.7, 0.4)], 40, 30).score).toBe(2);
    expect(scoreTest([rep(0, 1), rep(29.7, 0.8)], 40, 30).score).toBe(1);
  });
  it('scores nothing without a rep', () => expect(scoreTest([], 40, 30)).toMatchObject({ score: 0, complete: false }));
});

describe('the analysis of a test', () => {
  it('shows the 30-second score as the count, the marks of the reps within it, and the whole set beside', () => {
    const s = set('knee', 90, 170, 16, 0.8, 0.8, 0.6);
    const r: { count: number; reps: unknown[]; test?: unknown } = summarizeCount(s.wl, s.ts, 'chair_stand_test');
    expect(r.count).toBe(14);
    expect(r.reps).toHaveLength(14);
    expect(r.test).toMatchObject({ windowSec: 30, complete: true, beyond: 2, counted: 16 });
  });
  it('leaves an exercise that is not a test as it was', () => {
    const s = set('knee', 170, 90, 16, 0.8, 0.8, 0.6);
    const r: { count: number; test?: unknown } = summarizeCount(s.wl, s.ts, 'squat');
    expect(r.count).toBe(16);
    expect(r.test).toBeUndefined();
  });
});
