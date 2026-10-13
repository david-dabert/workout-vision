import { describe, it, expect } from 'vitest';
import {
  calculateStrengthParity,
  findCompatibleBuddies,
  ACTIVE_BUDDIES_POOL,
} from '../matcher';

describe('Gym Buddy Matchmaker Engine', () => {
  it('calculates compound strength parity accurately', () => {
    // Similar working weights (100kg bench / 140kg squat vs 95kg bench / 135kg squat)
    const c1 = { benchPressKg: 100, squatKg: 140 };
    const c2 = { benchPressKg: 95, squatKg: 135 };
    expect(calculateStrengthParity(c1, c2)).toBe(100);

    // Wide disparity (140kg vs 60kg)
    const c3 = { benchPressKg: 60, squatKg: 80 };
    expect(calculateStrengthParity(c1, c3)).toBeLessThan(60);
  });

  it('ranks gym partners by facility and evening schedule', () => {
    const matches = findCompatibleBuddies({
      facility: 'Fitness Park République',
      timeWindow: 'evening',
      split: 'ppl',
      userCompounds: { benchPressKg: 105, squatKg: 135 },
    });

    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].buddy.name).toBe('Antoine D.');
    expect(matches[0].score.facilityMatch).toBe(true);
    expect(matches[0].score.scheduleMatch).toBe(true);
    expect(matches[0].score.splitMatch).toBe(true);
    expect(matches[0].score.totalScore).toBeGreaterThan(90);
  });

  it('filters by city correctly', () => {
    const londonMatches = findCompatibleBuddies({ city: 'London' });
    expect(londonMatches.every(m => m.buddy.city === 'London')).toBe(true);
  });
});
