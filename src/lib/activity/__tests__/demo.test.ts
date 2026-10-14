/**
 * The volleyball demonstration the screen shows (demo.ts), on its one fixed seed: at every rate it offers, each value
 * shown with a margin holds its truth inside that margin, the count is exact, and what cannot be measured is refused
 * with its reason. One seed proves nothing general; the margins' coverage is in volleyball-heldout.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { volleyballDemo } from '../demo';

describe('the volleyball demo', () => {
  for (const rate of volleyballDemo.rates) {
    it(`at ${rate} samples a second, on the demo's seed, every value with a margin holds its truth`, () => {
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

  it('times the run-up at 60 and 240 samples a second, and says why not at 15', () => {
    const at = (rate: number) => volleyballDemo.run(rate).result.measures.find(m => m.key === 'approach')!;
    expect(at(15).value).toBeNull();
    expect(at(15).refused?.fr).toMatch(/^Élan non détecté à 15\u00A0images par seconde/);
    expect(at(60).value).not.toBeNull();
    expect(at(240).value).not.toBeNull();
  });

  it('names the best jump only when every jump is measured, against the true best jump', () => {
    for (const rate of volleyballDemo.rates) {
      const { result, truth } = volleyballDemo.run(rate);
      const h = result.measures.find(m => m.key === 'height')!;
      if (h.value === null) continue;
      expect(h.values.length, `rate ${rate}`).toBe(result.events.jump.length);
      expect(truth.height.value, `rate ${rate}`).toBe(Math.max(...(truth.height.byEvent as number[])));
    }
  });

  it('reads the same values on every visit', () => {
    expect(volleyballDemo.run(60).result.measures).toEqual(volleyballDemo.run(60).result.measures);
  });
});
