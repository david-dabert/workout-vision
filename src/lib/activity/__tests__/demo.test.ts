/**
 * The volleyball demonstration the screen shows (demo.ts): at every rate it offers, each value shown with a margin holds
 * its truth inside that margin, the count is exact, and what cannot be measured is refused with its reason.
 */
import { describe, expect, it } from 'vitest';
import { volleyballDemo } from '../demo';

describe('the volleyball demo', () => {
  for (const rate of volleyballDemo.rates) {
    it(`at ${rate} samples a second, every value with a margin holds its truth`, () => {
      const { result, truth, made } = volleyballDemo.run(rate);
      expect(result.refused).toBeNull();
      expect(Math.round(result.rate)).toBe(rate);
      const jumps = result.measures.find(m => m.key === 'jumps')!;
      expect(jumps.value).toBe(made.jumps);
      expect(truth.jumps.value).toBe(made.jumps);
      for (const m of result.measures) {
        if (m.value === null) { expect(m.refused, m.key).not.toBeNull(); continue; }
        if (m.margin === null) continue;
        expect(Math.abs(m.value - (truth[m.key].value as number)), `${m.key} at ${rate}`).toBeLessThanOrEqual(m.margin);
        m.values.forEach((v, k) => {
          const t = truth[m.key].each[k];
          expect(t, `${m.key} event ${v.event} at ${rate}`).not.toBeNull();
          expect(Math.abs(v.value - (t as number)), `${m.key} event ${v.event} at ${rate}`).toBeLessThanOrEqual(v.margin as number);
        });
      }
    });
  }

  it('times the run-up from 30 samples a second on, and says why not at 15', () => {
    expect(volleyballDemo.run(15).result.measures.find(m => m.key === 'approach')!.refused?.fr).toMatch(/15 images par seconde/);
    expect(volleyballDemo.run(60).result.measures.find(m => m.key === 'approach')!.value).not.toBeNull();
  });

  it('reads the same values on every visit', () => {
    expect(volleyballDemo.run(60).result.measures).toEqual(volleyballDemo.run(60).result.measures);
  });
});
