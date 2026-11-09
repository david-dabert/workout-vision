import { describe, expect, it } from 'vitest';
import {
  DeviceStabilityDetector,
  estimatePedalingCadence,
  estimatePhoneTiltDegrees,
  MotionSample,
} from '../deviceSensors';

describe('deviceSensors', () => {
  describe('DeviceStabilityDetector', () => {
    it('detects a stationary phone on a tripod after 1.5 seconds', () => {
      const detector = new DeviceStabilityDetector(1500, 0.02);
      let state = { isStable: false, stabilityDurationSec: 0, variance: 1 };

      // Simulate 2 seconds of still sensor readings (small noise around 0)
      for (let t = 0; t <= 2000; t += 100) {
        state = detector.push({
          timestamp: t,
          accelX: 0.005 * Math.sin(t),
          accelY: 0.005 * Math.cos(t),
          accelZ: 0.005,
        });
      }

      expect(state.isStable).toBe(true);
      expect(state.stabilityDurationSec).toBeGreaterThanOrEqual(1.5);
      expect(state.variance).toBeLessThan(0.02);
    });

    it('rejects stability when phone is being moved or shaken', () => {
      const detector = new DeviceStabilityDetector(1500, 0.02);
      let state = { isStable: false, stabilityDurationSec: 0, variance: 1 };

      for (let t = 0; t <= 2000; t += 100) {
        state = detector.push({
          timestamp: t,
          accelX: 1.5 * Math.sin(t / 100),
          accelY: 2.0 * Math.cos(t / 100),
          accelZ: 0.5,
        });
      }

      expect(state.isStable).toBe(false);
      expect(state.variance).toBeGreaterThan(0.02);
    });
  });

  describe('estimatePedalingCadence', () => {
    it('accurately estimates 80 RPM pedaling rhythm from periodic motion', () => {
      // 80 RPM = 1.333 Hz = period of 750 ms
      const periodMs = 750;
      const samples: MotionSample[] = [];

      for (let t = 0; t <= 6000; t += 50) {
        const phase = (2 * Math.PI * t) / periodMs;
        samples.push({
          timestamp: t,
          accelX: 0.1,
          accelY: 9.81 + 1.5 * Math.sin(phase),
          accelZ: 0.2,
        });
      }

      const result = estimatePedalingCadence(samples);
      expect(result.rpm).toBe(80);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('returns null for insufficient or irregular samples', () => {
      const samples: MotionSample[] = [
        { timestamp: 0, accelX: 0, accelY: 0, accelZ: 0 },
        { timestamp: 100, accelX: 0, accelY: 0, accelZ: 0 },
      ];
      expect(estimatePedalingCadence(samples).rpm).toBeNull();
    });
  });

  describe('estimatePhoneTiltDegrees', () => {
    it('detects vertical upright phone as ~0° pitch', () => {
      // Gravity along Y axis [0, 9.81, 0]
      expect(estimatePhoneTiltDegrees(0, 9.81, 0)).toBe(0);
    });

    it('detects flat phone on table as ~90° pitch', () => {
      // Gravity along Z axis [0, 0, 9.81]
      expect(estimatePhoneTiltDegrees(0, 0, 9.81)).toBe(90);
    });

    it('detects 45° inclined tripod setup', () => {
      const g = 9.81 / Math.sqrt(2);
      expect(estimatePhoneTiltDegrees(0, g, g)).toBeCloseTo(45, 0);
    });
  });
});
