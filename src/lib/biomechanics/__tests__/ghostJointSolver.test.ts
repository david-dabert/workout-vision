import { describe, it, expect } from 'vitest';
import { reconstructGhostJoint, AnchorPoint } from '../ghostJointSolver';

describe('Kinematic Rigid-Body Ghost Joint Solver', () => {
  it('preserves existing joint coordinate when joint visibility is high', () => {
    const hip: AnchorPoint = { x: 0.5, y: 0.3, visibility: 0.95 };
    const ankle: AnchorPoint = { x: 0.5, y: 0.9, visibility: 0.95 };
    const visibleKnee: AnchorPoint = { x: 0.65, y: 0.6, visibility: 0.88 };

    const result = reconstructGhostJoint(hip, ankle, visibleKnee, undefined, 'knee', 0.35);
    expect(result.isReconstructed).toBe(false);
    expect(result.x).toBe(0.65);
    expect(result.y).toBe(0.6);
    expect(result.confidence).toBe(0.88);
  });

  it('reconstructs occluded knee joint via geometric link trilateration', () => {
    const hip: AnchorPoint = { x: 0.5, y: 0.2, visibility: 0.95 };
    const ankle: AnchorPoint = { x: 0.5, y: 0.8, visibility: 0.95 };
    // Knee is occluded by weight plate: low visibility (0.15)
    const occludedKnee: AnchorPoint = { x: 0.5, y: 0.5, visibility: 0.15 };

    const lengths = { proximalLength: 0.35, distalLength: 0.35 };
    const result = reconstructGhostJoint(hip, ankle, occludedKnee, lengths, 'knee', 0.35);

    expect(result.isReconstructed).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.7);

    // Distance from hip to reconstructed knee must equal proximal segment length L1 (0.35)
    const dHipKnee = Math.hypot(result.x - hip.x, result.y - hip.y);
    expect(dHipKnee).toBeCloseTo(0.35, 2);

    // Distance from ankle to reconstructed knee must equal distal segment length L2 (0.35)
    const dAnkleKnee = Math.hypot(result.x - ankle.x, result.y - ankle.y);
    expect(dAnkleKnee).toBeCloseTo(0.35, 2);
  });

  it('handles fully extended limb at lockout without geometric singularity', () => {
    const hip: AnchorPoint = { x: 0.5, y: 0.2, visibility: 0.95 };
    const ankle: AnchorPoint = { x: 0.5, y: 0.8, visibility: 0.95 };
    const occludedKnee: AnchorPoint = { x: 0.5, y: 0.5, visibility: 0.05 };

    // Total length L1 + L2 = 0.30 + 0.30 = 0.60 = distance D
    const lengths = { proximalLength: 0.30, distalLength: 0.30 };
    const result = reconstructGhostJoint(hip, ankle, occludedKnee, lengths, 'knee', 0.35);

    expect(result.isReconstructed).toBe(true);
    expect(result.x).toBeCloseTo(0.5, 2);
    expect(result.y).toBeCloseTo(0.5, 2);
  });

  it('interpolates depth z coordinate when 3D anchors are available', () => {
    const shoulder: AnchorPoint = { x: 0.4, y: 0.2, z: 0.1, visibility: 0.9 };
    const wrist: AnchorPoint = { x: 0.4, y: 0.8, z: 0.3, visibility: 0.9 };
    const missingElbow = null;

    const result = reconstructGhostJoint(shoulder, wrist, missingElbow, undefined, 'elbow', 0.35);
    expect(result.isReconstructed).toBe(true);
    expect(result.z).toBeDefined();
    expect(result.z!).toBeGreaterThan(0.1);
    expect(result.z!).toBeLessThan(0.3);
  });
});
