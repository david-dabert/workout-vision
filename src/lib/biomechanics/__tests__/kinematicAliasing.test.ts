import { describe, it, expect } from 'vitest';
import {
  resolveKinematicAlias,
  correctMachineLandmarks,
  calculateJointAngle,
  KINEMATIC_MACHINE_REGISTRY,
  LandmarkPoint,
} from '../kinematicAliasing';

describe('Kinematic Machine Aliasing Engine', () => {
  describe('resolveKinematicAlias', () => {
    it('resolves pendulum squat machine variants correctly', () => {
      expect(resolveKinematicAlias('pendulum_squat').key).toBe('pendulum_squat');
      expect(resolveKinematicAlias('squat_pendule').key).toBe('pendulum_squat');
      expect(resolveKinematicAlias('lever_squat').key).toBe('pendulum_squat');
      expect(resolveKinematicAlias('Pendulum Squat Machine').key).toBe('pendulum_squat');
    });

    it('resolves hack squat and leg press correctly', () => {
      expect(resolveKinematicAlias('hack_squat').key).toBe('hack_squat');
      expect(resolveKinematicAlias('hack_machine').key).toBe('hack_squat');
      expect(resolveKinematicAlias('leg_press').key).toBe('leg_press');
      expect(resolveKinematicAlias('presse à cuisses').key).toBe('leg_press');
    });

    it('resolves upper body isolation and supported rows', () => {
      expect(resolveKinematicAlias('preacher_curl').key).toBe('preacher_curl');
      expect(resolveKinematicAlias('curl au pupitre larry scott').key).toBe('preacher_curl');
      expect(resolveKinematicAlias('seal_row').key).toBe('seal_row');
      expect(resolveKinematicAlias('belt_squat').key).toBe('belt_squat');
    });

    it('falls back to default free squat for unrecognized free squat queries', () => {
      const resolved = resolveKinematicAlias('random_unlisted_movement');
      expect(resolved.key).toBe('barbell_squat');
      expect(resolved.machineType).toBe('free_planar');
    });
  });

  describe('correctMachineLandmarks', () => {
    it('clamps false ankle jumps on deep pendulum squat sleds', () => {
      const profile = KINEMATIC_MACHINE_REGISTRY.pendulum_squat;
      const baselineFootplateY = 0.85; // Ankle at footplate

      // Mock 33 landmarks where left ankle falsely jumps up to y = 0.45 (near hip/chest)
      const mockLandmarks: LandmarkPoint[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.85, z: 0 }));
      mockLandmarks[23] = { x: 0.5, y: 0.65, z: 0 }; // Left Hip
      mockLandmarks[24] = { x: 0.5, y: 0.65, z: 0 }; // Right Hip
      mockLandmarks[27] = { x: 0.5, y: 0.40, z: 0 }; // Spurious Left Ankle Jump

      const { corrected, wasClamped } = correctMachineLandmarks(mockLandmarks, profile, baselineFootplateY);

      expect(wasClamped).toBe(true);
      expect(corrected[27].y).toBe(baselineFootplateY);
    });

    it('leaves landmarks untouched when ankle position is stable within tolerance', () => {
      const profile = KINEMATIC_MACHINE_REGISTRY.pendulum_squat;
      const baselineFootplateY = 0.85;

      const mockLandmarks: LandmarkPoint[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.85, z: 0 }));
      mockLandmarks[23] = { x: 0.5, y: 0.65, z: 0 };
      mockLandmarks[24] = { x: 0.5, y: 0.65, z: 0 };
      mockLandmarks[27] = { x: 0.5, y: 0.84, z: 0 }; // Stable ankle

      const { wasClamped } = correctMachineLandmarks(mockLandmarks, profile, baselineFootplateY);

      expect(wasClamped).toBe(false);
    });
  });

  describe('calculateJointAngle', () => {
    it('calculates 90 degree orthogonal angle accurately', () => {
      const a: LandmarkPoint = { x: 0, y: 1, z: 0 };
      const b: LandmarkPoint = { x: 0, y: 0, z: 0 };
      const c: LandmarkPoint = { x: 1, y: 0, z: 0 };

      const angle = calculateJointAngle(a, b, c);
      expect(Math.round(angle)).toBe(90);
    });

    it('calculates 180 degree collinear straight line angle', () => {
      const a: LandmarkPoint = { x: -1, y: 0, z: 0 };
      const b: LandmarkPoint = { x: 0, y: 0, z: 0 };
      const c: LandmarkPoint = { x: 1, y: 0, z: 0 };

      const angle = calculateJointAngle(a, b, c);
      expect(Math.round(angle)).toBe(180);
    });
  });
});
