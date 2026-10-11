// Drawn side-view figures for the lifts that have no recorded clip yet (squat, bench
// press, hip thrust, Romanian deadlift, leg press). They illustrate the movement on the
// choice card and the filming screen; they are drawings, not measurements, and no count
// or parameter comes from them. Writes them into src/components/experience/lift-poses.json
// in the format of the recorded ones: 33 MediaPipe points per frame.
//   node scripts/make-lift-poses.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../src/components/experience/lift-poses.json', import.meta.url);
const DIG = '0123456789abcdefghijklmnopqrstuvwxyz';
const rad = d => d * Math.PI / 180;
// A segment of length l at angle a (degrees clockwise from straight up).
const L = (l, a) => [l * Math.sin(rad(a)), -l * Math.cos(rad(a))];
const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
const len = v => Math.hypot(v[0], v[1]);
const unit = v => { const n = len(v) || 1; return [v[0] / n, v[1] / n]; };
// The middle joint of a two-segment limb from a to c; side +1 or -1 picks the bend.
function ik(a, c, l1, l2, side) {
  const d = Math.min(len(sub(c, a)), l1 + l2 - 1e-3), u = unit(sub(c, a));
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  return [a[0] + u[0] * x - side * u[1] * h, a[1] + u[1] * x + side * u[0] * h];
}
const TH = 230, SH = 230, TO = 290, UA = 160, FA = 150;

// Near-side joints at phase s (0 = rest, 1 = the other end of the rep).
const LIFTS = {
  squat(s) {
    const an = [330, 930], kn = add(an, L(SH, 32 * s)), hip = add(kn, L(TH, 32 * s - 115 * s));
    // Arms held forward, as in a bodyweight or goblet squat, so the figure reads from the side.
    const sh = add(hip, L(TO, 45 * s)), el = add(sh, L(UA, 95)), wr = add(el, L(FA, 90));
    return { sh, el, wr, hip, kn, an };
  },
  romanian_deadlift(s) {
    const an = [330, 930], kn = add(an, L(SH, 14 * s)), hip = add(kn, L(TH, -28 * s));
    const sh = add(hip, L(TO, 80 * s)), el = add(sh, L(UA, 180)), wr = add(el, L(FA, 180));
    return { sh, el, wr, hip, kn, an };
  },
  leg_press(s) {
    const hip = [260, 640], sh = add(hip, L(TO, -42));
    const an = add(hip, L(440 - 190 * s, 55)), kn = ik(hip, an, TH, SH, -1);
    const wr = add(hip, [10, -25]), el = ik(sh, wr, UA, FA, 1);
    return { sh, el, wr, hip, kn, an };
  },
  hip_thrust(s) {
    const an = [560, 860], hip = [330 + 30 * s, 820 - 220 * s];
    const sh = add(hip, [...unit(sub([150, 560], hip))].map(v => v * TO)), kn = ik(hip, an, TH, SH, -1);
    const wr = add(hip, [0, -22]), el = ik(sh, wr, UA, FA, 1);
    return { sh, el, wr, hip, kn, an };
  },
  bench_press(s) {
    const sh = [250, 600], hip = [540, 612], kn = add(hip, L(TH, 62)), an = add(kn, L(SH, 172));
    const wr = add(sh, [18, -300 + 250 * s]), el = ik(sh, wr, UA, FA, 1);
    return { sh, el, wr, hip, kn, an };
  },
};

// All 33 points from the near-side joints; the far side sits a little behind.
function points(j) {
  const P = new Array(66).fill(NaN), set = (i, p) => { P[i * 2] = p[0]; P[i * 2 + 1] = p[1]; };
  const far = p => add(p, [-26, -6]);
  const up = unit(sub(j.sh, j.hip)), fwd = [up[1] * -1, up[0]].map(v => -v); // perpendicular, facing +x when standing
  const head = add(j.sh, [up[0] * 105, up[1] * 105]);
  const f = (p, a, b) => add(p, [fwd[0] * a + up[0] * b, fwd[1] * a + up[1] * b]);
  set(0, f(head, 34, 0)); set(1, f(head, 22, 10)); set(2, f(head, 24, 12)); set(3, f(head, 26, 12));
  set(4, f(head, 20, 10)); set(5, f(head, 18, 12)); set(6, f(head, 16, 12)); set(7, f(head, -6, 6)); set(8, far(f(head, -6, 6)));
  set(9, f(head, 28, -14)); set(10, f(head, 26, -14));
  const hand = (wr, el) => { const d = unit(sub(wr, el)); return [add(wr, [d[0] * 22, d[1] * 22]), add(wr, [d[0] * 18 + 6, d[1] * 18]), add(wr, [d[0] * 14 - 4, d[1] * 14 + 4])]; };
  const [p17, p19, p21] = hand(j.wr, j.el);
  set(11, j.sh); set(13, j.el); set(15, j.wr); set(17, p17); set(19, p19); set(21, p21);
  set(12, far(j.sh)); set(14, far(j.el)); set(16, far(j.wr)); set(18, far(p17)); set(20, far(p19)); set(22, far(p21));
  const shin = unit(sub(j.an, j.kn)), toe = [shin[1] * -1, shin[0]].map(v => -v);
  const heel = add(j.an, [shin[0] * 18 - toe[0] * 16, shin[1] * 18 - toe[1] * 16]), foot = add(j.an, [shin[0] * 22 + toe[0] * 58, shin[1] * 22 + toe[1] * 58]);
  set(23, j.hip); set(25, j.kn); set(27, j.an); set(29, heel); set(31, foot);
  set(24, far(j.hip)); set(26, far(j.kn)); set(28, far(j.an)); set(30, far(heel)); set(32, far(foot));
  return P;
}

const FRAMES = 30, M = 40;
const poses = JSON.parse(readFileSync(FILE, 'utf8'));
for (const [lift, fn] of Object.entries(LIFTS)) {
  const loop = Array.from({ length: FRAMES }, (_, i) => points(fn((1 - Math.cos(2 * Math.PI * i / FRAMES)) / 2)));
  const rest = points(fn(0)), top = points(fn(1)), all = [...loop, rest, top];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const P of all) for (let i = 0; i < 66; i += 2) if (!Number.isNaN(P[i])) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]); }
  const w = x1 - x0 + 2 * M, hRaw = y1 - y0 + 2 * M, h = Math.max(hRaw, w * 1.3), dy = (h - hRaw) / 2;
  const shift = P => P.map((v, i) => Number.isNaN(v) ? NaN : i % 2 === 0 ? v - x0 + M : v - y0 + M + dy);
  const enc = P => { let s = ''; for (let i = 0; i < 33; i++) { const x = Math.round(P[i * 2]), y = Math.round(P[i * 2 + 1]); s += DIG[Math.floor(x / 36)] + DIG[x % 36] + DIG[Math.floor(y / 36)] + DIG[y % 36]; } return s; };
  const flat = P => shift(P).map(v => (Number.isNaN(v) ? -1 : Math.round(v * 10) / 10));
  poses[lift] = { view: 'side', arm: 'left', drawn: true, loop: { vb: [Math.round(w), Math.round(h)], f: loop.map(P => enc(shift(P))) }, rest: { vb: [Math.round(w), Math.round(h)], p: flat(rest) }, top: { vb: [Math.round(w), Math.round(h)], p: flat(top) } };
  console.log(lift, 'box', Math.round(w), 'x', Math.round(h));
}
writeFileSync(FILE, JSON.stringify(poses));
