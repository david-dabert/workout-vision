import { TIERS } from './liftTiers';

// The reference range of the tracked joint over a full repetition, for the Beta lifts (liftTiers.js), drawn as a
// faint band behind the per-rep wave (RepWave.jsx, the report sheet and its PDF). BACKLOG, 6 October 2026, "a
// reference movement beside the person's own", first step. A reference execution, never "optimal" or "correct":
// the right range depends on the person, the goal and any injury.
//
// Each range is in the counter's own three-point angle (core.ts JOINT_POINTS, 180 = joint straight): `work` is the
// angle a full repetition reaches at its working end, `rest` the angle at its rest end. Each end carries its source
// and status (R9). Sources: the network of 6 October blocked PubMed, PMC and the CDC archive, so only sources the
// repo already cites are used, as exerciseDefinitions.js cites them; the papers were not re-read in this session.
//
// Left out, and why:
// - lat_pulldown: counted on the elbow (core.ts); the repo's cited pulldown thresholds (Signorile 2002) are on the
//   shoulder, so no sourced elbow range.
// - leg_press: the working end is cited (90°, Escamilla 2001), the rest end is not ("avoid full lockout", no
//   angle); a band with an unsourced end is not drawn.
//
// REFERENCE_BAND_SHOWN: off. On the synthetic sets the app reads a rep's range 24 % low on the curl and 16 % low on
// the squat at the guided (side) view, from the pose itself (synth.txt, "Measure errors split"; TRIED.md,
// Measures, 6 October). Set beside a reference, a full rep would read as falling short of it (R8). On once the
// measured range is within REFERENCE_MAX_RANGE_ERROR of the truth at the guided view for the lift drawn, and once
// David has approved the band's wording (test/real-phone/swarm/copy-reference-band.md). Status: experimental.
export const REFERENCE_BAND_SHOWN = false;
// The largest mean range error, at the guided view, under which a band may be drawn: UNSOURCED, experimental
// (a tenth of the range, chosen before measuring; not met by any Beta lift measured on 6 October).
export const REFERENCE_MAX_RANGE_ERROR = 0.10;

const STRAIGHT = { deg: 180, source: 'Standing upright, the joint straight: the three-point angle at its maximum (core.ts angleDeg)', status: 'convention' };

export const REFERENCE_RANGES = {
  bicep_curl: {
    joint: 'elbow',
    work: { deg: 55, source: 'Oliveira LF et al, 2009, J Strength Cond Res (as cited in exerciseDefinitions.js, "Full contraction")', status: 'literature' },
    rest: { deg: 145, source: 'Oliveira LF et al, 2009, J Strength Cond Res (as cited in exerciseDefinitions.js, "Full extension")', status: 'literature' },
  },
  squat: {
    joint: 'knee',
    work: { deg: 90, source: 'Schoenfeld BJ, 2010, J Strength Cond Res (as cited in exerciseDefinitions.js, squat "Depth")', status: 'literature' },
    rest: STRAIGHT,
  },
  romanian_deadlift: {
    joint: 'hip',
    work: { deg: 95, source: 'McAllister MJ et al, 2014, J Strength Cond Res (as cited in exerciseDefinitions.js, "Hip hinge")', status: 'literature' },
    rest: STRAIGHT,
  },
};

/**
 * The band to draw for a lift, as { lo, hi } in degrees, or null: null unless the band is shown (or `shown` is
 * forced, for tests), the lift is Beta, it has a sourced range, and the range is on the joint the count tracks.
 */
export function referenceBand(lift, { shown = REFERENCE_BAND_SHOWN, tier = TIERS[lift], joint } = {}) {
  const r = REFERENCE_RANGES[lift];
  if (!shown || !r || tier !== 'beta' || (joint && joint !== r.joint)) return null;
  return { lo: Math.min(r.work.deg, r.rest.deg), hi: Math.max(r.work.deg, r.rest.deg) };
}
