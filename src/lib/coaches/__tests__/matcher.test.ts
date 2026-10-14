import { describe, it, expect } from 'vitest';
import { calculateHaversineDistanceKm, demoProfilesFor, DEMO_COACH_PROFILES, DEMO_CITIES } from '../matcher';
import * as matcher from '../matcher';

// Honesty pass of 14 October 2026 (FND-1, FND-2): fictional placeholders only, filtered for real.
describe('the coach directory demo', () => {
  it('holds fictional placeholders only: no credential, register, price, rating or review', () => {
    expect('VERIFIED_COACH_REGISTRY' in matcher).toBe(false);
    for (const p of DEMO_COACH_PROFILES) {
      expect(p.fictional).toBe(true);
      expect(p.name).toMatch(/exemple [A-Z]$/);
      expect(Object.keys(p)).not.toEqual(expect.arrayContaining(['rating']));
    }
    expect(JSON.stringify(DEMO_COACH_PROFILES)).not.toMatch(/rating|review|credential|RAMP|NAVP|FCCA|DPT|CSCS|Dr\.|hourlyRate|organization/i);
  });
  it('lists a city’s profiles, and only those of the specialty chosen', () => {
    const paris = demoProfilesFor('Paris');
    expect(paris.length).toBeGreaterThan(1);
    expect(paris.every(p => p.city === 'Paris')).toBe(true);
    const rehab = demoProfilesFor('Paris', 'rehab');
    expect(rehab.length).toBeGreaterThan(0);
    expect(rehab.every(p => p.specialties.includes('rehab'))).toBe(true);
    expect(demoProfilesFor('Paris', 'strength').some(p => p.specialties.includes('rehab') && !p.specialties.includes('strength'))).toBe(false);
    expect(demoProfilesFor('Nowhere')).toEqual([]);
    for (const c of DEMO_CITIES) expect(demoProfilesFor(c.name).length).toBeGreaterThan(0);
  });
  it('measures great-circle distances (kept for the real directory)', () => {
    const d = calculateHaversineDistanceKm({ latitude: 48.8566, longitude: 2.3522 }, { latitude: 51.5074, longitude: -0.1278 });
    expect(d).toBeGreaterThan(330);
    expect(d).toBeLessThan(360);
  });
});
