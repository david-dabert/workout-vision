import { describe, it, expect, beforeEach } from 'vitest';
import { IntelligentSpotter, type RepTelemetry } from '../intelligentSpotter';

describe('Intelligent Safety Spotter Engine', () => {
  let spotter: IntelligentSpotter;

  beforeEach(() => {
    spotter = new IntelligentSpotter();
  });

  it('recognizes fresh, clean repetitions and allows continuing', () => {
    const rep1: RepTelemetry = {
      repNumber: 1,
      concentricDurationMs: 800,
      eccentricDurationMs: 1500,
      meanConcentricVelocityDegPerSec: 120,
      bilateralAsymmetryDegrees: 2,
    };

    const decision = spotter.evaluateRep(rep1);
    expect(decision.shouldAbortSet).toBe(false);
    expect(decision.fatigueState).toBe('FRESH');
    expect(decision.injuryRisk).toBe('MINIMAL');
  });

  it('triggers warning on high velocity loss without compensation', () => {
    spotter.evaluateRep({
      repNumber: 1,
      concentricDurationMs: 800,
      eccentricDurationMs: 1500,
      meanConcentricVelocityDegPerSec: 120,
      bilateralAsymmetryDegrees: 2,
    });

    const rep4: RepTelemetry = {
      repNumber: 4,
      concentricDurationMs: 1200,
      eccentricDurationMs: 1600,
      meanConcentricVelocityDegPerSec: 85, // ~29% loss
      bilateralAsymmetryDegrees: 3,
    };

    const decision = spotter.evaluateRep(rep4);
    expect(decision.shouldAbortSet).toBe(false);
    expect(decision.fatigueState).toBe('HIGH_FATIGUE');
    expect(decision.injuryRisk).toBe('ELEVATED');
    expect(decision.audioCueFr).toContain('dernière répétition contrôlée');
  });

  it('triggers immediate critical abort when velocity loss combines with shrug sign compensation', () => {
    spotter.evaluateRep({
      repNumber: 1,
      concentricDurationMs: 800,
      eccentricDurationMs: 1500,
      meanConcentricVelocityDegPerSec: 120,
      bilateralAsymmetryDegrees: 2,
    });

    const failingRep: RepTelemetry = {
      repNumber: 6,
      concentricDurationMs: 1900,
      eccentricDurationMs: 1800,
      meanConcentricVelocityDegPerSec: 72, // 40% loss
      bilateralAsymmetryDegrees: 5,
      formViolations: ['shrug_sign'],
    };

    const decision = spotter.evaluateRep(failingRep);
    expect(decision.shouldAbortSet).toBe(true);
    expect(decision.fatigueState).toBe('NEUROMUSCULAR_FAILURE');
    expect(decision.injuryRisk).toBe('CRITICAL');
    expect(decision.audioCueFr).toContain('Arrêt recommandé');
    expect(decision.audioCueFr).toContain('compensation motrice');
  });

  it('triggers critical abort on severe lateral asymmetry drift', () => {
    spotter.evaluateRep({
      repNumber: 1,
      concentricDurationMs: 800,
      eccentricDurationMs: 1500,
      meanConcentricVelocityDegPerSec: 120,
      bilateralAsymmetryDegrees: 2,
    });

    const asymmetricRep: RepTelemetry = {
      repNumber: 5,
      concentricDurationMs: 950,
      eccentricDurationMs: 1600,
      meanConcentricVelocityDegPerSec: 110,
      bilateralAsymmetryDegrees: 14, // > 10 deg threshold
    };

    const decision = spotter.evaluateRep(asymmetricRep);
    expect(decision.shouldAbortSet).toBe(true);
    expect(decision.injuryRisk).toBe('CRITICAL');
    expect(decision.audioCueFr).toContain('déséquilibre latéral');
  });
});
