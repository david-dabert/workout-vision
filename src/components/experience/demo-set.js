// The entry's example: a set that no one filmed. Its body is the drawn squat of the choice card
// (lift-poses.json, scripts/make-lift-poses.mjs: a drawing, no person's recording), played through
// DEMO_REPS reps at 15 samples per second, as the app samples a video. The count the example shows
// is the counting core's own count of this sequence (demoResult), never a number typed in; the
// test (demo.test.js) holds that it equals the number of reps drawn.
import poses from './lift-poses.json';
import { countReps } from '../../lib/counting/core';

export const DEMO_LIFT = 'squat';
const SPS = 15;
// Seconds per rep, slowing a little as the set goes on, with a short stand between reps.
// Illustration only: no threshold or parameter of the core depends on them.
const REP_SEC = [2.4, 2.2, 2.3, 2.6, 2.9];
const LEAD_SEC = 1, PAUSE_SEC = 0.6, TAIL_SEC = 1.2;
export const DEMO_REPS = REP_SEC.length;

const DIG = '0123456789abcdefghijklmnopqrstuvwxyz';
// One frame of lift-poses.json: 33 points of two base-36 digits per coordinate, 'zz' for none.
function decode(s) {
  const o = [];
  for (let i = 0; i < 33; i++) {
    const a = s.charAt(i * 4), b = s.charAt(i * 4 + 1);
    if (a === 'z' && b === 'z') { o.push(null); continue; }
    o.push([DIG.indexOf(a) * 36 + DIG.indexOf(b), DIG.indexOf(s.charAt(i * 4 + 2)) * 36 + DIG.indexOf(s.charAt(i * 4 + 3))]);
  }
  return o;
}

// The drawn loop at phase u (0 to 1, rest to rest), each point between its two nearest frames.
function loopAt(frames, u) {
  const n = frames.length, fi = u * n, i = Math.floor(fi) % n, j = (i + 1) % n, k = fi - Math.floor(fi);
  return frames[i].map((p, m) => (p && frames[j][m] ? [p[0] + (frames[j][m][0] - p[0]) * k, p[1] + (frames[j][m][1] - p[1]) * k] : p));
}

let memo = null;
/**
 * The example set: image landmarks (x, y in 0..1 of the drawing's box) for the screen, world
 * landmarks (metres-like, z = 0) for the core, their timestamps in seconds and the set's length.
 */
export function demoSet() {
  if (memo) return memo;
  const data = poses[DEMO_LIFT], frames = data.loop.f.map(decode), [w, h] = data.loop.vb;
  const plan = [{ u0: 0, u1: 0, sec: LEAD_SEC }];
  REP_SEC.forEach((sec, i) => { plan.push({ u0: 0, u1: 1, sec }); plan.push({ u0: 0, u1: 0, sec: i === REP_SEC.length - 1 ? TAIL_SEC : PAUSE_SEC }); });
  const duration = plan.reduce((s, p) => s + p.sec, 0);
  const bodies = [], world = [], timestamps = [];
  for (let n = 0; n * (1 / SPS) <= duration + 1e-9; n++) {
    const t = n / SPS;
    let left = t, step = plan[plan.length - 1], u = 1;
    for (const p of plan) { if (left <= p.sec) { step = p; u = left / p.sec; break; } left -= p.sec; }
    const pts = loopAt(frames, step.u0 + (step.u1 - step.u0) * u);
    timestamps.push(t);
    bodies.push(pts);
    // World landmarks are metres about the hips in MediaPipe; the drawing's units scaled to a
    // body about 1.7 high are enough, since the core measures angles.
    world.push(pts.map(p => (p ? { x: (p[0] - w / 2) / h * 1.7, y: (p[1] - h / 2) / h * 1.7, z: 0, visibility: 0.99 } : { x: 0, y: 0, z: 0, visibility: 0 })));
  }
  // The screen's box: the body's extent over the whole set, with a margin, so the figure fills it.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const pts of bodies) for (const p of pts) if (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const m = 0.06 * (y1 - y0), bw = x1 - x0 + 2 * m, bh = y1 - y0 + 2 * m;
  const image = bodies.map(pts => pts.map(p => (p ? { x: (p[0] - x0 + m) / bw, y: (p[1] - y0 + m) / bh, visibility: 0.99 } : { x: 0, y: 0, visibility: 0 })));
  memo = { image, world, timestamps, duration, vb: [bw, bh] };
  return memo;
}

let counted = null;
/** The counting core's result for the example set: what the example shows. */
export function demoResult() {
  if (!counted) { const s = demoSet(); counted = countReps(s.world, s.timestamps, DEMO_LIFT); }
  return counted;
}

/** The counter at time t of the example: the reps the core has seen end by then. */
export const countAt = (reps, t) => reps.filter(r => r.endTime <= t).length;
