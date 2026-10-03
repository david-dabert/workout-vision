// Which exercises the app offers, and under which label (PLAN.md, GROWTH, step 2, 29 September
// 2026): the lifts of LIFT TIERS keep their tier; every other countable exercise of the guide is
// offered as Experimental, counted by its pattern (core.ts, liftDefinition), since none has
// evidence of its own. An exercise the guide cannot count (no joint) is not offered, nor one that
// cannot be filmed from a fixed phone.

// David's decision of 29 September 2026: the lifter walks out of a fixed frame. The sandbag lunge (3 October
// 2026) is a walking lunge with a sandbag on the shoulders, so the same holds.
const NOT_FILMABLE = new Set(['walking_lunge', 'sandbag_lunge']);
import patterns from './counting/guide-patterns.json';
import { TIERS } from './liftTiers';
import { FITNESS_TESTS } from './fitness-tests';

// Withdrawn on 3 October 2026 (third audit, C21): the floor exercises counted on both sides
// (guide-patterns.json 'both') that the Film screen tells the user to film in profile (guide-families.json
// view 'side'). A both-sides count needs each side's three landmarks seen on half the samples or more
// (coreAnalysis.js, FINDING-012). Lying or on all fours in profile, the body hides the far shoulder, hip
// and knee, so a set filmed as told is refused; filmed from the front or the feet, the hip angle lies
// along the camera's depth, where the pose model is weakest. TRIED.md (3 October) measured the first
// half of this on lunges: in a side view the far leg is hidden and two-sided sets were refused. For these
// four the reasoning is by anatomy, not measured: no labelled set holds them. Status: experimental.
// They keep their guide entry (shown "Guide only") and their names, so a set saved before still reads in
// History, and the collectors still list them, so the exam sets that would bring them back can be filmed
// (BACKLOG.md, 3 October). The standing both-sides exercises (lateral and Cossack lunges, archer push-up)
// are filmed from the front, where both sides are in view, and stay offered.
export const WITHDRAWN = Object.freeze({
  dead_bug: 'Lying on the back, in profile: the far arm and leg are hidden behind the body.',
  banded_dead_bug: 'Lying on the back, in profile: the far arm and leg are hidden behind the body.',
  bird_dog: 'On all fours, in profile: the far arm and leg are hidden behind the body.',
  glute_bridge_march: 'Lying on the back, hips raised, in profile: the far hip and knee are hidden behind the body.',
});

// The fitness tests (fitness-tests.js) are offered too, experimental like every exercise without evidence.
export const OFFERED = [...new Set([...Object.keys(TIERS), ...Object.keys(patterns), ...Object.keys(FITNESS_TESTS)])]
  .filter(key => !NOT_FILMABLE.has(key) && !Object.hasOwn(WITHDRAWN, key));
const offered = new Set(OFFERED);

export const isOffered = key => offered.has(key);
/** 'beta', 'experimental', or null for an exercise the app does not count. */
export const tierOf = key => TIERS[key] || (offered.has(key) ? 'experimental' : null);
