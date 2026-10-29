import { describe, it, expect } from 'vitest';
import {
  interpolateSubFrameInflection,
  estimateCameraAzimuthAngle,
  correctObliqueForeshortening,
  validatePhysiologicalPhaseDuration,
  Landmark3D,
} from '../subFrameInflection';

describe('SubFrameInflection & Multi-Angle Tracking', () => {
  it('interpolates exact sub-frame vertex for a symmetric parabolic peak', () => {
    // Parabola: y = -(t - 100)^2 + 150
    // at t = 66.66ms: y = -(66.66-100)^2 + 150 = 150 - 1111.5 = -961.5
    // Let's use simpler numbers: y = -0.01 * (t - 100)^2 + 120
    // t=67: y = -0.01 * (-33)^2 + 120 = 120 - 10.89 = 109.11
    // t=100: y = 120
    // t=133: y = 120 - 10.89 = 109.11
    const pPrev = { t: 67, y: 109.11 };
    const pCurr = { t: 100, y: 120 };
    const pNext = { t: 133, y: 109.11 };

    const vertex = interpolateSubFrameInflection(pPrev, pCurr, pNext);
    expect(vertex).not.toBeNull();
    expect(vertex?.isPeak).toBe(true);
    expect(vertex?.tPeak).toBeCloseTo(100, 0);
    expect(vertex?.yPeak).toBeCloseTo(120, 1);
    expect(vertex?.frameOffsetMs).toBeCloseTo(0, 0);
  });

  it('interpolates asymmetric sub-frame vertex occurring between frames', () => {
    // True vertex at t = 110ms with apex y = 125
    // Parabola: y(t) = -0.01 * (t - 110)^2 + 125
    // Frame at t=67: y = -0.01 * (67-110)^2 + 125 = 125 - 18.49 = 106.51
    // Frame at t=100: y = -0.01 * (100-110)^2 + 125 = 125 - 1 = 124.00 (discrete peak seen by camera)
    // Frame at t=133: y = -0.01 * (133-110)^2 + 125 = 125 - 5.29 = 119.71
    const pPrev = { t: 67, y: 106.51 };
    const pCurr = { t: 100, y: 124.0 };
    const pNext = { t: 133, y: 119.71 };

    const vertex = interpolateSubFrameInflection(pPrev, pCurr, pNext);
    expect(vertex).not.toBeNull();
    expect(vertex?.isPeak).toBe(true);
    // True mathematical apex occurred at t = 110ms, +10ms after frame 100
    expect(vertex?.tPeak).toBeCloseTo(110, 0);
    expect(vertex?.yPeak).toBeCloseTo(125, 1);
    expect(vertex?.frameOffsetMs).toBeCloseTo(10, 0);
  });

  it('interpolates concave valley at bottom turnaround (stretch apex)', () => {
    // Parabola: y(t) = 0.02 * (t - 515)^2 + 82 (e.g. 82 deg deep squat depth)
    // Frame at t=483: y = 0.02 * (483-515)^2 + 82 = 82 + 20.48 = 102.48
    // Frame at t=516: y = 0.02 * (516-515)^2 + 82 = 82 + 0.02 = 82.02
    // Frame at t=549: y = 0.02 * (549-515)^2 + 82 = 82 + 23.12 = 105.12
    const pPrev = { t: 483, y: 102.48 };
    const pCurr = { t: 516, y: 82.02 };
    const pNext = { t: 549, y: 105.12 };

    const vertex = interpolateSubFrameInflection(pPrev, pCurr, pNext);
    expect(vertex).not.toBeNull();
    expect(vertex?.isPeak).toBe(false); // Valley
    expect(vertex?.tPeak).toBeCloseTo(515, 0);
    expect(vertex?.yPeak).toBeCloseTo(82.0, 1);
  });

  it('returns null when points form a monotonic slope (not a turnaround)', () => {
    const pPrev = { t: 0, y: 100 };
    const pCurr = { t: 33, y: 90 };
    const pNext = { t: 66, y: 80 };

    const vertex = interpolateSubFrameInflection(pPrev, pCurr, pNext);
    expect(vertex).toBeNull();
  });

  it('estimates 3D camera azimuth angle from coronal shoulder and hip landmarks', () => {
    const mockLandmarks: Landmark3D[] = new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));

    // Pure profile (athlete facing side, shoulders aligned along Z axis)
    mockLandmarks[11] = { x: 0.5, y: 0.3, z: -0.2 };
    mockLandmarks[12] = { x: 0.5, y: 0.3, z: 0.2 };
    mockLandmarks[23] = { x: 0.5, y: 0.6, z: -0.15 };
    mockLandmarks[24] = { x: 0.5, y: 0.6, z: 0.15 };

    const azimuth = estimateCameraAzimuthAngle(mockLandmarks);
    // When dX is 0 and dZ is non-zero, azimuth is ~pi/2 (90 deg)
    expect(azimuth).toBeCloseTo(Math.PI / 2, 1);
  });

  it('compensates for 2D perspective foreshortening at oblique camera angles', () => {
    // 45 degree oblique angle = pi/4
    const observedAngle = 80; // Foreshortened 2D angle
    const corrected = correctObliqueForeshortening(observedAngle, Math.PI / 4);

    // True sagittal angle should be larger than foreshortened projection
    expect(corrected).toBeGreaterThan(observedAngle);
  });

  it('validates human physiological neuromuscular phase durations', () => {
    // 300ms concentric is biologically valid
    expect(validatePhysiologicalPhaseDuration(300, 'CONCENTRIC')).toBe(true);
    // 50ms concentric is camera noise/shake (impossible for a human under load)
    expect(validatePhysiologicalPhaseDuration(50, 'CONCENTRIC')).toBe(false);
  });
});
