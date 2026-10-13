import { describe, it, expect } from 'vitest';
import {
  analyzeEquineGait,
  calculateBAI,
  calculateCircleLean,
  savitzkyGolay,
  type EquineFrame,
} from '../kinematics';

describe('Equine Gait Kinematics & Asymmetry Engine', () => {
  it('smooths 1D signals cleanly with Savitzky-Golay quadratic filtering', () => {
    const raw = [10, 10.5, 9.8, 10.2, 10.0, 9.9, 10.1, 10.0, 10.2, 10.1];
    const smoothed = savitzkyGolay(raw, 7);
    expect(smoothed).toHaveLength(raw.length);
    // Boundary values handled, interior smoothed
    expect(smoothed[4]).toBeCloseTo(10.0, 1);
  });

  it('computes Bilateral Asymmetry Index (Bishop 2018) accurately', () => {
    expect(calculateBAI(100, 100)).toBe(0);
    expect(calculateBAI(100, 80)).toBeCloseTo(-20, 1); // Left/D1 dominant
    expect(calculateBAI(80, 100)).toBeCloseTo(20, 1); // Right/D2 dominant
    expect(calculateBAI(0, 0)).toBe(0);
  });

  it('calculates circle centripetal lean angle based on Dyson & Greve (2016)', () => {
    // 10m radius lunge circle at 3.5 m/s trot
    // theta = arctan(3.5^2 / (9.80665 * 10)) = arctan(12.25 / 98.0665) = arctan(0.1249) ~ 7.12 degrees
    const lean = calculateCircleLean(10, 3.5);
    expect(lean).toBeGreaterThan(6.5);
    expect(lean).toBeLessThan(7.5);
  });

  it('identifies a clinically sound trot with near-zero asymmetry', () => {
    // Generate 3 seconds of sound equine trot at 30 FPS (90 frames)
    // Stride period = 700 ms (frequency ~ 1.43 Hz)
    const frames: EquineFrame[] = [];
    const fps = 30;
    const stridePeriodMs = 700;

    for (let i = 0; i < 90; i++) {
      const t = (i / fps) * 1000;
      // In a trot, withers oscillates twice per stride (sine wave with period = stridePeriodMs / 2)
      const phase = (2 * Math.PI * t) / (stridePeriodMs / 2);
      const withersY = 1.4 + 0.05 * Math.sin(phase); // symmetrical 5cm vertical oscillation
      const sacrumY = 1.35 + 0.04 * Math.sin(phase + Math.PI / 4);

      frames.push({
        timestamp: t,
        landmarks: {
          withers: { x: 0.5, y: withersY },
          sacrum: { x: 0.2, y: sacrumY },
        },
      });
    }

    const report = analyzeEquineGait(frames);
    expect(report.totalStrides).toBeGreaterThanOrEqual(2);
    expect(report.meanStrideFrequencyHz).toBeCloseTo(1.43, 0);
    expect(report.isClinicallySymmetric).toBe(true);
    expect(report.suspectedLamenessLimb).toBe('None');
    expect(report.meanWithersMinDiff).toBeLessThan(0.015);
    expect(Math.abs(report.meanWithersAsymmetryPct)).toBeLessThan(8.0);
  });

  it('detects left forelimb (LF) lameness via asymmetric withers head-nod', () => {
    // Simulate forelimb lameness: D1 (LF) has diminished range of motion and elevated head
    const frames: EquineFrame[] = [];
    const fps = 30;
    const stridePeriodMs = 700;

    for (let i = 0; i < 90; i++) {
      const t = (i / fps) * 1000;
      const strideProgress = (t % stridePeriodMs) / stridePeriodMs;

      // In D1 (first half of stride, LF stance), withers drops less (head elevated to offload weight)
      let withersY: number;
      if (strideProgress < 0.5) {
        // D1: restricted downward excursion (only 2cm drop)
        withersY = 1.4 + 0.02 * Math.sin((2 * Math.PI * strideProgress) / 0.5);
      } else {
        // D2: normal sound downward excursion (6cm drop)
        withersY = 1.4 + 0.06 * Math.sin((2 * Math.PI * (strideProgress - 0.5)) / 0.5);
      }

      frames.push({
        timestamp: t,
        landmarks: {
          withers: { x: 0.5, y: withersY },
          sacrum: { x: 0.2, y: 1.35 + 0.04 * Math.sin((4 * Math.PI * t) / stridePeriodMs) },
        },
      });
    }

    const report = analyzeEquineGait(frames);
    expect(report.totalStrides).toBeGreaterThanOrEqual(2);
    expect(report.isClinicallySymmetric).toBe(false);
    expect(report.suspectedLamenessLimb).toBe('LF');
    expect(Math.abs(report.meanWithersAsymmetryPct)).toBeGreaterThan(15.0);
  });

  it('gracefully handles insufficient frames', () => {
    const report = analyzeEquineGait([]);
    expect(report.totalStrides).toBe(0);
    expect(report.isClinicallySymmetric).toBe(true);
    expect(report.suspectedLamenessLimb).toBe('None');
  });
});
