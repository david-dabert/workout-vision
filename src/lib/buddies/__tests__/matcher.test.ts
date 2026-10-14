import { describe, it, expect } from 'vitest';
import * as buddies from '../matcher';
import { calculateStrengthParity, findCompatibleBuddies, DEMO_BUDDY_PROFILES } from '../matcher';

// Honesty pass of 14 October 2026 (BUD-1 to BUD-3): fictional gyms, a split that filters, no assumed weights.
describe('the gym buddy demo', () => {
  it('compares working weights: 100 within 15 %, lower beyond', () => {
    expect(calculateStrengthParity({ benchPressKg: 100, squatKg: 140 }, { benchPressKg: 95, squatKg: 135 })).toBe(100);
    expect(calculateStrengthParity({ benchPressKg: 100, squatKg: 140 }, { benchPressKg: 60, squatKg: 80 })).toBeLessThan(60);
  });
  it('holds fictional profiles in fictional gyms, no brand', () => {
    expect('ACTIVE_BUDDIES_POOL' in buddies).toBe(false);
    expect(DEMO_BUDDY_PROFILES.every(b => b.fictional && /^Salle exemple [A-Z]$/.test(b.facility))).toBe(true);
    expect(JSON.stringify(DEMO_BUDDY_PROFILES)).not.toMatch(/Basic-Fit|Fitness Park|Gymbox|Equinox|London|New York/);
  });
  it('lists only the split chosen, and gives no parity without the person’s weights', () => {
    const pl = findCompatibleBuddies({ split: 'powerlifting' });
    expect(pl.length).toBeGreaterThan(0);
    expect(pl.every(m => m.buddy.split === 'powerlifting')).toBe(true);
    expect(pl.every(m => m.score.strengthParityPct === null)).toBe(true);
    expect(findCompatibleBuddies({ split: 'bro_split' })).toEqual([]);
    expect(findCompatibleBuddies({ userCompounds: { benchPressKg: 100, squatKg: 130 } })[0].score.strengthParityPct).toBe(100);
  });
});
