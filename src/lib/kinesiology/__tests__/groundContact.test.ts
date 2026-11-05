import { describe, it, expect } from 'vitest';
import {
  stabilizeFrameGroundContact,
  stabilizeMotionSequence,
  Landmark3D,
} from '../groundContact';

function createMockLandmarks(footY = 0.90, footZ = 0.0): Landmark3D[] {
  const lms: Landmark3D[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0.5,
    z: 0,
    visibility: 0.9,
  }));
  // Left foot
  lms[27] = { x: -0.15, y: footY - 0.05, z: footZ, visibility: 0.9 }; // ankle
  lms[29] = { x: -0.15, y: footY, z: footZ - 0.05, visibility: 0.9 }; // heel
  lms[31] = { x: -0.15, y: footY, z: footZ + 0.05, visibility: 0.9 }; // toe
  // Right foot
  lms[28] = { x: 0.15, y: footY - 0.05, z: footZ, visibility: 0.9 }; // ankle
  lms[30] = { x: 0.15, y: footY, z: footZ - 0.05, visibility: 0.9 }; // heel
  lms[32] = { x: 0.15, y: footY, z: footZ + 0.05, visibility: 0.9 }; // toe
  return lms;
}

describe('Ground Contact Invariance Engine', () => {
  it('detects stance state when foot is stationary between frames', () => {
    const frame1 = createMockLandmarks(0.88, 0.0);
    const frame2 = createMockLandmarks(0.881, 0.001); // tiny movement < 0.045 threshold

    const res = stabilizeFrameGroundContact(frame2, frame1);
    expect(res.leftFoot.state).toBe('STANCE');
    expect(res.rightFoot.state).toBe('STANCE');
    expect(res.leftFoot.isGrounded).toBe(true);
    expect(res.rightFoot.isGrounded).toBe(true);
  });

  it('detects swing state when foot moves rapidly', () => {
    const frame1 = createMockLandmarks(0.88, 0.0);
    const frame2 = createMockLandmarks(0.70, 0.1); // jump or lift: large delta

    const res = stabilizeFrameGroundContact(frame2, frame1);
    expect(res.leftFoot.state).toBe('SWING');
    expect(res.rightFoot.state).toBe('SWING');
    expect(res.leftFoot.isGrounded).toBe(false);
  });

  it('locks foot to ground plane during stance to eliminate depth floating', () => {
    const frame1 = createMockLandmarks(0.90, 0.0);
    // Slight jitter in frame 2 where foot floats upward by 0.01
    const frame2 = createMockLandmarks(0.89, 0.0);

    const res = stabilizeFrameGroundContact(frame2, frame1, 0.90);
    expect(res.leftFoot.isGrounded).toBe(true);
    // After stabilization, heel y should be clamped to estimated ground y
    expect(res.stabilizedLandmarks[29].y).toBeCloseTo(0.90, 2);
    expect(res.stabilizedLandmarks[30].y).toBeCloseTo(0.90, 2);
  });

  it('stabilizes an entire motion sequence smoothly without crashing on empty frames', () => {
    expect(stabilizeMotionSequence([])).toEqual([]);

    const sequence = [
      createMockLandmarks(0.90, 0.0),
      createMockLandmarks(0.902, 0.01),
      createMockLandmarks(0.898, -0.01),
    ];

    const stabilized = stabilizeMotionSequence(sequence);
    expect(stabilized).toHaveLength(3);
    expect(stabilized[0]).toHaveLength(33);
    expect(stabilized[1]).toHaveLength(33);
    expect(stabilized[2]).toHaveLength(33);
  });
});
