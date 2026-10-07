// The five survey techniques (survey.ts, 7 October): all off in the app, each measured on its own (TRIED.md). These
// tests pin that they are off, the helpers' arithmetic, and that each does what it says when a bench turns it on.
import { afterEach, describe, expect, it } from 'vitest';
import { countReps, liftDefinition, sideAngles } from '../core';
import { ALT_DIFF, BRIDGE_INTERPOLATE, FILL_FROM_PARTNER, SHAPE_EDGES, Z_WEIGHT, depthShare, dtw, fitLine, resample } from '../survey';
import { cycles, jointFrame, sample, timestamps } from './synthetic';

const on = (b: Record<string, unknown>) => { (globalThis as { __WV_CORE_BENCH__?: unknown }).__WV_CORE_BENCH__ = b; };
afterEach(() => { delete (globalThis as { __WV_CORE_BENCH__?: unknown }).__WV_CORE_BENCH__; });

describe('survey techniques', () => {
  it('are all off in the app', () => {
    expect([Z_WEIGHT, BRIDGE_INTERPOLATE, FILL_FROM_PARTNER, SHAPE_EDGES, ALT_DIFF]).toEqual([1, false, false, false, false]);
  });

  it('helpers: DTW of a series with itself is 0, a line is fitted exactly, resampling keeps the ends', () => {
    const a = [0, 1, 2, 3, 2, 1, 0];
    expect(dtw(a, a, 4)).toBe(0);
    expect(dtw(a, a.map(v => v + 1), 4)).toBeGreaterThan(0);
    const f = fitLine([1, 2, 3, null], [3, 5, 7, 9]);
    expect([f.a, f.b, f.r, f.n]).toEqual([1, 2, 1, 3]);
    expect(resample([0, null, 10], [0, 1, 2], 0, 2, 5)).toEqual([0, 2.5, 5, 7.5, 10]);
  });

  it('T3: the depth share reads a side-on shoulder line as 1 and a facing one as 0', () => {
    const f = (dx: number, dz: number) => { const fr = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 })); fr[12] = { x: dx, y: 0, z: dz, visibility: 1 }; return fr; };
    expect(depthShare([f(0, 0.3)])).toBeCloseTo(1);
    expect(depthShare([f(0.3, 0)])).toBeCloseTo(0);
  });

  it('T2: an inner gap is filled by a straight line, not the last value', () => {
    const angles = sample(cycles({ rest: 170, work: 50, reps: 1 }), 170, 15);
    const wl = angles.map((a, i) => (i >= 16 && i <= 19 ? null : jointFrame('elbow', { left: a })));
    const def = liftDefinition('bicep_curl')!;
    const repeat = sideAngles(wl, timestamps(wl.length, 15), def, 'left').smoothed;
    on({ interpolate: true });
    const line = sideAngles(wl, timestamps(wl.length, 15), def, 'left').smoothed;
    expect(line[17]).not.toBeCloseTo(repeat[17]!, 0);
    expect(Math.abs(line[17]! - angles[17])).toBeLessThan(Math.abs(repeat[17]! - angles[17]));
  });

  it('T1: a side missing every third sample is filled from the other side, and its coverage stays as seen', () => {
    const angles = sample(cycles({ rest: 170, work: 50, reps: 6 }), 170, 15);
    // The left side, counted (better seen), misses every third sample; the right misses every second.
    const wl = angles.map((a, i) => jointFrame('elbow', { ...(i % 3 ? { left: a } : {}), ...(i % 2 ? { right: a + 2 } : {}) }));
    on({ fill: true });
    const r = countReps(wl, timestamps(wl.length, 15), 'bicep_curl');
    expect(r.count).toBe(6);
    expect(r.confidence).toBeCloseTo(2 / 3, 1); // filled samples are not counted as seen
  });

  it('T5: alternating arms read on their difference count one rep per arm', () => {
    const left = sample([{ hold: 170, sec: 0.8 }, ...Array.from({ length: 5 }, () => [{ to: 50, sec: 1 }, { to: 170, sec: 1 }, { hold: 170, sec: 2.8 }]).flat()], 170, 15);
    const right = sample([{ hold: 170, sec: 2.8 }, ...Array.from({ length: 5 }, () => [{ to: 50, sec: 1 }, { to: 170, sec: 1 }, { hold: 170, sec: 2.8 }]).flat()], 170, 15);
    const n = Math.min(left.length, right.length);
    const wl = Array.from({ length: n }, (_, i) => jointFrame('elbow', { left: left[i], right: right[i] }));
    on({ altDiff: true });
    const r = countReps(wl, timestamps(n, 15), 'bicep_curl_alternating');
    expect(r.count).toBe(10);
    expect(r.reps.filter(x => x.side === 'left')).toHaveLength(5);
  });
});
