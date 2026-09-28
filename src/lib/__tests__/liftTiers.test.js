import { describe, it, expect } from 'vitest';
import { TIERS, tierLabel, reportWrongCountUrl } from '../liftTiers';
import { APPROVED_LIFTS } from '../coreAnalysis';
import { LIFTS as CORE_LIFTS } from '../counting/core';
import { LIFTS as SCREEN_LIFTS, META } from '../../components/experience/lift-meta';
import poses from '../../components/experience/lift-poses.json';

describe('lift tiers', () => {
  it('offers exactly the lifts that have a tier, each defined in the counting core', () => {
    expect([...APPROVED_LIFTS].sort()).toEqual(Object.keys(TIERS).sort());
    for (const lift of APPROVED_LIFTS) expect(CORE_LIFTS[lift], lift).toBeTruthy();
  });
  it('puts squat and the three built lifts in Beta, and four lifts in Experimental', () => {
    expect(Object.keys(TIERS).filter(l => TIERS[l] === 'beta').sort()).toEqual(['bicep_curl', 'lat_pulldown', 'lateral_raise', 'squat']);
    expect(Object.keys(TIERS).filter(l => TIERS[l] === 'experimental').sort()).toEqual(['bench_press', 'hip_thrust', 'leg_press', 'romanian_deadlift']);
    expect(TIERS.overhead_press).toBeUndefined();
  });
  it('gives every offered lift a card, names in both languages and a figure', () => {
    expect([...SCREEN_LIFTS].sort()).toEqual([...APPROVED_LIFTS].sort());
    for (const lift of APPROVED_LIFTS) {
      expect(META[lift].fr && META[lift].en && META[lift].aliasFr && META[lift].aliasEn, lift).toBeTruthy();
      expect(poses[lift]?.loop?.f?.length, lift).toBeGreaterThan(0);
      expect(poses[lift]?.rest?.p?.length, lift).toBe(66);
    }
  });
  it('labels the tiers in French and English', () => {
    expect(tierLabel('beta', false)).toBe('Beta');
    expect(tierLabel('beta', true)).toBe('Bêta');
    expect(tierLabel('experimental', false)).toBe('Experimental: we are still learning this exercise');
    expect(tierLabel('experimental', true)).toBe('Expérimental : nous apprenons encore cet exercice');
  });
});

describe('reportWrongCountUrl', () => {
  it('opens a new issue on this repository with the lift and both counts, and nothing else about the user', () => {
    const url = new URL(reportWrongCountUrl({ lift: 'squat', counted: 8, userCount: 10 }));
    expect(url.origin + url.pathname).toBe('https://github.com/david-dabert/workout-vision/issues/new');
    const title = url.searchParams.get('title'), body = url.searchParams.get('body');
    expect(title).toContain('squat');
    expect(body).toContain('Lift: squat');
    expect(body).toContain("App's count: 8");
    expect(body).toContain("User's count: 10");
    expect(body).toContain('No video');
    expect([...url.searchParams.keys()].sort()).toEqual(['body', 'title']);
  });
});

import { limbLabel } from '../../components/experience/lift-meta';
import { reportSheet } from '../../components/experience/report-sheet';
describe('the tracked limb follows the lift', () => {
  it('names the arm, the leg or the side', () => {
    expect(limbLabel('bicep_curl', 'right', false).text).toBe('right arm');
    expect(limbLabel('squat', 'right', false).text).toBe('right leg');
    expect(limbLabel('squat', 'right', true).text).toBe('jambe droite');
    expect(limbLabel('hip_thrust', 'left', true).text).toBe('côté gauche');
    expect(limbLabel('bench_press', 'left', true).text).toBe('bras gauche');
  });
  it('writes the coach report line accordingly', () => {
    const base = { date: new Date('2026-09-28T10:00:00Z'), client: '', coach: '', notes: '', liftName: 'Squat', count: 5, reps: [] };
    expect(reportSheet({ ...base, lang: 'en', arm: 'right', joint: 'knee' }).arm).toBe('Leg tracked: right');
    expect(reportSheet({ ...base, lang: 'fr', arm: 'right', joint: 'knee' }).arm).toBe('Jambe suivie : droite');
    expect(reportSheet({ ...base, lang: 'en', arm: 'left', joint: 'elbow' }).arm).toBe('Arm tracked: left');
  });
});
