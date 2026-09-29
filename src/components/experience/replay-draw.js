// The skeleton the pose model tracked, drawn over a picture of the set: the replay draws it over the
// video on screen, the exported video over each frame it records (step 4). One drawing for both.
import { JOINT_POINTS } from '../../lib/counting/core';
import { SEEN } from './replay-track';

const BONES = [[11, 12], [11, 23], [12, 24], [23, 24], [11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
const DOTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const BONE = 'rgba(239, 232, 220, 0.85)', SHADE = 'rgba(8, 7, 6, 0.4)';
export const LAMP = '#F7DCAE';

/**
 * lm: one frame's image landmarks (x, y in 0..1 of the picture); box: where the picture lies,
 * { ox, oy, w, h } in the context's units; u: the width of a line of 1 at the screen's scale.
 */
export function drawSkeleton(ctx, lm, box, sides, def, u = 1) {
  const at = k => [box.ox + lm[k].x * box.w, box.oy + lm[k].y * box.h];
  const seen = k => lm[k] && lm[k].visibility >= SEEN;
  const line = (pts, width, colour) => {
    ctx.lineWidth = width * u; ctx.strokeStyle = colour;
    ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const bones = BONES.filter(([a, b]) => seen(a) && seen(b)).map(([a, b]) => [at(a), at(b)]);
  for (const b of bones) line(b, 4, SHADE);
  for (const b of bones) line(b, 2, BONE);
  ctx.fillStyle = BONE;
  for (const k of DOTS) if (seen(k)) { const [x, y] = at(k); ctx.beginPath(); ctx.arc(x, y, 3 * u, 0, Math.PI * 2); ctx.fill(); }
  // The measured joint, lit. Its angle is not written on the picture: the core measures it
  // in 3D, and at the top of a curl filmed from the side the two can differ by tens of degrees.
  if (!def) return;
  for (const side of sides) {
    const [a, v, b] = JOINT_POINTS[def.joint][side];
    if (!seen(a) || !seen(v) || !seen(b)) continue;
    const pts = [at(a), at(v), at(b)];
    line(pts, 6, SHADE);
    ctx.shadowColor = 'rgba(247, 220, 174, 0.75)'; ctx.shadowBlur = 10 * u;
    line(pts, 3.5, LAMP);
    ctx.shadowBlur = 0;
    ctx.fillStyle = LAMP;
    ctx.beginPath(); ctx.arc(pts[1][0], pts[1][1], 4.5 * u, 0, Math.PI * 2); ctx.fill();
  }
}

/** The sides a set's skeleton lights: both for a both-sides set, else the side tracked. */
export const litSides = (def, arm) => (!def ? [] : arm === 'both' ? ['left', 'right'] : [arm === 'right' ? 'right' : 'left']);
