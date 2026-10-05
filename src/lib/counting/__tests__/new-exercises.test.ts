/**
 * Four exercises added on 3 October 2026, each counted by an existing pattern (guide-families.json), none measured
 * on any set: status experimental. The behind-the-neck press is counted as the guide's presses are (elbow, from
 * lockout; no counting work on presses, STATE.md); the barbell jump squat and the wall ball as a squat (knee, from
 * standing); the sandbag lunge is a walking lunge, not offered, as the walking lunge (offer.js, NOT_FILMABLE). The
 * guide holds no drawing of any of them: each borrows the nearest one's (exerciseGuide.js, `similar`).
 * Angles and timings are illustrative, not measured (UNSOURCED): a jump squat dips to 95 degrees of knee, takes off
 * at 175, holds the knee straight in the air and lands into the next dip; a wall ball squats to 80 and stands for a
 * second while the ball flies.
 */
import { describe, expect, it } from 'vitest';
import { summarizeCount } from '../../coreAnalysis';
import { getGuideExercise } from '../../exerciseGuide';
import { isOffered, tierOf } from '../../offer';
import { liftDefinition } from '../core';
import patterns from '../guide-patterns.json';
import { cycles, jointFrame, pressFrame, sample, timestamps, type Segment } from './synthetic';

const SPS = 15;
const count = (key: string, frames: ReturnType<typeof jointFrame>[]) =>
  (summarizeCount(frames, timestamps(frames.length, SPS), key) as { count: number }).count;
const knees = (path: Segment[], start: number) => sample(path, start, SPS).map(x => jointFrame('knee', { left: x, right: x }));

/** Jump squats in a row: dip, takeoff, flight, and a landing that flows into the next dip; the last one absorbs to `lastLanding`, then stands. */
function jumpSquats(reps: number, lastLanding: number, impact = false): Segment[] {
  const path: Segment[] = [{ hold: 170, sec: 1 }, { to: 95, sec: 0.7 }];
  for (let r = 0; r < reps; r++) {
    path.push({ to: 175, sec: 0.3 }, { hold: 177, sec: 0.35 });
    // A landing either bends steadily into the dip or first gives quickly under the impact, then dips.
    if (r < reps - 1) path.push(...(impact ? [{ to: 130, sec: 0.15 }, { to: 95, sec: 0.45 }] : [{ to: 95, sec: 0.6 }]));
  }
  path.push({ to: lastLanding, sec: 0.25 }, { to: 170, sec: 0.6 }, { hold: 170, sec: 1 });
  return path;
}

describe('the exercises added on 3 October', () => {
  const cases: [string, string, string][] = [
    ['behind_the_neck_press', 'elbow/high/eccentric', 'overhead-press'],
    ['barbell_jump_squat', 'knee/high/eccentric', 'jump-squat'],
    ['wall_ball', 'knee/high/eccentric', 'squat'],
    ['sandbag_lunge', patterns.walking_lunge, 'walking-lunge'],
  ];
  for (const [key, pattern, drawing] of cases) {
    it(`${key} resolves to its pattern, ${pattern}, and borrows the ${drawing} drawing`, () => {
      expect((patterns as Record<string, string>)[key]).toBe(pattern);
      const [joint, rest, first] = pattern.split('/');
      expect(liftDefinition(key)).toMatchObject({ joint, rest, first });
      const g = getGuideExercise(key)!;
      expect(g.similar).toBe(true);
      expect(g.frames[0]).toMatch(new RegExp(`guide/${drawing}/frame-1\\.webp$`));
    });
  }

  it('the press and the wall ball are offered, experimental like the overhead press; the jump squat is not yet', () => {
    expect(isOffered('barbell_jump_squat')).toBe(false);
    for (const key of ['behind_the_neck_press', 'wall_ball']) {
      expect(isOffered(key), key).toBe(true);
      expect(tierOf(key), key).toBe('experimental');
    }
    expect(tierOf('behind_the_neck_press')).toBe(tierOf('overhead_press'));
  });

  it('the sandbag lunge is not offered: it walks out of a fixed frame, as the walking lunge', () => {
    expect(isOffered('sandbag_lunge')).toBe(false);
    expect(isOffered('walking_lunge')).toBe(false);
    expect(liftDefinition('sandbag_lunge')).toEqual(liftDefinition('walking_lunge'));
  });

  it('ten behind-the-neck presses count ten', () => {
    const a = sample(cycles({ rest: 170, work: 75, firstSec: 1, secondSec: 0.8, restSec: 0.6 }), 170, SPS);
    expect(count('behind_the_neck_press', a.map(pressFrame))).toBe(10);
  });

  it('ten barbell jump squats count ten, the landings flowing into the next dip and the last one absorbing to 140', () => {
    expect(count('barbell_jump_squat', knees(jumpSquats(10, 140), 170))).toBe(10);
    expect(count('barbell_jump_squat', knees(jumpSquats(10, 140, true), 170))).toBe(10);
    // A last landing to 120 still counts no rep.
    expect(count('barbell_jump_squat', knees(jumpSquats(10, 120), 170))).toBe(10);
  });

  // Known limit: the working threshold sits a fifth of the set's range above its 10th percentile (THRESHOLD_MARGIN),
  // about 111 degrees here, so a last landing that bends the knee past it reads as an eleventh rep.
  it.fails('a last jump-squat landing absorbed to 110 degrees adds no rep', () => {
    expect(count('barbell_jump_squat', knees(jumpSquats(10, 110), 170))).toBe(10);
  });

  // Review of 3 October: why the barbell jump squat is not offered (offer.js, NOT_YET_COUNTED). A lifter who stands
  // between jumps lands into a knee bend that is not the next dip, and a landing absorbed past the working threshold
  // counts as a rep: ten jumps read 20. Pinned as a known failure until a landing guard exists.
  it.fails('ten jump squats with a stand after each landing absorbed to 110 degrees count ten', () => {
    const path: Segment[] = [{ hold: 170, sec: 1 }];
    for (let r = 0; r < 10; r++) path.push({ to: 95, sec: 0.7 }, { to: 175, sec: 0.3 }, { hold: 177, sec: 0.35 }, { to: 110, sec: 0.25 }, { to: 170, sec: 0.5 }, { hold: 170, sec: 0.8 });
    expect(count('barbell_jump_squat', knees(path, 170))).toBe(10);
  });

  it('ten wall balls count ten, standing while the ball flies, or catching straight into the next squat', () => {
    expect(count('wall_ball', knees(cycles({ rest: 172, work: 80, firstSec: 0.8, secondSec: 0.6, restSec: 1 }), 172))).toBe(10);
    expect(count('wall_ball', knees(cycles({ rest: 172, work: 80, firstSec: 0.8, secondSec: 0.6, restSec: 0.3 }), 172))).toBe(10);
  });
});

/**
 * Added on 5 October 2026 at David's request: the machine seated back extension, counted as the back extension (hip,
 * resting forward-leaning, extending first), filmed from the side; no drawing of its own, it borrows the back
 * extension's. Angles are illustrative (UNSOURCED): the hip angle (shoulder, hip, knee) opens from 80 degrees, leaning
 * forward on the seat, to 120 at the end of the extension.
 */
describe('the machine seated back extension', () => {
  const hips = (path: Segment[], start: number) => sample(path, start, SPS).map(x => jointFrame('hip', { left: x, right: x }));

  it('resolves to the back extension pattern, hip/low/concentric, and borrows its drawing', () => {
    expect((patterns as Record<string, string>).machine_seated_back_extension).toBe('hip/low/concentric');
    expect(liftDefinition('machine_seated_back_extension')).toEqual(liftDefinition('back_extension'));
    const g = getGuideExercise('machine_seated_back_extension')!;
    expect(g.similar).toBe(true);
    expect(g.frames[0]).toMatch(/guide\/back-extension\/frame-1\.webp$/);
  });

  it('is offered, experimental', () => {
    expect(isOffered('machine_seated_back_extension')).toBe(true);
    expect(tierOf('machine_seated_back_extension')).toBe('experimental');
  });

  it('ten extensions from 80 to 120 degrees count ten', () => {
    expect(count('machine_seated_back_extension', hips(cycles({ rest: 80, work: 120 }), 80))).toBe(10);
  });

  it('a travel under the 20-degree floor gives no count rather than a wrong one (R8)', () => {
    expect(count('machine_seated_back_extension', hips(cycles({ rest: 90, work: 105 }), 90))).toBe(0);
  });
});
