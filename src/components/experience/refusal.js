import { JOINT_POINTS, liftDefinition } from '../../lib/counting/core';

// Why a set was refused, read from the same joints the core uses rather than assumed. `side` names
// the limbs the sentence may speak of: for a both-sides exercise the sides are judged one by one, so
// a set with one leg hidden speaks of that leg, never of both (verifier of step 2, 29 September 2026).
const HIPS = new Set([23, 24]);
const coreIndices = (lift, side) => JOINT_POINTS[liftDefinition(lift)?.joint || 'elbow'][side];

/**
 * One side as the core sees it (core.ts): its angle is lost in a frame when any of its three
 * landmarks is below 0.5; `lost` counts those frames, and `i` is its landmark hidden most often.
 */
function sideOf(posed, lift, side) {
  const points = coreIndices(lift, side);
  const lost = posed.filter(f => points.some(k => f[k].visibility < 0.5)).length;
  let i = points[0], most = -1;
  for (const k of points) {
    const n = posed.filter(f => f[k].visibility < 0.5).length;
    if (n > most) { most = n; i = k; }
  }
  return { side, lost, i };
}

export function refusal(result, lift) {
  const frames = result.imageLandmarks || [];
  const posed = frames.filter(Boolean);
  const both = result.arm === 'both', one = result.arm === 'left' ? 'left' : 'right';
  if (!frames.length || posed.length < frames.length / 2) return { cause: 'nobody', side: both ? 'both' : one };
  const sides = (both ? ['left', 'right'] : [one]).map(side => sideOf(posed, lift, side));
  const out = sides.filter(s => s.lost > posed.length / 2);
  if (!out.length) return { cause: 'unclear', side: both ? 'both' : one };
  const { i } = out.reduce((a, b) => (b.lost > a.lost ? b : a));
  const hidden = posed.filter(f => f[i].visibility < 0.5);
  const outside = hidden.filter(f => f[i].x < 0 || f[i].x > 1 || f[i].y < 0 || f[i].y > 1).length > hidden.length / 2;
  const xs = posed.map(f => f[i].x).sort((a, b) => a - b);
  const side = out.length === 2 ? 'both' : out[0].side;
  // "Your hips" only when every hip the set counts on was out of sight: one hip of a both-sides set is its side.
  const hips = HIPS.has(i) && (!both || side === 'both');
  return { cause: outside ? 'outside' : 'hidden', hips, exitLeft: xs[xs.length >> 1] < 0.5, side };
}
