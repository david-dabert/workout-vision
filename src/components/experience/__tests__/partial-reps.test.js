/**
 * Partial reps (David, 2 October 2026: his machine chest press report printed a tempo of 0.1-6-0.1-1, a range
 * of 18° and 343°/s on a set of 8). A rep under half the set's median range, or with a moving phase under
 * 0.2 s, stays counted with its range, but gets no tempo and no speed, and leaves the set's tempo and time
 * under tension.
 */
import { describe, expect, it } from 'vitest';
import { partialIn, setTempo } from '../tempo';
import { repTable, reportSheet, setMeasures } from '../report-sheet';

const rep = (i, start, rom, conc, ecc, extra = {}) => ({ index: i, startTime: start, endTime: start + conc + ecc + 0.2, romDegrees: rom, concentricSec: conc, eccentricSec: ecc, peakSpeed: rom / conc * 1.5, meanSpeed: rom / (conc + ecc), ...extra });
// Six whole reps of about 80°, one of 18° (rep 4), one with a 0.1 s lift (rep 6).
const reps = [rep(1, 0, 80, 1, 1.5), rep(2, 3, 82, 1, 1.5), rep(3, 6, 79, 1.1, 1.4), rep(4, 9, 18, 0.6, 0.8), rep(5, 12, 81, 1, 1.5), rep(6, 15, 60, 0.1, 1.5), rep(7, 18, 80, 1, 1.6), rep(8, 21, 78, 1.2, 1.5)];

describe('partial reps', () => {
  it('are the rep under half the median range and the rep with a 0.1 s phase', () => {
    const partial = partialIn(reps);
    expect(reps.filter(partial).map(r => r.index)).toEqual([4, 6]);
  });
  it('a cut rep is not partial (it has its own mark)', () => {
    expect(partialIn(reps)({ ...reps[0], clipped: true })).toBe(false);
  });
  it('print no tempo and no speed in the per-rep table, but keep their range', () => {
    const { rows } = repTable({ reps, first: 'concentric', fr: true });
    expect(rows[3]).toEqual(['4', '…', '18° ▾', '…', '…']);
    expect(rows[5].slice(1, 2)).toEqual(['…']);
    expect(rows[0][1]).not.toBe('…');
  });
  it('leave the set tempo and the time under tension', () => {
    // Phases averaged over the six timed reps: lowering 1.5 s -> 2, lifting 1.05 s -> 1; the 18° rep's 0.8 s
    // lowering would have brought the lowering mean under 1.5 (2 -> 1). Pauses still measured to the next rep done.
    expect(setTempo(reps)).toBe('2-0-1-0');
    const whole = reps.filter(r => ![4, 6].includes(r.index));
    expect(setMeasures(reps).tut).toBeCloseTo(setMeasures(whole).tut, 6);
  });
  it('are named under the table', () => {
    const sheet = reportSheet({ lang: 'fr', date: new Date(2026, 9, 2), notes: '', liftName: 'Développé machine', count: 8, reps, first: 'concentric', measures: true });
    expect(sheet.partialRepNote).toBe('… : répétition partielle, non chronométrée');
    expect(reportSheet({ lang: 'en', date: new Date(2026, 9, 2), notes: '', liftName: 'Chest press', count: 8, reps, first: 'concentric', measures: true }).partialRepNote).toBe('…: partial rep, not timed');
  });
  it('a set without partial reps is unchanged', () => {
    const whole = reps.filter(r => ![4, 6].includes(r.index));
    expect(whole.filter(partialIn(whole))).toEqual([]);
    expect(reportSheet({ lang: 'fr', date: new Date(2026, 9, 2), notes: '', liftName: 'x', count: 6, reps: whole, first: 'concentric', measures: true }).partialRepNote).toBe('');
  });
});
