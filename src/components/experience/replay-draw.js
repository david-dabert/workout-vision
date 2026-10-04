// The skeleton the pose model tracked, drawn over a picture of the set: the replay draws it over the
// video on screen, the exported video over each frame it records (step 4). One drawing for both.
import { JOINT_POINTS } from '../../lib/counting/core';
import { SEEN } from './replay-track';

const BONES = [[11, 12], [11, 23], [12, 24], [23, 24], [11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
const DOTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const BONE = 'rgba(239, 232, 220, 0.85)', SHADE = 'rgba(8, 7, 6, 0.4)';
export const LAMP = '#F7DCAE';

// A point is drawn fully once the model's sureness reaches SEEN + FADE / 2 and not at all below SEEN - FADE / 2;
// between the two it fades, so a bone the model loses for a moment dims instead of blinking. Display only;
// experimental, UNSOURCED (R9): chosen by eye on David's sets.
const FADE = 0.3;
const alphaOf = v => Math.max(0, Math.min(1, ((v ?? 0) - (SEEN - FADE / 2)) / FADE));

/**
 * lm: one frame's image landmarks (x, y in 0..1 of the picture); box: where the picture lies,
 * { ox, oy, w, h } in the context's units; u: the width of a line of 1 at the screen's scale;
 * trails: for each lit side, the path its moving end has drawn (replay-smooth.js trailAt), or none.
 */
export function drawSkeleton(ctx, lm, box, sides, def, u = 1, trails = null) {
  const at = k => [box.ox + lm[k].x * box.w, box.oy + lm[k].y * box.h];
  const alpha = k => (lm[k] ? alphaOf(lm[k].visibility) : 0);
  const line = (pts, width, colour) => {
    ctx.lineWidth = width * u; ctx.strokeStyle = colour;
    ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  };
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // The path of the lit limb's end over the last moment, under the bones: a thin gold line that thins and fades
  // with age, so the eye reads the rep's arc.
  for (const trail of trails || []) {
    for (let j = 1; j < trail.length; j++) {
      const a = trail[j - 1], b = trail[j], fresh = 1 - (a.age + b.age) / 2;
      if (fresh <= 0) continue;
      ctx.globalAlpha = 0.55 * fresh * fresh;
      line([[box.ox + a.x * box.w, box.oy + a.y * box.h], [box.ox + b.x * box.w, box.oy + b.y * box.h]], 1 + 3 * fresh, LAMP);
    }
  }
  const bones = BONES.map(([a, b]) => [Math.min(alpha(a), alpha(b)), a, b]).filter(([o]) => o > 0);
  for (const [o, a, b] of bones) { ctx.globalAlpha = o; line([at(a), at(b)], 4, SHADE); }
  for (const [o, a, b] of bones) { ctx.globalAlpha = o; line([at(a), at(b)], 2, BONE); }
  ctx.fillStyle = BONE;
  for (const k of DOTS) {
    const o = alpha(k);
    if (o <= 0) continue;
    const [x, y] = at(k);
    ctx.globalAlpha = o;
    ctx.beginPath(); ctx.arc(x, y, 3 * u, 0, Math.PI * 2); ctx.fill();
  }
  // The measured joint, lit. Its angle is not written on the picture: the core measures it
  // in 3D, and at the top of a curl filmed from the side the two can differ by tens of degrees.
  if (def) for (const side of sides) {
    const [a, v, b] = JOINT_POINTS[def.joint][side];
    const o = Math.min(alpha(a), alpha(v), alpha(b));
    if (o <= 0) continue;
    const pts = [at(a), at(v), at(b)];
    ctx.globalAlpha = o;
    line(pts, 6, SHADE);
    ctx.shadowColor = 'rgba(247, 220, 174, 0.75)'; ctx.shadowBlur = 10 * u;
    line(pts, 3.5, LAMP);
    ctx.shadowBlur = 0;
    ctx.fillStyle = LAMP;
    ctx.beginPath(); ctx.arc(pts[1][0], pts[1][1], 4.5 * u, 0, Math.PI * 2); ctx.fill();
    // A ring round the measured joint, the one the count reads.
    ctx.globalAlpha = o * 0.5;
    ctx.lineWidth = 1.25 * u; ctx.strokeStyle = LAMP;
    ctx.beginPath(); ctx.arc(pts[1][0], pts[1][1], 9 * u, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

/** For each lit side, the landmark index of the limb's moving end (wrist, ankle): the third point of its joint. */
export const trailPoints = (def, sides) => (def ? sides.map(side => JOINT_POINTS[def.joint][side][2]) : []);

/** The sides a set's skeleton lights: both for a both-sides set, else the side tracked. */
export const litSides = (def, arm) => (!def ? [] : arm === 'both' ? ['left', 'right'] : [arm === 'right' ? 'right' : 'left']);
