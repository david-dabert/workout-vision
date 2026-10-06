/**
 * Step 2 (PLAN.md, GROWTH): every countable exercise of the guide is counted by its pattern in
 * guide-families.json: its joint, the end it rests at, the phase that leaves the rest, and whether
 * both sides are counted (joined, or the side with more reps). For each of the 27 combinations those 189 entries hold (22 until the one-limb exercises and close variants of 6 October), one exercise that
 * has no entry in LIFTS must count ten synthetic cycles as ten, with its first phase first; a
 * both-sides one must count five reps per side, alternated, as ten. Angles are illustrative
 * (UNSOURCED): a joint that rests at its high end works 90° below it, one that rests low works 90°
 * above it; the shoulder at rest low hangs at 20°.
 */
import { describe, it, expect } from 'vitest';
import { countReps, liftDefinition, LIFTS, type Joint } from '../core';
import familiesJson from '../guide-families.json';
import patternsJson from '../guide-patterns.json';
import { jointFrame, cycles, sample, timestamps, type Side } from './synthetic';

type Family = { joint: Joint | null; rest?: 'high' | 'low'; first?: 'concentric' | 'eccentric'; bothSides?: boolean; eitherSide?: boolean; together?: boolean };
const families = familiesJson as Record<string, Family>;

const combos = new Map<string, string>(); // pattern → the first exercise of it outside LIFTS
for (const [key, f] of Object.entries(families)) {
  if (!f.joint || Object.hasOwn(LIFTS, key)) continue;
  const id = `${f.joint}/${f.rest}/${f.first}${f.bothSides ? '/bothSides' : f.eitherSide ? '/eitherSide' : f.together ? '/together' : ''}`;
  if (!combos.has(id)) combos.set(id, key);
}

const angles = (f: Family) => {
  const rest = f.rest === 'high' ? 170 : f.joint === 'shoulder' ? 20 : 80;
  return { rest, work: f.rest === 'high' ? rest - 90 : rest + 90 };
};
const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

describe('every countable exercise is counted by its pattern', () => {
  it('holds the 27 patterns of the 189 countable exercises, each with an exercise outside LIFTS', () => {
    expect(Object.values(families).filter(f => f.joint).length).toBe(189);
    expect(combos.size).toBe(27);
  });

  it('defines each exercise from LIFTS when it is there, from its family otherwise, and none without a joint', () => {
    expect(liftDefinition('bicep_curl')).toEqual(LIFTS.bicep_curl);
    expect(liftDefinition('walking_lunge')).toEqual({ joint: 'knee', rest: 'high', first: 'eccentric', bothSides: true });
    expect(liftDefinition('forward_lunge')).toEqual({ joint: 'knee', rest: 'high', first: 'eccentric', together: true });
    expect(liftDefinition('push_up')).toMatchObject({ joint: 'elbow', rest: 'high', first: 'eccentric', eitherSide: true });
    expect(liftDefinition('nordic_hamstring_curl')).toEqual({ joint: 'knee', rest: 'low', first: 'eccentric' });
    expect(liftDefinition('pec_deck')).toBeNull();
    expect(liftDefinition('no_such_exercise')).toBeNull();
  });

  // Review of 29 September: an exercise the core cannot count gets no count, never a curl's.
  it('gives no count for an exercise without a joint, or a key it does not know', () => {
    const a = sample(cycles({ rest: 170, work: 80 }), 170, 30);
    const frames = a.map(x => jointFrame('elbow', { left: x })), ts = timestamps(a.length, 30);
    for (const key of ['pec_deck', 'bicep_curls', '']) {
      const r = countReps(frames, ts, key);
      expect(r.count, key).toBe(0);
      expect(r.reps, key).toEqual([]);
      expect(r.confidence, key).toBe(0);
    }
  });

  // The core imports only the patterns, not the families' reasons, which load with the first screen.
  it('reads the same patterns as guide-families.json, and nothing else', () => {
    const expected: Record<string, string> = {};
    for (const [key, f] of Object.entries(families)) {
      if (f.joint) expected[key] = [f.joint, f.rest, f.first, ...(f.bothSides ? ['both'] : f.eitherSide ? ['either'] : f.together ? ['together'] : [])].join('/');
    }
    expect(patternsJson).toEqual(expected);
  });

  for (const [id, key] of combos) {
    const f = families[key];
    const { rest, work } = angles(f);
    if (!f.bothSides) {
      it(`${id} (${key}): ten cycles count 10, the ${f.first} phase first`, () => {
        const sps = 30;
        const a = sample(cycles({ rest, work, firstSec: 1.2, secondSec: 0.8 }), rest, sps);
        const result = countReps(a.map(x => jointFrame(f.joint!, { left: x })), timestamps(a.length, sps), key);
        expect(result.count).toBe(10);
        const firstPhase = median(result.reps.map(r => (f.first === 'concentric' ? r.concentricSec : r.eccentricSec)));
        const secondPhase = median(result.reps.map(r => (f.first === 'concentric' ? r.eccentricSec : r.concentricSec)));
        expect(firstPhase).toBeGreaterThan(secondPhase);
      });
    } else {
      it(`${id} (${key}): five reps per side, alternated, count 10 on both sides`, () => {
        const sps = 30, repSec = 1.6, n = Math.round(23 * sps);
        const side = { left: new Array<number>(n).fill(rest), right: new Array<number>(n).fill(rest) };
        for (let k = 0; k < 10; k++) {
          const arm = side[(k % 2 ? 'right' : 'left') as Side], at = 0.5 + k * 2.2;
          for (let i = 0; i < n; i++) {
            const u = (i / sps - at) / repSec;
            if (u >= 0 && u <= 1) arm[i] = rest + (work - rest) * (u < 0.5 ? u * 2 : (1 - u) * 2);
          }
        }
        const frames = side.left.map((l, i) => jointFrame(f.joint!, { left: l, right: side.right[i] }));
        const result = countReps(frames, timestamps(n, sps), key);
        expect(result.count).toBe(10);
        expect(result.arm).toBe('both');
      });
    }
  }
});
