import { describe, it, expect } from 'vitest';
import { TIERS, tierLabel, betaFirst } from '../liftTiers';
import { APPROVED_LIFTS } from '../coreAnalysis';
import { liftDefinition } from '../counting/core';
import { LIFTS as SCREEN_LIFTS, CARD_ORDER, META } from '../../components/experience/lift-meta';
import poses from '../../components/experience/lift-poses.json';

describe('lift tiers', () => {
  // Step 2 (David's decision, 29 September 2026): every countable exercise of the guide is offered,
  // the lifts with a tier among them, each defined in the counting core.
  it('offers every lift that has a tier, and every offered exercise is defined in the counting core', () => {
    for (const lift of Object.keys(TIERS)) expect(APPROVED_LIFTS, lift).toContain(lift);
    for (const lift of APPROVED_LIFTS) expect(liftDefinition(lift), lift).toBeTruthy();
  });
  // 3 October: the tiers follow David's labelled sets (test/real-phone/accuracy/tiers.test.ts, tiers.txt).
  it('puts the five lifts whose sets all count exactly in Beta, and four lifts in Experimental', () => {
    expect(Object.keys(TIERS).filter(l => TIERS[l] === 'beta').sort()).toEqual(['bicep_curl', 'lat_pulldown', 'leg_press', 'romanian_deadlift', 'squat']);
    expect(Object.keys(TIERS).filter(l => TIERS[l] === 'experimental').sort()).toEqual(['bench_press', 'hip_thrust', 'lateral_raise', 'overhead_press']);
  });
  // David, 3 October: the Beta lifts are pinned on top, derived from TIERS.
  it('orders the cards Beta first, each group in the order of LIFTS', () => {
    expect(CARD_ORDER).toEqual(['bicep_curl', 'lat_pulldown', 'squat', 'romanian_deadlift', 'leg_press', 'lateral_raise', 'bench_press', 'hip_thrust', 'overhead_press']);
    expect(betaFirst(['a', 'b', 'c', 'd'], k => (k === 'c' || k === 'a' ? 'beta' : 'experimental'))).toEqual(['a', 'c', 'b', 'd']);
  });
  // The nine lifts with a tier keep their card; the other offered exercises are listed under the cards (step 2).
  it('gives every lift with a tier a card, names in both languages and a figure', () => {
    expect([...SCREEN_LIFTS].sort()).toEqual(Object.keys(TIERS).sort());
    for (const lift of Object.keys(TIERS)) {
      expect(META[lift].fr && META[lift].en && META[lift].aliasFr && META[lift].aliasEn, lift).toBeTruthy();
      expect(poses[lift]?.loop?.f?.length, lift).toBeGreaterThan(0);
      expect(poses[lift]?.rest?.p?.length, lift).toBe(66);
    }
  });
  it('labels the tiers in French and English', () => {
    expect(tierLabel('beta', false)).toBe('Beta');
    expect(tierLabel('beta', true)).toBe('Bêta');
    expect(tierLabel('experimental', false)).toBe('Experimental: we are still learning this exercise');
    expect(tierLabel('experimental', true)).toBe('Expérimental\u00A0: nous\u00A0apprenons encore cet exercice');
  });
});

// The GitHub report moved to src/lib/reportLinks.js (step 1), with its test.

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
  // Review 02 of step 2: a both-sides exercise names both limbs, never one.
  it('names both limbs for an exercise counted on both sides', () => {
    expect(limbLabel('walking_lunge', 'both', false).text).toBe('both legs');
    expect(limbLabel('walking_lunge', 'both', true).text).toBe('les deux jambes');
    expect(limbLabel('archer_push_up', 'both', true).text).toBe('les deux bras');
    expect(limbLabel('dead_bug', 'both', false).text).toBe('both sides');
  });
  it('writes the coach report line accordingly', () => {
    const base = { date: new Date('2026-09-28T10:00:00Z'), client: '', coach: '', notes: '', liftName: 'Squat', count: 5, reps: [] };
    expect(reportSheet({ ...base, lang: 'en', arm: 'right', joint: 'knee' }).arm).toBe('Leg tracked: right');
    expect(reportSheet({ ...base, lang: 'fr', arm: 'right', joint: 'knee' }).arm).toBe('Jambe suivie : droite');
    expect(reportSheet({ ...base, lang: 'en', arm: 'left', joint: 'elbow' }).arm).toBe('Arm tracked: left');
  });
});
