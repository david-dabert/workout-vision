import { describe, expect, it } from 'vitest';
import { computeClinicalTrend, type ClinicalSessionSummary } from '../clinicalTrendAnalysis';

describe('clinicalTrendAnalysis engine', () => {
  it('returns null on fewer than 2 sessions or invalid data', () => {
    expect(computeClinicalTrend([])).toBeNull();
    expect(computeClinicalTrend([{ date: '2026-11-01' }])).toBeNull();
    expect(
      computeClinicalTrend([
        { date: '2026-11-01', joints: [] },
        { date: '2026-11-02', joints: [] },
      ])
    ).toBeNull();
  });

  it('detects accelerated recovery trajectory when improvement is >= 10%', () => {
    const sessions: ClinicalSessionSummary[] = [
      {
        date: '2026-11-01',
        joints: [
          { name: 'shoulder', within: 0.65 },
          { name: 'elbow', within: 0.70 },
        ],
      },
      {
        date: '2026-11-08',
        joints: [
          { name: 'shoulder', within: 0.82 },
          { name: 'elbow', within: 0.85 },
        ],
      },
    ];

    const trend = computeClinicalTrend(sessions);
    expect(trend).not.toBeNull();
    expect(trend?.trajectory).toBe('ACCELERATED');
    expect(trend?.deltaPercent).toBeGreaterThanOrEqual(10);
    expect(trend?.improvingJoints).toContain('shoulder');
    expect(trend?.improvingJoints).toContain('elbow');
    expect(trend?.cueFr).toContain('Trajectoire accélérée');
    expect(trend?.cueFr).toContain('\u00A0:');
    expect(trend?.cueEn).toContain('Accelerated trajectory');
  });

  it('detects progressing trajectory when improvement is moderate (3% to 9%)', () => {
    const sessions: ClinicalSessionSummary[] = [
      {
        date: '2026-11-01',
        joints: [{ name: 'knee', within: 0.80 }],
      },
      {
        date: '2026-11-08',
        joints: [{ name: 'knee', within: 0.86 }],
      },
    ];

    const trend = computeClinicalTrend(sessions);
    expect(trend).not.toBeNull();
    expect(trend?.trajectory).toBe('PROGRESSING');
    expect(trend?.deltaPercent).toBe(6);
    expect(trend?.cueFr).toContain('Progression constante');
  });

  it('detects stabilized plateau when delta is between -3% and +2%', () => {
    const sessions: ClinicalSessionSummary[] = [
      {
        date: '2026-11-01',
        joints: [{ name: 'hip', within: 0.85 }],
      },
      {
        date: '2026-11-08',
        joints: [{ name: 'hip', within: 0.86 }],
      },
    ];

    const trend = computeClinicalTrend(sessions);
    expect(trend).not.toBeNull();
    expect(trend?.trajectory).toBe('STABILIZED');
    expect(trend?.cueFr).toContain('Plateau de consolidation');
  });

  it('detects regression and identifies lagging joints when score drops', () => {
    const sessions: ClinicalSessionSummary[] = [
      {
        date: '2026-11-01',
        joints: [
          { name: 'shoulder', within: 0.88 },
          { name: 'scapula', within: 0.80 },
        ],
      },
      {
        date: '2026-11-08',
        joints: [
          { name: 'shoulder', within: 0.87 },
          { name: 'scapula', within: 0.68 },
        ],
      },
    ];

    const trend = computeClinicalTrend(sessions);
    expect(trend).not.toBeNull();
    expect(trend?.trajectory).toBe('REGRESSING');
    expect(trend?.laggingJoints).toContain('scapula');
    expect(trend?.cueFr).toContain('Vigilance compensation');
  });
});
