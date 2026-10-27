import { describe, it, expect } from 'vitest';
import {
  calculateRepHypertrophyDiagnostics,
  analyzeSetHypertrophy,
  TrajectorySample,
} from '../hypertrophyDiagnostics';
import { KINEMATIC_MACHINE_REGISTRY } from '../kinematicAliasing';

describe('Hypertrophy & Momentum Diagnostics Engine', () => {
  const pendulumProfile = KINEMATIC_MACHINE_REGISTRY.pendulum_squat;

  it('detects optimal stretch depth when reaching target knee flexion', () => {
    // Descent from 160° down to 72° (optimal stretch < 80°) over 2.5s, then ascend over 1.2s
    const samples: TrajectorySample[] = [
      { timestampMs: 0, jointAngle: 160 },
      { timestampMs: 600, jointAngle: 135 },
      { timestampMs: 1200, jointAngle: 105 },
      { timestampMs: 1800, jointAngle: 85 },
      { timestampMs: 2400, jointAngle: 72 }, // deep stretch reached
      { timestampMs: 2500, jointAngle: 72 }, // controlled pause
      { timestampMs: 3000, jointAngle: 110 },
      { timestampMs: 3600, jointAngle: 160 },
    ];

    const diag = calculateRepHypertrophyDiagnostics(samples, 1, pendulumProfile);

    expect(diag.stretchDepthScore).toBe(100);
    expect(diag.inStretchZone).toBe(true);
    expect(diag.isMomentumBounce).toBe(false);
    expect(diag.feedback.level).toBe('optimal');
  });

  it('detects partial depth and computes proportional shortfall penalty', () => {
    // Descent stops at 95° (missed 80° target stretch)
    const samples: TrajectorySample[] = [
      { timestampMs: 0, jointAngle: 160 },
      { timestampMs: 600, jointAngle: 135 },
      { timestampMs: 1200, jointAngle: 115 },
      { timestampMs: 1800, jointAngle: 96 },
      { timestampMs: 2200, jointAngle: 95 },
      { timestampMs: 2800, jointAngle: 130 },
      { timestampMs: 3400, jointAngle: 160 },
    ];

    const diag = calculateRepHypertrophyDiagnostics(samples, 1, pendulumProfile);

    expect(diag.inStretchZone).toBe(false);
    expect(diag.stretchDepthScore).toBeLessThan(100);
    expect(diag.feedback.cueFr).toContain('Zone d’étirement incomplète');
  });

  it('detects violent bottom turnaround bounce (elastic recoil)', () => {
    // Fast dive into turnaround and immediate violent rebound in < 100ms
    const samples: TrajectorySample[] = [
      { timestampMs: 0, jointAngle: 160 },
      { timestampMs: 400, jointAngle: 120 },
      { timestampMs: 700, jointAngle: 75 }, // rapid dive
      { timestampMs: 750, jointAngle: 115 }, // instant rebound > 800 deg/s^2
      { timestampMs: 1100, jointAngle: 160 },
    ];

    const diag = calculateRepHypertrophyDiagnostics(samples, 1, pendulumProfile);

    expect(diag.isMomentumBounce).toBe(true);
    expect(diag.turnaroundJerk).toBeGreaterThan(pendulumProfile.momentumJerkTolerance);
    expect(diag.feedback.cueFr).toContain('Rebond détecté');
  });

  it('aggregates set-level metrics and produces coaching takeaways', () => {
    const controlledRep: TrajectorySample[] = [
      { timestampMs: 0, jointAngle: 160 },
      { timestampMs: 600, jointAngle: 130 },
      { timestampMs: 1200, jointAngle: 100 },
      { timestampMs: 1800, jointAngle: 74 },
      { timestampMs: 2400, jointAngle: 74 },
      { timestampMs: 3000, jointAngle: 120 },
      { timestampMs: 3600, jointAngle: 160 },
    ];

    const reps = [{ samples: controlledRep }, { samples: controlledRep }];
    const report = analyzeSetHypertrophy(reps, pendulumProfile);

    expect(report.totalReps).toBe(2);
    expect(report.bounceCount).toBe(0);
    expect(report.avgStretchScore).toBe(100);
    expect(report.overallHypertrophyScore).toBeGreaterThanOrEqual(85);
    expect(report.primaryCoachingTakeawayFr).toContain('Excellente exécution');
  });
});
