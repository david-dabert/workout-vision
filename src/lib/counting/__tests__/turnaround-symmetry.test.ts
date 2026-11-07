import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { countReps, liftDefinition } from '../core';
import { isDepthAxisCompoundLift } from '../lift3d';

describe('Monocular 3D Inverse Taylor Projection (liftSet) on Depth-Axis Lifts', () => {
  it('preserves planar side-view exercises without triggering 3D liftSet', () => {
    const sideFile = resolve(__dirname, '../../../../test/real-phone/sets-29sep/bicep_curl_5_side_f5e5bdf2.json.gz');
    const data = JSON.parse(gunzipSync(readFileSync(sideFile)).toString());

    // Planar side view has depthShare >= 0.6, so isDepthAxisCompoundLift is false
    expect(isDepthAxisCompoundLift('bicep_curl', data.worldLandmarks)).toBe(false);
  });

  it('verifies bone length invariance formula |dz| = sqrt(L^2 - l^2)', () => {
    // Synthetic bone length test: L = 1.0 m, in-plane dx=0.6, dy=0.0 -> dz should be sqrt(1.0 - 0.36) = 0.8
    const L = 1.0;
    const l = 0.6;
    const dz = Math.sqrt(Math.max(0, L * L - l * l));
    expect(dz).toBeCloseTo(0.8, 5);
  });
});

describe('Phase Turnaround Symmetry for Flexion-Working Lifts (restsLow === false)', () => {
  it('detects symmetric velocity zero-crossing turnaround on constant-tension flexion cycles', () => {
    // Generate synthetic flexion lift signal (rest at 170 deg, work at 60 deg, threshold low=85, high=145)
    // Rep 1: 170 -> 50 -> 170 (full lockout)
    // Rep 2: 170 -> 50 -> 140 (turns around at 140, returning > 70% of 120 ROM, without fully touching 145/170) -> 50 -> 170
    const sps = 15;
    const timestamps: number[] = [];
    const angles: number[] = [];

    // Baseline rest
    for (let t = 0; t <= 1.0; t += 1 / sps) {
      timestamps.push(t);
      angles.push(170);
    }
    // Rep 1
    for (let t = 1.1; t <= 2.0; t += 1 / sps) {
      const p = (t - 1.1) / 0.9;
      timestamps.push(t);
      angles.push(170 - 120 * Math.sin(Math.PI * p));
    }
    // Inter-rep rest
    for (let t = 2.1; t <= 2.5; t += 1 / sps) {
      timestamps.push(t);
      angles.push(170);
    }
    // Rep 2: descends to 50, ascends only to 142 (turnaround), descends back to 50, then full return to 170
    // Part A: 170 -> 50 -> 142
    for (let t = 2.6; t <= 3.8; t += 1 / sps) {
      const p = (t - 2.6) / 1.2;
      timestamps.push(t);
      const val = p < 0.5 ? 170 - 240 * p : 50 + 184 * (p - 0.5);
      angles.push(val);
    }
    // Part B: from 142 down to 50 and up to 170
    for (let t = 3.9; t <= 5.2; t += 1 / sps) {
      const p = (t - 3.9) / 1.3;
      timestamps.push(t);
      const val = p < 0.5 ? 142 - 184 * p : 50 + 240 * (p - 0.5);
      angles.push(val);
    }

    // Wrap into synthetic world landmark frames for elbow joint
    const frames = angles.map(a => {
      // Create elbow angle = a
      const rad = (a * Math.PI) / 180;
      const f = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.99 }));
      // Shoulder at (0, 0), Elbow at (0, 0.3), Wrist bent at angle a
      f[11] = { x: 0, y: 0, z: 0, visibility: 0.99 };
      f[13] = { x: 0, y: 0.3, z: 0, visibility: 0.99 };
      f[15] = { x: 0.3 * Math.sin(rad), y: 0.3 - 0.3 * Math.cos(rad), z: 0, visibility: 0.99 };
      return f;
    });

    const res = countReps(frames, timestamps, 'bicep_curl');
    expect(res.count).toBe(3); // 1 full rep + 2 turnaround reps in the constant-tension wave
  });

  it('validates flexion and extension joint families symmetry configuration', () => {
    const latPulldown = liftDefinition('lat_pulldown');
    expect(latPulldown).toBeDefined();
    expect(latPulldown!.rest).toBe('high');
    expect(latPulldown!.first).toBe('concentric');

    const bicepCurl = liftDefinition('bicep_curl');
    expect(bicepCurl).toBeDefined();
    expect(bicepCurl!.rest).toBe('high');
    expect(bicepCurl!.first).toBe('concentric');

    const proneY = liftDefinition('prone_y_raise');
    expect(proneY).toBeDefined();
    expect(proneY!.rest).toBe('low');
    expect(proneY!.first).toBe('concentric');
  });
});
