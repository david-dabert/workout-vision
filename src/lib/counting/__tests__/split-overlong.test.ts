/**
 * Two reps read as one (splitOverlongReps, core.ts, 3 October 2026): the return between them came most of the
 * way back but stopped short of the rest threshold. In a regular set, a rep lasting well over the median is split
 * at that return when it covered SPLIT_RETURN_SHARE (0.8) of the way back. Status: experimental, chosen on the
 * public build half A; these synthetic cases pin the behaviour, they do not validate it.
 */
import { describe, it, expect } from 'vitest';
import { countReps } from '../core';
import { jointFrame, sample, timestamps, type Segment } from './synthetic';

const REST = 170, WORK = 50;
const rep = (): Segment[] => [{ to: WORK, sec: 1 }, { to: REST, sec: 1 }, { hold: REST, sec: 0.8 }];
const doubled = (returnTo: number): Segment[] => [
  { to: WORK, sec: 1 }, { to: returnTo, sec: 0.9 }, { to: WORK, sec: 0.9 }, { to: REST, sec: 1 }, { hold: REST, sec: 0.8 },
];
const run = (path: Segment[], sps = 30) => {
  const a = sample(path, REST, sps);
  return countReps(a.map(x => jointFrame('elbow', { left: x })), timestamps(a.length, sps), 'bicep_curl');
};
const set = (middle: Segment[], n: number) => {
  const p: Segment[] = [{ hold: REST, sec: 0.8 }];
  for (let i = 0; i < n; i++) p.push(...rep());
  p.push(...middle);
  for (let i = 0; i < n; i++) p.push(...rep());
  return p;
};

describe('an overlong rep split at an in-set return', () => {
  it('two curls whose return stopped just short of rest count two', () => {
    expect(run(set([], 2)).count).toBe(4);
    expect(run(set(doubled(140), 2)).count).toBe(6);
  });
  it('a return only half way back is not split', () => {
    expect(run(set(doubled(110), 2)).count).toBe(5);
  });
  it('a set of two cycles is never split (no median to judge by)', () => {
    expect(run([{ hold: REST, sec: 0.8 }, ...rep(), ...doubled(140)]).count).toBe(2);
  });
});
