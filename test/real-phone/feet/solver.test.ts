// Unit checks of the foot solver (solver.js) on figures whose truth is known exactly: planted feet under a pelvis that
// drops 0.4 m (a squat), a foot lifted 0.25 m for a second (a step), and the two-bone IK. Runs in CI; bench only.
import { describe, expect, test } from 'vitest';
// @ts-expect-error: a JavaScript module without types
import { solveFeet, twoBoneIK } from './solver.js';

const N = 90, DT = 1 / 15;
const ts = Array.from({ length: N }, (_, t) => t * DT);
// A deterministic noise (no Math.random: the same figure on every run).
const noise = (t: number, j: number, k: number, amp: number) => amp * Math.sin(12.9898 * t + 78.233 * j + 37.719 * k) * Math.cos(4.1 * t + j);

/** A standing figure in global metres (y down, floor at y = 0.9 below the hips at rest), returned hip-centred as MediaPipe gives it. */
function figure(pelvisDrop: (t: number) => number, leftLift: (t: number) => number, amp = 0, footX = 0.12, kneeOnLine = false, n = N) {
  return Array.from({ length: n }, (_, t) => {
    const hipY = pelvisDrop(t); // pelvis height change, metres (positive = lower, y down)
    const g: Record<number, number[]> = {
      23: [0.1, hipY, 0], 24: [-0.1, hipY, 0],
      11: [0.18, hipY - 0.5, 0], 12: [-0.18, hipY - 0.5, 0],
      29: [footX, 0.9 - leftLift(t), 0.03], 31: [footX, 0.9 - leftLift(t), -0.15], 27: [footX, 0.82 - leftLift(t), 0],
      30: [-footX, 0.9, 0.03], 32: [-footX, 0.9, -0.15], 28: [-footX, 0.82, 0],
    };
    // knees: halfway down the leg, pushed forward as the pelvis drops (so the leg bends); or on the hip-ankle line, 1 cm
    // forward (a straight leg)
    const knee = (h: number[], a: number[]) => (kneeOnLine ? [(h[0] + a[0]) / 2, (h[1] + a[1]) / 2, -0.01] : [a[0], (h[1] + a[1]) / 2, -0.1 - hipY * 0.6]);
    g[25] = knee(g[23], g[27]);
    g[26] = knee(g[24], g[28]);
    const mid = [0, hipY, 0];
    return Array.from({ length: 33 }, (_, j) => {
      const p = g[j] ?? [0, hipY - 0.6, 0];
      return { x: p[0] - mid[0] + noise(t, j, 0, amp), y: p[1] - mid[1] + noise(t, j, 1, amp), z: p[2] - mid[2] + noise(t, j, 2, amp), visibility: 0.9 };
    });
  });
}
const squat = (t: number) => 0.2 - 0.2 * Math.cos((2 * Math.PI * t) / 45); // 0 to 0.4 m and back, twice
const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
const d3 = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('the foot solver', () => {
  test('planted feet under a squatting pelvis: the root takes the 0.4 m drop and the feet stay still', () => {
    const wl = figure(squat, () => 0);
    const r = solveFeet(wl, ts, { mode: 'root', rootSmooth: 0, rootSmoothZ: 0 });
    expect(r.contact.left.every(Boolean)).toBe(true);
    expect(r.contact.right.every(Boolean)).toBe(true);
    expect(range(r.root.map((p: number[]) => p[1]))).toBeCloseTo(0.4, 2);
    // in the global frame the heels do not move
    expect(range(r.global.map((f: any) => f[29].y))).toBeLessThan(1e-9);
  });

  test('with 1 cm of noise on every point, the root still takes the drop to within 2 cm and pinned feet slide under 1 mm', () => {
    const wl = figure(squat, () => 0, 0.01);
    const r = solveFeet(wl, ts, { mode: 'pin' });
    expect(Math.abs(range(r.root.map((p: number[]) => p[1])) - 0.4)).toBeLessThan(0.02);
    const steps = r.global.slice(10, 80).map((f: any, i: number, a: any[]) => (i ? Math.hypot(f[27].x - a[i - 1][27].x, f[27].y - a[i - 1][27].y, f[27].z - a[i - 1][27].z) : 0));
    expect(Math.max(...steps)).toBeLessThan(0.001);
  });

  test('a foot lifted 0.25 m for a second is not planted while it is up; the other foot stays planted', () => {
    const lift = (t: number) => (t >= 30 && t < 45 ? 0.25 : 0);
    const r = solveFeet(figure(() => 0, lift), ts, { mode: 'root' });
    expect(r.contact.left.slice(32, 44).some(Boolean)).toBe(false);
    expect(r.contact.left.slice(5, 25).every(Boolean)).toBe(true);
    expect(r.contact.right.every(Boolean)).toBe(true);
  });

  test('root mode leaves the landmarks untouched; pin mode moves no hip', () => {
    const wl = figure(squat, () => 0, 0.01);
    expect(solveFeet(wl, ts, { mode: 'root' }).world).toBe(wl);
    const pin = solveFeet(wl, ts, { mode: 'pin' });
    for (let t = 0; t < N; t++) for (const j of [23, 24, 11, 12]) for (const k of ['x', 'y', 'z']) expect(pin.world[t][j][k]).toBeCloseTo(wl[t][j][k], 9);
  });

  test('pinned, the whole foot (heel and toe as well as the ankle) stays still to under 1 mm through a noisy squat', () => {
    const r = solveFeet(figure(squat, () => 0, 0.01), ts, { mode: 'pin' });
    for (const j of [29, 31, 27]) {
      const steps = r.global.slice(10, 80).map((f: any, i: number, a: any[]) => (i ? Math.hypot(f[j].x - a[i - 1][j].x, f[j].y - a[i - 1][j].y, f[j].z - a[i - 1][j].z) : 0));
      expect(Math.max(...steps)).toBeLessThan(0.001);
    }
  });

  test('a plant beyond the leg\'s reach lowers the pelvis instead of leaving the foot short', () => {
    // for the middle third the feet read 8 cm lower under the hips: with the set's median leg lengths (pinFixed) the
    // planted feet are then out of reach of straight legs, even stretched by the soft reach
    const wl = figure(() => 0, () => 0).map((f: any, t: number) => (t >= 30 && t < 60 ? f.map((p: any, j: number) => ([27, 28, 29, 30, 31, 32].includes(j) ? { ...p, y: p.y + 0.08 } : p)) : f));
    const pin = solveFeet(wl, ts, { mode: 'pinFixed' }), only = solveFeet(wl, ts, { mode: 'root' });
    const plantY = pin.global[15][27].y;
    for (let t = 35; t < 55; t++) expect(Math.abs(pin.global[t][27].y - plantY)).toBeLessThan(0.002);
    expect(pin.root[45][1] - only.root[45][1]).toBeGreaterThan(0.003); // the pelvis went down (y down) to reach
    expect(pin.unreached).toBe(0);
  });

  test('two-bone IK keeps the bone lengths and reaches a reachable target', () => {
    const H = [0, 0, 0], K0 = [0, 0.4, -0.1], A = [0.05, 0.75, 0.1];
    const r = twoBoneIK(H, K0, A, 0.42, 0.4);
    expect(r.reached).toBe(true);
    expect(Math.hypot(r.K[0] - H[0], r.K[1] - H[1], r.K[2] - H[2])).toBeCloseTo(0.42, 6);
    expect(Math.hypot(r.A[0] - r.K[0], r.A[1] - r.K[1], r.A[2] - r.K[2])).toBeCloseTo(0.4, 6);
    expect(Math.hypot(r.A[0] - A[0], r.A[1] - A[1], r.A[2] - A[2])).toBeLessThan(1e-9);
    // the knee bends toward its pole (forward, -z)
    expect(r.K[2]).toBeLessThan(0);
  });

  // Regressions: the eight defects the independent check of 23 October 2026 found, each with its smallest failing case.
  test('D1 a step during a squat leaves the root on the pelvis path', () => {
    const r = solveFeet(figure(squat, t => (t >= 10 && t < 14 ? 0.25 : 0)), ts, { mode: 'root', rootSmooth: 0, rootSmoothZ: 0 });
    expect(range(r.root.map((p: number[], t: number) => p[1] - squat(t)))).toBeLessThan(0.005);
  });

  test('D2 a foot point whose visibility drops does not move the root', () => {
    const wl = figure(() => 0, () => 0).map((f: any, t: number) => (t >= 45 ? f.map((p: any, j: number) => (j === 31 ? { ...p, visibility: 0.2 } : p)) : f));
    expect(range(solveFeet(wl, ts, { mode: 'root' }).root.map((p: number[]) => p[2]))).toBeLessThan(0.005);
  });

  test('D3 one frame with no pose inside a plant does not move the pinned foot', () => {
    const wl: any[] = figure(squat, () => 0, 0.01); wl[45] = null;
    const r = solveFeet(wl, ts, { mode: 'pin' });
    expect(d3(r.global[46][27], r.global[44][27])).toBeLessThan(0.001);
  });

  test('D4 a nearly straight knee bends toward the leg\'s direction, not toward its 1 mm of noise', () => {
    expect(twoBoneIK([0.1, 0, 0], [0.1, 0.42, 0.001], [0.1, 0.79, 0], 0.42, 0.4, [0, 0, -1]).K[2]).toBeLessThan(0);
  });

  test('D4 straight legs under 1 cm of noise: the solved knees (rigid bones, the display mode) move about as much as the read ones', () => {
    const wl = figure(() => 0, () => 0, 0.01, 0.12, true);
    const r = solveFeet(wl, ts, { mode: 'pinFixed' });
    const step = (fr: any[], j: number) => { const d: number[] = []; for (let t = 1; t < N; t++) d.push(d3(fr[t][j], fr[t - 1][j])); return d.sort((a, b) => a - b)[d.length >> 1]; };
    for (const j of [25, 26]) expect(step(r.world, j)).toBeLessThan(1.5 * step(wl, j));
  });

  test('D5 wide stance, both plants out of reach: the pelvis gives way until both reach', () => {
    const wl = figure(() => 0, () => 0, 0, 0.5, true).map((f: any, t: number) => (t >= 30 && t < 60 ? f.map((p: any, j: number) => ([27, 28, 29, 30, 31, 32].includes(j) ? { ...p, y: p.y + 0.06 } : p)) : f));
    expect(solveFeet(wl, ts, { mode: 'pinFixed' }).unreached).toBe(0);
  });

  test('D6 a foot 0.25 m up is not planted because the other foot reads poorly', () => {
    const wl = figure(() => 0, t => (t >= 30 && t < 60 ? 0.25 : 0)).map((f: any) => f.map((p: any, j: number) => ([28, 30, 32].includes(j) ? { ...p, visibility: 0.1 } : p)));
    expect(solveFeet(wl, ts, { mode: 'root' }).contact.left.slice(32, 58).some(Boolean)).toBe(false);
  });

  test('D7 with the image gate, no contact is shorter than minContact', () => {
    const wl = figure(() => 0, t => (t >= 40 ? 0.25 : 0));
    const image = wl.map((f: any, t: number) => f.map((p: any, j: number) => ({ x: 0.5 + p.x * 0.5 + ([29, 31].includes(j) && t < 37 ? 0.02 * t : 0), y: 0.5 + p.y * 0.5, z: 0, visibility: 0.9 })));
    const c = solveFeet(wl, ts, { mode: 'root', image, frame: { width: 1000, height: 1000 } }).contact.left;
    const runs: number[] = []; for (let t = 0; t < N;) { if (!c[t]) { t++; continue; } let e = t; while (e < N && c[e]) e++; runs.push(e - t); t = e; }
    expect(runs.length ? Math.min(...runs) : 3).toBeGreaterThanOrEqual(3);
  });

  test('D8 with no smoothing asked, the root is unsmoothed on every axis', () => {
    const wl = figure(() => 0, () => 0).map((f: any, t: number) => f.map((p: any, j: number) => ([27, 28, 29, 30, 31, 32].includes(j) && t >= 45 ? { ...p, z: p.z + 0.05 } : p)));
    const r = solveFeet(wl, ts, { mode: 'root', rootSmooth: 0, rootSmoothZ: 0 });
    expect(Math.abs(r.root[44][2] - r.root[40][2])).toBeLessThan(1e-9);
  });

  test('a lifted foot keeps its pose under the hips when the planted leg moves the pelvis', () => {
    const wl = figure(() => 0, t => (t >= 30 && t < 60 ? 0.25 : 0)).map((f: any, t: number) => (t >= 30 && t < 60 ? f.map((p: any, j: number) => ([28, 30, 32].includes(j) ? { ...p, y: p.y + 0.05 } : p)) : f));
    const r = solveFeet(wl, ts, { mode: 'pinFixed' });
    const rel = (fr: any[], t: number) => d3(fr[t][27], fr[t][23]);
    expect(Math.abs(rel(r.world, 45) - rel(wl, 45))).toBeLessThan(0.002);
  });

  test('a non-finite coordinate does not spread', () => {
    const wl: any[] = figure(squat, () => 0, 0.01); wl[45] = wl[45].map((p: any, j: number) => (j === 29 ? { ...p, z: NaN } : p));
    const r = solveFeet(wl, ts, { mode: 'pin' });
    expect(r.root.filter((p: number[] | null) => p && !p.every(Number.isFinite)).length).toBe(0);
  });

  // Regressions from the second independent check of 23 October 2026: one test per mechanism a deliberate break left
  // uncaught, and the defects it found.
  const runsOf = (c: boolean[]) => { const rs: number[][] = []; for (let t = 0; t < c.length;) { if (!c[t]) { t++; continue; } let e = t; while (e < c.length && c[e]) e++; rs.push([t, e]); t = e; } return rs; };
  const P3 = (p: any) => [p.x, p.y, p.z];

  test('hysteresis: a foot that rises to 0.1 leg lengths after a plant (between liftIn and liftOut) stays planted', () => {
    expect(solveFeet(figure(() => 0, t => (t >= 30 ? 0.082 : 0)), ts, { mode: 'root' }).contact.left.slice(30).every(Boolean)).toBe(true);
  });

  test('gap filling: a 2-sample lift does not split the plant', () => {
    expect(runsOf(solveFeet(figure(() => 0, t => (t >= 44 && t < 46 ? 0.25 : 0)), ts, { mode: 'root' }).contact.left).length).toBe(1);
  });

  test('the image gate: a foot low in the world but fast in the image is not planted', () => {
    const wl = figure(() => 0, () => 0);
    const image = wl.map((f: any, t: number) => f.map((p: any, j: number) => ({ x: 0.5 + p.x * 0.5 + ([29, 31].includes(j) && t >= 30 && t < 60 ? 0.03 * t : 0), y: 0.5 + p.y * 0.5, z: 0 })));
    expect(solveFeet(wl, ts, { mode: 'root', image, frame: { width: 1000, height: 1000 } }).contact.left.slice(34, 56).some(Boolean)).toBe(false);
  });

  test('root smoothing: a 5 cm step of the feet becomes a ramp; depth is smoothed even with rootSmooth 0', () => {
    const step = (axis: 'x' | 'z') => figure(() => 0, () => 0).map((f: any, t: number) => f.map((p: any, j: number) => ([27, 28, 29, 30, 31, 32].includes(j) && t >= 45 ? { ...p, [axis]: p[axis] + 0.05 } : p)));
    const r = solveFeet(step('x'), ts, { mode: 'root' });
    expect(Math.abs(r.root[45][0] - r.root[44][0])).toBeLessThan(0.02);
    const z = solveFeet(step('z'), ts, { mode: 'root', rootSmooth: 0 });
    expect(Math.abs(z.root[45][2] - z.root[44][2])).toBeLessThan(0.01);
  });

  test('smoothing is set in seconds: the same step rises over the same time at 15 and 30 Hz', () => {
    const rise = (hz: number) => {
      const n = 6 * hz, tt = Array.from({ length: n }, (_, t) => t / hz);
      const wl = figure(() => 0, () => 0, 0, 0.12, false, n).map((f: any, t: number) => f.map((p: any, j: number) => ([27, 28, 29, 30, 31, 32].includes(j) && t >= n / 2 ? { ...p, x: p.x + 0.05 } : p)));
      const xs = solveFeet(wl, tt, { mode: 'root', rootSmoothZ: 0 }).root.map((p: number[]) => p[0]);
      const lo = xs[0], hi = xs[n - 1], fr = (v: number) => (v - lo) / (hi - lo);
      return (xs.findIndex((v: number) => fr(v) >= 0.9) - xs.findIndex((v: number) => fr(v) >= 0.1)) / hz;
    };
    expect(Math.abs(rise(15) - rise(30))).toBeLessThan(0.04);
  });

  test('floor placement: a foot read 3 cm lower than the other is planted on the floor like it', () => {
    const wl = figure(() => 0, () => 0).map((f: any) => f.map((p: any, j: number) => ([27, 29, 31].includes(j) ? { ...p, y: p.y + 0.03 } : p)));
    const r = solveFeet(wl, ts, { mode: 'pin' });
    for (const f of r.global.slice(5, 85)) { expect(Math.abs(Math.max(f[29].y, f[31].y) - r.floor)).toBeLessThan(1e-3); expect(Math.abs(Math.max(f[30].y, f[32].y) - r.floor)).toBeLessThan(1e-3); }
  });

  test('the fade: a plant 5 cm from the read ankle is eased in, not jumped to', () => {
    const wl = figure(() => 0, t => (t < 30 ? 0.25 : 0)).map((f: any, t: number) => (t >= 30 && t < 33 ? f.map((p: any, j: number) => ([27, 29, 31].includes(j) ? { ...p, x: p.x + 0.05 } : p)) : f));
    const r = solveFeet(wl, ts, { mode: 'pin' }), c0 = r.contact.left.indexOf(true, 25);
    expect(d3(r.global[c0][27], solveFeet(wl, ts, { mode: 'root' }).global[c0][27])).toBeLessThan(0.015);
  });

  test('a faded plant whose read foot is below the floor stays above it', () => {
    const wl = figure(squat, t => (t >= 30 && t < 45 ? 0.25 : 0), 0.005).map((f: any, t: number) => ([28, 29, 45, 46, 47].includes(t) ? f.map((p: any, j: number) => ([27, 29, 31].includes(j) ? { ...p, y: p.y + 0.04 } : p)) : f));
    const r = solveFeet(wl, ts, { mode: 'pin' });
    for (const f of r.global) for (const i of [29, 31]) expect(f[i].y).toBeLessThanOrEqual(r.floor + 1e-6);
  });

  test('an unplanted foot read below the floor is lifted to it', () => {
    const wl = figure(() => 0, t => (t >= 30 && t < 45 ? (t === 37 ? -0.04 : 0.25) : 0));
    const r = solveFeet(wl, ts, { mode: 'pin' });
    expect(r.contact.left[37]).toBe(false);
    expect(Math.max(r.global[37][29].y, r.global[37][31].y)).toBeLessThanOrEqual(r.floor + 1e-6);
  });

  test('a plant out of reach below: the pelvis is lowered straight down', () => {
    const wl = figure(() => 0, () => 0, 0, 0.12, true).map((f: any, t: number) => (t >= 30 && t < 60 ? f.map((p: any, j: number) => ([27, 29, 31].includes(j) ? { ...p, y: p.y + 0.08 } : p)) : f));
    const a = solveFeet(wl, ts, { mode: 'pinFixed' }), b = solveFeet(wl, ts, { mode: 'root' });
    const v = [0, 1, 2].map(k => a.root[45][k] - b.root[45][k]);
    expect(v[1]).toBeGreaterThan(0.01);
    expect(Math.hypot(v[0], v[2])).toBeLessThan(1e-6);
  });

  test('a plant horizontally out of reach: the pelvis moves toward it and the foot stays on its plant', () => {
    const wl = figure(() => 0, () => 0, 0, 0.12, true).map((f: any, t: number) => f.map((p: any, j: number) => {
      const q = { ...p };
      if (t >= 32 && t < 62 && [27, 29, 31].includes(j)) q.x = p.x + 0.83;
      if (t >= 32 && t < 62 && j === 25) q.x = (0.1 + 0.95) / 2;
      if (((t >= 24 && t < 28) || (t >= 62 && t < 66)) && [27, 29, 31].includes(j)) q.y -= 0.25;
      return q;
    }));
    const r = solveFeet(wl, ts, { mode: 'pinFixed' }), only = solveFeet(wl, ts, { mode: 'root' });
    // the plant: the median of the read (root-placed) ankle over the run, set on the floor
    const run = runsOf(r.contact.left).find(([a, b]) => a <= 46 && b > 46)!;
    const xs = only.global.slice(run[0], run[1]).map((f: any) => f[27].x).sort((a: number, b: number) => a - b);
    for (let t = run[0] + 3; t < run[1] - 3; t++) expect(Math.abs(r.global[t][27].x - xs[xs.length >> 1])).toBeLessThan(1e-3);
    expect(r.unreached).toBe(0); // the faded first and last samples too
  });

  test('the drop takes the largest need: two plants below reach by different amounts are both met', () => {
    // the left foot is planted only on t 28-61 (lifted before and after), so its plant sits where it reads then; both
    // feet read lower under the hips on t 30-59, by different amounts, so the two plants need different drops
    const wl = figure(() => 0, t => (t < 28 || t >= 62 ? 0.25 : 0), 0, 0.12, true).map((f: any, t: number) => (t >= 30 && t < 60 ? f.map((p: any, j: number) => ([27, 29, 31].includes(j) ? { ...p, y: p.y + 0.08 } : [28, 30, 32].includes(j) ? { ...p, y: p.y + 0.05 } : p)) : f));
    const r = solveFeet(wl, ts, { mode: 'pinFixed' }), only = solveFeet(wl, ts, { mode: 'root' });
    expect(r.unreached).toBe(0);
    // one vertical drop serves both: the pelvis moves straight down
    const v = [0, 1, 2].map(k => r.root[45][k] - only.root[45][k]);
    expect(v[1]).toBeGreaterThan(0.01);
    expect(Math.hypot(v[0], v[2])).toBeLessThan(1e-6);
  });

  test('a jump in the timestamps longer than maxGap, with no lost frame, ends the plant', () => {
    const tj = ts.map((t, i) => (i >= 45 ? t + 0.6 : t));
    const wl = figure(() => 0, () => 0).map((f: any, t: number) => (t >= 45 ? f.map((p: any, j: number) => ([25, 27, 29, 31].includes(j) ? { ...p, x: p.x + 0.2 } : p)) : f));
    const r = solveFeet(wl, tj, { mode: 'pin', rootSmooth: 0, rootSmoothZ: 0 });
    expect(Math.abs(r.global[60][27].x - r.global[20][27].x - 0.2)).toBeLessThan(0.01);
  });

  test('with no plant at all, pinFixed still solves every leg with the set\'s lengths', () => {
    // both feet fast in the image on every sample: nothing is planted, there is no floor
    const wl = figure(() => 0, () => 0, 0.01);
    const image = wl.map((f: any, t: number) => f.map((p: any, j: number) => ({ x: 0.5 + p.x * 0.5 + ([29, 30, 31, 32].includes(j) ? 0.05 * (t % 2) : 0), y: 0.5 + p.y * 0.5, z: 0 })));
    const r = solveFeet(wl, ts, { mode: 'pinFixed', image, frame: { width: 1000, height: 1000 } });
    expect(r.floor).toBeNull();
    // the set's shin length, stretched by at most the soft reach (3 %) near full extension; the read shin varies more
    const shin = r.world.map((f: any) => d3(f[27], f[25])), read = wl.map((f: any) => d3(f[27], f[25]));
    expect(Math.max(...shin) / Math.min(...shin)).toBeLessThan(1.031);
    expect(Math.max(...shin) / Math.min(...shin)).toBeLessThan(Math.max(...read) / Math.min(...read));
    expect(r.pinned).toBeGreaterThan(0);
  });

  test('an unplanted leg out of reach does not drag the pelvis', () => {
    // straight legs; the left leg raised 35 degrees forward and unplanted on t 30-59; at t 45 read 4 % longer
    const th = (35 * Math.PI) / 180;
    const wl = figure(() => 0, () => 0, 0, 0.12, true).map((f: any, t: number) => {
      if (t < 30 || t >= 60) return f;
      const H = P3(f[23]);
      return f.map((p: any, j: number) => {
        if (![25, 27, 29, 31].includes(j)) return p;
        const v = [p.x - H[0], p.y - H[1], p.z - H[2]];
        let q = [H[0] + v[0], H[1] + v[1] * Math.cos(th) + v[2] * Math.sin(th), H[2] - v[1] * Math.sin(th) + v[2] * Math.cos(th)];
        if (t === 45 && j !== 25) q = q.map((x, i) => x + (q[i] - H[i]) * 0.04);
        return { ...p, x: q[0], y: q[1], z: q[2] };
      });
    });
    const fx = solveFeet(wl, ts, { mode: 'pinFixed' }), rt = solveFeet(wl, ts, { mode: 'root' });
    expect(fx.contact.left.slice(32, 58).some(Boolean)).toBe(false);
    expect(Math.hypot(...[0, 1, 2].map(k => fx.root[45][k] - rt.root[45][k]))).toBeLessThan(0.005);
    expect(fx.unreached).toBeGreaterThan(0); // the lifted leg cannot reach its read ankle with the set's lengths: said, not hidden
  });

  test('a step hidden in a gap longer than maxGap does not drag the root', () => {
    const wl: any[] = figure(() => 0, () => 0).map((f: any, t: number) => (t >= 45 ? f.map((p: any, j: number) => ([25, 27, 29, 31].includes(j) ? { ...p, x: p.x + 0.2 } : p)) : f));
    for (let t = 30; t < 45; t++) wl[t] = null;
    const xs = solveFeet(wl, ts, { mode: 'root', rootSmooth: 0, rootSmoothZ: 0 }).root.filter(Boolean).map((p: number[]) => p[0]);
    expect(range(xs)).toBeLessThan(0.01);
    // and the plant after the gap is a new plant where the foot now stands, not the old one stretched over both
    const pin = solveFeet(wl, ts, { mode: 'pin', rootSmooth: 0, rootSmoothZ: 0 });
    expect(Math.abs(pin.global[60][27].x - pin.global[20][27].x - 0.2)).toBeLessThan(0.01);
  });

  test('the knee\'s bending direction is continuous around poleMin, and a knee read behind keeps forward', () => {
    const at = (z: number) => twoBoneIK([0.1, 0, 0], [0.1, 0.42, z], [0.1, 0.79, 0], 0.42, 0.4, [0, 0, -1], 0.02, 0.03).K;
    const a = at(0.0199), b = at(0.0201);
    expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeLessThan(0.01);
    expect(a[2]).toBeLessThan(0);
  });

  test('a valgus knee keeps its own direction', () => {
    // goal at the read ankle, the knee read 30 mm to the side of the hip-ankle line, own lengths
    const H = [0.1, 0, 0], A = [0.1, 0.8, 0], K0 = [0.13, 0.4, 0];
    const a = Math.hypot(K0[0] - H[0], K0[1] - H[1]), b = Math.hypot(A[0] - K0[0], A[1] - K0[1]);
    const r = twoBoneIK(H, K0, A, a, b, [0, 0, -1], 0.02, 0);
    expect(Math.hypot(r.K[0] - K0[0], r.K[1] - K0[1], r.K[2] - K0[2])).toBeLessThan(0.005);
  });

  test('pin mode meets a goal at the read ankle exactly: a straight leg stays as read', () => {
    const wl = figure(() => 0, () => 0, 0, 0.12, true);
    const r = solveFeet(wl, ts, { mode: 'pin' });
    for (let t = 10; t < 80; t++) expect(d3(r.world[t][25], wl[t][25])).toBeLessThan(1e-6);
  });

  test('pin mode uses no soft reach: straight legs under 1 cm of noise are not bent by the solve', () => {
    const wl = figure(() => 0, () => 0, 0.01, 0.12, true);
    const r = solveFeet(wl, ts, { mode: 'pin' });
    const flex = (f: any) => { const h = P3(f[23]), k = P3(f[25]), a = P3(f[27]); const u = [h[0] - k[0], h[1] - k[1], h[2] - k[2]], w = [a[0] - k[0], a[1] - k[1], a[2] - k[2]]; return 180 - (Math.acos((u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (Math.hypot(...u) * Math.hypot(...w))) * 180) / Math.PI; };
    const d = Array.from({ length: 70 }, (_, i) => flex(r.world[i + 10]) - flex(wl[i + 10])).sort((x, y) => x - y);
    expect(d[35]).toBeLessThan(3);
  });

  test('straight legs, the knee read 1 mm to either side: the rigid skeleton\'s knee stays forward', () => {
    const wl = figure(() => 0, () => 0, 0, 0.12, true).map((f: any, t: number) => f.map((p: any, j: number) => (j === 25 ? { ...p, z: t % 2 ? 0.001 : -0.001 } : [27, 29, 31].includes(j) ? { ...p, x: p.x + (t % 2 ? 0.0005 : -0.0005) } : p)));
    for (const f of solveFeet(wl, ts, { mode: 'pinFixed' }).world) expect(f[25].z).toBeLessThan(0);
  });

  test('a non-finite knee leaves that frame\'s ankle and foot finite, and the frame has no global pose', () => {
    const wl: any[] = figure(squat, () => 0, 0.01); wl[45] = wl[45].map((p: any, j: number) => (j === 25 ? { ...p, x: NaN } : p));
    const r = solveFeet(wl, ts, { mode: 'pin' });
    for (const j of [27, 29, 31]) expect(Number.isFinite(r.world[45][j].x)).toBe(true);
    expect(r.global[45]).toBeNull();
  });

  test('twoBoneIK reports a goal out of reach', () => {
    expect(twoBoneIK([0, 0, 0], [0, 0.4, -0.1], [0, 1.2, 0], 0.42, 0.4, null, 0.02, 0.03).reached).toBe(false);
  });

  test('three samples with no pose inside a plant do not split it', () => {
    const wl: any[] = figure(squat, () => 0, 0.01); for (const k of [44, 45, 46]) wl[k] = null;
    const r = solveFeet(wl, ts, { mode: 'pin' });
    expect(d3(r.global[47][27], r.global[43][27])).toBeLessThan(1e-3);
  });

  test('the leg length is the mean of the two legs', () => {
    const wl = figure(() => 0, () => 0).map((f: any) => f.map((p: any, j: number) => (j === 26 ? { ...p, z: p.z - 0.2 } : p)));
    const L = (q: any) => d3(q[25], q[23]) + d3(q[27], q[25]), R = (q: any) => d3(q[26], q[24]) + d3(q[28], q[26]);
    expect(Math.abs(solveFeet(wl, ts, { mode: 'root' }).leg - (L(wl[0]) + R(wl[0])) / 2)).toBeLessThan(1e-9);
  });
});
