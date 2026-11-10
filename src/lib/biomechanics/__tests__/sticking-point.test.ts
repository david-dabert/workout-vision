import { describe, it, expect } from 'vitest';
import {
  detectConcentricStickingPoint,
  detectSetStickingPoints,
  calculateIntraSetVelocityLoss,
} from '../stickingPoint';

describe('stickingPoint kinematics engine', () => {
  it('returns null when angle samples are insufficient or rep duration is invalid', () => {
    const rep = { index: 1, startTime: 1.0, endTime: 1.0, concentricSec: 0, eccentricSec: 0, romDegrees: 0 };
    expect(detectConcentricStickingPoint(rep, [], [])).toBeNull();
    expect(detectConcentricStickingPoint(rep, [160, 150], [0.1, 0.2])).toBeNull();
  });

  it('detects concentric sticking point inflection during a stalled ascent in compound squat', () => {
    // Generate realistic squat trajectory:
    // 0.0 - 1.0s: eccentric descent (160° down to 80°)
    // 1.0 - 2.5s: concentric ascent (80° up to 160°)
    // With an inflection stall between 1.6s and 1.9s at ~105°
    const timestamps: number[] = [];
    const angles: number[] = [];

    for (let t = 0; t <= 3.0; t += 0.05) {
      timestamps.push(Math.round(t * 100) / 100);
      if (t < 1.0) {
        // Descent: 160 -> 80
        angles.push(160 - (t / 1.0) * 80);
      } else if (t < 1.5) {
        // Fast initial ascent out of the hole: 80 -> 105 (v = 50 deg/s)
        angles.push(80 + ((t - 1.0) / 0.5) * 25);
      } else if (t < 1.9) {
        // Sticking point stall: 105 -> 108 (v = 7.5 deg/s)
        angles.push(105 + ((t - 1.5) / 0.4) * 3);
      } else if (t < 2.5) {
        // Lockout drive: 108 -> 160 (v = 86.6 deg/s)
        angles.push(108 + ((t - 1.9) / 0.6) * 52);
      } else {
        angles.push(160);
      }
    }

    const rep = {
      index: 1,
      startTime: 0.0,
      endTime: 2.5,
      concentricSec: 1.5,
      eccentricSec: 1.0,
      romDegrees: 80,
    };

    const sp = detectConcentricStickingPoint(rep, angles, timestamps, 'squat');
    expect(sp).not.toBeNull();
    if (sp) {
      expect(sp.repIndex).toBe(1);
      expect(sp.timestamp).toBeGreaterThanOrEqual(1.5);
      expect(sp.timestamp).toBeLessThanOrEqual(2.0);
      expect(sp.angleDeg).toBeGreaterThanOrEqual(100);
      expect(sp.angleDeg).toBeLessThanOrEqual(115);
      expect(sp.velocityDropPercent).toBeGreaterThanOrEqual(60);
      expect(sp.severity).toBe('severe');
    }
  });

  it('returns null if concentric drive is smooth without stall', () => {
    const timestamps: number[] = [];
    const angles: number[] = [];

    for (let t = 0; t <= 2.5; t += 0.05) {
      timestamps.push(Math.round(t * 100) / 100);
      if (t < 1.0) {
        angles.push(160 - (t / 1.0) * 80);
      } else if (t <= 2.2) {
        // Constant smooth speed (80 deg / 1.2s = 66.7 deg/s)
        angles.push(80 + ((t - 1.0) / 1.2) * 80);
      } else {
        angles.push(160);
      }
    }

    const rep = {
      index: 1,
      startTime: 0.0,
      endTime: 2.2,
      concentricSec: 1.2,
      eccentricSec: 1.0,
      romDegrees: 80,
    };

    const sp = detectConcentricStickingPoint(rep, angles, timestamps, 'squat');
    expect(sp).toBeNull();
  });

  it('detectSetStickingPoints collects inflections across multiple reps', () => {
    const timestamps: number[] = [];
    const angles: number[] = [];

    // Rep 1 (smooth): 0.0 to 2.0s
    for (let t = 0; t <= 2.0; t += 0.05) {
      timestamps.push(Math.round(t * 100) / 100);
      if (t < 1.0) angles.push(160 - t * 80);
      else angles.push(80 + (t - 1.0) * 80);
    }
    // Rep 2 (stalled): 2.0 to 4.5s
    for (let t = 2.05; t <= 4.5; t += 0.05) {
      timestamps.push(Math.round(t * 100) / 100);
      const rel = t - 2.0;
      if (rel < 1.0) angles.push(160 - rel * 80);
      else if (rel < 1.4) angles.push(80 + ((rel - 1.0) / 0.4) * 20); // 80 -> 100
      else if (rel < 1.8) angles.push(100 + ((rel - 1.4) / 0.4) * 2); // stall at 100
      else angles.push(102 + ((rel - 1.8) / 0.7) * 58);
    }

    const reps = [
      { index: 1, startTime: 0.0, endTime: 2.0, concentricSec: 1.0, eccentricSec: 1.0, romDegrees: 80 },
      { index: 2, startTime: 2.0, endTime: 4.5, concentricSec: 1.5, eccentricSec: 1.0, romDegrees: 80 },
    ];

    const pins = detectSetStickingPoints(reps, angles, timestamps, 'squat');
    expect(pins.length).toBe(1);
    expect(pins[0].repIndex).toBe(2);
    expect(pins[0].angleDeg).toBeGreaterThanOrEqual(98);
    expect(pins[0].angleDeg).toBeLessThanOrEqual(105);
  });

  describe('calculateIntraSetVelocityLoss', () => {
    it('returns null for less than 2 reps', () => {
      expect(calculateIntraSetVelocityLoss([])).toBeNull();
      expect(calculateIntraSetVelocityLoss([{ index: 1, startTime: 0, endTime: 2, concentricSec: 1, romDegrees: 90 }])).toBeNull();
    });

    it('calculates velocity loss and categorizes fatigue correctly', () => {
      const reps = [
        { index: 1, startTime: 0.0, endTime: 2.5, concentricSec: 1.0, eccentricSec: 1.5, romDegrees: 90 }, // 90 deg/s
        { index: 2, startTime: 3.0, endTime: 5.6, concentricSec: 1.2, eccentricSec: 1.4, romDegrees: 90 }, // 75 deg/s
        { index: 3, startTime: 6.0, endTime: 8.8, concentricSec: 1.4, eccentricSec: 1.4, romDegrees: 88 }, // 62.8 deg/s
        { index: 4, startTime: 9.0, endTime: 12.0, concentricSec: 1.6, eccentricSec: 1.4, romDegrees: 85 }, // 53.1 deg/s (41% loss)
      ];

      const vbt = calculateIntraSetVelocityLoss(reps);
      expect(vbt).not.toBeNull();
      if (vbt) {
        expect(vbt.fastestRepIndex).toBe(1);
        expect(vbt.fastestVelocity).toBe(90);
        expect(vbt.lastRepIndex).toBe(4);
        expect(vbt.lastVelocity).toBe(53.1);
        expect(vbt.lossPercent).toBe(41);
        expect(vbt.fatigueZone).toBe('excessive');
        expect(vbt.cueFr).toContain('41\u00A0%');
        expect(vbt.cueFr).toContain('fatigue neuromusculaire élevée');
        expect(vbt.cueEn).toContain('41%');
        expect(vbt.cueEn).toContain('high neuromuscular fatigue');
      }
    });

    it('assigns optimal hypertrophy zone for 20-40% velocity loss', () => {
      const reps = [
        { index: 1, startTime: 0.0, endTime: 2.0, concentricSec: 1.0, romDegrees: 80 }, // 80 deg/s
        { index: 2, startTime: 3.0, endTime: 5.2, concentricSec: 1.3, romDegrees: 78 }, // 60 deg/s (25% loss)
      ];

      const vbt = calculateIntraSetVelocityLoss(reps);
      expect(vbt).not.toBeNull();
      if (vbt) {
        expect(vbt.lossPercent).toBe(25);
        expect(vbt.fatigueZone).toBe('hypertrophy');
        expect(vbt.cueFr).toContain('zone idéale de stimulation');
      }
    });
  });
});
