import { describe, it, expect } from 'vitest';
import {
  analyzeBilateralKinematicSymmetry,
  Landmark3DCoord,
} from '../bilateralSymmetry';

describe('analyzeBilateralKinematicSymmetry', () => {
  it('returns null for empty, undefined, or insufficient landmark series', () => {
    expect(analyzeBilateralKinematicSymmetry(null, null)).toBeNull();
    expect(analyzeBilateralKinematicSymmetry([], [])).toBeNull();
    const shortFrames: Landmark3DCoord[][] = [[{ x: 0, y: 0, z: 0 }]];
    expect(analyzeBilateralKinematicSymmetry(shortFrames, [0])).toBeNull();
  });

  it('computes optimal symmetry score when bilateral angles are perfectly aligned', () => {
    // Generate 30 frames of identical left and right knee angles for squat
    const frames: Landmark3DCoord[][] = [];
    const timestamps: number[] = [];

    for (let i = 0; i < 30; i++) {
      const t = i / 30;
      timestamps.push(t);

      // Create a 33-landmark skeleton frame
      const frame: Landmark3DCoord[] = Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));

      // Left Knee (23 Hip, 25 Knee, 27 Ankle) - 90 degree angle
      frame[23] = { x: 0.45, y: 0.5, z: 0, visibility: 0.95 };
      frame[25] = { x: 0.45, y: 0.7, z: 0, visibility: 0.95 };
      frame[27] = { x: 0.55, y: 0.7, z: 0, visibility: 0.95 };

      // Right Knee (24 Hip, 26 Knee, 28 Ankle) - exactly symmetric 90 degree angle
      frame[24] = { x: 0.55, y: 0.5, z: 0, visibility: 0.95 };
      frame[26] = { x: 0.55, y: 0.7, z: 0, visibility: 0.95 };
      frame[28] = { x: 0.45, y: 0.7, z: 0, visibility: 0.95 };

      frames.push(frame);
    }

    const res = analyzeBilateralKinematicSymmetry(frames, timestamps, 'squat', [
      { index: 1, startTime: 0, endTime: 1.0, romDegrees: 85 },
    ]);

    expect(res).not.toBeNull();
    expect(res?.symmetryScore).toBe(100);
    expect(res?.meanDivergenceDeg).toBe(0);
    expect(res?.tier).toBe('optimal');
    expect(res?.cueFr).toContain('Symétrie bilatérale optimale (100\u00A0%)\u00A0:');
    expect(res?.cueEn).toContain('Optimal bilateral symmetry (100%):');
  });

  it('detects high asymmetry and unilateral compensation at sticking inflection', () => {
    const frames: Landmark3DCoord[][] = [];
    const timestamps: number[] = [];

    for (let i = 0; i < 30; i++) {
      const t = i / 30;
      timestamps.push(t);

      const frame: Landmark3DCoord[] = Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));

      // Left knee at ~90 deg (Hip (0.45, 0.5), Knee (0.45, 0.7), Ankle (0.55, 0.7))
      frame[23] = { x: 0.45, y: 0.5, z: 0, visibility: 0.95 };
      frame[25] = { x: 0.45, y: 0.7, z: 0, visibility: 0.95 };
      frame[27] = { x: 0.55, y: 0.7, z: 0, visibility: 0.95 };

      // Right knee: at frame 15 (t=0.5s), rotate tibia to 45 deg (Hip (0.55, 0.5), Knee (0.55, 0.7), Ankle (0.65, 0.6))
      const ankleY = i === 15 ? 0.6 : 0.7;
      frame[24] = { x: 0.55, y: 0.5, z: 0, visibility: 0.95 };
      frame[26] = { x: 0.55, y: 0.7, z: 0, visibility: 0.95 };
      frame[28] = { x: 0.65, y: ankleY, z: 0, visibility: 0.95 };

      frames.push(frame);
    }

    // Rep 1 from 0 to 1s with a sticking point inflection at 0.5s (frame 15)
    const sticking = [{ repIndex: 1, timestamp: 0.5 }];
    const res = analyzeBilateralKinematicSymmetry(frames, timestamps, 'squat', [
      { index: 1, startTime: 0, endTime: 1.0, romDegrees: 70 },
    ], sticking);

    expect(res).not.toBeNull();
    expect(res?.asymmetricStickingDivergence).toBe(true);
    expect(res?.tier).toBe('high_asymmetry');
    expect(res?.cueFr).toContain('Déséquilibre inter-membres détecté');
    expect(res?.cueFr).toContain('\u00A0:');
    expect(res?.cueEn).toContain('Inter-limb asymmetry detected');
    expect(res?.cueEn).toContain('inflection point');
  });

  it('switches to elbow kinematics when analyzing press movements', () => {
    const frames: Landmark3DCoord[][] = [];
    const timestamps: number[] = [];

    for (let i = 0; i < 15; i++) {
      timestamps.push(i / 15);
      const frame: Landmark3DCoord[] = Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));

      // Left Elbow (11 Shoulder, 13 Elbow, 15 Wrist)
      frame[11] = { x: 0.4, y: 0.3, z: 0, visibility: 0.95 };
      frame[13] = { x: 0.4, y: 0.5, z: 0, visibility: 0.95 };
      frame[15] = { x: 0.5, y: 0.5, z: 0, visibility: 0.95 };

      // Right Elbow (12 Shoulder, 14 Elbow, 16 Wrist)
      frame[12] = { x: 0.6, y: 0.3, z: 0, visibility: 0.95 };
      frame[14] = { x: 0.6, y: 0.5, z: 0, visibility: 0.95 };
      frame[16] = { x: 0.5, y: 0.5, z: 0, visibility: 0.95 };

      frames.push(frame);
    }

    const res = analyzeBilateralKinematicSymmetry(frames, timestamps, 'bench_press');
    expect(res).not.toBeNull();
    expect(res?.symmetryScore).toBeGreaterThanOrEqual(95);
  });
});
