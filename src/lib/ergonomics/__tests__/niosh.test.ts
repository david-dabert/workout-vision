import { describe, it, expect } from 'vitest';
import * as niosh from '../niosh';
import { calculateNioshLifting, frequencyMultiplier, couplingMultiplier, extractNioshParametersFromLandmarks } from '../niosh';

const base = { loadWeightKg: 15, horizontalDistanceCm: 25, verticalOriginCm: 75, verticalTravelDistanceCm: 25, asymmetryAngleDeg: 0 };

// Honesty pass of 14 October 2026 (ERG-1, ERG-3, ERG-4): the published equation and its domain, no invented L5/S1.
describe('the revised NIOSH lifting equation (Waters et al. 1993)', () => {
  it('gives LC = 23 kg at the reference lift, and a nominal LI below 1', () => {
    const r = calculateNioshLifting(base);
    expect(r.recommendedWeightLimitKg).toBe(23);
    expect(r.liftingIndexLI).toBe(0.65);
    expect(r.riskCategory).toBe('nominal');
  });
  it('multiplies HM = 25/H, VM, DM, AM as published', () => {
    const r = calculateNioshLifting({ loadWeightKg: 25, horizontalDistanceCm: 50, verticalOriginCm: 30, verticalTravelDistanceCm: 60, asymmetryAngleDeg: 45 });
    expect(r.horizontalMultiplierHM).toBe(0.5);
    expect(r.verticalMultiplierVM).toBe(0.865);
    expect(r.distanceMultiplierDM).toBe(0.895);
    expect(r.asymmetricMultiplierAM).toBe(0.856);
    expect(r.recommendedWeightLimitKg).toBe(7.6);
    expect(r.riskCategory).toBe('high');
    expect(r.lowest).toBe('HM');
  });
  it('puts a reach beyond 63 cm, a height or travel beyond 175 cm, a twist beyond 135° outside the equation', () => {
    for (const k of [{ horizontalDistanceCm: 65 }, { verticalOriginCm: 180 }, { verticalTravelDistanceCm: 180 }, { asymmetryAngleDeg: 140 }]) {
      const r = calculateNioshLifting({ ...base, ...k });
      expect(r.recommendedWeightLimitKg).toBe(0);
      expect(r.liftingIndexLI).toBeNull();
      expect(r.riskCategory).toBe('outside');
      expect(r.outside.length).toBe(1);
    }
  });
  it('reads the frequency and coupling tables', () => {
    expect(frequencyMultiplier(0.2, 'short', 50)).toBe(1);
    expect(frequencyMultiplier(1, 'short', 50)).toBe(0.94);
    expect(frequencyMultiplier(1, 'moderate', 50)).toBe(0.88);
    expect(frequencyMultiplier(1, 'long', 50)).toBe(0.75);
    expect(frequencyMultiplier(9, 'long', 50)).toBe(0);
    expect(frequencyMultiplier(9, 'long', 80)).toBe(0.15);
    expect(frequencyMultiplier(16, 'short', 80)).toBe(0);
    expect(couplingMultiplier('fair', 50)).toBe(0.95);
    expect(couplingMultiplier('fair', 80)).toBe(1);
    expect(couplingMultiplier('poor', 80)).toBe(0.9);
    const r = calculateNioshLifting({ ...base, frequencyLiftsPerMin: 4, duration: 'long', couplingQuality: 'poor' });
    expect(r.frequencyMultiplierFM).toBe(0.45);
    expect(r.recommendedWeightLimitKg).toBe(9.3);
  });
  it('offers no L5/S1 compression and no REBA score', () => {
    expect('calculateRebaScore' in niosh).toBe(false);
    expect('estimatedL5S1CompressionNewtons' in calculateNioshLifting(base)).toBe(false);
  });
});

describe('reading H, V and A from a pose (experimental, used by no screen)', () => {
  it('returns null without a pose rather than fixed values', () => {
    expect(extractNioshParametersFromLandmarks([], 175)).toBeNull();
  });
  it('scales a synthetic side pose by the person’s height', () => {
    const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    landmarks[11] = { x: 0.45, y: 0.25, z: 0 }; landmarks[12] = { x: 0.55, y: 0.25, z: 0 };
    landmarks[23] = { x: 0.47, y: 0.50, z: 0 }; landmarks[24] = { x: 0.53, y: 0.50, z: 0 };
    landmarks[27] = { x: 0.46, y: 0.85, z: 0 }; landmarks[28] = { x: 0.54, y: 0.85, z: 0 };
    landmarks[15] = { x: 0.50, y: 0.52, z: -0.1 }; landmarks[16] = { x: 0.50, y: 0.52, z: -0.1 };
    const e = extractNioshParametersFromLandmarks(landmarks, 175);
    expect(e!.verticalOriginCm).toBeGreaterThan(65);
    expect(e!.verticalOriginCm).toBeLessThan(85);
  });
});
