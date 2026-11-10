import { describe, it, expect } from 'vitest';
import { generateXRayComparison, type XRaySessionData } from '../biomechanicalXRay';

describe('Biomechanical X-Ray Progression Exporter', () => {
  it('correctly calculates clinical delta metrics and formats social badges', () => {
    const day1: XRaySessionData = {
      sessionId: 's_day1',
      date: '2026-10-01',
      label: 'Day 1 (Initial Screening)',
      romDegrees: 62,
      symmetryPct: 71,
      compensationCount: 7,
      keyframeJoints: [
        { jointName: 'Left Shoulder', angle: 62, status: 'compromised' },
      ],
    };

    const day30: XRaySessionData = {
      sessionId: 's_day30',
      date: '2026-10-31',
      label: 'Day 30 (Post-Rehab Follow-up)',
      romDegrees: 88,
      symmetryPct: 94,
      compensationCount: 0,
      keyframeJoints: [
        { jointName: 'Left Shoulder', angle: 88, status: 'optimal' },
      ],
    };

    const comparison = generateXRayComparison(
      'Shoulder External Rotation',
      'Rotation Externe Épaule',
      day1,
      day30
    );

    expect(comparison.deltaRomDegrees).toBe(26);
    expect(comparison.deltaSymmetryPct).toBe(23);
    expect(comparison.compensationsEliminated).toBe(7);
    expect(comparison.highlightBadgeFr).toContain('Mobilité +26°');
    expect(comparison.socialSharePayload.metricCallouts[0].value).toBe('+26°');
  });
});
