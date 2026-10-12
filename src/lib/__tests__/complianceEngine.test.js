import { describe, it, expect } from 'vitest';
import { generateComplianceProof, verifyComplianceProof, computeDigest, summarizeTrajectory } from '../complianceEngine';

describe('ComplianceEngine (Edge Cryptographic Compliance)', () => {
  it('computes deterministic SHA-256 digests', async () => {
    const d1 = await computeDigest('test-payload');
    const d2 = await computeDigest('test-payload');
    expect(d1).toBe(d2);
    expect(d1.length).toBeGreaterThanOrEqual(16);
  });

  it('summarizes landmark trajectories deterministically', () => {
    const frames = [
      [{ x: 0, y: 0, z: 0 }],
      [{ x: 0.1, y: 0.2, z: 0 }],
      [{ x: 0.2, y: 0.4, z: 0 }],
    ];
    const s1 = summarizeTrajectory(frames);
    const s2 = summarizeTrajectory(frames);
    expect(s1).toBe(s2);
    expect(s1).toContain('3f_');
  });

  it('generates an unforgeable compliance certificate and verifies it', async () => {
    const proof = await generateComplianceProof({
      exercise: 'prone_y_raise',
      reps: 12,
      duration: 35.4,
      timestamps: [0, 1, 2, 3, 4],
      worldLandmarks: [[{ x: 0, y: 0, z: 0 }]],
      date: '2026-10-12T20:00:00.000Z',
    });

    expect(proof.verified).toBe(true);
    expect(proof.certificateId).toMatch(/^WV-[A-F0-9]{8}-12R$/);
    expect(proof.continuous).toBe(true);

    const valid = await verifyComplianceProof(proof, { exercise: 'prone_y_raise', reps: 12 });
    expect(valid).toBe(true);

    const forged = await verifyComplianceProof(proof, { exercise: 'squat', reps: 12 });
    expect(forged).toBe(false);
  });
});
