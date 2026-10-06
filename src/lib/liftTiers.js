// The lifts on offer and how far each is trusted (PLAN.md, "Lift tiers", 28 September 2026).
// Beta: counted on committed evidence, not yet through its exam. Experimental: offered with
// no evidence, or evidence that fails the Beta condition. Both always ask the user to confirm
// or correct the count. Since 3 October (David) the tiers follow the evidence: a lift is Beta
// only if it is not a press and every one of David's labelled sets of it counts exactly, or, with
// no set of David's, on recorded dataset evidence. test/real-phone/accuracy/tiers.test.ts checks
// this table against npm run scoreboard's sets and fails when they disagree (tiers.txt).
// Status: convention (David's rule, PLAN.md Lift tiers), not a counting threshold.
export const TIERS = {
  // 3 October: experimental. sets-29sep/lateral_raise_9 counts 8 for 9 (scoreboard.txt); a failing set.
  lateral_raise: 'experimental',
  bicep_curl: 'beta',
  lat_pulldown: 'beta',
  squat: 'beta',
  bench_press: 'experimental',
  // 6 October: experimental. Of David's three sets, sets-06oct/set02_hip_thrust_7 counts 6 for 7; sets-29sep/hip_thrust_6
  // and sets-06oct/set01_hip_thrust_6 count exactly (scoreboard.txt). Beta from 3 to 6 October on the one set.
  hip_thrust: 'experimental',
  // 3 October: beta. sets-29sep/romanian_deadlift_8 counts 8 for 8, its only set (scoreboard.txt).
  romanian_deadlift: 'beta',
  // 3 October: sets-29sep/leg_press_13 counts 13 for 13 since the first-return rule (HEAD_RETURN_SHARE, core.ts;
  // it read 12 before), so the gate (tiers.test.ts) makes it Beta. One set of David's.
  leg_press: 'beta',
  // 28 September: counts 9 for 10 on David's build clip; MM-Fit 49 of 60 exact, 60 of 60 within one.
  overhead_press: 'experimental',
};

// The offered exercises with no card of their own (offer.js) that earn Beta by the same rule, from David's sets.
// Kept apart from TIERS, which also lists the cards (lift-meta.js, Choice.jsx). Same status: convention.
export const GUIDE_TIERS = {
  // The machine seated back extension was Beta on 5 and 6 October on its one set (8 for 8); David named the 13-rep
  // set of 5 October a back extension on 6 October, which counts 8 for 13: Experimental (tiers.txt).
};

export const tierLabel = (tier, fr) => tier === 'beta'
  ? (fr ? 'Bêta' : 'Beta')
  : (fr ? 'Expérimental\u00A0: nous\u00A0apprenons encore cet exercice' : 'Experimental: we are still learning this exercise');

/** The short form, for tags where the full sentence does not fit. */
export const tierTag = (tier, fr) => tier === 'beta' ? (fr ? 'Bêta' : 'Beta') : (fr ? 'Expérimental' : 'Experimental');

/** The keys given, Beta first, each group in the order given (David, 3 October: Beta pinned on top). */
export const betaFirst = (keys, tierOf = k => TIERS[k]) => [...keys.filter(k => tierOf(k) === 'beta'), ...keys.filter(k => tierOf(k) !== 'beta')];
