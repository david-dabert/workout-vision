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
  it('scores nothing without a rep', () => expect(scoreTest([], 40, 30)).toMatchObject({ score: 0 }));
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

describe('review of 2 October: how a test really ends', () => {
  // Seated 1 s; 11 stands (rise 0.8 s, sit 0.8 s, 0.8 s seated); a 12th rise, then standing until the end.
  const path = [{ hold: 90, sec: 1 }, ...Array.from({ length: 11 }, () => [{ to: 170, sec: 0.8 }, { to: 90, sec: 0.8 }, { hold: 90, sec: 0.8 }]).flat(), { to: 170, sec: 0.8 }, { hold: 170, sec: 6 }];
  it('counts a last stand ended standing, as the protocol counts any stand past halfway up', () => {
    const a = sample(path, 90, SPS), wl = a.map(x => jointFrame('knee', { left: x, right: x })), ts = timestamps(a.length, SPS);
    const r: { count: number } = summarizeCount(wl, ts, 'chair_stand_test');
    expect(r.count).toBe(12);
  });
  it('counts a last curl held at the top', () => {
    const p2 = [{ hold: 165, sec: 1 }, ...Array.from({ length: 14 }, () => [{ to: 50, sec: 0.6 }, { to: 165, sec: 1.0 }, { hold: 165, sec: 0.4 }]).flat(), { to: 50, sec: 0.6 }, { hold: 50, sec: 4 }];
    const a = sample(p2, 165, SPS), wl = a.map(x => jointFrame('elbow', { left: x, right: x })), ts = timestamps(a.length, SPS);
    const r: { count: number } = summarizeCount(wl, ts, 'arm_curl_test');
    expect(r.count).toBe(15);
  });
  it('a long video with no stand is not called short', () => expect(scoreTest([], 40, 30).complete).toBe(true));
  it('a video shorter than 30 s with no stand is called short', () => expect(scoreTest([], 20, 30).complete).toBe(false));
});

describe('the open rise stays inside the window', () => {
  it('a rise after the 30 s is not counted', () => {
    // One stand from 1 s, then seated until 34 s, then a rise held to the end (standing up to stop the phone).
    const path = [{ hold: 90, sec: 1 }, { to: 170, sec: 0.8 }, { to: 90, sec: 0.8 }, { hold: 90, sec: 32 }, { to: 170, sec: 0.8 }, { hold: 170, sec: 3 }];
    const a = sample(path, 90, SPS), wl = a.map(x => jointFrame('knee', { left: x, right: x })), ts = timestamps(a.length, SPS);
    const r: { count: number; test?: { beyond: number; open: boolean } } = summarizeCount(wl, ts, 'chair_stand_test');
    expect(r.count).toBe(1);
    expect(r.test).toMatchObject({ beyond: 1, open: false });
  });
  it('a set that ends seated has no open rise', () => {
    const path = [{ hold: 90, sec: 1 }, ...Array.from({ length: 10 }, () => [{ to: 170, sec: 0.8 }, { to: 90, sec: 0.8 }, { hold: 90, sec: 0.8 }]).flat(), { hold: 90, sec: 10 }];
    const a = sample(path, 90, SPS), wl = a.map(x => jointFrame('knee', { left: x, right: x })), ts = timestamps(a.length, SPS);
    const r: { count: number; test?: { open: boolean } } = summarizeCount(wl, ts, 'chair_stand_test');
    expect(r.count).toBe(10);
    expect(r.test?.open).toBe(false);
  });
});

describe('second review of 2 October', () => {
  const run = (path: object[], rest: number, joint: 'knee' | 'elbow', lift: string) => {
    const a = sample(path as never, rest, SPS), wl = a.map(x => jointFrame(joint, { left: x, right: x })), ts = timestamps(a.length, SPS);
    return summarizeCount(wl, ts, lift) as { count: number; reps: { clipped?: boolean }[]; test?: { open: boolean; complete: boolean; t0: number } };
  };
  it('a still video scores 0', () => expect(run([{ hold: 90, sec: 35 }], 90, 'knee', 'chair_stand_test').count).toBe(0));
  it('a still arm scores 0', () => expect(run([{ hold: 165, sec: 35 }], 165, 'elbow', 'arm_curl_test').count).toBe(0));
  it('partial rises under the countable range score 0', () => {
    const path = [{ hold: 90, sec: 1 }, ...Array.from({ length: 5 }, () => [{ to: 105, sec: 0.8 }, { to: 90, sec: 0.8 }, { hold: 90, sec: 0.8 }]).flat(), { hold: 90, sec: 20 }];
    expect(run(path, 90, 'knee', 'chair_stand_test').count).toBe(0);
  });
  it('the count is the marks: the open rise is a rep cut by the end', () => {
    const path = [{ hold: 90, sec: 1 }, ...Array.from({ length: 11 }, () => [{ to: 170, sec: 0.8 }, { to: 90, sec: 0.8 }, { hold: 90, sec: 0.8 }]).flat(), { to: 170, sec: 0.8 }, { hold: 170, sec: 6 }];
    const r = run(path, 90, 'knee', 'chair_stand_test');
    expect(r.reps.length).toBe(r.count);
    expect(r.reps.at(-1)?.clipped).toBe(true);
  });
  it('one stand held to the end is one mark, and a whole video', () => {
    const r = run([{ hold: 90, sec: 1 }, { to: 170, sec: 0.8 }, { hold: 170, sec: 31 }], 90, 'knee', 'chair_stand_test');
    expect(r.count).toBe(1);
    expect(r.reps.length).toBe(1);
    expect(r.test?.complete).toBe(true);
  });
});

describe('a lost pose breaks the open rise', () => {
  it('a half rise in the window, the pose lost, then standing after it, is not counted', () => {
    const path = [{ hold: 90, sec: 1 }, ...Array.from({ length: 10 }, () => [{ to: 170, sec: 0.8 }, { to: 90, sec: 0.8 }, { hold: 90, sec: 0.8 }]).flat(), { hold: 90, sec: 3 }, { to: 140, sec: 0.6 }, { hold: 140, sec: 12 }, { to: 170, sec: 0.5 }, { hold: 170, sec: 3 }];
    const a = sample(path, 90, SPS), ts = timestamps(a.length, SPS);
    const wl = a.map((x, i) => (ts[i] > 29 && ts[i] < 40 ? null : jointFrame('knee', { left: x, right: x })));
    const r: { count: number; test?: { open: boolean } } = summarizeCount(wl, ts, 'chair_stand_test');
    expect(r.count).toBe(10);
    expect(r.test?.open).toBe(false);
  });
});

describe('a test filmed from standing (David, 2 October 2026: 9 stands, the app said 10)', () => {
  it('the first sit-down is not a stand: 9 stands from standing score 9', () => {
    // Standing 1 s, sit down, then 9 stands (rise 0.8 s, sit 0.8 s, 0.8 s seated), seated to the end.
    const path = [{ hold: 165, sec: 1 }, { to: 90, sec: 0.8 }, { hold: 90, sec: 0.8 }, ...Array.from({ length: 9 }, () => [{ to: 165, sec: 0.8 }, { to: 90, sec: 0.8 }, { hold: 90, sec: 0.8 }]).flat(), { hold: 90, sec: 2 }];
    const a = sample(path, 165, SPS), wl = a.map(x => jointFrame('knee', { left: x, right: x })), ts = timestamps(a.length, SPS);
    const r: { count: number; reps: unknown[] } = summarizeCount(wl, ts, 'chair_stand_test');
    expect(r.count).toBe(9);
    expect(r.reps.length).toBe(9);
  });
});

import { riseHalfTimes } from '../../fitness-tests';

describe('halfway is half the movement, for every rep (audit FINDING-014)', () => {
  // A rise from 90° to 170° that is slow at first: half its time (0.5 s) is reached at 100°, half its angle
  // (130°) only at 0.794 s (80·t³ = 40).
  const ts = Array.from({ length: 21 }, (_, i) => i * 0.1);
  const angle = (t: number) => (t <= 1 ? 90 + 80 * Math.pow(t, 3) : 170);
  const smoothed = ts.map(angle);
  const rep = { startTime: 0, endTime: 2, concentricSec: 1, eccentricSec: 1 };
  it('the halfway time is where the angle passes half the range', () => {
    const [h] = riseHalfTimes(smoothed, ts, 90, 170, 'low', [rep]);
    expect(h).toBeCloseTo(0.794, 2);
  });
  it('a rep whose half angle comes after the window is not scored, even when its half time came before', () => {
    const [h] = riseHalfTimes(smoothed, ts, 90, 170, 'low', [rep]);
    const t = scoreTest([{ ...rep, halfTime: h }], 40, 0.6);
    expect(t.score).toBe(0);
  });
});
