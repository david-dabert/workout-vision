import { describe, it, expect } from 'vitest';
import {
  analyzeDynamicKneeValgus,
  LandmarkPoint,
} from '../dynamicValgus';

describe('analyzeDynamicKneeValgus', () => {
  it('returns null for empty, insufficient, or non-lower-body inputs', () => {
    expect(analyzeDynamicKneeValgus(null)).toBeNull();
    expect(analyzeDynamicKneeValgus([])).toBeNull();
    const short: LandmarkPoint[][] = [[{ x: 0, y: 0 }]];
    expect(analyzeDynamicKneeValgus(short)).toBeNull();
    expect(analyzeDynamicKneeValgus(Array(10).fill([]), null, 'bench_press')).toBeNull();
  });

  it('classifies safe alignment when knees track straight', () => {
    const frames: LandmarkPoint[][] = [];
    for (let i = 0; i < 20; i++) {
      const frame: LandmarkPoint[] = Array(33).fill(null).map(() => ({ x: 0, y: 0, visibility: 0.9 }));
      // Left leg collinear: Hip (0.4, 0.4), Knee (0.4, 0.6), Ankle (0.4, 0.8)
      frame[23] = { x: 0.4, y: 0.4, visibility: 0.95 };
      frame[25] = { x: 0.4, y: 0.6, visibility: 0.95 };
      frame[27] = { x: 0.4, y: 0.8, visibility: 0.95 };

      // Right leg collinear: Hip (0.6, 0.4), Knee (0.6, 0.6), Ankle (0.6, 0.8)
      frame[24] = { x: 0.6, y: 0.4, visibility: 0.95 };
      frame[26] = { x: 0.6, y: 0.6, visibility: 0.95 };
      frame[28] = { x: 0.6, y: 0.8, visibility: 0.95 };

      frames.push(frame);
    }

    const res = analyzeDynamicKneeValgus(frames, null, 'squat');
    expect(res).not.toBeNull();
    expect(res?.maxValgusDeg).toBe(0);
    expect(res?.valgusRiskFlag).toBe(false);
    expect(res?.tier).toBe('safe');
    expect(res?.cueFr).toContain('Alignement fémoro-tibial optimal');
    expect(res?.cueFr).toContain('\u00A0:');
    expect(res?.cueEn).toContain('Optimal femorotibial alignment');
  });

  it('detects severe medial knee collapse exceeding 12 degrees', () => {
    const frames: LandmarkPoint[][] = [];
    for (let i = 0; i < 20; i++) {
      const frame: LandmarkPoint[] = Array(33).fill(null).map(() => ({ x: 0, y: 0, visibility: 0.9 }));
      // Left leg: Hip (0.35, 0.3), Knee collapses medially to (0.44, 0.6), Ankle (0.35, 0.9)
      frame[23] = { x: 0.35, y: 0.3, visibility: 0.95 };
      frame[25] = { x: 0.44, y: 0.6, visibility: 0.95 };
      frame[27] = { x: 0.35, y: 0.9, visibility: 0.95 };

      // Right leg collinear: Hip (0.65, 0.3), Knee (0.65, 0.6), Ankle (0.65, 0.9)
      frame[24] = { x: 0.65, y: 0.3, visibility: 0.95 };
      frame[26] = { x: 0.65, y: 0.6, visibility: 0.95 };
      frame[28] = { x: 0.65, y: 0.9, visibility: 0.95 };

      frames.push(frame);
    }

    const res = analyzeDynamicKneeValgus(frames, null, 'squat');
    expect(res).not.toBeNull();
    expect(res?.maxValgusDeg).toBeGreaterThanOrEqual(12);
    expect(res?.valgusRiskFlag).toBe(true);
    expect(res?.severeRiskFlag).toBe(true);
    expect(res?.dominantSide).toBe('left');
    expect(res?.tier).toBe('severe');
    expect(res?.cueFr).toContain('Valgus dynamique prononcé');
    expect(res?.cueFr).toContain('\u00A0:');
    expect(res?.cueEn).toContain('Pronounced dynamic valgus');
  });
});
