// Which exercises the app offers, and under which label (PLAN.md, GROWTH, step 2, 29 September
// 2026): the lifts of LIFT TIERS keep their tier; every other countable exercise of the guide is
// offered as Experimental, counted by its pattern (core.ts, liftDefinition), since none has
// evidence of its own. An exercise the guide cannot count (no joint) is not offered, nor one that
// cannot be filmed from a fixed phone.

// David's decision of 29 September 2026: the lifter walks out of a fixed frame.
const NOT_FILMABLE = new Set(['walking_lunge']);
import patterns from './counting/guide-patterns.json';
import { TIERS } from './liftTiers';

export const OFFERED = [...new Set([...Object.keys(TIERS), ...Object.keys(patterns)])].filter(key => !NOT_FILMABLE.has(key));
const offered = new Set(OFFERED);

export const isOffered = key => offered.has(key);
/** 'beta', 'experimental', or null for an exercise the app does not count. */
export const tierOf = key => TIERS[key] || (offered.has(key) ? 'experimental' : null);
