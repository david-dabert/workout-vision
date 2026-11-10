import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mockResult = {
  verdict: 'match',
  reasons: [],
  start: 0,
  end: 2,
  tempo: 0,
  reference: [[90, 95, 100]],
  matched: [[85, 90, 118]],
  seen: [[true, true, true]],
  path: [[0, 0], [1, 1], [2, 2]],
  joints: [
    {
      name: 'leftShoulder',
      direction: false,
      within: 0.8,
      gapP90: 12,
      rangeShare: 0.95,
      shown: 1.0,
      worst: { atSec: 1.2, gap: 18, reference: 100, attempt: 118 },
    },
  ],
  holds: [],
};

vi.mock('../ReferenceCompare.css', () => ({}));
vi.mock('../../../lib/haptics', () => ({ hapticLight: vi.fn() }));
vi.mock('../../../lib/reference/compare', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    buildReference: vi.fn(() => ({
      joints: [{ name: 'leftShoulder', kind: 'moving' }],
    })),
    compareAttempt: vi.fn(() => mockResult),
    curves: vi.fn(() => ({ leftShoulder: [90, 95, 100] })),
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('ComparisonView live HUD and collision-free cards', () => {
  it('renders clinical video HUD and structured joint cards with separated metrics', async () => {
    const { LanguageProvider } = await import('../../../lib/LanguageContext');
    const { default: ComparisonView } = await import('../ComparisonView');

    const mockPose = {
      width: 1920,
      height: 1080,
      aspect: 16 / 9,
      timestamps: [0, 1, 2],
      imageLandmarks: [
        [{ x: 0.5, y: 0.5, visibility: 0.9 }],
        [{ x: 0.5, y: 0.5, visibility: 0.9 }],
        [{ x: 0.5, y: 0.5, visibility: 0.9 }],
      ],
    };

    const html = renderToStaticMarkup(
      <LanguageProvider>
        <ComparisonView
          attPose={mockPose}
          refPose={mockPose}
          attUrl="blob:att"
          refUrl="blob:ref"
        />
      </LanguageProvider>
    );

    // Live HUD overlay over video stage
    expect(html).toContain('data-testid="rc-stage-hud"');
    expect(html).toContain('data-testid="rc-hud-leftShoulder"');
    expect(html).toContain('rc-hud-delta');

    // Joint metric cards
    expect(html).toContain('data-testid="rc-joint-leftShoulder"');
    expect(html).toContain('rc-joint-top');
    expect(html).toContain('rc-joint-metrics');
    expect(html).toContain('rc-go');
  });
});
