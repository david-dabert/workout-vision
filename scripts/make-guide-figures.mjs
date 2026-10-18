// Animated figures for the exercises of the guide (18 October 2026). Each exercise's motion spec
// (test/real-phone/synth/motions/<key>.json, hand-posed from the usual technique: convention, angles UNSOURCED,
// experimental) is turned into a short loop, rest -> working end -> rest with a cosine ease, in the point format of the
// nine card figures (lift-poses.json: 33 MediaPipe points per frame, 4 base-36 digits per point). They illustrate the
// movement on the guide and filming screens; they are drawings, never measurements, and no count or parameter comes
// from them.
//   node scripts/make-guide-figures.mjs
// Writes src/components/experience/guide-poses.json (loaded lazily by guide-figure.js) and guide-figure-keys.json
// (the keys that have a figure, read at once so a screen keeps its layout while the figure loads).
//
// The pose: the spec's forward kinematics on a stick body (test/real-phone/template/fk.js, the renderer's rotations), its
// support (anchor, y, pin, planted) applied as synth.js applies it, the head's points placed around the nose.
// The view: the spec's own (front 0, left side 90), else the catalogue's (guide-families.json), as library.mjs reads it;
// a body lying along the camera's axis in a front view (|pitch| over 45 at rest) is drawn from the side instead, where
// it reads (a front camera sees a lying body end on); a movement mostly across the line of sight is drawn from the view
// that shows it (figureView). Status of these choices: convention (a drawing's readability), UNSOURCED. A side view is drawn facing right, as the card figures are, with
// the far side set a little back and up (an oblique projection: the drawn card figures' 26 px back, 6 px up).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { specLandmarks, specAt } from '../test/real-phone/template/fk.js';

const ROOT = new URL('../', import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, ROOT), 'utf8'));
const catalogue = read('src/lib/guide-catalog.json');
const families = read('src/lib/counting/guide-families.json');
const lift = read('src/components/experience/lift-poses.json');

const DIG = '0123456789abcdefghijklmnopqrstuvwxyz';
const F = 24; // frames per rep; the scene plays them at 12 a second (2 s a rep, as the card figures' 30 at 15)
const BOX = [770, 1000], M = 40, MAX_SCALE = 470; // px a metre at most: a standing body about the card figures' height
// Exercises whose spec makes no believable figure keep the guide's still drawing, each with the reason. Empty on
// 18 October 2026: the 300 figures were looked at as stills (rest, quarter, working end) and none drew a limb inverted,
// a body off its box or a view that hides the movement.
export const SKIP = {};

const add = (a, b, k = 1) => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = v => { const n = Math.hypot(...v) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
const mean = ps => ps.reduce((s, p) => add(s, p, 1 / ps.length), [0, 0, 0]);

// The pose at (uL, uR, swap) in the body frame (x the person's left, y up, z the way the body faces at rest).
function pose(spec, uL, uR, swap) {
  const P = specLandmarks(spec, uL, uR, swap).map(p => (p ? [p.x, -p.y, -p.z] : null));
  // The head (fk.js places the nose only): its frame from the shoulders' axis and the nose, which sits 0.17 m up and
  // 0.09 m forward of the neck's base in it; eyes, ears and mouth around the head's centre (UNSOURCED, a drawing).
  const shC = mean([P[11], P[12]]), x = unit(sub(P[11], P[12]));
  let n = sub(P[0], shC); n = unit(sub(n, x.map(v => v * dot(n, x))));
  const a = Math.atan2(0.09, 0.17), w = cross(x, n);
  const y = add(n.map(v => v * Math.cos(a)), w, -Math.sin(a)), z = add(n.map(v => v * Math.sin(a)), w, Math.cos(a));
  const c = add(shC, y, 0.2), at = (dx, dy, dz) => add(add(add(c, x, dx), y, dy), z, dz);
  // [left index, right index, offset on the left]: eyes inner, centre and outer, ears, mouth.
  for (const [l, r, [dx, dy, dz]] of [[1, 4, [0.012, 0.03, 0.075]], [2, 5, [0.03, 0.03, 0.07]], [3, 6, [0.045, 0.03, 0.06]], [7, 8, [0.075, 0.01, 0]], [9, 10, [0.022, -0.035, 0.07]]]) {
    P[l] = at(dx, dy, dz); P[r] = at(-dx, dy, dz);
  }
  return P;
}

// synth.js's support: the anchor's height, then the pinned points' mean kept where it is at rest.
const FEET = { left: [27, 29, 31], right: [28, 30, 32] }, HANDS = { left: [15], right: [16] };
export function supported(spec, uL, uR, swap) {
  const s = spec.support ?? {}, a = s.anchor ?? 'feet';
  const place = P => {
    const ys = a === 'feet' ? [27, 28, 29, 30, 31, 32].map(i => P[i][1]) : a === 'hands' ? [P[15][1], P[16][1]] : a === 'hips' ? [(P[23][1] + P[24][1]) / 2] : P.filter(Boolean).map(p => p[1]);
    const cur = a === 'hands' || a === 'hips' ? ys.reduce((t, v) => t + v, 0) / ys.length : Math.min(...ys);
    const target = s.y ?? (a === 'feet' ? 0 : a === 'lowest' ? 0.1 : a === 'hands' ? 2.1 : 0.55);
    return P.map(p => p && [p[0], p[1] + target - cur, p[2]]);
  };
  const pins = [].concat(s.pin === undefined ? (a === 'feet' || a === 'hands' ? a : []) : s.pin).filter(p => p === 'feet' || p === 'hands');
  let P = place(pose(spec, uL, uR, swap));
  if (!pins.length) return P;
  const sides = s.planted ? [swap ? (s.planted === 'left' ? 'right' : 'left') : s.planted]
    : spec.side ? [spec.side === 'left' ? 'right' : 'left']
    : spec.alternate === true && (uL > 0) !== (uR > 0) ? [uL > 0 ? 'right' : 'left'] : ['left', 'right'];
  const pinAt = Q => pins.reduce((t, g) => add(t, mean(sides.flatMap(sd => (g === 'feet' ? FEET : HANDS)[sd]).map(i => Q[i])), 1 / pins.length), [0, 0, 0]);
  const ref = pinAt(place(pose(spec, 0, 0, swap))), cur = pinAt(P), d = [ref[0] - cur[0], 0, ref[2] - cur[2]];
  return P.map(p => p && add(p, d));
}

// Each frame's sides: one rep, or two (alternate: left then right; mirror: then the mirrored pose).
export function frames(spec) {
  const us = Array.from({ length: F }, (_, i) => (1 - Math.cos(2 * Math.PI * i / F)) / 2);
  if (spec.alternate === true) return [...us.map(u => [u, 0, false]), ...us.map(u => [0, u, false])];
  if (spec.alternate === 'mirror') return [...us.map(u => [u, u, false]), ...us.map(u => [u, u, true])];
  if (spec.side === 'left') return us.map(u => [u, 0, false]);
  if (spec.side === 'right') return us.map(u => [0, u, false]);
  return us.map(u => [u, u, false]);
}

// How much of the movement a view shows: the points' travel on the drawing over their travel in space, over the loop.
export function shown(loop3, view) {
  let seen = 0, all = 0;
  const rest = project(loop3[0], view, false);
  for (const P of loop3) {
    const Q = project(P, view, false);
    for (let i = 11; i < 33; i++) { seen += Math.hypot(Q[i][0] - rest[i][0], Q[i][1] - rest[i][1]); all += Math.hypot(...sub(P[i], loop3[0][i])); }
  }
  return all > 1e-6 ? seen / all : 1;
}

// How much of the body's limbs a view shows: their drawn length over their length, over the loop (a limb pointing at
// the camera is drawn short: the arms of a prone T raise seen from the side).
const LIMBS = [[11, 13], [13, 15], [12, 14], [14, 16], [23, 25], [25, 27], [24, 26], [26, 28], [11, 23], [12, 24]];
export function posture(loop3, view) {
  let seen = 0, all = 0;
  for (const P of loop3) {
    const Q = project(P, view, false);
    for (const [a, b] of LIMBS) { seen += Math.hypot(Q[a][0] - Q[b][0], Q[a][1] - Q[b][1]); all += Math.hypot(...sub(P[a], P[b])); }
  }
  return seen / all;
}

export function figureView(key, spec, loop3) {
  let view = spec.view ?? (families[key]?.view === 'front' ? 0 : 90);
  if (view === 0 && Math.abs(specAt(spec, 'pitch', null, 0)) > 45) view = 90;
  // A movement mostly across the line of sight (a prone Y raise, a fire hydrant, a clamshell seen from the side) is
  // drawn from where it shows: the other view or the three-quarter one, when it shows half again as much of it.
  // A lying body is never drawn from the front (end on).
  const own = shown(loop3, view);
  if (own < 0.55) {
    let best = view, bestShown = own;
    for (const v of [0, 45, 90]) {
      if (v === 0 && Math.abs(specAt(spec, 'pitch', null, 0)) > 45) continue;
      const k = shown(loop3, v);
      if (k > bestShown * 1.5 && k > bestShown + 0.1) { best = v; bestShown = k; }
    }
    view = best;
  }
  return view;
}

// The body frame to the drawing's plane (x right, y down, metres): the camera turned by the view about the vertical.
function project(P, view, oblique = true) {
  const t = view * Math.PI / 180, r = [Math.cos(t), 0, -Math.sin(t)], c = [Math.sin(t), 0, Math.cos(t)], side = view !== 0, k = oblique ? 1 : 0;
  return P.map(p => {
    if (!p) return null;
    const d = dot(p, c);
    return side ? [-dot(p, r) + 0.15 * k * d, -p[1] + 0.035 * k * d] : [dot(p, r), -p[1]];
  });
}

const enc = Q => { let s = ''; for (let i = 0; i < 33; i++) { const x = Math.round(Q[i][0]), y = Math.round(Q[i][1]); s += DIG[Math.floor(x / 36)] + DIG[x % 36] + DIG[Math.floor(y / 36)] + DIG[y % 36]; } return s; };

export function makeFigure(key, spec) {
  const loop3 = frames(spec).map(([uL, uR, sw]) => supported(spec, uL, uR, sw));
  const view = figureView(key, spec, loop3), loop = loop3.map(P => project(P, view));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  // The head's top (0.12 m above its centre) and the box of every point over the loop.
  for (const Q of loop) for (const [i, p] of Q.entries()) { if (!p) continue; const top = i <= 10 ? 0.12 : 0; x0 = Math.min(x0, p[0] - top); x1 = Math.max(x1, p[0] + top); y0 = Math.min(y0, p[1] - top); y1 = Math.max(y1, p[1]); }
  const s = Math.min(MAX_SCALE, (BOX[0] - 2 * M) / (x1 - x0), (BOX[1] - 2 * M) / (y1 - y0));
  const ox = (BOX[0] - (x1 - x0) * s) / 2, oy = (BOX[1] - (y1 - y0) * s) / 2;
  const f = loop.map(Q => enc(Q.map(p => [ox + (p[0] - x0) * s, oy + (p[1] - y0) * s])));
  return { view: view === 0 ? 'front' : view === 90 ? 'side' : 'oblique', fps: 12, still: F / 2, loop: { vb: BOX, f } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = {};
  for (const e of catalogue) {
    const file = new URL(`test/real-phone/synth/motions/${e.key}.json`, ROOT);
    if (Object.hasOwn(lift, e.key) || SKIP[e.key] || !existsSync(file)) continue;
    out[e.key] = makeFigure(e.key, JSON.parse(readFileSync(file, 'utf8')));
  }
  writeFileSync(new URL('src/components/experience/guide-poses.json', ROOT), JSON.stringify(out));
  writeFileSync(new URL('src/components/experience/guide-figure-keys.json', ROOT), JSON.stringify(Object.keys(out)));
  const skipped = catalogue.filter(e => !out[e.key]).map(e => `${e.key}${SKIP[e.key] ? ` (${SKIP[e.key]})` : Object.hasOwn(lift, e.key) ? ' (card figure)' : ' (no spec)'}`);
  console.log(JSON.stringify({ figures: Object.keys(out).length, without: skipped }, null, 1));
}
