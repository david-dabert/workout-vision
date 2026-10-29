import { describe, it, expect } from 'vitest';
import {
  rotatePoint3D,
  rotateFrame3D,
  calculate3DAngle,
  calculate2DAngle,
  evaluateMultiAngleInvariance,
} from '../multiAngleStressTest';
import { WorldLandmark, WorldLandmarkFrame } from '../core';

describe('Multi-Angle Synthetic Stress Tester', () => {
  it('rotates 3D points and returns to original position on 360-degree rotation', () => {
    const p: WorldLandmark = { x: 0.5, y: -0.2, z: 0.3, visibility: 0.99 };
    const center = { x: 0, y: 0, z: 0 };

    const rotated360 = rotatePoint3D(p, center, 2 * Math.PI, 0);

    expect(rotated360.x).toBeCloseTo(p.x, 5);
    expect(rotated360.y).toBeCloseTo(p.y, 5);
    expect(rotated360.z).toBeCloseTo(p.z, 5);
  });

  it('proves mathematical SO(3) 3D angle invariance across arbitrary rotations', () => {
    // Knee joint: hip (23), knee (25), ankle (27)
    const hip: WorldLandmark = { x: 0.15, y: -0.1, z: 0.0, visibility: 0.99 };
    const knee: WorldLandmark = { x: 0.15, y: 0.3, z: -0.2, visibility: 0.99 };
    const ankle: WorldLandmark = { x: 0.15, y: 0.7, z: 0.0, visibility: 0.99 };

    const orig3DAngle = calculate3DAngle(hip, knee, ankle);
    const center = { x: 0, y: 0, z: 0 };

    // Test a sweep of continuous azimuths and elevations
    for (let az = 0; az <= 360; az += 45) {
      for (let el = -30; el <= 30; el += 15) {
        const azRad = (az * Math.PI) / 180;
        const elRad = (el * Math.PI) / 180;

        const rotHip = rotatePoint3D(hip, center, azRad, elRad);
        const rotKnee = rotatePoint3D(knee, center, azRad, elRad);
        const rotAnkle = rotatePoint3D(ankle, center, azRad, elRad);

        const rot3DAngle = calculate3DAngle(rotHip, rotKnee, rotAnkle);

        // Invariance error must be under 1e-4 degrees
        expect(rot3DAngle).toBeCloseTo(orig3DAngle, 4);
      }
    }
  });

  it('demonstrates non-linear 2D projected angle distortion at oblique camera views', () => {
    // Sagittal plane knee bend during squat (109 degrees in 3D)
    const hip: WorldLandmark = { x: 0.0, y: 0.0, z: 0.0, visibility: 0.99 };
    const knee: WorldLandmark = { x: 0.0, y: 0.35, z: -0.25, visibility: 0.99 };
    const ankle: WorldLandmark = { x: 0.0, y: 0.7, z: 0.0, visibility: 0.99 };

    const orig3D = calculate3DAngle(hip, knee, ankle);
    expect(orig3D).toBeCloseTo(108.9, 1);

    const center = { x: 0, y: 0, z: 0 };

    // At azimuth 0 (side-on with Z in depth), 2D (X, Y) projects both segments onto the vertical axis X=0,
    // causing extreme 2D foreshortening distortion (apparent 180 degrees)
    const rotHip = rotatePoint3D(hip, center, 0, 0);
    const rotKnee = rotatePoint3D(knee, center, 0, 0);
    const rotAnkle = rotatePoint3D(ankle, center, 0, 0);

    const rot2DAngle = calculate2DAngle(rotHip, rotKnee, rotAnkle);

    const distortion2D = Math.abs(rot2DAngle - orig3D);
    expect(distortion2D).toBeGreaterThan(45.0); // Severe 2D distortion (>45 degrees)
  });

  it('evaluates multi-angle invariance across full repetition workout streams', () => {
    // Generate synthetic 4-rep squat sequence
    const fps = 15;
    const numReps = 4;
    const repPeriodSec = 2.0;
    const totalFrames = Math.round((numReps + 2) * repPeriodSec * fps);

    const frames: WorldLandmarkFrame[] = [];
    const timestamps: number[] = [];

    for (let f = 0; f < totalFrames; f++) {
      const t = f / fps;
      timestamps.push(t);

      let phase = 0;
      if (t >= repPeriodSec && t < (numReps + 1) * repPeriodSec) {
        const activeT = t - repPeriodSec;
        phase = (Math.cos((2 * Math.PI * activeT) / repPeriodSec) - 1) * 0.5;
      }
      const squatDepth = Math.abs(phase) * 0.4;

      const frame: WorldLandmark[] = Array.from({ length: 33 }, () => ({
        x: 0,
        y: 0,
        z: 0,
        visibility: 0.99,
      }));

      frame[11] = { x: -0.2, y: -0.6 + squatDepth, z: 0, visibility: 0.99 };
      frame[12] = { x: 0.2, y: -0.6 + squatDepth, z: 0, visibility: 0.99 };
      frame[13] = { x: -0.25, y: -0.3 + squatDepth, z: 0.1, visibility: 0.99 };
      frame[14] = { x: 0.25, y: -0.3 + squatDepth, z: 0.1, visibility: 0.99 };
      frame[15] = { x: -0.2, y: 0.0 + squatDepth, z: 0.2, visibility: 0.99 };
      frame[16] = { x: 0.2, y: 0.0 + squatDepth, z: 0.2, visibility: 0.99 };
      frame[23] = { x: -0.15, y: -0.1 + squatDepth, z: 0, visibility: 0.99 };
      frame[24] = { x: 0.15, y: -0.1 + squatDepth, z: 0, visibility: 0.99 };
      frame[25] = { x: -0.15, y: 0.3 + squatDepth * 0.5, z: -squatDepth * 0.3, visibility: 0.99 };
      frame[26] = { x: 0.15, y: 0.3 + squatDepth * 0.5, z: -squatDepth * 0.3, visibility: 0.99 };
      frame[27] = { x: -0.15, y: 0.7, z: 0, visibility: 0.99 };
      frame[28] = { x: 0.15, y: 0.7, z: 0, visibility: 0.99 };

      frames.push(frame);
    }

    const report = evaluateMultiAngleInvariance(
      frames,
      timestamps,
      [0, 30, 45, 60, 90, 180]
    );

    expect(report.totalAnglesTested).toBe(6);
    expect(report.is3DInvariant).toBe(true);
    expect(report.max3DDeviationDeg).toBeLessThan(1e-3);
    expect(report.repCountConsistencyRate).toBe(1.0); // Exactly 4 reps counted at all angles
  });
});
