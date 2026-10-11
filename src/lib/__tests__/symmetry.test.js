import { describe, it, expect } from 'vitest';
import { analyzeBilateralSymmetry } from '../symmetry';

describe('Bilateral Symmetry Analysis', () => {
  function makeSyntheticBilateralFrame(leftAngleDeg, rightAngleDeg, vis = 0.99) {
    const frame = [];
    for (let i = 0; i < 33; i++) {
      frame.push({ x: 0, y: 0, z: 0, visibility: 0.1 });
    }
    // Left arm: shoulder=11, elbow=13, wrist=15
    const leftRad = (leftAngleDeg * Math.PI) / 180;
    frame[11] = { x: -0.2, y: -0.3, z: 0, visibility: vis };
    frame[13] = { x: -0.2, y: 0, z: 0, visibility: vis };
    frame[15] = { x: -0.2 + 0.3 * Math.sin(Math.PI - leftRad), y: 0.3 * Math.cos(Math.PI - leftRad), z: 0, visibility: vis };

    // Right arm: shoulder=12, elbow=14, wrist=16
    const rightRad = (rightAngleDeg * Math.PI) / 180;
    frame[12] = { x: 0.2, y: -0.3, z: 0, visibility: vis };
    frame[14] = { x: 0.2, y: 0, z: 0, visibility: vis };
    frame[16] = { x: 0.2 + 0.3 * Math.sin(Math.PI - rightRad), y: 0.3 * Math.cos(Math.PI - rightRad), z: 0, visibility: vis };

    return frame;
  }

  it('detects balanced bilateral symmetry on equal excursions', () => {
    const frames = [];
    const timestamps = [];
    const dt = 1 / 15;
    let t = 0;

    // 3 reps of equal 170° -> 60° (ROM = 110°)
    for (let rep = 0; rep < 3; rep++) {
      for (let i = 0; i < 15; i++) {
        const a = 170 - (110 * i) / 15;
        frames.push(makeSyntheticBilateralFrame(a, a));
        timestamps.push(t);
        t += dt;
      }
      for (let i = 0; i < 15; i++) {
        const a = 60 + (110 * i) / 15;
        frames.push(makeSyntheticBilateralFrame(a, a));
        timestamps.push(t);
        t += dt;
      }
    }

    const reps = [
      { index: 1, startTime: 0, endTime: 2, romDegrees: 110 },
      { index: 2, startTime: 2, endTime: 4, romDegrees: 110 },
      { index: 3, startTime: 4, endTime: 6, romDegrees: 110 },
    ];

    const result = analyzeBilateralSymmetry(frames, timestamps, 'bicep_curl', reps);
    expect(result).not.toBeNull();
    expect(result.symmetryScore).toBeGreaterThanOrEqual(95);
    expect(result.status).toBe('balanced');
  });

  it('detects notable asymmetry when one limb lags or has reduced ROM', () => {
    const frames = [];
    const timestamps = [];
    const dt = 1 / 15;
    let t = 0;

    // Left arm curls 170° -> 60° (ROM = 110°)
    // Right arm curls only 170° -> 90° (ROM = 80°) -> ~27% asymmetry
    for (let rep = 0; rep < 3; rep++) {
      for (let i = 0; i < 15; i++) {
        const aL = 170 - (110 * i) / 15;
        const aR = 170 - (80 * i) / 15;
        frames.push(makeSyntheticBilateralFrame(aL, aR));
        timestamps.push(t);
        t += dt;
      }
      for (let i = 0; i < 15; i++) {
        const aL = 60 + (110 * i) / 15;
        const aR = 90 + (80 * i) / 15;
        frames.push(makeSyntheticBilateralFrame(aL, aR));
        timestamps.push(t);
        t += dt;
      }
    }

    const reps = [
      { index: 1, startTime: 0, endTime: 2, romDegrees: 110 },
      { index: 2, startTime: 2, endTime: 4, romDegrees: 110 },
      { index: 3, startTime: 4, endTime: 6, romDegrees: 110 },
    ];

    const result = analyzeBilateralSymmetry(frames, timestamps, 'bicep_curl', reps);
    expect(result).not.toBeNull();
    expect(result.dominantSide).toBe('left');
    expect(result.asymmetryPct).toBeGreaterThanOrEqual(20);
    expect(result.status).toBe('notable_asymmetry');
  });

  it('returns null when the non-tracked limb is not visible (side view video)', () => {
    const frames = [];
    const timestamps = [];
    // Right arm has visibility 0.1
    for (let i = 0; i < 30; i++) {
      frames.push(makeSyntheticBilateralFrame(100, 100, 0.1));
      timestamps.push(i * 0.1);
    }
    const reps = [{ index: 1, startTime: 0, endTime: 2, romDegrees: 70 }];
    const result = analyzeBilateralSymmetry(frames, timestamps, 'bicep_curl', reps);
    expect(result).toBeNull();
  });
});
