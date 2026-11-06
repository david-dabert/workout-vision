import { describe, it, expect, beforeEach } from 'vitest';
import {
  CyclingKinematicsTracker,
  calculateAngle3D,
  calculateTorsoAngleWithHorizontal,
  detectDominantSide,
  type Landmark3D,
} from '../cyclingKinematics';
import { LANDMARKS } from '../poseGeometry';

describe('Cycling Kinematics & Dynamic Bike Fit Engine', () => {
  let tracker: CyclingKinematicsTracker;

  beforeEach(() => {
    tracker = new CyclingKinematicsTracker();
  });

  describe('Mathematical Geometry', () => {
    it('calculates 3D knee angle accurately', () => {
      // Straight leg (180°)
      const hip: Landmark3D = { x: 0.5, y: 0.3, z: 0 };
      const knee: Landmark3D = { x: 0.5, y: 0.6, z: 0 };
      const ankle: Landmark3D = { x: 0.5, y: 0.9, z: 0 };

      const angle = calculateAngle3D(hip, knee, ankle);
      expect(angle).toBeCloseTo(180, 1);
    });

    it('calculates right angle knee flexion (90°)', () => {
      const hip: Landmark3D = { x: 0.5, y: 0.3, z: 0 };
      const knee: Landmark3D = { x: 0.5, y: 0.6, z: 0 };
      const ankle: Landmark3D = { x: 0.8, y: 0.6, z: 0 };

      const angle = calculateAngle3D(hip, knee, ankle);
      expect(angle).toBeCloseTo(90, 1);
    });

    it('calculates torso angle with horizontal plane', () => {
      // 45° angle
      const hip: Landmark3D = { x: 0.5, y: 0.5 };
      const shoulder: Landmark3D = { x: 0.8, y: 0.2 }; // dx = 0.3, dy = 0.3

      const torsoAngle = calculateTorsoAngleWithHorizontal(hip, shoulder);
      expect(torsoAngle).toBeCloseTo(45, 1);
    });

    it('detects dominant lateral side facing the camera', () => {
      const landmarks: Landmark3D[] = new Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0.1 });
      landmarks[LANDMARKS.LEFT_HIP] = { x: 0.4, y: 0.4, visibility: 0.95 };
      landmarks[LANDMARKS.LEFT_KNEE] = { x: 0.4, y: 0.6, visibility: 0.92 };
      landmarks[LANDMARKS.LEFT_ANKLE] = { x: 0.4, y: 0.8, visibility: 0.94 };

      landmarks[LANDMARKS.RIGHT_HIP] = { x: 0.45, y: 0.4, visibility: 0.2 };
      landmarks[LANDMARKS.RIGHT_KNEE] = { x: 0.45, y: 0.6, visibility: 0.15 };
      landmarks[LANDMARKS.RIGHT_ANKLE] = { x: 0.45, y: 0.8, visibility: 0.1 };

      const side = detectDominantSide(landmarks);
      expect(side).toBe('left');
    });
  });

  describe('Dynamic Pedaling & Cadence Tracking', () => {
    function generateCyclingFrame(
      phaseAngleRad: number,
      targetKneeBdc = 150,
      targetKneeTdc = 70,
      torsoAngleDeg = 40,
      reachAngleDeg = 88
    ): Landmark3D[] {
      const landmarks: Landmark3D[] = new Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0.95 });

      // Hip fixed at (0.5, 0.4)
      const hip = { x: 0.5, y: 0.4, z: 0, visibility: 0.95 };
      landmarks[LANDMARKS.LEFT_HIP] = hip;

      // Shoulder for torso angle
      const torsoRad = (torsoAngleDeg * Math.PI) / 180;
      const torsoLength = 0.4;
      const shoulder = {
        x: hip.x + torsoLength * Math.cos(torsoRad),
        y: hip.y - torsoLength * Math.sin(torsoRad),
        z: 0,
        visibility: 0.95,
      };
      landmarks[LANDMARKS.LEFT_SHOULDER] = shoulder;

      // Elbow for reach angle
      const reachRad = (reachAngleDeg * Math.PI) / 180;
      const armLength = 0.3;
      landmarks[LANDMARKS.LEFT_ELBOW] = {
        x: shoulder.x + armLength * Math.cos(reachRad),
        y: shoulder.y + armLength * Math.sin(reachRad),
        z: 0,
        visibility: 0.95,
      };

      // Knee angle oscillates sinusoidally between TDC (min) and BDC (max)
      // When phase = PI, sin(phase) is at bottom/top
      const kneeRange = targetKneeBdc - targetKneeTdc;
      const currentKnee = targetKneeTdc + (kneeRange / 2) * (1 - Math.cos(phaseAngleRad));

      // Construct knee and ankle matching currentKnee angle
      const femurLen = 0.4;
      const tibiaLen = 0.4;

      // Knee position
      const femurAngle = (60 * Math.PI) / 180;
      const knee = {
        x: hip.x + femurLen * Math.cos(femurAngle),
        y: hip.y + femurLen * Math.sin(femurAngle),
        z: 0,
        visibility: 0.95,
      };
      landmarks[LANDMARKS.LEFT_KNEE] = knee;

      // Ankle position based on currentKnee angle
      const kneeRad = (currentKnee * Math.PI) / 180;
      const ankleAngle = femurAngle + (Math.PI - kneeRad);
      landmarks[LANDMARKS.LEFT_ANKLE] = {
        x: knee.x + tibiaLen * Math.cos(ankleAngle),
        y: knee.y + tibiaLen * Math.sin(ankleAngle),
        z: 0,
        visibility: 0.95,
      };

      return landmarks;
    }

    it('tracks pedaling strokes and computes cadence at 80 RPM', () => {
      // 80 RPM = 1.333 rev/s -> Period = 0.75s = 750ms
      const rpm = 80;
      const revDurationMs = (60 / rpm) * 1000; // 750 ms
      const fps = 30;
      const frameDeltaMs = 1000 / fps; // 33.33 ms
      const totalFrames = Math.round((revDurationMs * 6) / frameDeltaMs); // 6 full revolutions

      let bdcCount = 0;
      let lastCadence: number | null = null;

      for (let f = 0; f < totalFrames; f++) {
        const timeMs = f * frameDeltaMs;
        const phase = (2 * Math.PI * timeMs) / revDurationMs;
        const frame = generateCyclingFrame(phase, 150, 70);

        const result = tracker.processFrame(frame, timeMs, 'left');
        if (result?.isBdcTurnaround) {
          bdcCount++;
        }
        if (result?.cadenceRpm) {
          lastCadence = result.cadenceRpm;
        }
      }

      // Should detect approximately 5-6 BDC events
      expect(bdcCount).toBeGreaterThanOrEqual(4);
      expect(bdcCount).toBeLessThanOrEqual(7);

      // Cadence should converge near 80 RPM
      expect(lastCadence).not.toBeNull();
      expect(lastCadence!).toBeGreaterThanOrEqual(75);
      expect(lastCadence!).toBeLessThanOrEqual(85);
    });

    it('diagnoses optimal saddle height when knee extension is 149°', () => {
      const revDurationMs = 700;
      const totalFrames = 90;

      for (let f = 0; f < totalFrames; f++) {
        const timeMs = f * 33.3;
        const phase = (2 * Math.PI * timeMs) / revDurationMs;
        const frame = generateCyclingFrame(phase, 149, 72, 42, 90);
        tracker.processFrame(frame, timeMs, 'left');
      }

      const summary = tracker.getSummary();
      expect(summary.totalRevolutions).toBeGreaterThanOrEqual(3);
      expect(summary.finalAssessment.saddleHeightStatus).toBe('optimal');
      expect(summary.finalAssessment.saddleRecommendation).toContain('optimal');
    });

    it('flags saddle too high when knee overextends to 162° at BDC', () => {
      const revDurationMs = 700;
      const totalFrames = 90;

      for (let f = 0; f < totalFrames; f++) {
        const timeMs = f * 33.3;
        const phase = (2 * Math.PI * timeMs) / revDurationMs;
        // Saddle too high: 162° extension at BDC
        const frame = generateCyclingFrame(phase, 162, 75, 40, 90);
        tracker.processFrame(frame, timeMs, 'left');
      }

      const summary = tracker.getSummary();
      expect(summary.finalAssessment.saddleHeightStatus).toBe('too_high');
      expect(summary.finalAssessment.saddleRecommendation).toContain('too high');
      expect(summary.finalAssessment.saddleRecommendation).toContain('Lower saddle');
    });

    it('flags saddle too low when knee is overly compressed (134° at BDC)', () => {
      const revDurationMs = 700;
      const totalFrames = 90;

      for (let f = 0; f < totalFrames; f++) {
        const timeMs = f * 33.3;
        const phase = (2 * Math.PI * timeMs) / revDurationMs;
        // Saddle too low: 138° extension at BDC
        const frame = generateCyclingFrame(phase, 138, 65, 45, 90);
        tracker.processFrame(frame, timeMs, 'left');
      }

      const summary = tracker.getSummary();
      expect(summary.finalAssessment.saddleHeightStatus).toBe('too_low');
      expect(summary.finalAssessment.saddleRecommendation).toContain('too low');
      expect(summary.finalAssessment.saddleRecommendation).toContain('Raise saddle');
    });
  });
});
