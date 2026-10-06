/**
 * Savitzky–Golay smoothing at any sample rate (audit of 6 October 2026, action 4, B). The window is SG_WINDOW_SEC
 * converted to samples; above about 33 samples per second it needs more than the 11 samples the fixed tables
 * held, and the smoothing fell back to 5 samples without a word. Quadratic coefficients are now generated for any
 * odd window (Savitzky & Golay, Anal. Chem. 1964; 36(8):1627-39, the closed form for a quadratic fit).
 */
import { describe, it, expect } from 'vitest';
import { countReps, sgKernel } from '../core';
import { jointFrame, timestamps } from './synthetic';

describe('Savitzky–Golay kernels', () => {
  it('matches the published tables for 5 to 11 samples', () => {
    const table: Record<number, number[]> = {
      5: [-3, 12, 17, 12, -3].map(v => v / 35),
      7: [-2, 3, 6, 7, 6, 3, -2].map(v => v / 21),
      9: [-21, 14, 39, 54, 59, 54, 39, 14, -21].map(v => v / 231),
      11: [-36, 9, 44, 69, 84, 89, 84, 69, 44, 9, -36].map(v => v / 429),
    };
    for (const [n, k] of Object.entries(table)) {
      const g = sgKernel(Number(n));
      expect(g).toHaveLength(Number(n));
      g.forEach((v, i) => expect(v).toBeCloseTo(k[i], 12));
    }
  });
  it('a 21-sample kernel sums to 1, is symmetric and keeps a parabola', () => {
    const k = sgKernel(21);
    expect(k).toHaveLength(21);
    expect(k.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
    for (let i = 0; i < 10; i++) expect(k[i]).toBeCloseTo(k[20 - i], 12);
    // A quadratic fit reproduces a parabola exactly at the window's centre.
    const y = (x: number) => 3 + 2 * x - 0.5 * x * x;
    expect(k.reduce((s, v, i) => s + v * y(i - 10), 0)).toBeCloseTo(y(0), 9);
  });
  it('never throws, for any window', () => {
    for (const n of [1, 2, 3, 4, 13, 31, 61, 121]) expect(() => sgKernel(n)).not.toThrow();
    for (const n of [13, 31, 61, 121]) expect(sgKernel(n).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
  });
});

describe('smoothing at 60 samples per second', () => {
  it('uses the 21-sample window: a 10° one-sample spike keeps only the centre weight', () => {
    const sps = 60;
    const angles = Array.from({ length: 120 }, (_, i) => (i === 60 ? 160 : 150));
    const r = countReps(angles.map(a => jointFrame('elbow', { left: a })), timestamps(angles.length, sps), 'bicep_curl');
    const k = sgKernel(21);
    expect(r.smoothedAngles[60]).toBeCloseTo(150 + 10 * k[10], 6);
    // The 5-sample fallback would have kept 17/35 of it.
    expect(r.smoothedAngles[60]! - 150).toBeLessThan(10 * (17 / 35) - 1);
  });
});
