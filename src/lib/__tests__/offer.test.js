import { describe, it, expect, vi } from 'vitest';
// exercise-info.js reaches the drawing code, which reads the screen when it loads (as in exercise-name.test.js).
vi.hoisted(() => {
  const any = new Proxy(function stub() {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : any), apply: () => any, set: () => true });
  globalThis.window ??= { devicePixelRatio: 1 };
  globalThis.document ??= { createElement: () => any };
});
import { NOT_YET_COUNTED, OFFERED, WITHDRAWN, isOffered, tierOf } from '../offer';
import { GUIDE_TIERS, TIERS } from '../liftTiers';
import catalogue from '../guide-catalog.json';
import families from '../counting/guide-families.json';
import { liftDefinition } from '../counting/core';
import { filmView } from '../../components/experience/exercise-info';

// Step 2 (PLAN.md, GROWTH): every countable exercise of the guide but the walking lunge, 183 (181, and since 2 October the standing and lying barbell curls),
// and since 3 October 179, without the four floor exercises counted on both sides in profile (offer.js, WITHDRAWN, third audit C21);
// 181 the same day with the behind-the-neck press and the wall ball (the barbell jump squat is in the guide but not yet counted, NOT_YET_COUNTED;
// the sandbag lunge, a walking lunge, is not offered); 182 on 5 October with the machine seated back extension; the
// prone Y raise, countable since 8 October (core.ts, LiftDefinition.lift), is not offered yet (NOT_YET_COUNTED);
// Beta marks the exercises with evidence and Experimental all the others, so that the label stays true.
describe('the exercises the app offers', () => {
  // David's decision of 29 September: the walking lunge is not offered, since the lifter walks out of a fixed frame; nor, since 3 October, the sandbag lunge.
  it('are the countable exercises of the guide but the walking and sandbag lunges and the four withdrawn and the jump squat and the prone Y raise, 182, the lifts of LIFT TIERS among them', () => {
    const countable = catalogue.map(e => e.key).filter(k => families[k].joint);
    expect(countable).toHaveLength(190);
    // With the two fitness tests of 2 October (fitness-tests.js), Experimental like every exercise without evidence.
    expect(Object.keys(WITHDRAWN).sort()).toEqual(['banded_dead_bug', 'bird_dog', 'dead_bug', 'glute_bridge_march']);
    expect([...OFFERED].sort()).toEqual([...countable.filter(k => k !== 'walking_lunge' && k !== 'sandbag_lunge' && !Object.hasOwn(WITHDRAWN, k) && !Object.hasOwn(NOT_YET_COUNTED, k)), 'chair_stand_test', 'arm_curl_test'].sort());
    expect(OFFERED).toHaveLength(184);
    expect(isOffered('prone_y_raise')).toBe(false);
    expect(isOffered('machine_seated_back_extension')).toBe(true);
    expect(isOffered('barbell_jump_squat')).toBe(false);
    for (const key of Object.keys(WITHDRAWN)) expect(isOffered(key), key).toBe(false);
    expect(tierOf('chair_stand_test')).toBe('experimental');
    expect(tierOf('arm_curl_test')).toBe('experimental');
    expect(isOffered('walking_lunge')).toBe(false);
    expect(isOffered('sandbag_lunge')).toBe(false);
    for (const key of Object.keys(TIERS)) expect(isOffered(key), key).toBe(true);
    expect(isOffered('pec_deck')).toBe(false);
    expect(isOffered('bicep_curl_alternating')).toBe(false); // in the core's LIFTS, not in the guide
  });

  it('keep the tier of the lifts with evidence, and mark every other one Experimental', () => {
    for (const [key, tier] of Object.entries({ ...TIERS, ...GUIDE_TIERS })) expect(tierOf(key)).toBe(tier);
    const beta = OFFERED.filter(k => tierOf(k) === 'beta');
    expect(beta.sort()).toEqual(Object.entries({ ...TIERS, ...GUIDE_TIERS }).filter(([, t]) => t === 'beta').map(([k]) => k).sort());
    expect(tierOf('hammer_curl')).toBe('experimental');
    expect(tierOf('pec_deck')).toBeNull();
  });

  it('can each be counted by the core', () => {
    for (const key of OFFERED) expect(liftDefinition(key), key).not.toBeNull();
  });

  // Third audit, C21 (3 October 2026): a both-sides count needs both sides in view (coreAnalysis.js, FINDING-012),
  // and in profile the far limbs are hidden. An offered both-sides exercise filmed in profile needs a reason here.
  it('never ask for a profile view of an exercise counted on both sides, unless allowed with a reason', () => {
    /** key -> why its profile view still shows both sides. None on 3 October 2026. */
    const PROFILE_ALLOWED = {};
    const inProfile = OFFERED.filter(k => liftDefinition(k)?.bothSides && filmView(k) === 'side' && !Object.hasOwn(PROFILE_ALLOWED, k));
    expect(inProfile).toEqual([]);
    for (const why of Object.values(PROFILE_ALLOWED)) expect(typeof why === 'string' && why.trim().length > 0).toBe(true);
    // The withdrawn ones are the case this guards: counted on both sides and filmed in profile.
    for (const key of Object.keys(WITHDRAWN)) {
      expect(liftDefinition(key)?.bothSides, key).toBe(true);
      expect(filmView(key), key).toBe('side');
    }
  });
});
