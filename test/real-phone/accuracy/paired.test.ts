import { expect, it } from 'vitest';
import { bootstrapExactChange, mcnemarExact, pairedLine, type Pair } from './paired';

// n sets, each exact before and now as given.
const pairs = (spec: [boolean, boolean, number][]): Pair[] => spec.flatMap(([before, now, k]) => Array.from({ length: k }, () => ({ before, now })));

it('gives p = 1 when no set changed outcome (b + c = 0)', () => {
  expect(mcnemarExact(0, 0)).toBe(1);
});
it('gives p = 0.0625 for 5 gained and 0 lost, either way round', () => {
  expect(mcnemarExact(5, 0)).toBeCloseTo(0.0625, 12);
  expect(mcnemarExact(0, 5)).toBeCloseTo(0.0625, 12);
});
it('gives p = 0.625 for 3 gained and 1 lost', () => {
  expect(mcnemarExact(3, 1)).toBeCloseTo(0.625, 12);
});
it('never gives p above 1 (b = c)', () => {
  expect(mcnemarExact(2, 2)).toBe(1);
});
it('gives the same interval on every run (seeded)', () => {
  const p = pairs([[false, true, 3], [true, false, 1], [true, true, 6], [false, false, 4]]);
  const a = bootstrapExactChange(p), b = bootstrapExactChange(p);
  expect(a).toEqual(b);
  expect(a[0]).toBeLessThanOrEqual(2 / 14);
  expect(a[1]).toBeGreaterThanOrEqual(2 / 14);
});
it('gives [0, 0] when nothing changes', () => {
  expect(bootstrapExactChange(pairs([[true, true, 6], [false, false, 8]]))).toEqual([0, 0]);
  expect(bootstrapExactChange([])).toEqual([0, 0]);
});
it('prints one line: 1 gained of 14 sets', () => {
  expect(pairedLine(pairs([[false, true, 1], [true, true, 5], [false, false, 8]]))).toContain('1 gained, 0 lost, McNemar p = 1.00; exact-rate change +7.1 points, 95 % interval [0.0, +21.4]');
});
