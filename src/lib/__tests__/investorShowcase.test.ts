import { describe, it, expect, vi } from 'vitest';
import { InvestorShowcaseEngine } from '../investorShowcase';

describe('InvestorShowcaseEngine', () => {
  it('initializes and runs simulation frames through phases', () => {
    const frames: any[] = [];
    let completedSummary: any = null;

    const engine = new InvestorShowcaseEngine({
      targetReps: 2,
      repDurationMs: 100, // fast simulation for test
      playbackSpeed: 1.0,
      enableAudio: false,
      onFrame: (f) => frames.push(f),
      onComplete: (s) => {
        completedSummary = s;
      },
    });

    // Mock requestAnimationFrame
    vi.stubGlobal('requestAnimationFrame', (cb: any) => {
      setTimeout(cb, 16);
      return 1;
    });

    engine.start();
    expect(engine).toBeDefined();
    engine.stop();
  });

  it('computes correct biomechanical summary upon completion', () => {
    let summary: any = null;
    const engine = new InvestorShowcaseEngine({
      exerciseName: 'Barbell Back Squat',
      targetReps: 5,
      enableAudio: false,
      onComplete: (s) => {
        summary = s;
      },
    });

    // Directly call finish()
    (engine as any).finish();

    expect(summary).toBeDefined();
    expect(summary.exerciseName).toBe('Barbell Back Squat');
    expect(summary.totalReps).toBe(5);
    expect(summary.peakVelocityMps).toBeGreaterThan(0.5);
    expect(summary.bilateralSymmetryPercent).toBeGreaterThan(90);
    expect(summary.romConsistencyScore).toBeGreaterThan(90);
    expect(summary.depthQuality).toBe('full');
  });
});
