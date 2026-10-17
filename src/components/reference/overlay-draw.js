// The comparison's drawing over the patient's video, one frame at a time: the patient's skeleton, each compared joint
// in the lamp when out of tolerance at that moment, its angle beside the reference's; the reference's skeleton laid on
// the patient's trunk as a ghost. Drawn the same on screen (ComparisonView.jsx) and in the video the patient keeps
// (attempt-export.js), so the file shows what the screen showed. R8: no label or colour at a moment either video does
// not show (result.seen).
import { MIRROR, SAMPLE_HZ, shownAngle, TOLERANCE_DEG } from '../../lib/reference/compare';
import { EDGES, ghostPoints, nearestIndex, refTimeFor } from '../../lib/reference/overlay';
import { deg } from './reference-copy';

const JOINT_POINTS = { leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14 };
// The point a measure is drawn at: a joint's own point, a direction's end (the wrist); the other side's twin when the
// attempt was read as in a mirror (compareAttempt).
export const pointOf = (name, measures, mirrored) => {
  const i = measures?.directions?.[name]?.to ?? JOINT_POINTS[name];
  return mirrored ? MIRROR[i] : i;
};

export function drawSkeleton(ctx, pts, { color, width, dash = null, alpha = 1, colorOf }) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  if (dash) ctx.setLineDash(dash);
  for (const [a, b] of EDGES) {
    if (!pts[a] || !pts[b]) continue;
    ctx.strokeStyle = colorOf?.(a, b) ?? color;
    ctx.beginPath();
    ctx.moveTo(pts[a].x, pts[a].y);
    ctx.lineTo(pts[b].x, pts[b].y);
    ctx.stroke();
  }
  ctx.restore();
}

/** The moment of the reference matched to the attempt's time t: its time and its index in the result's curves. */
export function refMomentAt(t, result, maps) {
  const tr = refTimeFor(t, maps);
  const ri = Math.max(0, Math.min(result.reference[0].length - 1, Math.round((tr - maps.refT0) * SAMPLE_HZ)));
  return { tr, ri };
}

/**
 * Draws the comparison at the attempt's time t on a w x h picture of the patient's video. u scales the strokes and
 * the type (1 on screen; the picture's width over 390 in a recorded video). colors: { lamp, bone, ash }. labels: false
 * for a still whose caption gives the values (a report's frames). anchor: the ghost's (overlay.js ghostAnchor).
 * Returns the reference's moment ({ tr, ri }).
 */
export function drawComparison(ctx, { t, w, h, u = 1, result, attPose, refPose, maps, measures, names, refShort, colors, ghost = true, labels = true, anchor = 'trunk' }) {
  const { lamp, bone, ash } = colors;
  const { tr, ri } = refMomentAt(t, result, maps);
  const lm = attPose.imageLandmarks[nearestIndex(attPose.timestamps, t)];
  const rlm = refPose.imageLandmarks[nearestIndex(refPose.timestamps, tr)];
  // Gap of each compared joint at this moment of the reference.
  const off = {};
  result.joints.forEach((j, k) => { off[pointOf(j.measure ?? j.name, measures, result.mirrored)] = result.seen[k][ri] && Math.abs(result.matched[k][ri] - result.reference[k][ri]) > TOLERANCE_DEG; });
  if (ghost && lm && rlm) {
    const g = ghostPoints(rlm, { w: 1, h: refPose.height / refPose.width }, lm, { w, h: w * (attPose.height / attPose.width) }, anchor);
    if (g) drawSkeleton(ctx, g, { color: ash, width: 6 * u, dash: [2 * u, 8 * u], alpha: 0.75 });
  }
  if (!lm) return { tr, ri };
  const pts = lm.map(p => ((p.visibility ?? 0) >= 0.5 ? { x: p.x * w, y: p.y * h } : null));
  drawSkeleton(ctx, pts, { color: bone, width: 4 * u, alpha: 0.95, colorOf: (a, b) => (off[a] || off[b] ? lamp : bone) });
  if (!labels) return { tr, ri };
  ctx.save();
  ctx.font = `600 ${Math.round(13 * u)}px system-ui, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  // Each joint's label, named, beside its point; a label that would cover one already set moves down.
  const placed = [];
  result.joints.forEach((j, k) => {
    // No label at a moment either video does not show: the value there is a filled line, not a measure (R8).
    const p = result.seen[k][ri] ? pts[pointOf(j.measure ?? j.name, measures, result.mirrored)] : null;
    if (!p) return;
    const bad = off[pointOf(j.measure ?? j.name, measures, result.mirrored)];
    ctx.fillStyle = bad ? lamp : bone;
    ctx.beginPath(); ctx.arc(p.x, p.y, 5 * u, 0, Math.PI * 2); ctx.fill();
    const label = `${names[j.name].split(' ')[0]} ${deg(shownAngle(result.matched[k][ri], j.direction))} · ${refShort} ${deg(shownAngle(result.reference[k][ri], j.direction))}`;
    const bw = ctx.measureText(label).width + 10 * u, bh = 20 * u;
    let bx = Math.min(p.x + 9 * u, w - bw - 4 * u), by = Math.max(4 * u, p.y - 21 * u);
    while (placed.some(r => bx < r.x + r.w && r.x < bx + bw && by < r.y + r.h && r.y < by + bh)) by += bh + 3 * u;
    placed.push({ x: bx, y: by, w: bw, h: bh });
    ctx.fillStyle = 'rgba(10,10,10,0.72)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = bad ? lamp : bone;
    ctx.fillText(label, bx + 5 * u, by + 15 * u);
  });
  ctx.restore();
  return { tr, ri };
}
