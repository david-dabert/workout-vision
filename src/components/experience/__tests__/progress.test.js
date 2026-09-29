import { describe, expect, it } from 'vitest';
import { exerciseProgress, recordsOf, storedLoad, TREND_SETS } from '../progress';

// A saved set as the storage returns it: newest first, the count kept in reps.
let clock = 0;
const set = (id, exercise, reps, extra = {}) => ({ id, exercise, reps, createdAt: Date.UTC(2026, 8, 1) + (clock += 3600000), ...extra });
const newestFirst = list => [...list].sort((a, b) => b.createdAt - a.createdAt);

describe('the sets of one exercise, in time order', () => {
  it('groups by exercise (old sets saved exerciseKey) and orders each oldest first', () => {
    const a = set('a', 'squat', 8), b = set('b', 'bicep_curl', 10), c = { ...set('c', undefined, 9), exerciseKey: 'squat' };
    const p = exerciseProgress(newestFirst([a, b, c]));
    expect(p.map(e => e.key)).toEqual(['squat', 'bicep_curl']); // the exercise trained last comes first
    expect(p[0].sets.map(w => w.id)).toEqual(['a', 'c']);
  });
  it('reads the stored count after the correction, never what the app counted', () => {
    const a = set('a', 'squat', 8), b = set('b', 'squat', 12, { machineResult: { reps: 11 }, correctedResult: { reps: 12 } });
    const [e] = exerciseProgress(newestFirst([a, b]));
    expect(e.trend).toEqual([8, 12]);
    expect(e.bests.reps).toEqual({ value: 12, id: 'b' });
  });
});

describe('the reps trend', () => {
  it('keeps the last sets only, oldest first', () => {
    const list = Array.from({ length: TREND_SETS + 3 }, (_, i) => set(`s${i}`, 'squat', i + 1));
    const [e] = exerciseProgress(newestFirst(list));
    expect(e.trend).toHaveLength(TREND_SETS);
    expect(e.trend.at(-1)).toBe(TREND_SETS + 3);
    expect(e.trend[0]).toBe(4);
  });
});

describe('a single set', () => {
  it('is the first: no trend, no best', () => {
    const [e] = exerciseProgress([set('a', 'squat', 8)]);
    expect(e.first).toBe(true);
    expect(e.trend).toEqual([]);
    expect(e.bests).toBeNull();
    expect(recordsOf(exerciseProgress([set('a', 'squat', 8)])).size).toBe(0);
  });
});

describe('personal bests', () => {
  it('most reps in one set: a tie does not take the record from the set that first reached it', () => {
    const a = set('a', 'squat', 10), b = set('b', 'squat', 12), c = set('c', 'squat', 12);
    const p = exerciseProgress(newestFirst([a, b, c]));
    expect(p[0].bests.reps).toEqual({ value: 12, id: 'b' });
    expect(recordsOf(p).get('b')).toEqual(['reps']);
    expect(recordsOf(p).has('c')).toBe(false);
  });
  it('no load stored: no heaviest load, no best at a load', () => {
    const [e] = exerciseProgress(newestFirst([set('a', 'squat', 8), set('b', 'squat', 9, { weight: 0 })]));
    expect(e.bests.load).toBeNull();
    expect(e.bests.atLoad).toEqual([]);
  });
  it('heaviest load, with the reps of the set that first lifted it', () => {
    const list = [set('a', 'squat', 10, { weight: 40 }), set('b', 'squat', 6, { weight: 60 }), set('c', 'squat', 8, { weight: 60 }), set('d', 'squat', 12)];
    const p = exerciseProgress(newestFirst(list));
    expect(p[0].bests.load).toEqual({ value: 60, reps: 6, id: 'b' });
  });
  it('best reps at a load, only where that load was lifted more than once, heaviest first', () => {
    const list = [
      set('a', 'squat', 10, { weight: 40 }), set('b', 'squat', 6, { weight: 60 }), set('c', 'squat', 8, { weight: 60 }),
      set('d', 'squat', 11, { weight: 40 }), set('e', 'squat', 5, { weight: 70 }),
    ];
    const p = exerciseProgress(newestFirst(list));
    expect(p[0].bests.atLoad).toEqual([{ load: 60, reps: 8, id: 'c' }, { load: 40, reps: 11, id: 'd' }]);
    const r = recordsOf(p);
    expect(r.get('d')).toEqual(['reps', 'atLoad']);
    expect(r.get('e')).toEqual(['load']);
    expect(r.get('c')).toEqual(['atLoad']);
    expect(r.has('a')).toBe(false);
  });
  it('keeps each exercise apart', () => {
    const p = exerciseProgress(newestFirst([set('a', 'squat', 20), set('b', 'bicep_curl', 8), set('c', 'bicep_curl', 9)]));
    expect(p.find(e => e.key === 'bicep_curl').bests.reps).toEqual({ value: 9, id: 'c' });
    expect(p.find(e => e.key === 'squat').first).toBe(true);
  });
});

describe('a stored load', () => {
  it('is a positive number in the weight field; anything else is no load', () => {
    expect(storedLoad({ weight: 42.5 })).toBe(42.5);
    for (const weight of [0, -5, '40', null, undefined, NaN, Infinity]) expect(storedLoad({ weight })).toBeNull();
    expect(storedLoad({ load: 40 })).toBeNull(); // no version of the app saves "load"
  });
});
