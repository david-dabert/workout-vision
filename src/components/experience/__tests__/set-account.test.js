import { describe, expect, it } from 'vitest';
import { shortReps, averageTempo, slowdown, setAccount, ordinal } from '../set-account';

// A rep: start, duration, range, concentric and eccentric seconds.
const rep = (i, start, dur, rom, conc, ecc, extra = {}) => ({ index: i, startTime: start, endTime: start + dur, romDegrees: rom, concentricSec: conc, eccentricSec: ecc, peakSpeed: 0, meanSpeed: 0, ...extra });
const even = (n, { rom = 100, conc = 1, ecc = 2, gap = 0.5 } = {}) =>
  Array.from({ length: n }, (_, i) => rep(i + 1, i * (conc + ecc + gap), conc + ecc, rom, conc, ecc));

describe('the ▾ mark: a whole rep under 85 % of the set\'s median range', () => {
  it('marks reps 3 and 5 of seven', () => {
    const reps = even(7); reps[2].romDegrees = 80; reps[4].romDegrees = 84;
    expect(shortReps(reps)).toEqual([3, 5]);
  });
  it('leaves a rep at 85 % and a clipped rep alone', () => {
    const reps = even(5); reps[1].romDegrees = 85; reps[4] = { ...reps[4], romDegrees: 10, clipped: true };
    expect(shortReps(reps)).toEqual([]);
  });
});

describe('the average tempo, eccentric-pause-concentric-pause, in whole seconds', () => {
  it('a curl starts with the lift: the pause between reps is at the bottom, after the eccentric phase', () => {
    expect(averageTempo(even(4, { conc: 1, ecc: 2, gap: 1 }), 'concentric')).toEqual([2, 1, 1, 0]);
  });
  it('a squat starts going down: the pause between reps is at the top, after the concentric phase', () => {
    expect(averageTempo(even(4, { conc: 1, ecc: 2, gap: 1 }), 'eccentric')).toEqual([2, 0, 1, 1]);
  });
  it('a phase under half a second reads 1, never 0', () => {
    expect(averageTempo(even(3, { conc: 0.4, ecc: 0.4, gap: 0 }), 'concentric')).toEqual([1, 0, 1, 0]);
  });
  it('no whole rep, no tempo', () => {
    expect(averageTempo([], 'concentric')).toBeNull();
  });
});

describe('the slowdown: the last two reps\' concentric phase against the first two', () => {
  it('needs four whole reps', () => { expect(slowdown(even(3))).toBeNull(); });
  it('reads 25 % slower', () => {
    const reps = even(6); reps[4].concentricSec = 1.25; reps[5].concentricSec = 1.25;
    expect(slowdown(reps)).toBe(25);
  });
  it('reads 20 % faster as -20', () => {
    const reps = even(4); reps[2].concentricSec = 0.8; reps[3].concentricSec = 0.8;
    expect(slowdown(reps)).toBe(-20);
  });
});

describe('the account of the set, the tip and the encouragement', () => {
  it('French, a short rep, slower, two more than last time', () => {
    const reps = even(6); reps[2].romDegrees = 70; reps[4].concentricSec = 1.2; reps[5].concentricSec = 1.2;
    const a = setAccount({ reps, first: 'concentric', fr: true, name: 'Curl biceps', count: 6, previous: 4, nth: 3 });
    expect(a.lines).toEqual([
      'Tempo moyen : 2-1-1-0.',
      'La répétition 3 a été plus courte que les autres.',
      'Vos deux dernières répétitions ont été 20 % plus lentes que les deux premières.',
      '2 répétitions de plus que votre dernière série.',
    ]);
    expect(a.tip).toBe('La prochaine fois, visez la même amplitude sur toutes les répétitions.');
    expect(a.cheer).toBe('3e série de curl biceps dans votre historique. La régularité fera le reste.');
  });
  it('English, even reps, as fast, fewer than last time, first set', () => {
    const a = setAccount({ reps: even(5), first: 'eccentric', fr: false, name: 'Squat', count: 5, previous: 6, nth: 1 });
    expect(a.lines).toEqual([
      'Average tempo: 2-0-1-1.',
      'Your last two reps were as fast as your first two.',
      '1 fewer rep than your last set.',
    ]);
    expect(a.tip).toBe('When all your reps stay full and controlled, add a rep or a little weight.');
    expect(a.cheer).toBe('Your 1st set of squat in your history. Consistency will do the rest.');
  });
  it('several short reps, elision before a vowel, first set in French, no previous set', () => {
    const reps = even(7); reps[1].romDegrees = 50; reps[3].romDegrees = 50; reps[5].romDegrees = 50;
    const a = setAccount({ reps, first: 'concentric', fr: true, name: 'Élévations latérales', count: 7, previous: null, nth: 1 });
    expect(a.lines).toContain('Les répétitions 2, 4 et 6 ont été plus courtes que les autres.');
    expect(a.lines.some(l => l.includes('dernière série'))).toBe(false);
    expect(a.cheer).toBe('1re série d’élévations latérales dans votre historique. La régularité fera le reste.');
  });
  it('as many as last time', () => {
    expect(setAccount({ reps: even(2), first: 'concentric', fr: true, name: 'Squat', count: 2, previous: 2, nth: 2 }).lines)
      .toContain('Autant que votre dernière série.');
  });
});

describe('the name inside a sentence', () => {
  it('keeps an acronym', () => {
    expect(setAccount({ reps: [], first: 'concentric', fr: false, name: 'RDL', count: 1, previous: null, nth: 2 }).cheer).toBe('Your 2nd set of RDL in your history. Consistency will do the rest.');
  });
});

describe('real names in the encouragement (review 01 of step 3)', () => {
  const cheer = (name, fr) => setAccount({ reps: [], first: 'concentric', fr, name, count: 5, previous: null, nth: 2 }).cheer;
  it('French does not elide before an aspirated h', () => {
    expect(cheer('Hip thrust', true)).toBe('2e série de hip thrust dans votre historique. La régularité fera le reste.');
    expect(cheer('Hack squat', true)).toBe('2e série de hack squat dans votre historique. La régularité fera le reste.');
  });
  it('French elides before the mute h of haltère', () => {
    expect(cheer('Haltères au sol', true)).toBe('2e série d’haltères au sol dans votre historique. La régularité fera le reste.');
  });
  it('a proper adjective and a name with inner capitals keep their case', () => {
    expect(cheer('Romanian deadlift', false)).toBe('Your 2nd set of Romanian deadlift in your history. Consistency will do the rest.');
    expect(cheer('Arnold Press', false)).toBe('Your 2nd set of Arnold Press in your history. Consistency will do the rest.');
    expect(cheer('Hip Thrust', true)).toBe('2e série de Hip Thrust dans votre historique. La régularité fera le reste.');
  });
  it('no rank when the history could not be read: no encouragement, rather than a false one', () => {
    expect(setAccount({ reps: [], first: 'concentric', fr: true, name: 'Squat', count: 5, previous: null, nth: null }).cheer).toBeNull();
  });
});

describe('ordinals', () => {
  it('French and English', () => {
    expect([1, 2, 11].map(n => ordinal(n, true))).toEqual(['1re', '2e', '11e']);
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map(n => ordinal(n, false))).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd']);
  });
});
