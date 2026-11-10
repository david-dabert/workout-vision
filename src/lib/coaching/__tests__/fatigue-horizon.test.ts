import { describe, it, expect } from 'vitest';
import { predictFatigueHorizon } from '../fatigueHorizon';

describe('predictFatigueHorizon', () => {
  it('returns fresh tier with default viable sets for minimal velocity loss on first set', () => {
    const res = predictFatigueHorizon([], 8.0, 'squat');
    expect(res.currentFatigueTier).toBe('fresh');
    expect(res.estimatedRemainingSets).toBeGreaterThanOrEqual(3);
    expect(res.recommendedRestSec).toBeGreaterThanOrEqual(120);
    expect(res.cueFr).toContain('Fraîcheur neuromusculaire élevée');
    expect(res.cueFr).toContain('\u00A0:');
    expect(res.cueEn).toContain('High neuromuscular freshness:');
  });

  it('progresses to high fatigue and prescribes extended rest when velocity loss exceeds 30%', () => {
    const history = [
      { setIndex: 1, repsCount: 8, velocityLossPercent: 12 },
      { setIndex: 2, repsCount: 8, velocityLossPercent: 20 },
    ];
    const res = predictFatigueHorizon(history, 32.0, 'squat');
    expect(res.currentFatigueTier).toBe('high_fatigue');
    expect(res.estimatedRemainingSets).toBe(1);
    expect(res.recommendedRestSec).toBeGreaterThanOrEqual(180);
    expect(res.cueFr).toContain('Accumulation de fatigue élevée');
    expect(res.cueFr).toContain('\u00A0:');
    expect(res.cueEn).toContain('High fatigue accumulation');
  });

  it('triggers exhausted tier when cumulative fatigue surpasses threshold', () => {
    const history = [
      { setIndex: 1, repsCount: 10, velocityLossPercent: 15 },
      { setIndex: 2, repsCount: 10, velocityLossPercent: 25 },
      { setIndex: 3, repsCount: 9, velocityLossPercent: 35 },
    ];
    const res = predictFatigueHorizon(history, 42.0, 'deadlift');
    expect(res.currentFatigueTier).toBe('exhausted');
    expect(res.estimatedRemainingSets).toBe(0);
    expect(res.cueFr).toContain('Seuil de fatigue neuromusculaire atteint');
    expect(res.cueFr).toContain('\u00A0:');
    expect(res.cueEn).toContain('Neuromuscular fatigue threshold reached');
  });

  it('scales base rest for isolation exercises compared to compound lifts', () => {
    const compound = predictFatigueHorizon([], 15.0, 'barbell_squat');
    const isolation = predictFatigueHorizon([], 15.0, 'bicep_curls');
    expect(isolation.recommendedRestSec).toBeLessThan(compound.recommendedRestSec);
  });
});
