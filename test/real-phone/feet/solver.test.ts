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
function figure(pelvisDrop: (t: number) => number, leftLift: (t: number) => number, amp = 0, footX = 0.12, kneeOnLine = false) {
  return ts.map((_, t) => {
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
});
