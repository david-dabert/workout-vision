import { describe, it, expect } from 'vitest';
import { calculateTrunkShift, analyzeAsymmetryAndTrunk } from '../asymmetryCoaching';

describe('Asymmetry Coaching & Trunk Stability Intelligence', () => {
  function makeSyntheticFrame(leftAngleDeg, rightAngleDeg, trunkTiltDeg = 0) {
    const frame = [];
    for (let i = 0; i < 33; i++) {
      frame.push({ x: 0, y: 0, z: 0, visibility: 0.95 });
    }

    // Shoulders (11, 12) and Hips (23, 24)
    // Lateral shift in radians
    const tiltRad = (trunkTiltDeg * Math.PI) / 180;
    const dx = Math.sin(tiltRad) * 0.5; // torso length 0.5m
    const dy = -Math.cos(tiltRad) * 0.5;

    // Hips centered at (0, 0)
    frame[23] = { x: -0.15, y: 0, z: 0, visibility: 0.95 };
    frame[24] = { x: 0.15, y: 0, z: 0, visibility: 0.95 };

    // Shoulders tilted
    frame[11] = { x: -0.15 + dx, y: dy, z: 0, visibility: 0.95 };
    frame[12] = { x: 0.15 + dx, y: dy, z: 0, visibility: 0.95 };

    // Arms for bilateral calculation
    const leftRad = (leftAngleDeg * Math.PI) / 180;
    frame[13] = { x: -0.2 + dx, y: dy + 0.25, z: 0, visibility: 0.95 };
    frame[15] = { x: -0.2 + dx + 0.25 * Math.sin(Math.PI - leftRad), y: dy + 0.25 + 0.25 * Math.cos(Math.PI - leftRad), z: 0, visibility: 0.95 };

    const rightRad = (rightAngleDeg * Math.PI) / 180;
    frame[14] = { x: 0.2 + dx, y: dy + 0.25, z: 0, visibility: 0.95 };
    frame[16] = { x: 0.2 + dx + 0.25 * Math.sin(Math.PI - rightRad), y: dy + 0.25 + 0.25 * Math.cos(Math.PI - rightRad), z: 0, visibility: 0.95 };

    return frame;
  }

  it('detects upright trunk stability with minimal lateral tilt', () => {
    const frames = [];
    const timestamps = [];
    for (let i = 0; i < 20; i++) {
      frames.push(makeSyntheticFrame(90, 90, 1.0)); // 1 degree sway
      timestamps.push(i / 15);
    }

    const shift = calculateTrunkShift(frames, timestamps);
    expect(shift).not.toBeNull();
    expect(shift.maxTrunkTiltDeg).toBeLessThan(3.0);
    expect(shift.hasShift).toBe(false);
  });

  it('detects significant lateral trunk shift when lifter leans under load', () => {
    const frames = [];
    const timestamps = [];
    for (let i = 0; i < 20; i++) {
      frames.push(makeSyntheticFrame(90, 90, 7.5)); // 7.5 degrees lean to the right
      timestamps.push(i / 15);
    }

    const shift = calculateTrunkShift(frames, timestamps);
    expect(shift).not.toBeNull();
    expect(shift.maxTrunkTiltDeg).toBeGreaterThanOrEqual(7.0);
    expect(shift.direction).toBe('right');
    expect(shift.hasShift).toBe(true);
  });

  it('generates rich actionable coaching advice when notable limb asymmetry exists', () => {
    const frames = [];
    const timestamps = [];
    let t = 0;
    const dt = 1 / 15;

    // 2 reps: Left has 110° ROM, Right has 80° ROM
    for (let rep = 0; rep < 2; rep++) {
      for (let i = 0; i < 15; i++) {
        const aL = 170 - (110 * i) / 15;
        const aR = 170 - (80 * i) / 15;
        frames.push(makeSyntheticFrame(aL, aR, 0));
        timestamps.push(t);
        t += dt;
      }
      for (let i = 0; i < 15; i++) {
        const aL = 60 + (110 * i) / 15;
        const aR = 90 + (80 * i) / 15;
        frames.push(makeSyntheticFrame(aL, aR, 0));
        timestamps.push(t);
        t += dt;
      }
    }

    const reps = [
      { index: 1, startTime: 0, endTime: 2, romDegrees: 110 },
      { index: 2, startTime: 2, endTime: 4, romDegrees: 110 },
    ];

    const res = analyzeAsymmetryAndTrunk(frames, timestamps, 'bicep_curl', reps);
    expect(res).not.toBeNull();
    expect(res.asymmetryPct).toBeGreaterThan(15);
    expect(res.dominantSide).toBe('left');
    expect(res.coaching.level).toBe('notable');
    expect(res.coaching.adviceFr).toContain('Asymétrie notable');
    expect(res.coaching.adviceFr).toContain('haltères');
    expect(res.coaching.adviceEn).toContain('Notable asymmetry');
    expect(res.coaching.adviceEn).toContain('dumbbell');
  });

  it('combines limb symmetry and trunk shift advice into cohesive guidance', () => {
    const frames = [];
    const timestamps = [];
    let t = 0;
    const dt = 1 / 15;

    // Balanced arms (110° ROM each) but 8° lateral trunk tilt to the left
    for (let rep = 0; rep < 2; rep++) {
      for (let i = 0; i < 15; i++) {
        const a = 170 - (110 * i) / 15;
        frames.push(makeSyntheticFrame(a, a, -8.0));
        timestamps.push(t);
        t += dt;
      }
      for (let i = 0; i < 15; i++) {
        const a = 60 + (110 * i) / 15;
        frames.push(makeSyntheticFrame(a, a, -8.0));
        timestamps.push(t);
        t += dt;
      }
    }

    const reps = [
      { index: 1, startTime: 0, endTime: 2, romDegrees: 110 },
      { index: 2, startTime: 2, endTime: 4, romDegrees: 110 },
    ];

    const res = analyzeAsymmetryAndTrunk(frames, timestamps, 'bicep_curl', reps);
    expect(res).not.toBeNull();
    expect(res.trunkShift.hasShift).toBe(true);
    expect(res.trunkShift.direction).toBe('left');
    expect(res.coaching.adviceFr).toContain('Décalage latéral du tronc');
    expect(res.coaching.adviceEn).toContain('Lateral trunk tilt');
  });
});
