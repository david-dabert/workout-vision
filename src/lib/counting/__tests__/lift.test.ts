/**
 * The prone Y raise read as the arm's lift against gravity (core.ts, LiftDefinition.lift; 8 October 2026). A body lies
 * face down along x, the arms overhead in a Y; each wrist rises above its shoulder on every rep. The three-point
 * shoulder angle in space barely moves on that motion (why the exercise had no counter); the lift does, the same from
 * either side of the body and whichever way the body lies. Angles and noise are illustrative (UNSOURCED): a lift from
 * 3 degrees under level to 13 above, as on the exercise's motion spec (test/real-phone/synth/motions/prone_y_raise.json).
 */
import { describe, expect, it } from 'vitest';
import { countReps, liftAngleDeg, liftDefinition, JOINT_POINTS, type WorldLandmarkFrame } from '../core';
import { cycles, gaussian, sample, seeded, timestamps } from './synthetic';

const D = Math.PI / 180;
const pt = (x: number, y: number, z: number) => ({ x, y, z, visibility: 0.9 });

/**
 * A body lying face down along +x (head towards +x, or -x when `towards` is -1), the left arm at `lift` degrees above
 * level and the right at `right` (the same by default), 45 degrees out; the right arm seen at `rightVis`.
 */
function prone(left: number, towards = 1, right = left, rightVis = 0.9): WorldLandmarkFrame {
  const f = Array.from({ length: 33 }, () => pt(0, 0, 0));
  for (const [sh, el, wr, hip, side] of [[11, 13, 15, 23, 1], [12, 14, 16, 24, -1]] as const) {
    const lift = side > 0 ? left : right, vis = side > 0 ? 0.9 : rightVis;
    const pt = (x: number, y: number, z: number) => ({ x, y, z, visibility: vis });
    const s = pt(towards * 0.5, -0.05, side * 0.18);
    // The arm: overhead (along the body's axis), 45 degrees out, raised `lift` degrees above level.
    const dir = (len: number) => pt(s.x + towards * len * Math.cos(lift * D) * Math.cos(45 * D), s.y - len * Math.sin(lift * D), s.z + side * len * Math.cos(lift * D) * Math.sin(45 * D));
    f[sh] = s; f[el] = dir(0.29); f[wr] = dir(0.55); f[hip] = pt(0, 0, side * 0.09);
  }
  return f;
}

describe('the lift of a limb against gravity', () => {
  it('reads 180 level, above 180 rising, below falling, whatever the direction the limb points in', () => {
    const v = pt(0, 0, 0);
    expect(liftAngleDeg(v, pt(1, 0, 0))).toBeCloseTo(180, 6);
    expect(liftAngleDeg(v, pt(0, 0, -1))).toBeCloseTo(180, 6);
    expect(liftAngleDeg(v, pt(Math.cos(10 * D), -Math.sin(10 * D), 0))).toBeCloseTo(190, 6);
    expect(liftAngleDeg(v, pt(0, -Math.sin(10 * D), -Math.cos(10 * D)))).toBeCloseTo(190, 6);
    expect(liftAngleDeg(v, pt(-Math.cos(5 * D), Math.sin(5 * D), 0))).toBeCloseTo(175, 6);
  });

  it('counts the prone Y raise on it, where the three-point shoulder angle barely moves', () => {
    const def = liftDefinition('prone_y_raise')!;
    expect(def).toMatchObject({ joint: 'shoulder', rest: 'low', first: 'concentric', lift: true, minRangeDeg: 10 });
    expect(def.eitherSide).toBeUndefined();
    const sps = 30;
    const lifts = sample(cycles({ rest: -3, work: 13, firstSec: 1.2, secondSec: 0.8 }), -3, sps);
    for (const towards of [1, -1]) {
      const frames = lifts.map(l => prone(l, towards));
      const res = countReps(frames, timestamps(frames.length, sps), 'prone_y_raise');
      expect(res.count, `head towards ${towards > 0 ? '+x' : '-x'}`).toBe(10);
      const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
      expect(median(res.reps.map(r => r.concentricSec))).toBeGreaterThan(median(res.reps.map(r => r.eccentricSec)));
    }
    // The three-point angle hip-shoulder-elbow over the same rep: about 2 degrees, under any range floor.
    const [a, b, c] = JOINT_POINTS.shoulder.left;
    const three = [-3, 13].map(l => { const f = prone(l)!; const u = [f[a].x - f[b].x, f[a].y - f[b].y, f[a].z - f[b].z], w = [f[c].x - f[b].x, f[c].y - f[b].y, f[c].z - f[b].z]; return Math.acos((u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / Math.hypot(...u) / Math.hypot(...w)) / D; });
    expect(Math.abs(three[1] - three[0])).toBeLessThan(3);
  });

  it('counts a lift over the 10-degree floor and none under it', () => {
    const sps = 30;
    for (const [swing, reps] of [[14, 10], [8, 0]] as const) {
      const lifts = sample(cycles({ rest: -3, work: -3 + swing, firstSec: 1.2, secondSec: 0.8 }), -3, sps);
      const frames = lifts.map(l => prone(l));
      expect(countReps(frames, timestamps(frames.length, sps), 'prone_y_raise').count, `${swing} degrees`).toBe(reps);
    }
  });

  it('counts the better seen arm, so a far arm wobbling past the floor adds no rep (review of 8 October)', () => {
    // The near arm still (2 degrees of noise); the far arm, seen less well, wobbling 6 degrees either way every 1.5 s.
    // Counted on the arm with more reps (eitherSide, the first form) this read 7.
    const rng = seeded(8), sps = 15, n = 20 * sps;
    const frames = Array.from({ length: n }, (_, i) => prone(-3 + gaussian(rng, 2), 1, -3 + 6 * Math.sin((2 * Math.PI * i) / sps / 1.5), 0.7));
    expect(countReps(frames, timestamps(n, sps), 'prone_y_raise').count).toBe(0);
  });
});
