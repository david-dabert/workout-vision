// The state-model counter (hmm.ts) on synthetic sets: the cases the core's filter cannot hold together.
import { describe, expect, it } from 'vitest';
import { hmmCountLift } from '../hmm';
import { cycles, jointFrame, sample, timestamps } from './synthetic';

const SPS = 15;
const frames = (a: number[]) => a.map(x => jointFrame('elbow', { left: x, right: x }));
const run = (a: number[]) => hmmCountLift(frames(a), timestamps(a.length, SPS), 'bicep_curl');

describe('the state-model counter', () => {
  it('counts ordinary curls', () => {
    const a = sample([{ hold: 165, sec: 1 }, ...cycles({ rest: 165, work: 50, reps: 6, firstSec: 0.8, secondSec: 1, restSec: 0.6 }), { hold: 165, sec: 1 }], 165, SPS);
    expect(run(a).count).toBe(6);
  });
  it('counts eight continuous curls of 0.7 s, which the core counts as one', () => {
    const a = sample([{ hold: 160, sec: 1 }, ...cycles({ rest: 160, work: 40, reps: 8, firstSec: 0.35, secondSec: 0.35, restSec: 0 }), { hold: 160, sec: 1 }], 160, SPS);
    expect(run(a).count).toBe(8);
  });
  it('ignores a one-sample glitch of 70°', () => {
    const a = sample([{ hold: 160, sec: 1 }, ...cycles({ rest: 160, work: 40, reps: 4, firstSec: 1, secondSec: 1, restSec: 0.6 }), { hold: 160, sec: 1 }], 160, SPS);
    expect(run(a.map((x, i) => (i === 8 ? x - 70 : x))).count).toBe(4);
  });
  it('counts slow reps of 4 s', () => {
    const a = sample([{ hold: 165, sec: 1 }, ...cycles({ rest: 165, work: 50, reps: 3, firstSec: 2, secondSec: 2, restSec: 1 }), { hold: 165, sec: 1 }], 165, SPS);
    expect(run(a).count).toBe(3);
  });
  it('counts nothing in a still set', () => {
    expect(run(Array.from({ length: 90 }, () => 160)).count).toBe(0);
  });
});
