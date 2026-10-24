// The loop counter's winding count on signals of known truth (loop.js windSignal). Each signal is put through the
// bank's own smoothing (SG5), as the bank hands it over, with seeded Gaussian jitter.
import { describe, expect, it } from 'vitest';
// @ts-expect-error: a JavaScript module without types
import { windSignal, principal, fillGaps } from './loop.js';

const SG5 = [-3, 12, 17, 12, -3].map(c => c / 35);
const sg5 = (x: number[]) => x.map((_, t) => (t < 2 || t + 2 >= x.length ? x[t] : SG5.reduce((a, c, i) => a + c * x[t + i - 2], 0)));
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
function gauss(r: () => number) { const u = Math.max(r(), 1e-12), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const noisy = (x: number[], sigma: number, seed = 1) => { const r = rng(seed); return sg5(x.map(v => v + sigma * gauss(r))); };
// One rep: from the rest end (-1) to the far end (+1) and back, as a raised cosine over `len` samples.
const rep = (len: number, amp = 1) => Array.from({ length: len }, (_, i) => -1 + amp * (1 - Math.cos((2 * Math.PI * i) / len)));
const rest = (len: number) => Array.from({ length: len }, () => -1);

describe('the winding count', () => {
  it('counts ten steady reps, and is sure of them', () => {
    const x = noisy([...rest(15), ...Array.from({ length: 10 }, () => rep(30)).flat(), ...rest(15)], 0.03);
    const r = windSignal(x, 30);
    expect(r.count).toBe(10);
    expect(r.minRatio).toBeGreaterThan(3);
    expect(r.ambiguous).toBe(false);
  });
  it('counts reps separated by long pauses at the rest end, and a fidget at rest adds none', () => {
    const r0 = rng(7), fidget = Array.from({ length: 40 }, () => -1 + 0.08 * Math.sin(r0() * 6));
    const x = noisy([...fidget, ...Array.from({ length: 8 }, () => [...rep(24), ...rest(24)]).flat(), ...fidget], 0.03, 2);
    expect(windSignal(x, 48).count).toBe(8);
  });
  it('reads uneven reps, fast and slow, by the turns and not by a fixed period', () => {
    const lens = [22, 30, 40, 26, 36, 28];
    const x = noisy([...rest(10), ...lens.map(l => rep(l)).flat(), ...rest(10)], 0.03, 3);
    expect(windSignal(x, 30).count).toBe(6);
  });
  it('is not sure when the jitter comes near the centre', () => {
    const x = noisy([...rest(15), ...Array.from({ length: 10 }, () => rep(30)).flat(), ...rest(15)], 0.5, 4);
    expect(windSignal(x, 30).minRatio).toBeLessThan(3);
  });
  it('is not sure of a set that opens in the middle of a rep (half a turn before the first rest)', () => {
    const full = Array.from({ length: 6 }, () => rep(30)).flat();
    const r = windSignal(noisy([...full.slice(15), ...rest(15)], 0.03, 5), 30);
    expect(r.count).toBe(5);
    expect(r.ambiguous).toBe(true);
  });
  it('counts a last rep cut once most of its return is filmed, and not a release to the far end', () => {
    const body = [...rest(15), ...Array.from({ length: 5 }, () => rep(30)).flat()];
    expect(windSignal(noisy([...body, ...rep(30).slice(0, 27)], 0.02, 9), 30).count).toBe(6);
    // A release: from rest to the far end of the range, where the video stops (half a turn): no rep, and unsure.
    const r = windSignal(noisy([...body, ...rep(30).slice(0, 15), ...Array.from({ length: 15 }, () => 1)], 0.02, 10), 30);
    expect(r.count).toBe(5);
  });
  it('a movement that never reaches the middle of the range makes no turn', () => {
    // Five full reps, then three that reach only 30 % of the way: those do not go around the centre.
    const x = noisy([...rest(10), ...Array.from({ length: 5 }, () => rep(30)).flat(), ...Array.from({ length: 3 }, () => rep(30, 0.3)).flat(), ...rest(10)], 0.02, 6);
    expect(windSignal(x, 30).count).toBe(5);
  });
  it('gives the same count and margin whatever the signal\'s scale and offset', () => {
    const x = noisy([...rest(15), ...Array.from({ length: 7 }, () => rep(30)).flat(), ...rest(15)], 0.05, 8);
    const a = windSignal(x, 30), b = windSignal(x.map(v => 7 * v + 3), 30);
    expect(b.count).toBe(a.count);
    expect(b.minRatio).toBeCloseTo(a.minRatio, 6);
  });
  it('finds the main direction of a movement spread over several signals', () => {
    const base = Array.from({ length: 200 }, (_, t) => Math.cos((2 * Math.PI * t) / 25));
    const rows = [base.map(v => 2 * v), base.map(v => -v), base.map(() => 0)];
    const [c] = principal(rows, 1);
    expect(Math.abs(c.dir[0]) / Math.abs(c.dir[1])).toBeCloseTo(2, 3);
    expect(fillGaps([NaN, 1, NaN, 3, NaN])).toEqual(Float64Array.from([1, 1, 2, 3, 3]));
  });
});
