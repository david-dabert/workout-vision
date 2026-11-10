import { describe, it, expect } from 'vitest';
import {
  analyzeKineticChainSequencing,
  Landmark3DCoord,
} from '../kineticChainSequencing';

function createCoordinatedSquatFrames(numFrames = 30): Landmark3DCoord[][] {
  const frames: Landmark3DCoord[][] = [];
  for (let i = 0; i < numFrames; i++) {
    const progress = i / (numFrames - 1); // 0 (bottom) to 1 (lockout)
    const frame: Landmark3DCoord[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 0.95,
    }));

    // Torso: upright (shoulder slightly forward of hip)
    // Shoulder (11): (0.52, 0.2 + 0.2 * progress)
    frame[11] = { x: 0.52, y: 0.4 - 0.2 * progress, z: 0, visibility: 0.95 };
    // Hip (23): (0.5, 0.55 - 0.15 * progress)
    frame[23] = { x: 0.5, y: 0.7 - 0.15 * progress, z: 0, visibility: 0.95 };
    // Knee (25): (0.58 - 0.08 * progress, 0.85)
    frame[25] = { x: 0.58 - 0.08 * progress, y: 0.85, z: 0, visibility: 0.95 };
    // Ankle (27): (0.5, 0.98)
    frame[27] = { x: 0.5, y: 0.98, z: 0, visibility: 0.95 };

    frames.push(frame);
  }
  return frames;
}

function createHipShootSquatFrames(numFrames = 30): Landmark3DCoord[][] {
  const frames: Landmark3DCoord[][] = [];
  for (let i = 0; i < numFrames; i++) {
    const progress = i / (numFrames - 1);
    const frame: Landmark3DCoord[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 0.95,
    }));

    // Severe torso forward lean: shoulder x is far from hip x -> inclination > 45 deg
    // Shoulder (11): forward x = 0.75, y stays low
    frame[11] = { x: 0.75, y: 0.6, z: 0, visibility: 0.95 };
    // Hip (23): shoots back x = 0.4, y stays around 0.65
    frame[23] = { x: 0.4, y: 0.65, z: 0, visibility: 0.95 };
    // Knee (25): extends prematurely from 0.65 to 0.50 rapidly in first half
    const kneeExt = Math.min(1, progress * 2);
    frame[25] = { x: 0.65 - 0.15 * kneeExt, y: 0.85, z: 0, visibility: 0.95 };
    // Ankle (27): (0.5, 0.98)
    frame[27] = { x: 0.5, y: 0.98, z: 0, visibility: 0.95 };

    frames.push(frame);
  }
  return frames;
}

describe('kineticChainSequencing engine', () => {
  it('returns null on sparse or empty landmark sets', () => {
    expect(analyzeKineticChainSequencing(null, null)).toBeNull();
    expect(analyzeKineticChainSequencing([], [])).toBeNull();
    expect(analyzeKineticChainSequencing([[ { x: 0.5, y: 0.5 } ]], [0])).toBeNull();
  });

  it('evaluates coordinated squat with high KSEI and optimal tier', () => {
    const frames = createCoordinatedSquatFrames(30);
    const timestamps = frames.map((_, i) => i * 0.05); // 1.5s duration
    const res = analyzeKineticChainSequencing(frames, timestamps, 'squat', [
      { index: 1, startTime: 0, endTime: 1.45, inflectionTimestamp: 0.2 },
    ]);

    expect(res).not.toBeNull();
    if (!res) return;

    expect(res.kseiPercent).toBeGreaterThanOrEqual(75);
    expect(res.hipShootDetected).toBe(false);
    expect(res.cueFr).toContain('Coordination proximodistale');
    expect(res.cueEn).toContain('Optimal proximal-to-distal sequencing');
    expect(res.cueFr).not.toContain('\u2014');
    expect(res.cueEn).not.toContain('\u2014');
  });

  it('detects hip shoot fault when knees extend prematurely with excessive torso forward inclination', () => {
    const frames = createHipShootSquatFrames(30);
    const timestamps = frames.map((_, i) => i * 0.05);
    const res = analyzeKineticChainSequencing(frames, timestamps, 'squat', [
      { index: 1, startTime: 0, endTime: 1.45, inflectionTimestamp: 0.1 },
    ]);

    expect(res).not.toBeNull();
    if (!res) return;

    expect(res.hipShootDetected).toBe(true);
    expect(res.tier).toBe('fault_detected');
    expect(res.cueFr).toContain('Décrochage pelvien détecté\u00A0:');
    expect(res.cueEn).toContain('Hip shoot detected:');
    expect(res.kseiPercent).toBeLessThan(75);
  });
});
