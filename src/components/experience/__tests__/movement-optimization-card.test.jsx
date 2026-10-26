import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MovementOptimizationCard from '../MovementOptimizationCard';

vi.mock('../MovementOptimization.css', () => ({}));

describe('MovementOptimizationCard component', () => {
  it('renders awaiting reps state gracefully when reps array is empty', () => {
    const html = renderToStaticMarkup(
      <MovementOptimizationCard reps={[]} lift="squat" fr={false} />
    );
    expect(html).toContain('data-testid="movement-optimization-card"');
    expect(html).toContain('Awaiting Reps');
    expect(html).not.toContain('data-testid="vbt-profile-strip"');
  });

  it('renders movement metrics and VBT profile strip when reps are present', () => {
    const reps = [
      { index: 1, startTime: 1.0, endTime: 3.5, concentricSec: 1.0, eccentricSec: 1.5, romDegrees: 90, peakSpeed: 100, meanSpeed: 60 },
      { index: 2, startTime: 4.0, endTime: 6.8, concentricSec: 1.2, eccentricSec: 1.6, romDegrees: 88, peakSpeed: 100, meanSpeed: 60 },
      { index: 3, startTime: 7.5, endTime: 10.7, concentricSec: 1.6, eccentricSec: 1.6, romDegrees: 85, peakSpeed: 100, meanSpeed: 60 },
    ];

    const html = renderToStaticMarkup(
      <MovementOptimizationCard reps={reps} lift="squat" fr={false} />
    );

    expect(html).toContain('data-testid="movement-optimization-card"');
    expect(html).toContain('ROM Stretch Score');
    expect(html).toContain('Control &amp; Tempo');
    expect(html).toContain('Velocity Loss (VBT)');
    expect(html).toContain('Mechanical Work');
    expect(html).toContain('Time Under Tension (TUT)');
    expect(html).toContain('data-testid="vbt-profile-strip"');
    expect(html).toContain('data-testid="vbt-rep-1"');
    expect(html).toContain('data-testid="vbt-rep-2"');
    expect(html).toContain('data-testid="vbt-rep-3"');
    expect(html).toContain('Hypertrophic Stimulus Cues');
  });

  it('renders French labels and non-breaking space typography when fr=true', () => {
    const reps = [
      { index: 1, startTime: 1.0, endTime: 3.5, concentricSec: 1.0, eccentricSec: 2.0, romDegrees: 90, peakSpeed: 100, meanSpeed: 60 },
      { index: 2, startTime: 4.0, endTime: 7.0, concentricSec: 1.4, eccentricSec: 2.0, romDegrees: 89, peakSpeed: 100, meanSpeed: 60 },
    ];

    const html = renderToStaticMarkup(
      <MovementOptimizationCard reps={reps} lift="pendulum_squat" fr={true} />
    );

    expect(html).toContain('Optimisation Biomécanique');
    expect(html).toContain('Score d’amplitude (ROM)');
    expect(html).toContain('Profil de Vitesse par Répétition (VBT)');
    expect(html).toContain('Recommandations hypertrophie');
    expect(html).toContain('Moyenne\u00A0:');
  });
});
