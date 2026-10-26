import { describe, expect, it } from 'vitest';
import {
  buildSkeletalGaussianSplats,
  computeAngleUncertainty,
  estimateReferenceBoneLengths,
  computeTrajectoryGaussianKinematics,
  quadraticForm,
  createDiagonalCovariance,
} from '../GaussianSplatKinematics';
import { decodeBiomechanicalPhases } from '../BiomechanicalDecoder';
import { WorldLandmark, WorldLandmarkFrame } from '../core';

describe('GaussianSplatKinematics', () => {
  describe('Quadratic form & Covariance primitives', () => {
    it('computes J * Sigma * J^T correctly for diagonal matrices', () => {
      const cov = createDiagonalCovariance(2.0, 3.0, 5.0);
      const grad: [number, number, number] = [1.0, 2.0, 3.0];
      // 1^2 * 2 + 2^2 * 3 + 3^2 * 5 = 2 + 12 + 45 = 59
      const result = quadraticForm(grad, cov);
      expect(result).toBeCloseTo(59.0, 5);
    });
  });

  describe('buildSkeletalGaussianSplats', () => {
    it('models anisotropic monocular depth uncertainty (sigma_z > sigma_xy)', () => {
      const landmarks: WorldLandmark[] = [
        { x: 0.5, y: 0.5, z: 0.0, visibility: 1.0 },
      ];
      const splats = buildSkeletalGaussianSplats(landmarks);
      const splat = splats.get(0)!;

      expect(splat).toBeDefined();
      expect(splat.centroid).toEqual([0.5, 0.5, 0.0]);
      // Depth variance should be (3.5)^2 = 12.25 times transverse variance
      expect(splat.depthVariance / splat.transverseVariance).toBeCloseTo(12.25, 2);
    });

    it('dilates spatial covariance as visibility drops', () => {
      const highVis: WorldLandmark[] = [
        { x: 0.5, y: 0.5, z: 0.0, visibility: 0.95 },
      ];
      const lowVis: WorldLandmark[] = [
        { x: 0.5, y: 0.5, z: 0.0, visibility: 0.20 },
      ];

      const splatHigh = buildSkeletalGaussianSplats(highVis).get(0)!;
      const splatLow = buildSkeletalGaussianSplats(lowVis).get(0)!;

      expect(splatLow.transverseVariance).toBeGreaterThan(splatHigh.transverseVariance);
    });

    it('inflates covariance along bone vector when anatomical length invariance is violated', () => {
      // Connect landmarks 11 and 13 (shoulder to elbow)
      const refLengths = new Map<string, number>();
      refLengths.set('11-13', 0.30);

      // Normal length: 0.30 along Y
      const normalLms: WorldLandmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
      normalLms[11] = { x: 0.5, y: 0.2, z: 0, visibility: 1 };
      normalLms[13] = { x: 0.5, y: 0.5, z: 0, visibility: 1 }; // dist = 0.30

      // Distorted length: 0.45 along Y (50% stretch, physically impossible for bone)
      const distortedLms: WorldLandmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
      distortedLms[11] = { x: 0.5, y: 0.2, z: 0, visibility: 1 };
      distortedLms[13] = { x: 0.5, y: 0.65, z: 0, visibility: 1 }; // dist = 0.45

      const normalSplats = buildSkeletalGaussianSplats(normalLms, refLengths);
      const distortedSplats = buildSkeletalGaussianSplats(distortedLms, refLengths);

      // Y-axis variance (m11) should be significantly higher for the distorted limb
      expect(distortedSplats.get(11)!.covariance.m11).toBeGreaterThan(
        normalSplats.get(11)!.covariance.m11 * 1.5
      );
    });
  });

  describe('computeAngleUncertainty & Analytical Jacobian', () => {
    it('computes 90-degree orthogonal joint angle accurately', () => {
      const a: WorldLandmark = { x: 0.0, y: 0.5, z: 0.0, visibility: 0.9 };
      const v: WorldLandmark = { x: 0.0, y: 0.0, z: 0.0, visibility: 0.9 };
      const b: WorldLandmark = { x: 0.5, y: 0.0, z: 0.0, visibility: 0.9 };

      const uncert = computeAngleUncertainty(a, v, b);
      expect(uncert).not.toBeNull();
      expect(uncert!.angleDeg).toBeCloseTo(90.0, 3);
      expect(uncert!.stdDevDeg).toBeGreaterThan(0.1);
      expect(uncert!.stdDevDeg).toBeLessThan(10.0);
    });

    it('verifies analytical Jacobian against finite difference numerical perturbation', () => {
      const a: WorldLandmark = { x: 0.1, y: 0.45, z: 0.05, visibility: 0.95 };
      const v: WorldLandmark = { x: 0.0, y: 0.0, z: 0.0, visibility: 0.95 };
      const b: WorldLandmark = { x: 0.45, y: 0.1, z: -0.05, visibility: 0.95 };

      const base = computeAngleUncertainty(a, v, b)!;
      const analyticalGradAx = base.jacobian.gradA[0]; // in radians per unit

      // Numerical perturbation
      const h = 1e-5;
      const aPerturbed: WorldLandmark = { ...a, x: a.x + h };
      const perturbed = computeAngleUncertainty(aPerturbed, v, b)!;

      const numericalGradAx = ((perturbed.angleDeg - base.angleDeg) * (Math.PI / 180)) / h;
      expect(analyticalGradAx).toBeCloseTo(numericalGradAx, 2);
    });

    it('handles collinear limits gracefully without NaN or Inf', () => {
      // 180-degree straight line
      const a: WorldLandmark = { x: 0.0, y: 0.5, z: 0.0, visibility: 0.9 };
      const v: WorldLandmark = { x: 0.0, y: 0.0, z: 0.0, visibility: 0.9 };
      const b: WorldLandmark = { x: 0.0, y: -0.5, z: 0.0, visibility: 0.9 };

      const uncert = computeAngleUncertainty(a, v, b);
      expect(uncert).not.toBeNull();
      expect(uncert!.angleDeg).toBeCloseTo(180.0, 1);
      expect(Number.isFinite(uncert!.stdDevDeg)).toBe(true);
      expect(isNaN(uncert!.stdDevDeg)).toBe(false);
    });
  });

  describe('estimateReferenceBoneLengths', () => {
    it('extracts median bone lengths from high-confidence frames', () => {
      const frames: WorldLandmarkFrame[] = [];
      for (let i = 0; i < 10; i++) {
        const frame: WorldLandmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.95 }));
        // Left hip (23) to Left knee (25) = 0.40
        frame[23] = { x: 0.3, y: 0.4, z: 0, visibility: 0.95 };
        frame[25] = { x: 0.3, y: 0.8, z: 0, visibility: 0.95 };
        frames.push(frame);
      }

      const refLengths = estimateReferenceBoneLengths(frames);
      expect(refLengths.get('23-25')).toBeCloseTo(0.40, 3);
    });
  });

  describe('computeTrajectoryGaussianKinematics & BiomechanicalDecoder Integration', () => {
    it('computes trajectory angles and standard deviations across frames', () => {
      const frames: WorldLandmarkFrame[] = [];
      const numFrames = 30;

      for (let i = 0; i < numFrames; i++) {
        const frame: WorldLandmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));
        // Left knee joint: hip(23), knee(25), ankle(27)
        // Oscillating squat angle between 70 deg and 170 deg
        const thetaRad = (120 + 50 * Math.sin((i / 15) * Math.PI)) * (Math.PI / 180);
        frame[23] = { x: 0.3, y: 0.2, z: 0, visibility: 0.9 };
        frame[25] = { x: 0.3, y: 0.6, z: 0, visibility: 0.9 };
        frame[27] = {
          x: 0.3 + 0.4 * Math.sin(Math.PI - thetaRad),
          y: 0.6 + 0.4 * Math.cos(Math.PI - thetaRad),
          z: 0,
          visibility: 0.9,
        };
        frames.push(frame);
      }

      const result = computeTrajectoryGaussianKinematics(frames, 'knee', 'left');
      expect(result.angles.length).toBe(numFrames);
      expect(result.stdDevDeg.length).toBe(numFrames);
      expect(result.angles[0]).toBeGreaterThan(60);
      expect(result.stdDevDeg[0]).toBeGreaterThan(0);
      expect(result.stdDevDeg[0]).toBeLessThan(15);
    });

    it('integrates with BiomechanicalDecoder to bridge occlusions using Gaussian uncertainty', () => {
      const n = 60;
      const timestamps = Array.from({ length: n }, (_, i) => i * 0.1);
      const angles: (number | null)[] = [];
      const uncerts: (number | null)[] = [];

      // 2 clean reps (180 -> 80 -> 180), but frame 15-18 has occlusion (simulated high variance)
      for (let i = 0; i < n; i++) {
        const phase = (i % 25) / 25;
        const val = 180 - 100 * Math.sin(phase * Math.PI);
        if (i >= 15 && i <= 17) {
          // Noisy jitter with huge uncertainty
          angles.push(val + 35);
          uncerts.push(45.0); // 45 deg uncertainty
        } else {
          angles.push(val);
          uncerts.push(1.5); // 1.5 deg uncertainty
        }
      }

      const decoded = decodeBiomechanicalPhases(angles, timestamps, {
        restType: 'high',
        minRomDegrees: 30,
        angleUncertainties: uncerts,
      });

      // Decoded successfully tracks 2 reps despite the occlusion jitter
      expect(decoded.count).toBe(2);
      expect(decoded.reps.length).toBe(2);
    });
  });
});
