import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MovementOptimizationCard from '../MovementOptimizationCard';

// These tests exercise the readings with their switch on (measures.js UNVALIDATED_BIOMECHANICS_SHOWN, off in the app since 11 November 2026).
vi.mock('../measures', async orig => ({ ...(await orig()), UNVALIDATED_BIOMECHANICS_SHOWN: true }));
vi.mock('../MovementOptimization.css', () => ({}));
vi.mock('../Replay.css', () => ({}));
vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const times = Array.from({ length: 61 }, (_, i) => i / 15);
const body = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));

describe('Intra-Set Velocity Loss Telemetry & Scrubber Sticking Pins', () => {
  describe('MovementOptimizationCard telemetry tile', () => {
    it('omits velocity loss metric when fewer than 2 reps are available', () => {
      const singleRep = [
        { index: 1, startTime: 1.0, endTime: 3.5, concentricSec: 1.0, eccentricSec: 1.5, romDegrees: 90 },
      ];
      const html = renderToStaticMarkup(
        <MovementOptimizationCard reps={singleRep} lift="squat" fr={false} />
      );
      expect(html).not.toContain('data-testid="velocity-loss-metric"');
    });

    it('renders velocity loss metric tile when multiple reps are provided', () => {
      const reps = [
        { index: 1, startTime: 1.0, endTime: 3.5, concentricSec: 1.0, eccentricSec: 1.5, romDegrees: 90 }, // 90 deg/s
        { index: 2, startTime: 4.0, endTime: 6.8, concentricSec: 1.25, eccentricSec: 1.5, romDegrees: 90 }, // 72 deg/s
        { index: 3, startTime: 7.5, endTime: 11.0, concentricSec: 1.5, eccentricSec: 1.5, romDegrees: 90 }, // 60 deg/s (33% loss)
      ];

      const htmlEn = renderToStaticMarkup(
        <MovementOptimizationCard reps={reps} lift="squat" fr={false} />
      );
      expect(htmlEn).toContain('data-testid="velocity-loss-metric"');
      expect(htmlEn).toContain('Intra-Set Velocity Decline');
      expect(htmlEn).toContain('33%');
      expect(htmlEn).toContain('Optimal velocity decline (33%): ideal hypertrophic stimulus zone.');

      const htmlFr = renderToStaticMarkup(
        <MovementOptimizationCard reps={reps} lift="squat" fr={true} />
      );
      expect(htmlFr).toContain('data-testid="velocity-loss-metric"');
      expect(htmlFr).toContain('Perte de vitesse intra-série');
      expect(htmlFr).toContain('33%');
      expect(htmlFr).toContain('Perte de vitesse optimale (33\u00A0%)\u00A0: zone idéale de stimulation musculaire.');
    });
  });

  describe('Replay scrubber sticking point pins', () => {
    it('renders rp-stickingpin elements on the scrubber line when concentric stall occurs', async () => {
      vi.stubGlobal('localStorage', { getItem: k => ({ wv_lang: 'fr' })[k] ?? null, setItem() {}, removeItem() {} });
      vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));

      const { LanguageProvider } = await import('../../../lib/LanguageContext');
      const { default: Replay } = await import('../Replay');

      // Trajectory with concentric stall:
      // 0.0 - 1.0s: descent 160 -> 80
      // 1.0 - 1.4s: fast ascent 80 -> 105
      // 1.4 - 1.8s: stall at 105 -> 107
      // 1.8 - 2.5s: lockout drive 107 -> 160
      const stallAngles = times.map(t => {
        if (t < 1.0) return 160 - t * 80;
        if (t < 1.4) return 80 + ((t - 1.0) / 0.4) * 25;
        if (t < 1.8) return 105 + ((t - 1.4) / 0.4) * 2;
        if (t <= 2.5) return 107 + ((t - 1.8) / 0.7) * 53;
        return 160;
      });

      const result = {
        count: 1,
        reps: [
          { index: 1, startTime: 0.0, endTime: 2.5, concentricSec: 1.5, eccentricSec: 1.0, romDegrees: 80 },
        ],
        arm: 'right',
        confidence: 0.9,
        timestamps: times,
        imageLandmarks: times.map(() => body),
        worldLandmarks: times.map(() => body),
        smoothedAngles: stallAngles,
        metadata: { duration: 4, width: 9, height: 16 },
      };

      const html = renderToStaticMarkup(
        <LanguageProvider>
          <Replay file={null} result={result} lift="squat" saved={1} onBack={() => {}} />
        </LanguageProvider>
      );

      expect(html).toContain('class="rp-line"');
      expect(html).toContain('data-testid="rp-stickingpin"');
      expect(html).toContain('rp-stickingpin');
      expect(html).toContain('106°');
    });
  });
});
