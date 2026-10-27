import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const any = new Proxy(function stub() {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : any), apply: () => any, set: () => true });
  globalThis.window ??= { devicePixelRatio: 1, matchMedia: () => ({ matches: false }) };
  globalThis.document ??= { createElement: () => any };
});

import {
  computeLiveConcentricPower,
  extractLiveJointAngle,
  PHASE_LABELS,
} from '../Live';

describe('Live biomechanical telemetry & phase classification', () => {
  it('computes realistic concentric mechanical power and velocity for squats', () => {
    // Standard reference squat: ~66kg body displacement, 0.45m travel, 0.8s concentric
    const normal = computeLiveConcentricPower('squat', 0.8);
    expect(normal.powerWatts).toBeGreaterThan(300);
    expect(normal.powerWatts).toBeLessThan(500);
    expect(normal.velocityMs).toBeCloseTo(0.56, 1);

    // Fatigued rep: 1.6s concentric duration
    const fatigued = computeLiveConcentricPower('squat', 1.6);
    expect(fatigued.powerWatts).toBeLessThan(normal.powerWatts);
    expect(fatigued.velocityMs).toBeCloseTo(0.28, 1);
  });

  it('computes concentric mechanical power across diverse lift archetypes', () => {
    const deadlift = computeLiveConcentricPower('deadlift', 1.0);
    expect(deadlift.powerWatts).toBeGreaterThan(150);

    const bench = computeLiveConcentricPower('bench_press', 0.7);
    expect(bench.powerWatts).toBeGreaterThan(200);

    const curl = computeLiveConcentricPower('bicep_curl', 0.9);
    expect(curl.powerWatts).toBeGreaterThan(40);
  });

  it('provides bilingual labels for all 4 micro-sequence phases', () => {
    const phases = ['concentric', 'amortization_sticking', 'eccentric', 'lockout_rest'];
    for (const p of phases) {
      expect(PHASE_LABELS.fr[p]).toBeTruthy();
      expect(PHASE_LABELS.en[p]).toBeTruthy();
    }
    expect(PHASE_LABELS.fr.concentric).toBe('Propulsion');
    expect(PHASE_LABELS.fr.amortization_sticking).toBe('Point critique');
    expect(PHASE_LABELS.fr.eccentric).toBe('Descente');
  });

  it('extracts live joint angles accurately from 33 pose landmarks', () => {
    // Synthetic landmarks where knee is bent at 90 degrees
    const fakeLandmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
    // Hip (23): (0.5, 0.2)
    fakeLandmarks[23] = { x: 0.5, y: 0.2, visibility: 0.9 };
    // Knee (25): (0.5, 0.5)
    fakeLandmarks[25] = { x: 0.5, y: 0.5, visibility: 0.9 };
    // Ankle (27): (0.8, 0.5) -> horizontal shin, vertical thigh -> 90 degrees
    fakeLandmarks[27] = { x: 0.8, y: 0.5, visibility: 0.9 };

    const kneeAngle = extractLiveJointAngle(fakeLandmarks, { joint: 'knee' });
    expect(kneeAngle).toBeCloseTo(90, 0);

    // When landmarks are null, returns null
    expect(extractLiveJointAngle(null, { joint: 'knee' })).toBeNull();
  });
});
