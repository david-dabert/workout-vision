import { describe, expect, it } from 'vitest';
import { sidesLines, sidesRecord } from '../sides-line';

describe('sides line', () => {
  it('states both ranges, the gap and the synthetic bounds as observations, with no verdict', () => {
    const s = sidesRecord({ status: 'measured', comparison: { left: 90.4, right: 80.6, si: -11.4, reps: 8 } });
    expect(s).toEqual({ left: 90, right: 81, si: -11, reps: 8, v: 2 });
    expect(sidesLines(s, true, 'lateral_raise')).toEqual({ line: 'Amplitude de l’épaule\u00A0: gauche 90°\u00A0· droite 81°\u00A0· écart 11\u00A0%', note: 'Série filmée bien de face, gauche et droite de la personne filmée. Sur 6 séries de synthèse à l’écart connu, l’écart lu s’en éloignait jusqu’à 9 points, et jusqu’à 14 d’une répétition à l’autre.' });
    expect(sidesLines(s, false, 'lateral_raise').line).toBe('Shoulder range: left 90°\u00A0· right 81°\u00A0· 11% apart');
  });
  it('says nothing for a set not measured', () => {
    expect(sidesRecord({ status: 'not-front' })).toBeNull();
    expect(sidesRecord(null)).toBeNull();
    expect(sidesLines(null, true, 'lateral_raise')).toBeNull();
    expect(sidesLines({ left: NaN, right: 3, si: 1, v: 2 }, true, 'lateral_raise')).toBeNull();
  });
  it('says nothing again for a set saved under the older, wider rule, or for a lift no longer compared', () => {
    // An overhead press saved on 1 October (review of 1144e4f): no version, a lift no longer compared.
    expect(sidesLines({ left: 62, right: 57, si: -8, reps: 4 }, true, 'overhead_press')).toBeNull();
    expect(sidesLines({ left: 62, right: 57, si: -8, reps: 4, v: 2 }, true, 'overhead_press')).toBeNull();
    // A lateral raise saved under the older gate: no version, not shown.
    expect(sidesLines({ left: 92, right: 74, si: -21, reps: 10 }, true, 'lateral_raise')).toBeNull();
  });
});
