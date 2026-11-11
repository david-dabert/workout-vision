// The unvalidated biomechanical readings stay off the result card while measures.js UNVALIDATED_BIOMECHANICS_SHOWN is
// false (11 November 2026: on David's 20 stored sets they read "critical" on nearly every set, whatever the exercise).
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MovementOptimizationCard from '../MovementOptimizationCard';
import { UNVALIDATED_BIOMECHANICS_SHOWN } from '../measures';

vi.mock('../MovementOptimization.css', () => ({}));
vi.mock('../BarPathTracer.css', () => ({}));

const lm = () => Array.from({ length: 33 }, (_, i) => ({ x: 0.4 + (i % 2) * 0.2, y: 0.1 + i * 0.02, z: 0, visibility: 0.99 }));
const frames = Array.from({ length: 40 }, lm);
const timestamps = frames.map((_, i) => i / 15);
const reps = [1, 2, 3].map(i => ({ index: i, startTime: i - 1, endTime: i - 0.1, concentricSec: 0.3 * i, eccentricSec: 0.5, romDegrees: 90 }));

describe('unvalidated biomechanical readings', () => {
  it('are switched off in the app', () => {
    expect(UNVALIDATED_BIOMECHANICS_SHOWN).toBe(false);
  });

  it('do not render on the result card, with landmarks and a declared height present', () => {
    globalThis.localStorage = { getItem: k => (k === 'wv_athlete_profile' ? JSON.stringify({ height: 180, weight: 80 }) : null), setItem() {}, removeItem() {} };
    const html = renderToStaticMarkup(<MovementOptimizationCard reps={reps} lift="squat" fr result={{ worldLandmarks: frames, imageLandmarks: frames, timestamps }} />);
    delete globalThis.localStorage;
    for (const id of ['velocity-loss-metric', 'bilateral-symmetry-metric', 'dynamic-valgus-metric', 'kinetic-sequencing-metric', 'lumbopelvic-stability-metric', 'barbell-tilt-metric', 'scapular-stability-metric', 'bar-path-metric', 'anthropometric-leverage-banner']) {
      expect(html, id).not.toContain(`data-testid="${id}"`);
    }
    expect(html).not.toContain('Ratio fémur/buste');
  });
});
