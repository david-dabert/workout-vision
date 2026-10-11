import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ExerciseProgress from '../ExerciseProgress';
import { exerciseProgress, bestLines } from '../progress';

const NB = ' ';
let clock = 0;
const set = (id, exercise, reps, extra = {}) => ({ id, exercise, reps, createdAt: Date.UTC(2026, 8, 1) + (clock += 3600000), ...extra });
const html = (sets, fr) => renderToStaticMarkup(createElement(ExerciseProgress, { progress: exerciseProgress(sets), name: w => w.exercise, fr }));

describe('the progress block of the history', () => {
  it('a single set says only that it is the first', () => {
    const out = html([set('a', 'squat', 8)], true);
    expect(out).toContain('Première série de cet exercice.');
    expect(out).not.toContain('<svg');
    expect(out).not.toContain('Record');
  });
  it('several sets: one bar per set, the reps read aloud, the bests', () => {
    const out = html([set('a', 'squat', 8), set('b', 'squat', 10)], false);
    expect(out.match(/<rect/g)).toHaveLength(2);
    expect(out).toContain('Reps in your last 2 sets: 8, 10.');
    expect(out).toContain(`Best: 10${NB}reps`);
  });
  it('nothing at all without a set', () => {
    expect(html([], true)).toBe('');
  });
});

describe('the words of the bests', () => {
  // Set a: 12 reps, no load entered; set b the heaviest (review, 30 September: "charge non notée").
  const bests = { reps: { value: 12, id: 'a' }, load: { value: 62.5, reps: 6, id: 'b' }, atLoad: [{ load: 60, reps: 8, id: 'c' }] };
  it('in French, with the space before the colon and a decimal comma', () => {
    expect(bestLines(bests, true)).toEqual([`Record${NB}: 12${NB}répétitions, charge non notée`, `Charge max${NB}: 62,5${NB}kg × 6`, `Record à 60${NB}kg${NB}: 8${NB}répétitions`]);
  });
  it('in English', () => {
    expect(bestLines(bests, false)).toEqual([`Best: 12${NB}reps, load not logged`, `Heaviest: 62.5${NB}kg × 6`, `Best at 60${NB}kg: 8${NB}reps`]);
  });
  it('the heaviest set\'s best at its own load is not said twice', () => {
    const same = { reps: { value: 10, id: 'a' }, load: { value: 12, reps: 10, id: 'a' }, atLoad: [{ load: 12, reps: 10, id: 'a' }, { load: 10, reps: 9, id: 'b' }] };
    expect(bestLines(same, false)).toEqual([`Best: 10${NB}reps`, `Heaviest: 12${NB}kg × 10`, `Best at 10${NB}kg: 9${NB}reps`]);
  });
  it('one rep is singular', () => {
    expect(bestLines({ reps: { value: 1, id: 'a' }, load: null, atLoad: [] }, true)).toEqual([`Record${NB}: 1${NB}répétition`]);
  });
});
