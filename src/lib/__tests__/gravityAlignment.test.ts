import { describe, it, expect } from 'vitest';
import { GravityAligner } from '../biomechanics/gravityAlignment';
import { Landmark3D } from '../biomechanics/kinematicFootLocking';

function createUprightPerson(pitchRad: number = 0, rollRad: number = 0): Landmark3D[] {
  const lms: Landmark3D[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.95,
  }));

  // Ankles at (0.5, 0.90, 0)
  lms[27] = { x: 0.45, y: 0.90, z: 0, visibility: 0.95 };
  lms[28] = { x: 0.55, y: 0.90, z: 0, visibility: 0.95 };

  // Hips at (0.5, 0.60, 0)
  lms[23] = { x: 0.45, y: 0.60, z: 0, visibility: 0.95 };
  lms[24] = { x: 0.55, y: 0.60, z: 0, visibility: 0.95 };

  // Shoulders at (0.5, 0.30, 0) rotated by pitchRad in Z and rollRad in X
  const trunkLen = 0.60;
  const dy = -trunkLen * Math.cos(pitchRad) * Math.cos(rollRad);
  const dz = trunkLen * Math.sin(pitchRad);
  const dx = trunkLen * Math.sin(rollRad);

  lms[11] = { x: 0.45 + dx, y: 0.90 + dy, z: dz, visibility: 0.95 };
  lms[12] = { x: 0.55 + dx, y: 0.90 + dy, z: dz, visibility: 0.95 };

  return lms;
}

describe('GravityAligner (Gravity-View Coordinate Normalization)', () => {
  it('estimates zero pitch and roll for a perfectly upright standing person', () => {
    const aligner = new GravityAligner();
    const lms = createUprightPerson(0, 0);
    const { pitchDeg, rollDeg } = aligner.estimateAnglesFromPose(lms);

    expect(pitchDeg).toBeCloseTo(0, 1);
    expect(rollDeg).toBeCloseTo(0, 1);
  });

  it('estimates upward camera pitch when phone is propped up (e.g. 15 degrees tilt)', () => {
    const aligner = new GravityAligner();
    const pitch15Rad = (15 * Math.PI) / 180;
    const lms = createUprightPerson(pitch15Rad, 0);

    const { pitchDeg, rollDeg } = aligner.estimateAnglesFromPose(lms);
    expect(pitchDeg).toBeCloseTo(15, 0);
    expect(rollDeg).toBeCloseTo(0, 1);
  });

  it('corrects coordinates so that vertical axis is aligned with gravity vector', () => {
    const aligner = new GravityAligner();
    const pitch20Rad = (20 * Math.PI) / 180;
    const tilted = createUprightPerson(pitch20Rad, 0);

    aligner.setCalibration(20, 0);
    const res = aligner.alignLandmarks(tilted);

    expect(res.isTiltCorrected).toBe(true);
    // After alignment, the shoulder Z should be returned back to near 0 relative to ankles
    const midShoulderZ = ((res.landmarks[11].z ?? 0) + (res.landmarks[12].z ?? 0)) / 2;
    expect(midShoulderZ).toBeCloseTo(0, 1);
  });
});
