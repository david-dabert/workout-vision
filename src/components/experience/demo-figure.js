// The example's figure, as pure functions the screen and its tests share: the drawing fitted to the
// canvas, its points in canvas pixels for the particle body, and the one joint the core measures.
import { JOINT_POINTS } from '../../lib/counting/core';

// Room above the drawing's frame for the particle head, which rises past the landmarks (Body.geom puts
// the head 0.05 L above points 0-10 and draws it 0.2 L further; L is shoulders to hips). Status:
// measured on the committed drawing (review, 30 September), not a coaching rule.
export const HEADROOM = 0.12; // 0.1 is the least that keeps every grain in (test), plus a margin

/** The drawing's box { ox, oy, w, h } in canvas pixels: fitted, centred, with room for the head. */
export function fitFigure([bw, bh], w, h) {
  const pad = bh * HEADROOM, k = Math.min(w / bw, h / (bh + pad));
  return { ox: (w - bw * k) / 2, oy: (h - (bh + pad) * k) / 2 + pad * k, w: bw * k, h: bh * k };
}

/** The 33 points in canvas pixels, as the particle body reads them (x, y pairs; NaN when missing). */
export function figurePoints(lm, box, out) {
  for (let i = 0; i < 33; i++) {
    out[i * 2] = lm[i] ? box.ox + lm[i].x * box.w : NaN;
    out[i * 2 + 1] = lm[i] ? box.oy + lm[i].y * box.h : NaN;
  }
  return out;
}

/** The landmarks with only the measured joint's three points visible, to be drawn lit over the body. */
export function litOnly(lm, joint, side) {
  const keep = JOINT_POINTS[joint][side];
  return lm.map((p, i) => (keep.includes(i) ? p : { ...p, visibility: 0 }));
}

// Grains sized to the figure: the entry's body stands about 320 px tall; never below 0.45, where a
// grain still reads as one.
export const grainSize = (box, dpr) => Math.max(0.45, Math.min(1, box.h / (320 * dpr)));
