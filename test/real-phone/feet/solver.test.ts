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
function figure(pelvisDrop: (t: number) => number, leftLift: (t: number) => number, amp = 0) {
  return ts.map((_, t) => {
    const hipY = pelvisDrop(t); // pelvis height change, metres (positive = lower, y down)
    const g: Record<number, number[]> = {
      23: [0.1, hipY, 0], 24: [-0.1, hipY, 0],
      11: [0.18, hipY - 0.5, 0], 12: [-0.18, hipY - 0.5, 0],
      29: [0.12, 0.9 - leftLift(t), 0.03], 31: [0.12, 0.9 - leftLift(t), -0.15], 27: [0.12, 0.82 - leftLift(t), 0],
      30: [-0.12, 0.9, 0.03], 32: [-0.12, 0.9, -0.15], 28: [-0.12, 0.82, 0],
    };
    // knees: halfway down the leg, pushed forward as the pelvis drops (so the leg bends)
    g[25] = [0.12, (hipY + g[27][1]) / 2, -0.1 - hipY * 0.6];
    g[26] = [-0.12, (hipY + g[28][1]) / 2, -0.1 - hipY * 0.6];
    const mid = [0, hipY, 0];
    return Array.from({ length: 33 }, (_, j) => {
      const p = g[j] ?? [0, hipY - 0.6, 0];
      return { x: p[0] - mid[0] + noise(t, j, 0, amp), y: p[1] - mid[1] + noise(t, j, 1, amp), z: p[2] - mid[2] + noise(t, j, 2, amp), visibility: 0.9 };
    });
  });
}
const squat = (t: number) => 0.2 - 0.2 * Math.cos((2 * Math.PI * t) / 45); // 0 to 0.4 m and back, twice
const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs);

describe('the foot solver', () => {
  test('planted feet under a squatting pelvis: the root takes the 0.4 m drop and the feet stay still', () => {
    const wl = figure(squat, () => 0);
    const r = solveFeet(wl, ts, { mode: 'root', rootSigma: 0 });
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
});
