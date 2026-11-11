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

  it('renders genuine kinematic movement metrics when reps are present', () => {
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
    expect(html).toContain('Time Under Tension (TUT)');
    expect(html).toContain('Hypertrophic Stimulus Cues');
    expect(html).not.toContain('Velocity Loss');
    expect(html).not.toContain('Mechanical Work');
    expect(html).not.toContain('S-MAS');
    expect(html).not.toContain('vbt-profile-strip');
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
    expect(html).toContain('Recommandations hypertrophie');
    expect(html).toContain('Moyenne\u00A0:');
    expect(html).not.toContain('Profil de Vitesse');
    expect(html).not.toContain('S-MAS');
  });

  it('renders path fidelity when continuous result with angles is provided', () => {
    const fps = 20;
    const dt = 1 / fps;
    const angles = [];
    const timestamps = [];

    let cur = 0;
    // 2 reps with a sticking stall on rep 2
    for (let r = 0; r < 2; r++) {
      // descent
      for (let t = 0; t <= 1.5; t += dt) {
        timestamps.push(cur);
        angles.push(170 - (t / 1.5) * 90);
        cur += dt;
      }
      if (r === 1) {
        // sticking stall
        for (let i = 0; i < 10; i++) {
          timestamps.push(cur);
          angles.push(110 + Math.sin(i));
          cur += dt;
        }
      }
      // ascent
      for (let t = 0; t <= 1.0; t += dt) {
        timestamps.push(cur);
        angles.push(80 + (t / 1.0) * 90);
        cur += dt;
      }
    }

    const mockResult = {
      count: 2,
      angles,
      timestamps,
      reps: [],
    };

    const html = renderToStaticMarkup(
      <MovementOptimizationCard reps={[]} lift="squat" fr={false} result={mockResult} />
    );

    expect(html).toContain('data-testid="movement-optimization-card"');
    expect(html).toContain('data-testid="form-fidelity-metric"');
    expect(html).toContain('Path Fidelity (experimental)');
    expect(html).not.toContain('data-testid="sticking-point-box"');

    const htmlFr = renderToStaticMarkup(
      <MovementOptimizationCard reps={[]} lift="squat" fr={true} result={mockResult} />
    );
    expect(htmlFr).toContain('Fidélité de trajectoire (expérimental)');
  });

  it('renders machine guidance banner and stretch hypertrophy metric for machine movements', () => {
    const reps = [
      { index: 1, startTime: 1.0, endTime: 3.5, concentricSec: 1.0, eccentricSec: 2.0, romDegrees: 90, peakSpeed: 100, meanSpeed: 60 },
      { index: 2, startTime: 4.0, endTime: 7.0, concentricSec: 1.2, eccentricSec: 2.0, romDegrees: 92, peakSpeed: 100, meanSpeed: 60 },
    ];

    const html = renderToStaticMarkup(
      <MovementOptimizationCard reps={reps} lift="pendulum_squat" fr={true} />
    );

    expect(html).toContain('data-testid="machine-profile-banner"');
    expect(html).toContain('Squat pendulaire');
    expect(html).toContain('Trajectoire pendulaire guidée');
    expect(html).toContain('data-testid="stretch-hypertrophy-metric"');
    expect(html).toContain('Tension d’étirement');
  });

  it('renders Coach Prescription card and Next-Set Cue banner with bilingual feedback', () => {
    const reps = [
      { index: 1, startTime: 1.0, endTime: 3.5, concentricSec: 1.0, eccentricSec: 2.0, romDegrees: 90, peakSpeed: 100, meanSpeed: 60 },
      { index: 2, startTime: 4.0, endTime: 7.0, concentricSec: 1.2, eccentricSec: 2.0, romDegrees: 92, peakSpeed: 100, meanSpeed: 60 },
    ];

    const htmlFr = renderToStaticMarkup(
      <MovementOptimizationCard reps={reps} lift="squat" fr={true} />
    );

    expect(htmlFr).toContain('data-testid="coach-prescription-card"');
    expect(htmlFr).toContain('Le Verdict du Coach');
    expect(htmlFr).not.toContain('data-testid="compliance-score"');
    expect(htmlFr).toContain('data-testid="next-set-prescription"');
    expect(htmlFr).toContain('Consigne pour la série suivante');
    expect(htmlFr).toContain('Focus mental\u00A0:');

    const htmlEn = renderToStaticMarkup(
      <MovementOptimizationCard reps={reps} lift="squat" fr={false} />
    );

    expect(htmlEn).toContain('The Coach’s Prescription');
    expect(htmlEn).toContain('Prescription for Set N+1');
    expect(htmlEn).toContain('Mental cue:');
  });

  it('renders Bilateral Symmetry, Dynamic Valgus, and Bar Path metrics when landmarks are provided in result', () => {
    // 20 frames with hips, knees, ankles, wrists
    const frames = [];
    const timestamps = [];
    for (let i = 0; i < 20; i++) {
      timestamps.push(i / 20);
      const frame = Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 }));

      // Shoulders (11, 12)
      frame[11] = { x: 0.45, y: 0.2, z: 0, visibility: 0.95 };
      frame[12] = { x: 0.55, y: 0.2, z: 0, visibility: 0.95 };

      // Left leg (23, 25, 27)
      frame[23] = { x: 0.4, y: 0.4, z: 0, visibility: 0.95 };
      frame[25] = { x: 0.4, y: 0.6, z: 0, visibility: 0.95 };
      frame[27] = { x: 0.4, y: 0.8, z: 0, visibility: 0.95 };

      // Right leg (24, 26, 28)
      frame[24] = { x: 0.6, y: 0.4, z: 0, visibility: 0.95 };
      frame[26] = { x: 0.6, y: 0.6, z: 0, visibility: 0.95 };
      frame[28] = { x: 0.6, y: 0.8, z: 0, visibility: 0.95 };

      // Wrists (15, 16) traveling vertically
      frame[15] = { x: 0.48, y: 0.7 - (i / 19) * 0.3, z: 0, visibility: 0.95 };
      frame[16] = { x: 0.52, y: 0.7 - (i / 19) * 0.3, z: 0, visibility: 0.95 };

      frames.push(frame);
    }

    const reps = [
      { index: 1, startTime: 0.1, endTime: 0.9, concentricSec: 0.4, eccentricSec: 0.4, romDegrees: 80, peakSpeed: 100, meanSpeed: 60 },
    ];

    const result = {
      worldLandmarks: frames,
      landmarks: frames,
      timestamps,
      angles: [160, 140, 100, 90, 120, 160],
    };

    const html = renderToStaticMarkup(
      <MovementOptimizationCard reps={reps} lift="squat" fr={false} result={result} />
    );

    expect(html).toContain('data-testid="bilateral-symmetry-metric"');
    expect(html).toContain('Bilateral Symmetry');
    expect(html).toContain('data-testid="dynamic-valgus-metric"');
    expect(html).toContain('Knee Valgus Stability');
    expect(html).toContain('data-testid="bar-path-metric"');
    expect(html).toContain('Axial Bar Path Efficiency');
    expect(html).toContain('data-testid="kinetic-sequencing-metric"');
    expect(html).toContain('Kinetic Chain Sequencing');
    expect(html).toContain('data-testid="lumbopelvic-stability-metric"');
    expect(html).toContain('Lumbopelvic Stability');
    expect(html).toContain('data-testid="barbell-tilt-metric"');
    expect(html).toContain('Barbell Planar Stability');
  });
});

