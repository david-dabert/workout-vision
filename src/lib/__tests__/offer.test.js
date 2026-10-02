import { describe, it, expect } from 'vitest';
import { OFFERED, isOffered, tierOf } from '../offer';
import { TIERS } from '../liftTiers';
import catalogue from '../guide-catalog.json';
import families from '../counting/guide-families.json';
import { liftDefinition } from '../counting/core';

// Step 2 (PLAN.md, GROWTH): every countable exercise of the guide but the walking lunge, 181; Beta marks the
// exercises with evidence and Experimental all the others, so that the label stays true.
describe('the exercises the app offers', () => {
  // David's decision of 29 September: the walking lunge is not offered, since the lifter walks out of a fixed frame.
  it('are the countable exercises of the guide but the walking lunge, 181, the lifts of LIFT TIERS among them', () => {
    const countable = catalogue.map(e => e.key).filter(k => families[k].joint);
    expect(countable).toHaveLength(182);
    // With the two fitness tests of 2 October (fitness-tests.js), Experimental like every exercise without evidence.
    expect([...OFFERED].sort()).toEqual([...countable.filter(k => k !== 'walking_lunge'), 'chair_stand_test', 'arm_curl_test'].sort());
    expect(tierOf('chair_stand_test')).toBe('experimental');
    expect(tierOf('arm_curl_test')).toBe('experimental');
    expect(isOffered('walking_lunge')).toBe(false);
    for (const key of Object.keys(TIERS)) expect(isOffered(key), key).toBe(true);
    expect(isOffered('pec_deck')).toBe(false);
    expect(isOffered('bicep_curl_alternating')).toBe(false); // in the core's LIFTS, not in the guide
  });

  it('keep the tier of the lifts with evidence, and mark every other one Experimental', () => {
    for (const [key, tier] of Object.entries(TIERS)) expect(tierOf(key)).toBe(tier);
    const beta = OFFERED.filter(k => tierOf(k) === 'beta');
    expect(beta.sort()).toEqual(Object.keys(TIERS).filter(k => TIERS[k] === 'beta').sort());
    expect(tierOf('hammer_curl')).toBe('experimental');
    expect(tierOf('pec_deck')).toBeNull();
  });

  it('can each be counted by the core', () => {
    for (const key of OFFERED) expect(liftDefinition(key), key).not.toBeNull();
  });
});
