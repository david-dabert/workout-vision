import { describe, expect, it } from 'vitest';
import { repAt, repStrokes, waveGeometry } from '../wave';

const ts = Array.from({ length: 11 }, (_, i) => i * 0.5);
const knee = [90, 100, 130, 170, 130, 100, 90, null, 90, 170, 90];

describe('the wave', () => {
  it('needs two measured samples', () => {
    expect(waveGeometry({ angles: [null, 90], timestamps: [0, 1] })).toBe(null);
  });
  it('draws effort upward for a lift resting low, and inverted for one resting high', () => {
    const low = waveGeometry({ angles: knee, timestamps: ts, rest: 'low', height: 100, pad: 0 });
    expect(low.y(170)).toBe(0);
    expect(low.y(90)).toBe(100);
    const high = waveGeometry({ angles: knee, timestamps: ts, rest: 'high', height: 100, pad: 0 });
    expect(high.y(90)).toBe(0);
  });
  it('spans the box in time and breaks where the pose was lost', () => {
    const g = waveGeometry({ angles: knee, timestamps: ts, width: 100, pad: 0 });
    expect(g.x(0)).toBe(0);
    expect(g.x(5)).toBe(100);
    expect(g.path().match(/M/g)).toHaveLength(2);
  });
  it('splits a whole rep at its turn and keeps a cut one in one stroke', () => {
    const g = waveGeometry({ angles: knee, timestamps: ts, width: 100, pad: 0 });
    const reps = [{ startTime: 0.5, endTime: 2.5, concentricSec: 1, eccentricSec: 1 }, { startTime: 4, endTime: 5, concentricSec: 0.5, eccentricSec: 0.5, clipped: true }];
    const [a, b] = repStrokes(g, reps);
    expect(a.whole).toBe(true);
    expect(a.out.startsWith('M10 ')).toBe(true);
    expect(a.back).not.toBe('');
    expect(b.whole).toBe(false);
    expect(b.back).toBe('');
  });
  it('finds the rep under a tap', () => {
    const g = waveGeometry({ angles: knee, timestamps: ts, width: 100, pad: 0 });
    const reps = [{ startTime: 0.5, endTime: 2.5 }, { startTime: 4, endTime: 5 }];
    expect(repAt(g, reps, 30)).toBe(0);
    expect(repAt(g, reps, 95)).toBe(1);
    expect(repAt(g, reps, 70)).toBe(1);
  });
});

import { compactWave } from '../wave';
import { reportSheet } from '../report-sheet';

describe('the wave a set keeps', () => {
  it('holds at most 200 samples, rounded, a lost one as null', () => {
    const t = Array.from({ length: 450 }, (_, i) => i / 15), a = t.map((x, i) => (i === 3 ? null : 90 + 40 * Math.sin(x)));
    const w = compactWave(a, t);
    expect(w.t.length).toBeLessThanOrEqual(200);
    expect(w.t.length).toBe(w.a.length);
    expect(w.a.every(v => v === null || Number.isInteger(Math.round(v * 10)))).toBe(true);
    expect(compactWave([1], [0])).toBe(null);
  });
  it('is on the report with the measures, and not without them', () => {
    const reps = [{ index: 1, startTime: 0.5, endTime: 2.5, romDegrees: 80, concentricSec: 1, eccentricSec: 1 }];
    const wave = { t: [0, 1, 2, 3], a: [90, 150, 100, 90] };
    const base = { lang: 'fr', date: new Date(2026, 9, 2), notes: '', liftName: 'Curl', count: 1, reps, first: 'concentric', lift: 'bicep_curl', joint: 'elbow', wave };
    expect(reportSheet({ ...base, measures: true }).wave).toMatchObject({ rest: 'high', jointWord: 'du coude' });
    expect(reportSheet({ ...base, measures: false }).wave).toBe(null);
    expect(reportSheet({ ...base, measures: true, wave: null }).wave).toBe(null);
  });
});

import { validateWorkout } from '../../../lib/validateSchema';

describe('the wave through storage', () => {
  const base = { id: 'w1', exercise: 'bicep_curl', reps: 6, date: '2026-10-02T10:00:00Z', createdAt: 1 };
  it('is kept when read back', () => {
    expect(validateWorkout({ ...base, wave: { t: [0, 1], a: [90, null] } }).sanitized.wave).toEqual({ t: [0, 1], a: [90, null] });
  });
  it('is dropped when malformed', () => {
    expect(validateWorkout({ ...base, wave: { t: [0, 1], a: [90] } }).sanitized.wave).toBe(null);
    expect(validateWorkout({ ...base, wave: { t: [0, 'x'], a: [90, 91] } }).sanitized.wave).toBe(null);
  });
});

describe('the kept wave keeps what was not seen (audit FINDING-027)', () => {
  const t = Array.from({ length: 450 }, (_, i) => i / 15);
  it('a lost sample between two kept ones still breaks the line', () => {
    const a = t.map((x, i) => (i === 4 ? null : 90 + 40 * Math.sin(x)));
    const w = compactWave(a, t);
    expect(w.a).toContain(null);
    expect(w.t.length).toBeLessThanOrEqual(400);
    for (let k = 1; k < w.t.length; k++) expect(w.t[k]).toBeGreaterThanOrEqual(w.t[k - 1]);
  });
  it('keeps the last sample', () => {
    const a = t.map(x => 90 + 40 * Math.sin(x));
    const w = compactWave(a, t);
    expect(w.t.at(-1)).toBe(Math.round(t.at(-1) * 100) / 100);
  });
});

describe('per-rep details read back are checked (audit FINDING-015)', () => {
  const base = { id: 'w1', exercise: 'bicep_curl', reps: 6, date: '2026-10-02T10:00:00Z', createdAt: 1, repDetailsVersion: 2 };
  const rep = { index: 1, startTime: 0, endTime: 2, romDegrees: 80, concentricSec: 1, eccentricSec: 1, peakSpeed: 100, meanSpeed: 40 };
  it('a list of reps with their numbers is kept', () => {
    expect(validateWorkout({ ...base, repDetails: [rep] }).sanitized.repDetails).toEqual([rep]);
  });
  it('details that are not such a list are dropped, with their version', () => {
    for (const bad of [{ 0: rep }, [{ ...rep, startTime: 'x' }], [null], 'reps']) {
      const s = validateWorkout({ ...base, repDetails: bad }).sanitized;
      expect(s.repDetails).toBe(null);
      expect(s.repDetailsVersion).toBe(null);
    }
  });
});

// Second audit, 3 October: an exercise counted on both sides drew one side's angle under every rep, so the other
// side's reps sat over a flat line. The line follows, during each rep, the side that made it.
import { waveAngles } from '../wave';
describe('the wave of an exercise counted on both sides', () => {
  const t = [0, 1, 2, 3, 4, 5];
  const left = { smoothedAngles: [170, 90, 170, 170, 170, 170] }, right = { smoothedAngles: [170, 170, 170, 90, 170, 170] };
  const result = { smoothedAngles: left.smoothedAngles, timestamps: t, sides: { left, right },
    reps: [{ startTime: 0, endTime: 2, side: 'left' }, { startTime: 2, endTime: 4, side: 'right' }] };
  it('follows the side that made each rep', () => {
    expect(waveAngles(result)).toEqual([170, 90, 170, 90, 170, 170]);
  });
  it('is the angle as counted for an exercise on one side', () => {
    expect(waveAngles({ smoothedAngles: [1, 2], timestamps: [0, 1], reps: [] })).toEqual([1, 2]);
  });
});
