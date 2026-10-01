import { describe, expect, it, vi } from 'vitest';
import { setOpener } from '../set-opener';

// A rep: start, duration, range, concentric and eccentric seconds (as in set-account.test.js).
const rep = (i, start, dur, rom, conc, ecc, extra = {}) => ({ index: i, startTime: start, endTime: start + dur, romDegrees: rom, concentricSec: conc, eccentricSec: ecc, peakSpeed: 0, meanSpeed: 0, ...extra });
const even = (n, { rom = 100, conc = 1, ecc = 2, gap = 0.5 } = {}) =>
  Array.from({ length: n }, (_, i) => rep(i + 1, i * (conc + ecc + gap), conc + ecc, rom, conc, ecc));
const say = (o, fr) => setOpener({ first: 'concentric', ...o, fr });

// The opener sums up the set in one sentence, from what set-account.js already derives: the count,
// the short reps, the slowdown. It measures nothing new.
describe('the opener of a counted set', () => {
  it('names the short reps first, since the tip is about them', () => {
    const one = even(10); one[2].romDegrees = 70;
    expect(say({ reps: one, count: 10, counted: 10 }, true)).toBe('10 répétitions, dont une plus courte que les autres.');
    expect(say({ reps: one, count: 10, counted: 10 }, false)).toBe('10 reps, one of them shorter than the others.');
    const two = even(10); two[2].romDegrees = 70; two[7].romDegrees = 60;
    expect(say({ reps: two, count: 10, counted: 10 }, true)).toBe('10 répétitions, dont 2 plus courtes que les autres.');
    expect(say({ reps: two, count: 10, counted: 10 }, false)).toBe('10 reps, 2 of them shorter than the others.');
  });

  it('with no short rep, says how the last two reps went against the first two', () => {
    const slower = even(6); slower[4].concentricSec = 1.25; slower[5].concentricSec = 1.25;
    expect(say({ reps: slower, count: 6, counted: 6 }, true)).toBe('6 répétitions, les deux dernières plus lentes que les deux premières.');
    expect(say({ reps: slower, count: 6, counted: 6 }, false)).toBe('6 reps, the last two slower than the first two.');
    const faster = even(6); faster[4].concentricSec = 0.8; faster[5].concentricSec = 0.8;
    expect(say({ reps: faster, count: 6, counted: 6 }, true)).toBe('6 répétitions, les deux dernières plus rapides que les deux premières.');
    expect(say({ reps: faster, count: 6, counted: 6 }, false)).toBe('6 reps, the last two faster than the first two.');
    expect(say({ reps: even(6), count: 6, counted: 6 }, true)).toBe('6 répétitions, les deux dernières aussi rapides que les deux premières.');
    expect(say({ reps: even(6), count: 6, counted: 6 }, false)).toBe('6 reps, the last two as fast as the first two.');
  });

  it('under four whole reps, says only that none was shorter', () => {
    expect(say({ reps: even(3), count: 3, counted: 3 }, true)).toBe('3 répétitions, aucune plus courte que les autres.');
    expect(say({ reps: even(3), count: 3, counted: 3 }, false)).toBe('3 reps, none shorter than the others.');
  });

  it('with no rep measured, states the count alone', () => {
    expect(say({ reps: null, count: 7, counted: 7 }, true)).toBe('Série de 7 répétitions.');
    expect(say({ reps: null, count: 7, counted: 7 }, false)).toBe('A set of 7 reps.');
    expect(say({ reps: [rep(1, 0, 2, 90, 1, 1, { clipped: true })], count: 1, counted: 1 }, true)).toBe('Série d’une répétition.');
    expect(say({ reps: even(1), count: 1, counted: 1 }, false)).toBe('A set of one rep.');
    // A set entered by hand says nothing of what the app counted.
    expect(say({ reps: null, count: 7 }, true)).toBe('Série de 7 répétitions.');
  });

  it('with nothing counted, says so without a zero', () => {
    expect(say({ reps: [], count: 0, counted: 0 }, true)).toBe('Aucune répétition comptée.');
    expect(say({ reps: [], count: 0, counted: 0 }, false)).toBe('No reps counted.');
  });
});

// Rule 8: never a number the app cannot measure.
describe('the opener when the app\'s count does not stand', () => {
  it('a refused set has no opener: the screen already says it could not count', () => {
    expect(say({ reps: even(5), count: 5, counted: 5, refused: true }, true)).toBeNull();
    expect(say({ reps: even(5), count: 5, counted: 5, refused: true }, false)).toBeNull();
  });

  it('an unknown count has no opener', () => {
    for (const count of [null, undefined, NaN, -1]) {
      expect(say({ reps: even(5), count, counted: 5 }, true)).toBeNull();
      expect(say({ reps: even(5), count, counted: 5 }, false)).toBeNull();
    }
  });

  it('a corrected count is the user\'s, and says nothing of reps the app measured on another count', () => {
    const two = even(10); two[2].romDegrees = 70; two[7].romDegrees = 60;
    expect(say({ reps: two, count: 12, counted: 10 }, true)).toBe('Vous avez compté 12 répétitions.');
    expect(say({ reps: two, count: 12, counted: 10 }, false)).toBe('You counted 12 reps.');
    expect(say({ reps: two, count: 1, counted: 10 }, true)).toBe('Vous avez compté 1 répétition.');
    expect(say({ reps: two, count: 1, counted: 10 }, false)).toBe('You counted 1 rep.');
    expect(say({ reps: two, count: 0, counted: 10 }, true)).toBe('Vous n’avez compté aucune répétition.');
    expect(say({ reps: two, count: 0, counted: 10 }, false)).toBe('You counted no reps.');
  });
});
