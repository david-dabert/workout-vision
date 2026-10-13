import { describe, it, expect } from 'vitest';
import {
  calculateJointAngleDeg,
  extractGolfKinematicsFromLandmarks,
  extractTennisKinematicsFromLandmarks,
  extractBikeFitKinematicsFromLandmarks,
  extractBaseballPitchFromLandmarks,
  MP_LEFT_SHOULDER,
  MP_RIGHT_SHOULDER,
  MP_LEFT_HIP,
  MP_RIGHT_HIP,
  MP_RIGHT_KNEE,
  MP_RIGHT_ANKLE,
  MP_RIGHT_ELBOW,
  MP_RIGHT_WRIST,
} from '../landmarkKinematics';

describe('Sports Pose Landmark Kinematics Engine', () => {
  it('calculates joint angle correctly for right triangle (90°)', () => {
    const a = { x: 0, y: 1, z: 0 };
    const b = { x: 0, y: 0, z: 0 };
    const c = { x: 1, y: 0, z: 0 };
    const angle = calculateJointAngleDeg(a, b, c);
    expect(Math.round(angle)).toBe(90);
  });

  it('calculates joint angle for collinear points (180°)', () => {
    const a = { x: -1, y: 0, z: 0 };
    const b = { x: 0, y: 0, z: 0 };
    const c = { x: 1, y: 0, z: 0 };
    const angle = calculateJointAngleDeg(a, b, c);
    expect(Math.round(angle)).toBe(180);
  });

  it('extracts Golf X-Factor from transverse plane shoulder and hip vectors', () => {
    const dummyLandmarks = Array(33).fill({ x: 0.5, y: 0.5, z: 0 });

    // 90° shoulder turn, 45° hip turn
    dummyLandmarks[MP_LEFT_SHOULDER] = { x: 0.5, y: 0.3, z: -0.2 };
    dummyLandmarks[MP_RIGHT_SHOULDER] = { x: 0.5, y: 0.3, z: 0.2 }; // along z axis = 90°

    dummyLandmarks[MP_LEFT_HIP] = { x: 0.4, y: 0.6, z: -0.1 };
    dummyLandmarks[MP_RIGHT_HIP] = { x: 0.6, y: 0.6, z: 0.1 }; // 45° angle

    const res = extractGolfKinematicsFromLandmarks(dummyLandmarks);
    expect(res.shoulderTurnDeg).toBe(90);
    expect(res.xFactorDeg).toBeGreaterThan(30);
    expect(res.xFactorDeg).toBeLessThan(70);
  });

  it('extracts Tennis Serve Trophy Pose from shoulder tilt and knee flexion', () => {
    const dummyLandmarks = Array(33).fill({ x: 0.5, y: 0.5, z: 0 });

    // 25° upward shoulder tilt
    dummyLandmarks[MP_LEFT_SHOULDER] = { x: 0.4, y: 0.25, z: 0 };
    dummyLandmarks[MP_RIGHT_SHOULDER] = { x: 0.6, y: 0.35, z: 0 };

    // Rear knee flexion ~ 115°
    dummyLandmarks[MP_RIGHT_HIP] = { x: 0.55, y: 0.5, z: 0 };
    dummyLandmarks[MP_RIGHT_KNEE] = { x: 0.70, y: 0.7, z: 0 };
    dummyLandmarks[MP_RIGHT_ANKLE] = { x: 0.55, y: 0.9, z: 0 };

    const res = extractTennisKinematicsFromLandmarks(dummyLandmarks);
    expect(res.shoulderTiltDeg).toBeGreaterThan(15);
    expect(res.rearKneeFlexionDeg).toBeGreaterThan(85);
    expect(res.rearKneeFlexionDeg).toBeLessThan(140);
  });

  it('extracts Cycling Bike Fit knee angle at BDC', () => {
    const dummyLandmarks = Array(33).fill({ x: 0.5, y: 0.5, z: 0 });

    // Sagittal knee extension: Holmes angle ~ 30° (180° - 150°)
    dummyLandmarks[MP_RIGHT_HIP] = { x: 0.45, y: 0.4, z: 0 };
    dummyLandmarks[MP_RIGHT_KNEE] = { x: 0.60, y: 0.65, z: 0 };
    dummyLandmarks[MP_RIGHT_ANKLE] = { x: 0.55, y: 0.9, z: 0 };
    dummyLandmarks[MP_RIGHT_SHOULDER] = { x: 0.35, y: 0.25, z: 0 };

    const res = extractBikeFitKinematicsFromLandmarks(dummyLandmarks);
    expect(res.bdcKneeAngleDeg).toBeGreaterThan(15);
    expect(res.bdcKneeAngleDeg).toBeLessThan(45);
    expect(['optimal', 'too_high', 'too_low']).toContain(res.saddleHeightVerdict);
  });

  it('extracts Baseball Pitching mechanics and UCL valgus stress', () => {
    const dummyLandmarks = Array(33).fill({ x: 0.5, y: 0.5, z: 0 });

    // 90° shoulder abduction, 90° elbow flexion
    dummyLandmarks[MP_RIGHT_HIP] = { x: 0.5, y: 0.6, z: 0 };
    dummyLandmarks[MP_RIGHT_SHOULDER] = { x: 0.5, y: 0.3, z: 0 };
    dummyLandmarks[MP_RIGHT_ELBOW] = { x: 0.7, y: 0.3, z: 0 };
    dummyLandmarks[MP_RIGHT_WRIST] = { x: 0.7, y: 0.1, z: 0 };

    const res = extractBaseballPitchFromLandmarks(dummyLandmarks);
    expect(res.shoulderAbductionDeg).toBe(90);
    expect(res.elbowFlexionDeg).toBe(90);
    expect(res.uclSafetyVerdict).toBe('optimal_safe');
    expect(res.estimatedUclStressNm).toBe(52);
  });
});
