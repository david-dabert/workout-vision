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
export function drawSkeleton(ctx, lm, box, sides, def, u = 1, trajectory = null) {
  const at = k => [box.ox + lm[k].x * box.w, box.oy + lm[k].y * box.h];
  const seen = k => lm[k] && lm[k].visibility >= SEEN;
  const line = (pts, width, colour) => {
    ctx.lineWidth = width * u; ctx.strokeStyle = colour;
    ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // Draw bar path trajectory trail if provided
  if (trajectory && trajectory.length > 1) {
    ctx.save();
    for (let i = 1; i < trajectory.length; i++) {
      const p0 = trajectory[i - 1], p1 = trajectory[i];
      const x0 = box.ox + p0.x * box.w, y0 = box.oy + p0.y * box.h;
      const x1 = box.ox + p1.x * box.w, y1 = box.oy + p1.y * box.h;
      ctx.lineWidth = 2 * u;
      ctx.strokeStyle = `rgba(247, 220, 174, ${p1.alpha ?? 0.6})`;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    const last = trajectory[trajectory.length - 1];
    const lx = box.ox + last.x * box.w, ly = box.oy + last.y * box.h;
    ctx.fillStyle = LAMP;
    ctx.shadowColor = 'rgba(247, 220, 174, 0.8)';
    ctx.shadowBlur = 6 * u;
    ctx.beginPath();
    ctx.arc(lx, ly, 3 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

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

    // Subtle biomechanical angle arc at the active joint
    const dxA = pts[0][0] - pts[1][0], dyA = pts[0][1] - pts[1][1];
    const dxB = pts[2][0] - pts[1][0], dyB = pts[2][1] - pts[1][1];
    const thA = Math.atan2(dyA, dxA);
    const thB = Math.atan2(dyB, dxB);
    let diff = thB - thA;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    const anticlockwise = diff < 0;
    ctx.strokeStyle = 'rgba(247, 220, 174, 0.6)';
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath();
    ctx.arc(pts[1][0], pts[1][1], 14 * u, thA, thB, anticlockwise);
    ctx.stroke();
  }
}

/** The sides a set's skeleton lights: both for a both-sides set, else the side tracked. */
export const litSides = (def, arm) => (!def ? [] : arm === 'both' ? ['left', 'right'] : [arm === 'right' ? 'right' : 'left']);
