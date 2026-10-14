/**
 * The volleyball demonstration the screen shows (demo.ts), on its one fixed seed: at every rate it offers, each value
 * shown with a margin holds its truth inside that margin (the summary and each jump's own), the count is exact, and
 * what cannot be measured is refused with its reason. One seed proves nothing general; the margins' coverage is in
 * volleyball-heldout.test.ts.
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
        if (m.value === null) expect(m.refused, m.key).not.toBeNull();
        else if (m.margin !== null) expect(Math.abs(m.value - (truth[m.key].value as number)), `${m.key} at ${rate}`).toBeLessThanOrEqual(m.margin);
        // Each jump's value, shown in the table even when the summary is refused.
        if (m.values.some(v => v.margin === null)) continue;
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
    expect(at(15).refused?.fr).toMatch(/^Élan non mesurable à 15\u00A0images par seconde/);
    expect(at(60).value).not.toBeNull();
    expect(at(240).value).not.toBeNull();
  });

  it('names the best jump against the true best jump, also when a jump too wide to show lies wholly below it (30 a second)', () => {
    for (const rate of volleyballDemo.rates) {
      const { result, truth } = volleyballDemo.run(rate);
      const h = result.measures.find(m => m.key === 'height')!;
      if (h.value === null) continue;
      expect(truth.height.value, `rate ${rate}`).toBe(Math.max(...(truth.height.byEvent as number[])));
    }
    const at30 = volleyballDemo.run(30).result.measures.find(m => m.key === 'height')!;
    expect(at30.values.length).toBe(3);
    expect(at30.value).not.toBeNull();
  });

  it('keeps each jump\'s height when the best cannot be named, and says why (20 a second)', () => {
    const { result, truth } = volleyballDemo.run(20);
    const h = result.measures.find(m => m.key === 'height')!;
    expect(h.value).toBeNull();
    expect(h.refused?.fr).toBe('Hauteur mesurée sur 2\u00A0sauts sur 4\u00A0: impossible de désigner le meilleur.');
    expect(h.values.length).toBe(2);
    for (const v of h.values) expect(Math.abs(v.value - (truth.height.byEvent[v.event] as number))).toBeLessThanOrEqual(v.margin as number);
  });

  it('says what the run-up\'s mean was taken over', () => {
    const at = (rate: number) => volleyballDemo.run(rate).result.measures.find(m => m.key === 'approach')!;
    expect(at(30).scope?.fr).toBe('Moyenne sur 1 des 2\u00A0élans détectés.');
    expect(at(60).scope?.fr).toBe('Moyenne sur 2\u00A0élans.');
  });

  it('reads the same values on every visit', () => {
    expect(volleyballDemo.run(60).result.measures).toEqual(volleyballDemo.run(60).result.measures);
  });
});
