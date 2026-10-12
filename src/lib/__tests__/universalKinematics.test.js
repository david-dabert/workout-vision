import { describe, it, expect } from 'vitest';
import {
  angle3D,
  extractFrameKinematics,
  smoothSeries,
  calculateSPARC,
  analyzeIsometricHold,
  analyzeDynamicKinematics,
  analyzeUniversalLandmarks,
  ISOMETRIC_HOLDS,
  KINEMATIC_MAPPINGS,
} from '../universalKinematics';

function mockPoint(x, y, z) {
  return { x, y, z, visibility: 1 };
}

function mockLandmarkFrame(options = {}) {
  const wl = Array.from({ length: 33 }, () => mockPoint(0, 0, 0));
  // Set key landmarks
  wl[11] = mockPoint(-0.2, 0.5, 0); // L shoulder
  wl[12] = mockPoint(0.2, 0.5, 0);  // R shoulder
  wl[13] = mockPoint(-0.3, 0.2, 0); // L elbow
  wl[14] = mockPoint(0.3, 0.2, 0);  // R elbow
  wl[15] = mockPoint(options.wristX != null ? -options.wristX : -0.2, 0.0, 0); // L wrist
  wl[16] = mockPoint(options.wristX != null ? options.wristX : 0.2, 0.0, 0);   // R wrist
  wl[23] = mockPoint(-0.15, 1.0, 0); // L hip
  wl[24] = mockPoint(0.15, 1.0, 0);  // R hip
  wl[25] = mockPoint(-0.15, 1.5, 0); // L knee
  wl[26] = mockPoint(0.15, 1.5, 0);  // R knee
  wl[27] = mockPoint(-0.15, 2.0, 0); // L ankle
  wl[28] = mockPoint(0.15, 2.0, 0);  // R ankle
  wl[31] = mockPoint(-0.15, 2.1, options.ankleZ || 0.15); // L toe
  wl[32] = mockPoint(0.15, 2.1, options.ankleZ || 0.15);  // R toe
  wl[7] = mockPoint(-0.1, 0.2, 0);  // L ear
  wl[8] = mockPoint(0.1, 0.2, 0);   // R ear

  if (options.shrugY) {
    wl[11].y = options.shrugY;
    wl[12].y = options.shrugY;
  }
  return wl;
}

describe('Universal Kinematic Engine', () => {
  it('computes 3D angle accurately', () => {
    const a = mockPoint(0, 1, 0);
    const vertex = mockPoint(0, 0, 0);
    const c = mockPoint(1, 0, 0);
    expect(angle3D(a, vertex, c)).toBeCloseTo(90, 1);

    const straight = mockPoint(0, -1, 0);
    expect(angle3D(a, vertex, straight)).toBeCloseTo(180, 1);
  });

  it('extracts multi-channel kinematics from a 33-point frame', () => {
    const frame = mockLandmarkFrame({ wristX: 0.1 });
    const k = extractFrameKinematics(frame);
    expect(k).not.toBeNull();
    expect(k.leftElbow).toBeGreaterThan(0);
    expect(k.rightElbow).toBeGreaterThan(0);
    expect(k.leftAnkle).toBeGreaterThan(0);
    expect(k.chestAperture).toBeGreaterThan(0);
    expect(k.shrug).toBeGreaterThan(0);
  });

  it('smoothes signals with Savitzky-Golay and fills dropout gaps', () => {
    const noisy = [100, 105, null, 110, 108, 112, 115, 120, null, 125];
    const smoothed = smoothSeries(noisy, 5);
    expect(smoothed.length).toBe(noisy.length);
    expect(smoothed[2]).not.toBeNull();
    expect(smoothed[8]).not.toBeNull();
    expect(smoothed[4]).toBeGreaterThan(105);
    expect(smoothed[4]).toBeLessThan(115);
  });

  it('bridges extended 8-10 sample dropouts caused by camera motion or dim lighting', () => {
    // 25 samples with an 8-sample consecutive dropout (e.g. fast pan or lighting flare)
    const series = [150, 148, 146, 144, 142, null, null, null, null, null, null, null, null, 126, 124, 122, 120, 118, 116, 114, 112, 110, 108, 106, 104];
    const smoothed = smoothSeries(series, 7);
    expect(smoothed.length).toBe(series.length);
    // None of the internal dropout samples should remain null
    for (let i = 0; i < series.length; i++) {
      expect(smoothed[i]).not.toBeNull();
      expect(Number.isFinite(smoothed[i])).toBe(true);
    }
    // Monotonic descent preserved across the bridged dropout
    expect(smoothed[5]).toBeLessThan(smoothed[4]);
    expect(smoothed[12]).toBeGreaterThan(smoothed[13]);
  });

  it('calculates SPARC motor smoothness', () => {
    const smoothSpeeds = Array.from({ length: 30 }, (_, i) => 20 * Math.sin((i / 30) * Math.PI));
    const score = calculateSPARC(smoothSpeeds);
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('analyzes isometric hold (plank) with TUT, stability, and breakdown timestamp', () => {
    const frames = [];
    const timestamps = [];
    // 10 seconds of plank: steady for 6 seconds, sags at 7s
    for (let i = 0; i < 150; i++) {
      const t = i / 15;
      timestamps.push(t);
      const sag = t > 6 ? 0.35 : 0;
      const f = mockLandmarkFrame();
      // Drop hips out of alignment at 6 seconds
      f[23].z += sag;
      f[24].z += sag;
      frames.push(f);
    }

    const res = analyzeIsometricHold(frames, timestamps, 'plank');
    expect(res.isIsometric).toBe(true);
    expect(res.tut).toBeCloseTo(9.9, 0);
    expect(res.count).toBe(10);
    expect(res.breakdownSec).toBeGreaterThanOrEqual(6.0);
    expect(res.breakdownSec).toBeLessThanOrEqual(7.5);
    expect(res.stabilityDeg).toBeGreaterThan(0);
  });

  it('detects calf raise repetitions via ankle channel', () => {
    const frames = [];
    const timestamps = [];
    // Generate 5 cyclic calf raises over 10 seconds (150 frames)
    for (let i = 0; i < 150; i++) {
      const t = i / 15;
      timestamps.push(t);
      // Oscillate ankle angle with 30 deg ROM
      const ankleZ = 0.15 + 0.12 * Math.sin((t / 2) * 2 * Math.PI);
      frames.push(mockLandmarkFrame({ ankleZ }));
    }

    const res = analyzeDynamicKinematics(frames, timestamps, 'standing_calf_raise');
    expect(res.count).toBeGreaterThanOrEqual(4);
    expect(res.count).toBeLessThanOrEqual(6);
    expect(res.dominantJoint).toContain('Ankle');
    expect(res.reps.length).toBe(res.count);
    expect(res.reps[0].romDegrees).toBeGreaterThan(12);
  });

  it('detects pec deck repetitions via chest aperture channel', () => {
    const frames = [];
    const timestamps = [];
    // Generate 4 cyclic chest flyes
    for (let i = 0; i < 150; i++) {
      const t = i / 15;
      timestamps.push(t);
      // Wrist aperture oscillates from wide (0.35) to narrow (0.05)
      const wristX = 0.20 + 0.15 * Math.sin((t / 2.5) * 2 * Math.PI);
      frames.push(mockLandmarkFrame({ wristX }));
    }

    const res = analyzeDynamicKinematics(frames, timestamps, 'pec_deck');
    expect(res.count).toBeGreaterThanOrEqual(3);
    expect(res.count).toBeLessThanOrEqual(5);
    expect(res.dominantJoint).toBe('chestAperture');
  });

  it('routes correctly in analyzeUniversalLandmarks', () => {
    const frames = Array.from({ length: 30 }, () => mockLandmarkFrame());
    const timestamps = Array.from({ length: 30 }, (_, i) => i / 15);

    const iso = analyzeUniversalLandmarks(frames, timestamps, 'wall_sit');
    expect(iso.isIsometric).toBe(true);

    const dyn = analyzeUniversalLandmarks(frames, timestamps, 'pec_deck');
    expect(dyn.isIsometric).toBeFalsy();
  });
});
