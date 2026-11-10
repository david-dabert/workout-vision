import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MovementOptimizationCard from '../MovementOptimizationCard';

vi.mock('../MovementOptimization.css', () => ({}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Anthropometric Leverage Integration in MovementOptimizationCard', () => {
  it('renders long-femur leverage cues and stance width when athlete profile is calibrated', () => {
    const profile = {
      height: 184,
      weight: 82,
      sex: 'male',
      physique: 'v_taper',
    };

    vi.stubGlobal('localStorage', {
      getItem: k => (k === 'wv_athlete_profile' ? JSON.stringify(profile) : null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    const mockReps = [
      { start: 0, end: 2, peak: 1, duration: 2, range: 85, score: 92 },
      { start: 2, end: 4, peak: 3, duration: 2, range: 88, score: 95 },
    ];

    const html = renderToStaticMarkup(
      <MovementOptimizationCard reps={mockReps} lift="squat" fr={true} />
    );

    expect(html).toContain('data-testid="anthropometric-leverage-banner"');
    expect(html).toContain('1.09');
    expect(html).toContain('Fémurs longs');
    expect(html).toContain('Stance large');
    expect(html).toContain('20-25°');
  });

  it('renders compact-femur leverage cues for lifters with short femur ratios', () => {
    const profile = {
      height: 160,
      weight: 60,
      sex: 'female',
      physique: 'glute_curves',
    };

    vi.stubGlobal('localStorage', {
      getItem: k => (k === 'wv_athlete_profile' ? JSON.stringify(profile) : null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    const mockReps = [
      { start: 0, end: 2, peak: 1, duration: 2, range: 85, score: 92 },
    ];

    const html = renderToStaticMarkup(
      <MovementOptimizationCard reps={mockReps} lift="squat" fr={true} />
    );

    expect(html).toContain('data-testid="anthropometric-leverage-banner"');
    expect(html).toContain('0.94');
    expect(html).toContain('Fémurs courts');
    expect(html).toContain('Stance épaules');
  });
});
