import { describe, it, expect } from 'vitest';
import { estimateDailyNeeds, calculateAdherenceScore } from '../nutrition';

// Honesty pass of 14 October 2026 (NUT-5, NUT-6): nothing filled in for the client, the activity level chosen by the
// coach, the goal as computed (-500 / +300 kcal), protein as Morton et al. 2018's range.
describe('a client’s estimated daily needs', () => {
  it('is Mifflin-St Jeor × the chosen activity, then the goal’s offset, with protein as 1.6 to 2.2 g/kg', () => {
    const n = estimateDailyNeeds({ weight: '80', height: '180', age: '30', sex: 'male' }, { goal: 'cut', activity: 'moderate' });
    expect(n).not.toBeNull();
    expect(n!.bmr).toBe(1780);
    expect(n!.tdee).toBe(2759);
    expect(n!.calories).toBe(2259);
    expect(n!.offset).toBe(-500);
    expect(n!.proteinG).toEqual([128, 176]);
    const bulk = estimateDailyNeeds({ weight: '60', height: '165', age: '25', sex: 'female' }, { goal: 'bulk', activity: 'active' });
    expect(bulk!.calories).toBe(bulk!.tdee + 300);
  });
  it('gives nothing while the age, the sex, the weight, the height or the activity level is missing', () => {
    const full = { weight: '80', height: '180', age: '30', sex: 'male' };
    expect(estimateDailyNeeds(full, { goal: 'maintain' })).toBeNull();
    for (const k of ['weight', 'height', 'age', 'sex']) expect(estimateDailyNeeds({ ...full, [k]: '' }, { activity: 'light' })).toBeNull();
    expect(estimateDailyNeeds(null, { activity: 'light' })).toBeNull();
  });
});

describe('adherence', () => {
  it('computes the rate from logged days', () => {
    const score = calculateAdherenceScore([
      { date: '2026-10-06', adherent: true }, { date: '2026-10-07', adherent: true }, { date: '2026-10-08', adherent: false },
      { date: '2026-10-09', adherent: true }, { date: '2026-10-10', adherent: true },
    ]);
    expect(score.complianceRatePct).toBe(80);
  });
  it('gives no rate without a log, never 100 %', () => {
    expect(calculateAdherenceScore([])).toEqual({ daysLogged: 0, adherentDays: 0, complianceRatePct: null, status: 'no_data' });
  });
});
