import { describe, it, expect, vi } from 'vitest';
import {
  estimateL5S1SpinalShear,
  estimateKneeShear,
  estimateShoulderTorque,
  analyzeSetKinetics,
  estimateWorldScaleMeters,
} from '../jointTorqueEngine';
import {
  rodriguesRotationMatrix,
  applyRotationToPoint,
  estimateGravityPlumbLine,
  rectifySequence,
} from '../perspectiveInvariance';
import {
  playLockoutCue,
  playTurnaroundCue,
  playVelocityLossAlert,
} from '../audioCueEngine';

describe('JointTorqueEngine (Edge Inverse Dynamics)', () => {
  // Synthetic standing skeleton with realistic MediaPipe landmarks
  const standingSkeleton = Array.from({ length: 33 }, (_, i) => ({
    x: 0.5,
    y: i * 0.05,
    z: 0.0,
    visibility: 0.99,
  }));
  // Left/Right shoulder
  standingSkeleton[11] = { x: 0.42, y: 0.25, z: 0.0, visibility: 0.99 };
  standingSkeleton[12] = { x: 0.58, y: 0.25, z: 0.0, visibility: 0.99 };
  // Left/Right hip
  standingSkeleton[23] = { x: 0.44, y: 0.55, z: 0.0, visibility: 0.99 };
  standingSkeleton[24] = { x: 0.56, y: 0.55, z: 0.0, visibility: 0.99 };
  // Left/Right knee
  standingSkeleton[25] = { x: 0.44, y: 0.75, z: 0.0, visibility: 0.99 };
  standingSkeleton[26] = { x: 0.56, y: 0.75, z: 0.0, visibility: 0.99 };
  // Left/Right ankle
  standingSkeleton[27] = { x: 0.44, y: 0.95, z: 0.0, visibility: 0.99 };
  standingSkeleton[28] = { x: 0.56, y: 0.95, z: 0.0, visibility: 0.99 };

  it('estimates anatomical world scaling in meters', () => {
    const scale = estimateWorldScaleMeters(standingSkeleton);
    expect(scale).toBeGreaterThan(0.5);
    expect(scale).toBeLessThan(3.5);
  });

  it('calculates L5/S1 spinal shear and compressive force', () => {
    // Upright posture: minimal horizontal moment arm
    const upright = estimateL5S1SpinalShear(standingSkeleton, 1.75, 75);
    expect(upright).not.toBeNull();
    expect(upright.flexionMomentNm).toBeLessThan(10);
    expect(upright.compressiveForceN).toBeGreaterThan(300);

    // Flexed posture (e.g. forward lean in deadlift / RDL)
    const flexedSkeleton = standingSkeleton.map(p => ({ ...p }));
    flexedSkeleton[11] = { x: 0.42, y: 0.50, z: 0.35, visibility: 0.99 };
    flexedSkeleton[12] = { x: 0.58, y: 0.50, z: 0.35, visibility: 0.99 };

    const flexed = estimateL5S1SpinalShear(flexedSkeleton, 1.75, 75);
    expect(flexed).not.toBeNull();
    expect(flexed.flexionMomentNm).toBeGreaterThan(upright.flexionMomentNm);
    expect(flexed.anteriorShearN).toBeGreaterThan(100);
  });

  it('calculates patellofemoral knee shear forces', () => {
    const kneeRes = estimateKneeShear(standingSkeleton, 1.75, 75);
    expect(kneeRes).not.toBeNull();
    expect(kneeRes.extensorMomentNm).toBeDefined();
    expect(kneeRes.patellarShearN).toBeDefined();
  });

  it('analyzes entire set kinetics and calculates total mechanical work in Joules', () => {
    const sequence = Array.from({ length: 30 }, () => standingSkeleton);
    const timestamps = Array.from({ length: 30 }, (_, i) => i * 0.1);
    const reps = [{ startTime: 0.2, endTime: 2.5, romDegrees: 85 }];

    const result = analyzeSetKinetics(sequence, timestamps, 'squat', reps, 80);
    expect(result).not.toBeNull();
    expect(result.totalWorkJoules).toBeGreaterThanOrEqual(0);
    expect(result.perRepKinetics).toHaveLength(1);
    expect(result.perRepKinetics[0].workJoules).toBeGreaterThan(0);
  });
});

describe('PerspectiveInvariance (3D Camera Raymarching)', () => {
  it('computes exact Rodrigues rotation matrix and aligns vectors', () => {
    const from = [0, 1, 0];
    const to = [0, 0, 1];
    const R = rodriguesRotationMatrix(from, to);

    const rotated = applyRotationToPoint({ x: 0, y: 1, z: 0 }, R);
    expect(Math.abs(rotated.x)).toBeLessThan(1e-5);
    expect(Math.abs(rotated.y)).toBeLessThan(1e-5);
    expect(Math.abs(rotated.z - 1)).toBeLessThan(1e-5);
  });

  it('estimates gravity vector and rectifies landmark sequences to canonical plane', () => {
    const frame = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
    frame[27] = { x: 0.4, y: 0.9, z: 0.0, visibility: 0.9 };
    frame[28] = { x: 0.6, y: 0.9, z: 0.0, visibility: 0.9 };
    frame[29] = { x: 0.4, y: 0.95, z: -0.1, visibility: 0.9 };
    frame[30] = { x: 0.6, y: 0.95, z: -0.1, visibility: 0.9 };
    frame[31] = { x: 0.4, y: 0.95, z: 0.15, visibility: 0.9 };
    frame[32] = { x: 0.6, y: 0.95, z: 0.15, visibility: 0.9 };

    const plumb = estimateGravityPlumbLine([frame]);
    expect(plumb).toHaveLength(3);
    expect(plumb[1]).toBeLessThan(0); // Upward pointing normal in MediaPipe coordinates

    const rectified = rectifySequence([frame]);
    expect(rectified.rectifiedSequence).toHaveLength(1);
    expect(rectified.cameraPitchTiltDeg).toBeDefined();
  });
});

describe('AudioCueEngine (Web Audio Synthesis)', () => {
  it('synthesizes acoustic cues gracefully in simulated environment', () => {
    // In Vitest environment without native AudioContext, ensures zero crashes
    expect(() => playLockoutCue()).not.toThrow();
    expect(() => playTurnaroundCue()).not.toThrow();
    expect(() => playVelocityLossAlert()).not.toThrow();
  });
});
