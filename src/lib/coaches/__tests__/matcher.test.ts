import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistanceKm,
  calculateDistanceScore,
  calculateSpecialtyScore,
  findNearestCoaches,
  VERIFIED_COACH_REGISTRY,
} from '../matcher';

describe('Coach & Physio Proximity Matchmaker Engine', () => {
  it('calculates Haversine distances accurately between landmarks', () => {
    // Paris (48.8566, 2.3522) to London (51.5074, -0.1278) ~ 343 km
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    const london = { latitude: 51.5074, longitude: -0.1278 };
    const dist = calculateHaversineDistanceKm(paris, london);
    expect(dist).toBeGreaterThan(330);
    expect(dist).toBeLessThan(360);
  });

  it('computes distance decay properly', () => {
    expect(calculateDistanceScore(0)).toBe(100);
    expect(calculateDistanceScore(10)).toBe(50); // d = d0 -> 50%
    expect(calculateDistanceScore(30)).toBeLessThan(20);
  });

  it('computes Jaccard specialty similarity correctly', () => {
    const coachSpecialties = ['rotator_cuff_shoulder', 'lumbar_spine', 'knee_acl_recovery'] as any;
    const req1 = ['rotator_cuff_shoulder', 'lumbar_spine'] as any;
    const req2 = ['olympic_weightlifting'] as any;

    expect(calculateSpecialtyScore(coachSpecialties, req1)).toBeCloseTo(66.6, 0);
    expect(calculateSpecialtyScore(coachSpecialties, req2)).toBe(0);
    expect(calculateSpecialtyScore(coachSpecialties, [])).toBe(80); // baseline
  });

  it('finds and ranks nearest coaches in Paris', () => {
    // User in Paris near Châtelet (48.8584, 2.3470)
    const userLocation = { latitude: 48.8584, longitude: 2.347 };
    const matches = findNearestCoaches({
      userLocation,
      maxDistanceKm: 20,
      requiredSpecialties: ['hypertrophy_physique'],
    });

    expect(matches.length).toBeGreaterThanOrEqual(2);
    // Closest Paris coach should be ranked at the top
    expect(matches[0].coach.city).toBe('Paris');
    expect(matches[0].score.distanceKm).toBeLessThan(5);
    expect(matches[0].score.totalScore).toBeGreaterThan(60);
  });

  it('ranks Cambridge equine specialist when searching for veterinary kinematics', () => {
    // User looking for equine locomotion specialist in the UK
    const userLocation = { latitude: 52.2053, longitude: 0.1218 }; // Cambridge
    const matches = findNearestCoaches({
      userLocation,
      requiredSpecialties: ['equine_veterinary'],
    });

    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].coach.name).toContain('Sarah Smith');
    expect(matches[0].coach.specialties).toContain('equine_veterinary');
  });
});
