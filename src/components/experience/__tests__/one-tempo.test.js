import { describe, expect, it } from 'vitest';
import { reportSheet } from '../report-sheet';
import { setAccount } from '../set-account';
import { setTempo, setTempoParts } from '../tempo';

// Audit of 6 October, action 9: the report's "Tempo moyen" tile averaged each rep's tempo row, so the last
// rep's rest gap, which does not exist and reads 0, pulled the pause between reps down (the 30 September
// bug, back), and it wrote tenths where the result screen writes whole seconds. One tempo for the app now.
const rep = (i, start, conc, ecc) => ({ index: i, startTime: start, endTime: start + conc + ecc, romDegrees: 100, concentricSec: conc, eccentricSec: ecc, peakSpeed: 0, meanSpeed: 0 });
// Three curls, 1 s up, 2 s down, 2 s of rest between them: two gaps, none after the last rep.
const reps = [rep(1, 0, 1, 2), rep(2, 5, 1, 2), rep(3, 10, 1, 2)];
const base = { lang: 'fr', date: new Date(2026, 9, 6), notes: '', liftName: 'Curl biceps', count: 3, counted: 3, arm: 'right', reps, measures: true };
const tile = s => s.stats.find(([label]) => label === 'Tempo moyen' || label === 'Average tempo')?.[1];
const screen = fr => setAccount({ reps, first: 'concentric', fr, name: 'Curl biceps', count: 3, previous: null, nth: null, measures: true })
  .lines.find(l => l.startsWith('Tempo moyen') || l.startsWith('Average tempo'));

describe('one set tempo: the result screen and the report tile', () => {
  it('the pause between reps is averaged over the two gaps, not over three reps with a 0 for the last', () => {
    expect(setTempoParts(reps, 'concentric')).toEqual({ lowering: 2, bottom: 2, lifting: 1, top: 0 });
    expect(setTempo(reps, 'concentric')).toBe('2-2-1-0');
  });
  it('the report tile writes what the result screen writes, in French and in English', () => {
    expect(tile(reportSheet({ ...base, first: 'concentric' }))).toBe('2-2-1-0');
    expect(screen(true)).toBe('Tempo moyen : 2-2-1-0.');
    expect(tile(reportSheet({ ...base, lang: 'en', first: 'concentric' }))).toBe('2-2-1-0');
    expect(screen(false)).toBe('Average tempo: 2-2-1-0.');
  });
  it('for a lift that starts with the eccentric phase, the rest sits at the top in both', () => {
    expect(tile(reportSheet({ ...base, first: 'eccentric' }))).toBe(setTempo(reps, 'eccentric'));
    expect(setTempo(reps, 'eccentric')).toBe('2-0-1-2');
  });
  it('no tile and no tempo without a whole rep', () => {
    expect(setTempoParts([], 'concentric')).toBeNull();
    expect(tile(reportSheet({ ...base, reps: [{ ...reps[0], clipped: true }] }))).toBeUndefined();
  });
});
