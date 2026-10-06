/**
 * A pause at the working end is not movement (WORK_HOLD_CAP_SEC in core.ts, audit of 6 October 2026, action 5).
 * MAX_REP_SEC bounded a rep's whole duration, so a squat or a lateral raise held 5 s at the working end lasted
 * over 8 s and was dropped: eight paused reps read 0, and a set of six plain and two paused reps read 6 with
 * full coverage, a confident wrong count (R8). The bound now applies to the rep's moving time: its duration less
 * the time it spent past the working threshold, that hold counted up to WORK_HOLD_CAP_SEC (10 s). A long stay at
 * the working end that is no rep (arms crossed for 20 s after a curl set) still exceeds it.
 * Source: UNSOURCED. Status: experimental; these synthetic cases pin the behaviour, they do not validate it.
 */
import { describe, it, expect } from 'vitest';
import { countReps } from '../core';
import { jointFrame, sample, seeded, timestamps, wobble, type Segment } from './synthetic';

type J = 'knee' | 'shoulder' | 'elbow';
const run = (joint: J, lift: string, path: Segment[], start: number, sps: number, noise = 0) => {
  let a = sample(path, start, sps);
  if (noise) a = wobble(a, noise, seeded(7));
  return countReps(a.map(x => jointFrame(joint, { left: x })), timestamps(a.length, sps), lift);
};

// Squat: standing 170°, bottom 80°, 2 s down and 2 s up (a controlled tempo), 1 s standing between reps.
const SQ_REST = 170, SQ_WORK = 80;
const squat = (hold: number): Segment[] => [
  { to: SQ_WORK, sec: 2 }, ...(hold ? [{ hold: SQ_WORK, sec: hold }] : []), { to: SQ_REST, sec: 2 }, { hold: SQ_REST, sec: 1 },
];
const squats = (holds: number[]): Segment[] => [{ hold: SQ_REST, sec: 1 }, ...holds.flatMap(squat)];

// Lateral raise: arms down 15°, up 90°, 2 s up and 2 s down, 1 s down between reps.
const LR_REST = 15, LR_WORK = 90;
const raise = (hold: number): Segment[] => [
  { to: LR_WORK, sec: 2 }, ...(hold ? [{ hold: LR_WORK, sec: hold }] : []), { to: LR_REST, sec: 2 }, { hold: LR_REST, sec: 1 },
];
const raises = (holds: number[]): Segment[] => [{ hold: LR_REST, sec: 1 }, ...holds.flatMap(raise)];

describe('a pause at the working end is not counted against the longest rep', () => {
  for (const sps of [15, 30]) {
    for (const hold of [5, 7]) {
      it(`eight squats held ${hold} s at the bottom count 8 (${sps} sps)`, () => {
        expect(run('knee', 'squat', squats(Array(8).fill(hold)), SQ_REST, sps).count).toBe(8);
      });
      it(`eight lateral raises held ${hold} s at the top count 8 (${sps} sps)`, () => {
        expect(run('shoulder', 'lateral_raise', raises(Array(8).fill(hold)), LR_REST, sps).count).toBe(8);
      });
    }
    it(`six plain squats and two held 5 s count 8 (${sps} sps)`, () => {
      expect(run('knee', 'squat', squats([0, 0, 0, 5, 0, 0, 5, 0]), SQ_REST, sps).count).toBe(8);
    });
    it(`six plain lateral raises and two held 5 s count 8 (${sps} sps)`, () => {
      expect(run('shoulder', 'lateral_raise', raises([0, 5, 0, 0, 0, 5, 0, 0]), LR_REST, sps).count).toBe(8);
    });
    it(`a soft-knee breather between squats adds no rep (${sps} sps)`, () => {
      // Paused squats (5 s at the bottom). Between the fourth and fifth rep the knees stay soft (145°, past the
      // rest threshold) for 2.5 s, then the next rep goes down from there: the breather is moving time of the
      // next cycle, not a rep of its own.
      const p = squats([5, 5, 5, 5]);
      p.push({ to: 145, sec: 0.8 }, { hold: 145, sec: 2.5 });
      p.push(...[5, 5, 5, 5].flatMap(squat));
      expect(run('knee', 'squat', p, SQ_REST, sps).count).toBe(8);
      // A breather that comes back to standing without going down is no rep either.
      const q = squats([5, 5, 5, 5]);
      q.push({ to: 145, sec: 0.8 }, { hold: 145, sec: 3 }, { to: SQ_REST, sec: 0.8 }, { hold: SQ_REST, sec: 1 });
      q.push(...[5, 5, 5, 5].flatMap(squat));
      expect(run('knee', 'squat', q, SQ_REST, sps).count).toBe(8);
    });
    it(`arms crossed for 20 s after eight curls is still not counted (${sps} sps)`, () => {
      // Curl: rest 170°, flexed 50°. Arms crossed: the elbow at 55° for 20 s, then back down.
      const p: Segment[] = [{ hold: 170, sec: 1 }];
      for (let r = 0; r < 8; r++) p.push({ to: 50, sec: 1 }, { to: 170, sec: 1 }, { hold: 170, sec: 0.8 });
      p.push({ to: 55, sec: 0.6 }, { hold: 55, sec: 20 }, { to: 170, sec: 0.6 }, { hold: 170, sec: 1 });
      expect(run('elbow', 'bicep_curl', p, 170, sps).count).toBe(8);
    });
  }
});

describe('splitOverlongReps leaves a held rep whole', () => {
  it('one curl held 5 s in a regular set of eight, with a sag in the hold, counts 8, not 9', () => {
    // The held rep lasts about three median reps (a split candidate); the hold sags 15° and comes back,
    // nowhere near the 0.8 of the way to rest a split needs.
    const p: Segment[] = [{ hold: 170, sec: 1 }];
    for (let r = 0; r < 8; r++) {
      p.push({ to: 50, sec: 1 });
      if (r === 3) p.push({ to: 65, sec: 2.5 }, { to: 50, sec: 2.5 });
      p.push({ to: 170, sec: 1 }, { hold: 170, sec: 0.8 });
    }
    for (const sps of [15, 30]) {
      const r = run('elbow', 'bicep_curl', p, 170, sps, 3);
      expect(r.count).toBe(8);
    }
  });
});
