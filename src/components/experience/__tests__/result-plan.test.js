import { describe, expect, it } from 'vitest';
import { dayPlan, keptAs, planRows, quickKeys } from '../result-plan';

// The result screen's plan (result-plan.js; C4 of the design review, 7 October 2026).
const plan = { programme: 'p1', item: 1, sets: 3, reps: 10, rest: 60 };
const now = new Date('2026-10-07T18:00:00');
const at = h => new Date(`2026-10-07T${h}:00`).getTime();
const set = (o) => ({ exercise: 'squat', source: 'counter-core', planned: plan, ...o });

describe('the day of a planned set', () => {
  it('keeps the sets of this programme item, this lift and this day, oldest first, with how each was kept', () => {
    const sets = [
      set({ reps: 9, machineResult: { reps: 10 }, correctedResult: { reps: 9 }, createdAt: at('17:40') }),
      set({ reps: 10, machineResult: { reps: 10 }, createdAt: at('17:30') }),
      set({ reps: 8, source: 'manual', machineResult: null, createdAt: at('17:50') }),
      set({ reps: 10, machineResult: { reps: 10 }, createdAt: at('17:10'), planned: { ...plan, item: 0 } }), // another item
      set({ reps: 10, machineResult: { reps: 10 }, createdAt: at('17:10'), planned: { ...plan, programme: 'p2' } }), // another programme
      set({ reps: 10, machineResult: { reps: 10 }, createdAt: new Date('2026-10-06T17:00:00').getTime() }), // yesterday
      set({ reps: 10, exercise: 'bicep_curl', machineResult: { reps: 10 }, createdAt: at('17:20') }), // another lift
      { exercise: 'squat', reps: 10, createdAt: at('17:00') }, // outside the programme
    ];
    const day = dayPlan({ planned: plan, sets, lift: 'squat', now });
    expect(day).toEqual({ sets: 3, reps: 10, index: 4, done: [{ reps: 10, kind: 'confirmed' }, { reps: 9, kind: 'corrected' }, { reps: 8, kind: 'typed' }] });
  });
  it('is null without a plan, a whole target or the sets read', () => {
    expect(dayPlan({ planned: null, sets: [], lift: 'squat', now })).toBe(null);
    expect(dayPlan({ planned: { ...plan, reps: 0 }, sets: [], lift: 'squat', now })).toBe(null);
    expect(dayPlan({ planned: plan, sets: null, lift: 'squat', now })).toBe(null);
  });
  it('reads a set the app counted none in, then corrected, as corrected', () => {
    expect(keptAs({ reps: 8, machineResult: { reps: 0 }, correctedResult: { reps: 8 } })).toBe('corrected');
    expect(keptAs({ reps: 8, machineResult: { reps: 8 }, corrected: true, correctedResult: null })).toBe('confirmed');
  });
});

describe('the rows of the day', () => {
  it('lists the sets done, the set on screen, then the sets planned', () => {
    const day = { sets: 4, reps: 10, index: 2, done: [{ reps: 10, kind: 'confirmed' }] };
    expect(planRows(day, { kind: 'pending', n: 9 })).toEqual([
      { k: 1, kind: 'confirmed', n: 10 }, { k: 2, kind: 'pending', n: 9 }, { k: 3, kind: 'planned', n: 10 }, { k: 4, kind: 'planned', n: 10 },
    ]);
  });
  it('adds no planned row past the plan, and none without a plan', () => {
    const day = { sets: 1, reps: 10, index: 2, done: [{ reps: 10, kind: 'confirmed' }] };
    expect(planRows(day, { kind: 'pending', n: 9 }).map(r => r.kind)).toEqual(['confirmed', 'pending']);
    expect(planRows(null, { kind: 'pending', n: 9 })).toEqual([]);
  });
});

describe('the quick keys', () => {
  it('are five, centred on the number, never below 1', () => {
    expect(quickKeys(10)).toEqual([8, 9, 10, 11, 12]);
    expect(quickKeys(2)).toEqual([1, 2, 3, 4, 5]);
    expect(quickKeys(99)).toEqual([95, 96, 97, 98, 99]);
  });
  it('are none without a centre', () => {
    expect(quickKeys(null)).toEqual([]);
    expect(quickKeys(0)).toEqual([]);
    expect(quickKeys(undefined)).toEqual([]);
  });
});
