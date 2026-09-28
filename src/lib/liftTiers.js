// The lifts on offer and how far each is trusted (PLAN.md, "Lift tiers", 28 September 2026).
// Beta: counted on committed evidence, not yet through its exam. Experimental: offered with
// no evidence of its own yet. Both always ask the user to confirm or correct the count.
export const TIERS = {
  lateral_raise: 'beta',
  bicep_curl: 'beta',
  lat_pulldown: 'beta',
  squat: 'beta',
  bench_press: 'experimental',
  hip_thrust: 'experimental',
  romanian_deadlift: 'experimental',
  leg_press: 'experimental',
};

export const tierLabel = (tier, fr) => tier === 'beta'
  ? (fr ? 'Bêta' : 'Beta')
  : (fr ? 'Expérimental : nous apprenons encore cet exercice' : 'Experimental: we are still learning this exercise');

/** The short form, for tags where the full sentence does not fit. */
export const tierTag = (tier, fr) => tier === 'beta' ? (fr ? 'Bêta' : 'Beta') : (fr ? 'Expérimental' : 'Experimental');

const REPO = 'https://github.com/david-dabert/workout-vision';

/**
 * A new GitHub issue on this repository, prefilled with the lift and the two counts.
 * Opened only by the user's tap; no video, landmark or personal detail is included.
 */
export function reportWrongCountUrl({ lift, counted, userCount, version = '' }) {
  const body = [
    `Lift: ${lift}`,
    `App's count: ${counted}`,
    `User's count: ${userCount}`,
    ...(version ? [`App version: ${version}`] : []),
    '',
    'No video, frame or landmark is attached.',
  ].join('\n');
  const q = new URLSearchParams({ title: `Wrong count: ${lift}, app ${counted}, user ${userCount}`, body });
  return `${REPO}/issues/new?${q}`;
}
