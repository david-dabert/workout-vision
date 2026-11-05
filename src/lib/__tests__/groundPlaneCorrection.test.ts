import { describe, it, expect, beforeEach } from 'vitest';
import {
  estimatePitchFromIMU,
  estimatePitchFromPose,
  rotatePointGravity,
  rectifyLandmarks,
  computeTrueVerticalDisplacement,
  computeRectifiedJointAngle,
  GroundPlanePitchCorrector,
  ANATOMICAL_INDICES,
  Landmark3D,
} from '../groundPlaneCorrection';

describe('groundPlaneCorrection', () => {
  describe('estimatePitchFromIMU', () => {
    it('computes zero pitch when phone is upright (beta = 90)', () => {
      const est = estimatePitchFromIMU(90, 0, true);
      expect(est.pitchDeg).toBeCloseTo(0, 1);
      expect(est.pitchRad).toBeCloseTo(0, 2);
      expect(est.source).toBe('imu');
      expect(est.confidence).toBeGreaterThan(0.9);
    });

    it('computes 20 deg upward pitch when phone is propped against plate (beta = 70)', () => {
      const est = estimatePitchFromIMU(70, 0, true);
      expect(est.pitchDeg).toBeCloseTo(20, 1);
      expect(est.pitchRad).toBeCloseTo((20 * Math.PI) / 180, 2);
    });

    it('clamps extreme angles within realistic gym floor bounds', () => {
      const flat = estimatePitchFromIMU(0, 0, true); // 90 deg tilt clamped to 60 deg
      expect(flat.pitchDeg).toBe(60);

      const downward = estimatePitchFromIMU(110, 0, true); // -20 deg clamped to -10 deg
      expect(downward.pitchDeg).toBe(-10);
    });

    it('handles NaN or invalid inputs gracefully', () => {
      const est = estimatePitchFromIMU(NaN as any);
      expect(est.pitchDeg).toBe(0);
      expect(est.confidence).toBe(0);
    });
  });

  describe('estimatePitchFromPose', () => {
    function makePose(spineDy: number, spineDz: number): Landmark3D[] {
      const landmarks: Landmark3D[] = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
        visibility: 0.95,
      }));

      // Hips at (0.5, 0.6, 0)
      landmarks[ANATOMICAL_INDICES.LEFT_HIP] = { x: 0.45, y: 0.6, z: 0, visibility: 0.95 };
      landmarks[ANATOMICAL_INDICES.RIGHT_HIP] = { x: 0.55, y: 0.6, z: 0, visibility: 0.95 };

      // Shoulders at (0.5, 0.6 + spineDy, spineDz)
      landmarks[ANATOMICAL_INDICES.LEFT_SHOULDER] = {
        x: 0.45,
        y: 0.6 + spineDy,
        z: spineDz,
        visibility: 0.95,
      };
      landmarks[ANATOMICAL_INDICES.RIGHT_SHOULDER] = {
        x: 0.55,
        y: 0.6 + spineDy,
        z: spineDz,
        visibility: 0.95,
      };

      return landmarks;
    }

    it('estimates near-zero pitch when spine is vertical in camera frame (dz = 0)', () => {
      const pose = makePose(-0.35, 0); // Shoulders directly above hips
      const est = estimatePitchFromPose(pose);
      expect(est.pitchDeg).toBeCloseTo(0, 1);
      expect(est.confidence).toBeGreaterThan(0.7);
    });

    it('estimates upward camera pitch when shoulders recede in depth (dz > 0)', () => {
      // theta = 20 deg -> tan(20 deg) = 0.364
      // With height dy = -0.35, dz = 0.35 * tan(20 deg) ~= 0.127
      const thetaRad = (20 * Math.PI) / 180;
      const height = 0.35;
      const dz = height * Math.tan(thetaRad);

      const pose = makePose(-height, dz);
      const est = estimatePitchFromPose(pose);
      expect(est.pitchDeg).toBeCloseTo(20, 1);
    });

    it('returns low confidence when landmark visibility is compromised', () => {
      const pose = makePose(-0.35, 0);
      pose[ANATOMICAL_INDICES.LEFT_SHOULDER].visibility = 0.2;
      const est = estimatePitchFromPose(pose);
      expect(est.confidence).toBeLessThan(0.5);
    });
  });

  describe('rotatePointGravity & rectifyLandmarks', () => {
    it('rotates foreshortened point back to true gravity vertical', () => {
      const pitchRad = (30 * Math.PI) / 180;
      const origin = { x: 0, y: 0, z: 0 };

      // Point resting along gravity unit vector (0, 1, 0)
      // When viewed by camera tilted up by 30 deg, camera coordinates are:
      // y_cam = cos(30 deg), z_cam = sin(30 deg)
      const pCam: Landmark3D = {
        x: 0,
        y: Math.cos(pitchRad),
        z: Math.sin(pitchRad),
        visibility: 1,
      };

      const pRect = rotatePointGravity(pCam, pitchRad, 0, origin);
      expect(pRect.x).toBeCloseTo(0, 3);
      expect(pRect.y).toBeCloseTo(1, 3);
      expect(pRect.z).toBeCloseTo(0, 3);
    });

    it('rectifies an array of landmarks preserving landmark count and visibility', () => {
      const pitchRad = (25 * Math.PI) / 180;
      const landmarks: Landmark3D[] = [
        { x: 0.5, y: 0.5, z: 0, visibility: 0.9 },
        { x: 0.5, y: 0.8, z: 0.1, visibility: 0.85 },
      ];

      const rectified = rectifyLandmarks(landmarks, pitchRad, 0, 0);
      expect(rectified.length).toBe(2);
      expect(rectified[0].visibility).toBe(0.9);
      expect(rectified[1].visibility).toBe(0.85);
    });
  });

  describe('computeTrueVerticalDisplacement', () => {
    it('restores true vertical travel under a 30-degree upward tilt', () => {
      const pitchRad = (30 * Math.PI) / 180;
      const trueDisplacement = 0.40; // 40 cm squat descent

      // In camera space:
      // dy = trueDisplacement * cos(30 deg) ~= 0.346
      // dz = trueDisplacement * sin(30 deg) ~= 0.200
      const pStart: Landmark3D = { x: 0.5, y: 0.3, z: 0 };
      const pEnd: Landmark3D = {
        x: 0.5,
        y: 0.3 + trueDisplacement * Math.cos(pitchRad),
        z: 0 + trueDisplacement * Math.sin(pitchRad),
      };

      const uncorrectedDy = pEnd.y - pStart.y;
      expect(uncorrectedDy).toBeCloseTo(0.346, 2); // 13.4% foreshortening loss!

      const trueDy = computeTrueVerticalDisplacement(pStart, pEnd, pitchRad);
      expect(trueDy).toBeCloseTo(0.40, 3); // 100% recovered!
    });
  });

  describe('computeRectifiedJointAngle', () => {
    it('calculates unskewed joint angle in 3D gravity-aligned frame', () => {
      const pitchRad = (25 * Math.PI) / 180;

      // 90-degree right angle in gravity coordinates:
      // Vertex B at (0, 0, 0)
      // A along vertical: (0, 1, 0)
      // C along horizontal: (1, 0, 0)
      // Project into tilted camera frame:
      const b: Landmark3D = { x: 0, y: 0, z: 0 };
      const a: Landmark3D = {
        x: 0,
        y: Math.cos(pitchRad),
        z: Math.sin(pitchRad),
      };
      const c: Landmark3D = { x: 1, y: 0, z: 0 };

      const angle = computeRectifiedJointAngle(a, b, c, pitchRad, 0);
      expect(angle).toBeCloseTo(90, 1);
    });
  });

  describe('GroundPlanePitchCorrector', () => {
    let corrector: GroundPlanePitchCorrector;

    beforeEach(() => {
      corrector = new GroundPlanePitchCorrector({ smoothingAlpha: 0.5 });
    });

    it('temporally smooths pitch angle updates', () => {
      corrector.updateFromIMU(70); // 20 deg
      let est = corrector.getEstimate();
      expect(est.pitchDeg).toBeCloseTo(20, 1);

      corrector.updateFromIMU(50); // 40 deg
      est = corrector.getEstimate();
      // With alpha = 0.5, smoothed angle is (20 + 40) / 2 = 30 deg
      expect(est.pitchDeg).toBeCloseTo(30, 1);
    });

    it('resets state cleanly', () => {
      corrector.updateFromIMU(70);
      expect(corrector.getEstimate().pitchDeg).toBeGreaterThan(0);

      corrector.reset();
      expect(corrector.getEstimate().pitchDeg).toBe(0);
      expect(corrector.getEstimate().confidence).toBe(0);
    });
  });
});
