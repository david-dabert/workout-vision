import { describe, it, expect, beforeEach } from 'vitest';
import { GolfKinematicsTracker, type Landmark3D } from '../golfKinematics';
import { LANDMARKS } from '../poseGeometry';

describe('Golf Swing Kinematics & Posture Analytics Engine', () => {
  let tracker: GolfKinematicsTracker;

  beforeEach(() => {
    tracker = new GolfKinematicsTracker('right_handed');
  });

  function createGolfPose(
    spineAngleDeg = 40,
    headOffset = { x: 0, y: 0 },
    pelvicTurn = 0,
    shoulderTurn = 0,
    wristSpeedPos = { x: 0.5, y: 0.8 },
    leadElbowAngle = 175
  ): Landmark3D[] {
    const lms: Landmark3D[] = new Array(33).fill({ x: 0, y: 0, z: 0, visibility: 0.95 });

    // Head (Nose)
    lms[LANDMARKS.NOSE] = { x: 0.5 + headOffset.x, y: 0.2 + headOffset.y, z: 0, visibility: 0.95 };

    // Hips with pelvic turn angle
    const hipTurnRad = (pelvicTurn * Math.PI) / 180;
    const hipRadius = 0.08;
    lms[LANDMARKS.LEFT_HIP] = { x: 0.5 - hipRadius * Math.cos(hipTurnRad), y: 0.6 - hipRadius * Math.sin(hipTurnRad), z: 0, visibility: 0.95 };
    lms[LANDMARKS.RIGHT_HIP] = { x: 0.5 + hipRadius * Math.cos(hipTurnRad), y: 0.6 + hipRadius * Math.sin(hipTurnRad), z: 0, visibility: 0.95 };

    // Shoulders with spine angle & shoulder turn
    const spineRad = (spineAngleDeg * Math.PI) / 180;
    const trunkLen = 0.35;
    const midShoulderX = 0.5 + trunkLen * Math.sin(spineRad);
    const midShoulderY = 0.6 - trunkLen * Math.cos(spineRad);

    const shoulderTurnRad = (shoulderTurn * Math.PI) / 180;
    const shoulderRadius = 0.12;
    lms[LANDMARKS.LEFT_SHOULDER] = {
      x: midShoulderX - shoulderRadius * Math.cos(shoulderTurnRad),
      y: midShoulderY - shoulderRadius * Math.sin(shoulderTurnRad),
      z: 0,
      visibility: 0.95,
    };
    lms[LANDMARKS.RIGHT_SHOULDER] = {
      x: midShoulderX + shoulderRadius * Math.cos(shoulderTurnRad),
      y: midShoulderY + shoulderRadius * Math.sin(shoulderTurnRad),
      z: 0,
      visibility: 0.95,
    };

    // Lead Arm (Left Arm for right-handed)
    lms[LANDMARKS.LEFT_ELBOW] = { x: midShoulderX - 0.05, y: midShoulderY + 0.15, z: 0, visibility: 0.95 };
    lms[LANDMARKS.LEFT_WRIST] = { x: wristSpeedPos.x, y: wristSpeedPos.y, z: 0, visibility: 0.95 };

    return lms;
  }

  it('tracks address spine posture and initial head position', () => {
    const frame = createGolfPose(42);
    const metric = tracker.processFrame(frame, 100);

    expect(metric).not.toBeNull();
    expect(metric!.spineAngleDeg).toBeCloseTo(42, 1);
    expect(metric!.headSwayDeviation).toBeCloseTo(0, 3);
  });

  it('detects early extension when spine angle straightens by 12° at impact', () => {
    // 10 Address frames at 42° spine angle
    for (let i = 0; i < 10; i++) {
      tracker.processFrame(createGolfPose(42, { x: 0, y: 0 }, 0, 0, { x: 0.5, y: 0.85 }), i * 33);
    }

    // Backswing to Top of swing (wrist travels high)
    for (let i = 10; i < 25; i++) {
      tracker.processFrame(createGolfPose(41, { x: 0.02, y: 0 }, 40, 85, { x: 0.3, y: 0.2 }), i * 33);
    }

    // Downswing to Impact with Early Extension (spine straightens to 30°)
    for (let i = 25; i < 35; i++) {
      tracker.processFrame(createGolfPose(30, { x: 0.01, y: 0 }, 30, 45, { x: 0.5, y: 0.8 }), i * 33);
    }

    const assessment = tracker.getAssessment();
    expect(assessment.addressSpineAngleDeg).toBeCloseTo(42, 1);
    expect(assessment.earlyExtensionFlag).toBe(true);
    expect(assessment.earlyExtensionRecommendation).toContain('Early Extension detected');
  });

  it('detects excessive lateral head sway (> 0.08 normalized screen width)', () => {
    // Address frame
    tracker.processFrame(createGolfPose(40, { x: 0, y: 0 }), 0);

    // Lateral slide / reverse pivot: head shifts laterally by 0.10
    const swayFrame = createGolfPose(40, { x: 0.10, y: 0 });
    const metric = tracker.processFrame(swayFrame, 500);

    expect(metric!.isHeadSwayExcessive).toBe(true);

    const assessment = tracker.getAssessment();
    expect(assessment.headSwayStatus).toBe('excessive_sway');
    expect(assessment.headSwayRecommendation).toContain('Excessive lateral head sway');
  });

  it('confirms full lead arm extension at impact (no chicken-wing)', () => {
    for (let i = 0; i < 10; i++) {
      tracker.processFrame(createGolfPose(40), i * 33);
    }
    const assessment = tracker.getAssessment();
    expect(assessment.leadArmStatus).toBe('full_extension');
  });
});
