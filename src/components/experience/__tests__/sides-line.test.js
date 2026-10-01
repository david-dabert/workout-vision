import { describe, expect, it } from 'vitest';
import { sidesLines, sidesRecord } from '../sides-line';

describe('sides line', () => {
  it('states both ranges and the gap, with no verdict', () => {
    const s = sidesRecord({ status: 'measured', comparison: { left: 90.4, right: 80.6, si: -11.4, reps: 8 } });
    expect(s).toEqual({ left: 90, right: 81, si: -11, reps: 8 });
    expect(sidesLines(s, true)).toEqual({ line: 'Amplitude gauche 90° · droite 81° · écart 11 %', note: 'Série filmée de face, gauche et droite de la personne filmée. Sur des vidéos publiques de sportifs sans asymétrie connue, environ un tiers dépassent 15\u00A0% d’écart.' });
    expect(sidesLines(s, false).line).toBe('Range left 90° · right 81° · 11% apart');
  });
  it('says nothing for a set not measured', () => {
    expect(sidesRecord({ status: 'not-front' })).toBeNull();
    expect(sidesRecord(null)).toBeNull();
    expect(sidesLines(null, true)).toBeNull();
    expect(sidesLines({ left: NaN, right: 3, si: 1 }, true)).toBeNull();
  });
});
