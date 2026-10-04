// The records and helpers of the gym session loop (WP1.4-WP1.6 of docs/SPEC-production.md).
import { describe, expect, it } from 'vitest';
import { countedBy, recentLifts } from '../sets';
import { savedSet } from '../saved-set';
import { confirmed } from '../progress';
import { reportSheet } from '../report-sheet';

const refused = { refused: true, count: 3, arm: 'left', confidence: 0.2, reps: [{ startTime: 0, endTime: 1 }], metadata: { duration: 20 }, timestamps: [0, 0.1], smoothedAngles: [90, 91] };
const counted = { refused: false, count: 9, arm: 'right', confidence: 0.8, reps: [], metadata: { duration: 20 }, timestamps: [0, 0.1], smoothedAngles: [90, 91] };

describe('a refused set typed by hand (WP1.6)', () => {
  const w = savedSet({ result: refused, lift: 'bicep_curl', n: 8, corrected: true, manual: true });
  it('is saved as the person\'s count alone: no app count, no measure, no side, no wave', () => {
    expect(w).toMatchObject({ reps: 8, source: 'manual', afterRefusal: true, corrected: true, arm: null, repDetails: [], machineResult: null, wave: null, sides: null });
  });
  it('has no count of the app, even once storage has filled machineResult in', () => {
    expect(countedBy({ ...w, machineResult: { reps: 8 } })).toBeNull();
  });
  it('the report says it was typed after a refusal; a set ManualLog typed is not said to be refused', () => {
    const base = { lang: 'fr', date: new Date('2026-10-04T10:00:00Z'), liftName: 'Curl biceps', count: 8, counted: null, reps: [], measures: false };
    expect(reportSheet({ ...base, source: 'manual', afterRefusal: true }).corrected).toBe('Saisi à la main : l’app n’a pas pu compter cette série.');
    expect(reportSheet({ ...base, source: 'manual' }).corrected || '').not.toContain('pas pu compter');
  });
});

describe('a set kept from the close button before its count was answered (WP1.4)', () => {
  it('is saved unconfirmed, so it holds no record', () => {
    const w = savedSet({ result: counted, lift: 'bicep_curl', n: 9, corrected: null });
    expect(w.corrected).toBeNull();
    expect(confirmed(w)).toBe(false);
    expect(confirmed(savedSet({ result: counted, lift: 'bicep_curl', n: 9, corrected: false }))).toBe(true);
  });
});

describe('the recent lifts (WP1.5)', () => {
  it('are the lifts of the newest sets, each once, newest first, three at most', () => {
    const sets = ['squat', 'squat', 'bicep_curl', 'squat', 'leg_press', 'hip_thrust'].map(exercise => ({ exercise }));
    expect(recentLifts(sets)).toEqual(['squat', 'bicep_curl', 'leg_press']);
    expect(recentLifts([{ exerciseKey: 'lat_pulldown' }, {}])).toEqual(['lat_pulldown']);
    expect(recentLifts(null)).toEqual([]);
  });
});
