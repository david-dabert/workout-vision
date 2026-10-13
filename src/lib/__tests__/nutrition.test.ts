import { describe, it, expect } from 'vitest';
import { getDailyTargets, calculateAdherenceScore } from '../nutrition';

describe('Client Nutrition Target Engine', () => {
  it('calculates macro targets for cut goal', () => {
    const targets = getDailyTargets(
      {
        weight: '80',
        height: '180',
        age: '30',
        sex: 'male',
        activityLevel: 'moderate',
      },
      'cut'
    );

    expect(targets.bmr).toBe(1780);
    expect(targets.tdee).toBe(2759);
    expect(targets.calories).toBe(2259); // tdee - 500
    expect(targets.protein).toBeLessThanOrEqual(200);
    expect(targets.carbs).toBeGreaterThan(0);
    expect(targets.fat).toBeGreaterThan(0);
  });

  it('calculates lean surplus targets for bulk goal', () => {
    const targets = getDailyTargets(
      {
        weight: '60',
        height: '165',
        age: '25',
        sex: 'female',
        activityLevel: 'active',
      },
      'bulk'
    );

    expect(targets.calories).toBe(targets.tdee + 300);
    expect(targets.protein).toBe(108); // 60 * 1.8
  });

  it('computes compliance rate correctly from daily adherence logs', () => {
    const logs = [
      { date: '2026-10-06', adherent: true },
      { date: '2026-10-07', adherent: true },
      { date: '2026-10-08', adherent: false },
      { date: '2026-10-09', adherent: true },
      { date: '2026-10-10', adherent: true },
    ];
    const score = calculateAdherenceScore(logs);
    expect(score.daysLogged).toBe(5);
    expect(score.adherentDays).toBe(4);
    expect(score.complianceRatePct).toBe(80);
    expect(score.status).toBe('good');
  });
});
