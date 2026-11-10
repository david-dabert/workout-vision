import { describe, it, expect } from 'vitest';
import {
  analyzeLumbopelvicRhythm,
  calculateTorsoPelvisAngle,
  Landmark3DCoord,
} from '../lumbopelvicRhythm';

function createNeutralSquatFrames(numFrames = 30): Landmark3DCoord[][] {
  const frames: Landmark3DCoord[][] = [];
  for (let i = 0; i < numFrames; i++) {
    // 0 = setup standing, 0.5 = turnaround bottom, 1.0 = lockout standing
    const progress = i < numFrames / 2
      ? i / (numFrames / 2)
      : (numFrames - 1 - i) / (numFrames / 2);

    const frame: Landmark3DCoord[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 0.95,
    }));

    // In neutral squat, spine maintains stable lumbar posture:
    // Shoulders (11, 12): lean forward slightly as hips descend
    const shoulderX = 0.52 + 0.05 * progress;
    const shoulderY = 0.25 + 0.15 * progress;
    frame[11] = { x: shoulderX, y: shoulderY, z: 0, visibility: 0.95 };
    frame[12] = { x: shoulderX, y: shoulderY, z: 0, visibility: 0.95 };

    // Hips (23, 24): descend and hinge backward
    const hipX = 0.48 - 0.04 * progress;
    const hipY = 0.55 + 0.22 * progress;
    frame[23] = { x: hipX, y: hipY, z: 0, visibility: 0.95 };
    frame[24] = { x: hipX, y: hipY, z: 0, visibility: 0.95 };

    // Knees (25, 26): track forward over toes
    const kneeX = 0.55 + 0.03 * progress;
    const kneeY = 0.78 + 0.04 * progress;
    frame[25] = { x: kneeX, y: kneeY, z: 0, visibility: 0.95 };
    frame[26] = { x: kneeX, y: kneeY, z: 0, visibility: 0.95 };

    frames.push(frame);
  }
  return frames;
}

function createButtWinkSquatFrames(numFrames = 30): Landmark3DCoord[][] {
  const frames: Landmark3DCoord[][] = [];
  for (let i = 0; i < numFrames; i++) {
    const isTurnaround = i >= 12 && i <= 18;
    const progress = i < numFrames / 2
      ? i / (numFrames / 2)
      : (numFrames - 1 - i) / (numFrames / 2);

    const frame: Landmark3DCoord[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 0.95,
    }));

    // In butt wink squat: at turnaround bottom (frames 12-18),
    // pelvis tucks under (retroversion): hip x shoots forward relative to knees,
    // while torso leans forward, creating severe lumbar flexion excursion.
    const shoulderX = isTurnaround ? 0.68 : 0.52 + 0.05 * progress;
    const shoulderY = 0.25 + 0.15 * progress;
    frame[11] = { x: shoulderX, y: shoulderY, z: isTurnaround ? -0.2 : 0, visibility: 0.95 };
    frame[12] = { x: shoulderX, y: shoulderY, z: isTurnaround ? -0.2 : 0, visibility: 0.95 };

    // Hip shifts forward under trunk at bottom turnaround (posterior pelvic tilt)
    const hipX = isTurnaround ? 0.72 : 0.48 - 0.04 * progress;
    const hipY = 0.55 + 0.25 * progress;
    frame[23] = { x: hipX, y: hipY, z: 0, visibility: 0.95 };
    frame[24] = { x: hipX, y: hipY, z: 0, visibility: 0.95 };

    // Knees stay back
    const kneeX = 0.52;
    const kneeY = 0.78 + 0.04 * progress;
    frame[25] = { x: kneeX, y: kneeY, z: 0, visibility: 0.95 };
    frame[26] = { x: kneeX, y: kneeY, z: 0, visibility: 0.95 };

    frames.push(frame);
  }
  return frames;
}

describe('lumbopelvicRhythm engine', () => {
  it('returns null on sparse or empty landmark inputs', () => {
    expect(analyzeLumbopelvicRhythm(null, null)).toBeNull();
    expect(analyzeLumbopelvicRhythm([], [])).toBeNull();
    expect(analyzeLumbopelvicRhythm([[ { x: 0.5, y: 0.5 } ]], [0])).toBeNull();
  });

  it('calculates torso-pelvis angle accurately', () => {
    // Standing upright: shoulder (0.5, 0.2), hip (0.5, 0.5), knee (0.5, 0.8)
    const shoulder: Landmark3DCoord = { x: 0.5, y: 0.2, z: 0 };
    const hip: Landmark3DCoord = { x: 0.5, y: 0.5, z: 0 };
    const knee: Landmark3DCoord = { x: 0.5, y: 0.8, z: 0 };

    const angle = calculateTorsoPelvisAngle(shoulder, hip, knee);
    expect(angle).not.toBeNull();
    expect(Math.round(angle!)).toBe(180);
  });

  it('evaluates neutral squat with high LSI and neutral tier', () => {
    const frames = createNeutralSquatFrames(30);
    const timestamps = frames.map((_, i) => i * 0.05); // 1.5s rep
    const res = analyzeLumbopelvicRhythm(frames, timestamps, 'squat', [
      { index: 1, startTime: 0, endTime: 1.45, inflectionTimestamp: 0.75 },
    ]);

    expect(res).not.toBeNull();
    if (!res) return;

    expect(res.buttWinkDetected).toBe(false);
    expect(res.lsiPercent).toBeGreaterThanOrEqual(85);
    expect(res.tier).toBe('neutral');
    expect(res.cueFr).toContain('Rachis lombaire neutre\u00A0:');
    expect(res.cueEn).toContain('Neutral lumbar spine:');
    expect(res.cueFr).not.toContain('\u2014');
    expect(res.cueEn).not.toContain('\u2014');
  });

  it('detects butt-wink flexion fault when pelvis posteriorly tilts at turnaround', () => {
    const frames = createButtWinkSquatFrames(30);
    const timestamps = frames.map((_, i) => i * 0.05);
    const res = analyzeLumbopelvicRhythm(frames, timestamps, 'squat', [
      { index: 1, startTime: 0, endTime: 1.45, inflectionTimestamp: 0.75 },
    ]);

    expect(res).not.toBeNull();
    if (!res) return;

    expect(res.buttWinkDetected).toBe(true);
    expect(res.tier).toBe('butt_wink_fault');
    expect(res.maxFlexionExcursionDeg).toBeGreaterThan(12);
    expect(res.lsiPercent).toBeLessThan(75);
    expect(res.cueFr).toContain('Flexion lombaire détectée au point bas\u00A0:');
    expect(res.cueEn).toContain('Lumbar flexion detected at turnaround:');
    expect(res.cueFr).not.toContain('\u2014');
    expect(res.cueEn).not.toContain('\u2014');
  });
});
