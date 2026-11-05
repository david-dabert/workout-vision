import { describe, it, expect } from 'vitest';
import {
  formatShareText,
  generateShareCardSvg,
  BiomechanicalSummary,
} from '../biomechanicalShareCard';

describe('biomechanicalShareCard', () => {
  const sampleSummary: BiomechanicalSummary = {
    exerciseName: 'Squat avec barre',
    totalReps: 9,
    completedAt: '5 nov. 15:00',
    peakVelocityMps: 0.68,
    averageVelocityMps: 0.62,
    velocityLossPercent: 8.4,
    eccentricCadenceSec: 2.1,
    concentricCadenceSec: 0.9,
    bilateralSymmetryPercent: 98.2,
    romConsistencyScore: 96,
    depthQuality: 'full',
  };

  it('formats text summary with proper French typography and non-breaking spaces', () => {
    const text = formatShareText(sampleSummary);
    expect(text).toContain('WorkoutVision');
    expect(text).toContain('Squat avec barre');
    expect(text).toContain('9 (Profondeur complète)');
    expect(text).toContain('0.68 m/s');
    expect(text).toContain('8.4\u00A0%');
    expect(text).toContain('98.2\u00A0%');
    expect(text).toContain('100\u00A0% sur l’appareil');
    expect(text).toContain('https://david-dabert.github.io/workout-vision/');
  });

  it('generates an SVG share card containing all key metrics', () => {
    const svg = generateShareCardSvg(sampleSummary);
    expect(svg).toContain('<svg');
    expect(svg).toContain('WorkoutVision');
    expect(svg).toContain('Squat avec barre');
    expect(svg).toContain('0.68');
    expect(svg).toContain('8.4%');
    expect(svg).toContain('98.2%');
    expect(svg).toContain('WASM 60 FPS');
    expect(svg).toContain('100% On-Device AI • Zero Cloud • 100% Private');
  });

  it('adapts depth labels and fatigue tags correctly', () => {
    const fatiguedSummary: BiomechanicalSummary = {
      ...sampleSummary,
      velocityLossPercent: 24.5,
      depthQuality: 'parallel',
    };
    const text = formatShareText(fatiguedSummary);
    expect(text).toContain('Parallèle validée');
    expect(text).toContain('Proche de l’échec');
  });
});
