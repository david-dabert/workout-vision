/**
 * The replay says only what the app measured and names only what it draws (second round of the honesty pass, 14 October
 * 2026): a set the body check flagged shows each rep's number alone until its count is saved, then its measures, as its
 * result, report, history and export do (saved-set.js keepsMeasures, R8; 24 October 2026); an exercise the core does
 * not offer lights no joint, and its legend names none.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { universalAsProposal } from '../../../lib/universalProposal';

vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const times = Array.from({ length: 61 }, (_, i) => i / 15);
const body = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
const rep = (i, t) => ({ index: i, startTime: t, endTime: t + 1.8, romDegrees: 92.4, concentricSec: 0.8, eccentricSec: 1, peakSpeed: 180, meanSpeed: 90 });
const counted = (extra = {}) => ({
  count: 2, reps: [rep(1, 0), rep(2, 2)], arm: 'right', confidence: 0.9, timestamps: times, imageLandmarks: times.map(() => body),
  worldLandmarks: times.map(() => body), smoothedAngles: times.map((_, i) => 90 + 40 * Math.sin(i / 5)), metadata: { duration: 4, width: 9, height: 16 }, ...extra,
});

async function replay(lang, result, lift = 'bicep_curl', saved = result.count) {
  vi.stubGlobal('localStorage', { getItem: k => ({ wv_lang: lang })[k] ?? null, setItem() {}, removeItem() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: Replay } = await import('../Replay');
  const html = renderToStaticMarkup(<LanguageProvider><Replay file={null} result={result} lift={lift} saved={saved} onBack={() => {}} /></LanguageProvider>);
  return { html, legend: html.match(/data-testid="rp-legend"[^>]*>(.*?)<\/p>/)[1], detail: html.match(/class="rp-detail"[^>]*>(.*?)<\/p>/)[1] };
}

describe('the replay of a counted set', () => {
  it('shows the rep\'s measures and names the angle in its chip, at the top left', async () => {
    const { html, legend, detail } = await replay('fr', counted());
    expect(html).toContain('data-testid="rp-angle"');
    expect(detail).toMatch(/92°/);
    expect(html).toContain('data-testid="rp-exp"');
    expect(legend).toContain('En doré, l’articulation dont l’angle compte les répétitions, et le trajet récent du poignet.');
    expect(legend).toContain('En haut à gauche, l’angle du coude, estimé en 3D : il peut différer de ce que montre l’image.');
    expect((await replay('en', counted())).legend).toContain('Top left, the elbow angle, estimated in 3D: it can differ from what the picture shows.');
  });
  it('a set the body check flagged, not yet saved: each rep\'s number alone, no angle, phase or time, and no word of an angle', async () => {
    const { html, legend, detail } = await replay('fr', counted({ bodyCheck: { flagged: true, agreement: 0.2, second: null } }), 'bicep_curl', null);
    expect(html).not.toContain('data-testid="rp-angle"');
    expect(html).not.toContain('data-testid="rp-exp"');
    expect(html).not.toMatch(/Concentrique|Excentrique|Pause/);
    expect(detail).toBe('Rép. 1');
    expect(legend).not.toMatch(/angle du coude|3D/);
  });
  it('the same set once its count is saved, confirmed or corrected: its measures, as the result shows them', async () => {
    for (const saved of [2, 3]) {
      const { html, detail } = await replay('fr', counted({ bodyCheck: { flagged: true, agreement: 0.2, second: null } }), 'bicep_curl', saved);
      expect(html).toContain('data-testid="rp-angle"');
      expect(html).toContain('data-testid="rp-exp"');
      expect(detail).toMatch(/92°/);
      // With the card's caution line, word for word.
      expect(html).toContain('data-testid="rp-doubted">À prendre avec précaution\u00A0: sur cette série, l’angle du coude ne bouge pas comme le reste de votre corps.</p>');
    }
    expect((await replay('en', counted({ bodyCheck: { flagged: true, agreement: 0.2, second: null } }), 'bicep_curl', 2)).html).toContain('Read with caution: in this set, the elbow angle does not move like the rest of your body.');
    // None before the answer, none on a set the check passed.
    expect((await replay('fr', counted({ bodyCheck: { flagged: true, agreement: 0.2, second: null } }), 'bicep_curl', null)).html).not.toContain('rp-doubted');
    expect((await replay('fr', counted(), 'bicep_curl', 2)).html).not.toContain('rp-doubted');
  });

  it('renders sticking point pins on the scrubber line when continuous angles are validated', async () => {
    const stallAngles = times.map(t => {
      if (t >= 0 && t <= 0.5) return 160 - (t / 0.5) * 55;
      if (t > 0.5 && t <= 1.2) return 105;
      if (t > 1.2 && t <= 1.8) return 105 - ((t - 1.2) / 0.6) * 45;
      return 60 + ((t - 1.8) / 0.6) * 100;
    });
    const { html } = await replay('fr', counted({ angles: stallAngles }), 'bicep_curl', 2);
    expect(html).toContain('class="rp-line"');
  });
});

describe('the replay of an exercise the core does not offer', () => {
  const read = { count: 9, dominantJoint: 'leftElbow', worldLandmarks: times.map(() => body), imageLandmarks: times.map(() => body), timestamps: times, metadata: { duration: 4 } };
  for (const lift of ['bent_over_rear_delt_raise', 'walking_lunge']) {
    it(`${lift}: no gold joint named, no angle, the skeleton said to be the app's estimate`, async () => {
      const { html, legend } = await replay('fr', universalAsProposal(read, lift), lift);
      expect(legend).toMatch(/^Le squelette est une estimation de l’appli\./);
      expect(legend).not.toMatch(/doré|angle/);
      expect(html).not.toContain('data-testid="rp-angle"');
      expect((await replay('en', universalAsProposal(read, lift), lift)).legend).toMatch(/^The skeleton is the app’s estimate\./);
    });
  }
});
