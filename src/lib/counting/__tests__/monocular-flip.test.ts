import { describe, expect, it } from 'vitest';
import { countReps } from '../core';
import { summarizeCount } from '../../coreAnalysis';

function makeElbowFrames(anglesDeg: number[], visibilities?: number[]) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const world = anglesDeg.map((deg, idx) => {
    const v = visibilities?.[idx] ?? 0.95;
    const pts = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.95 }));
    // Left arm (11 shoulder, 13 elbow, 15 wrist): forearm rotates around elbow in x-y plane
    pts[11] = { x: 0, y: 0, z: 0, visibility: v };
    pts[13] = { x: 0, y: 0.3, z: 0, visibility: v };
    const a = rad(deg);
    pts[15] = { x: 0.25 * Math.sin(a), y: 0.3 - 0.25 * Math.cos(a), z: 0, visibility: v };
    // Right arm fixed still
    pts[12] = { x: -0.3, y: 0, z: 0, visibility: v };
    pts[14] = { x: -0.3, y: 0.3, z: 0, visibility: v };
    pts[16] = { x: -0.3, y: 0.55, z: 0, visibility: v };
    return pts;
  });
  const image = world.map(f => f.map(p => ({ x: 0.5 + p.x, y: 0.5 + p.y, z: 0, visibility: p.visibility })));
  const timestamps = anglesDeg.map((_, i) => i / 15);
  return { world, image, timestamps };
}

function buildCurlAngles(reps: number): number[] {
  const angles: number[] = [];
  for (let i = 0; i < 15; i++) angles.push(155);
  for (let r = 0; r < reps; r++) {
    for (let k = 0; k <= 12; k++) angles.push(155 - 105 * (k / 12));
    for (let k = 1; k <= 12; k++) angles.push(50 + 105 * (k / 12));
    for (let k = 0; k < 6; k++) angles.push(155);
  }
  return angles;
}

describe('monocular 2D-vs-3D impulse flip guard', () => {
  it('masks 2-frame and 3-frame monocular 3D elbow flip spikes contradicted by 2D image angles without dropping coverage', () => {
    const angles = buildCurlAngles(7);
    const { world, image, timestamps } = makeElbowFrames(angles);
    // Inject a 3-frame depth inversion at peak flexion of rep 4 while 2D image landmarks stay flexed:
    const midIdx = 15 + 3 * 31 + 12;
    const rad = (d: number) => (d * Math.PI) / 180;
    for (const k of [midIdx - 1, midIdx, midIdx + 1]) {
      const a = rad(140);
      world[k][15] = { x: 0.25 * Math.sin(a), y: 0.3 - 0.25 * Math.cos(a), z: 0, visibility: 0.9 };
    }
    const clean = countReps(world, timestamps, 'bicep_curl', { outlierWindow: 3 }, image);
    expect(clean.count).toBe(7);
    expect(clean.confidence).toBe(1);

    const summary = summarizeCount(world, timestamps, 'bicep_curl', undefined, image);
    expect(summary.count).toBe(7);
    expect(summary.refused).toBe(false);
  });

  it('does not mask a genuine flexion frame where 3D matches 2D even when neighboring frames foreshorten', () => {
    const worldAngles = [
      165, 165, 165, 165, 165, 160, 145, 120, 90, 50, 82, 84, 83, 82, 85, 100, 130, 160, 165, 165,
    ];
    const imageAngles = [
      165, 165, 165, 165, 165, 160, 145, 120, 85, 48, 22, 10, 10, 15, 40, 85, 125, 160, 165, 165,
    ];
    const { world, timestamps } = makeElbowFrames(worldAngles);
    const { world: image } = makeElbowFrames(imageAngles);
    const withImg = summarizeCount(world, timestamps, 'bicep_curl', undefined, image);
    const withoutImg = summarizeCount(world, timestamps, 'bicep_curl');
    expect(withImg.smoothedAngles[9]).toBeCloseTo(withoutImg.smoothedAngles[9]!, 4);
  });
});
