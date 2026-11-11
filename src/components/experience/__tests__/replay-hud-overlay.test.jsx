import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// These tests exercise the readings with their switch on (measures.js UNVALIDATED_BIOMECHANICS_SHOWN, off in the app since 11 November 2026).
vi.mock('../measures', async orig => ({ ...(await orig()), UNVALIDATED_BIOMECHANICS_SHOWN: true }));
vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const times = Array.from({ length: 61 }, (_, i) => i / 15);
const body = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
const rep = (i, t) => ({ index: i, startTime: t, endTime: t + 1.8, romDegrees: 92.4, concentricSec: 0.8, eccentricSec: 1, peakSpeed: 180, meanSpeed: 90 });
const counted = (extra = {}) => ({
  count: 2, reps: [rep(1, 0), rep(2, 2)], arm: 'right', confidence: 0.9, timestamps: times, imageLandmarks: times.map(() => body),
  worldLandmarks: times.map(() => body), smoothedAngles: times.map(() => 58), metadata: { duration: 4, width: 9, height: 16 }, ...extra,
});

async function renderReplay(lang, result, lift = 'bicep_curl', saved = result.count) {
  vi.stubGlobal('localStorage', { getItem: k => ({ wv_lang: lang })[k] ?? null, setItem() {}, removeItem() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: Replay } = await import('../Replay');
  return renderToStaticMarkup(<LanguageProvider><Replay file={null} result={result} lift={lift} saved={saved} onBack={() => {}} /></LanguageProvider>);
}

describe('Replay live clinical HUD overlay', () => {
  it('renders .rc-stage-hud and primary joint with target angle and delta badge when measured', async () => {
    const html = await renderReplay('fr', counted());
    expect(html).toContain('data-testid="rc-stage-hud"');
    expect(html).toContain('data-testid="rc-hud-primary"');
    expect(html).toContain('rc-hud-name">Coude<');
    expect(html).toContain('58° / 60°');
    expect(html).toContain('-2°');
    expect(html).toContain('is-ok');
  });

  it('renders target and delta in English when language is en', async () => {
    const html = await renderReplay('en', counted());
    expect(html).toContain('data-testid="rc-stage-hud"');
    expect(html).toContain('rc-hud-name">Elbow<');
    expect(html).toContain('58° / 60°');
  });

  it('marks out-of-tolerance deviation with is-off when delta exceeds 15 degrees', async () => {
    const offResult = counted({ smoothedAngles: times.map(() => 95) });
    const html = await renderReplay('fr', offResult);
    expect(html).toContain('data-testid="rc-hud-primary"');
    expect(html).toContain('95° / 60°');
    expect(html).toContain('+35°');
    expect(html).toContain('is-off');
  });

  it('hides .rc-stage-hud on flagged unsaved sets to uphold honesty invariant', async () => {
    const flaggedUnsaved = counted({ bodyCheck: { flagged: true, agreement: 0.2, second: null } });
    const html = await renderReplay('fr', flaggedUnsaved, 'bicep_curl', null);
    expect(html).not.toContain('data-testid="rc-stage-hud"');
  });

  it('renders multi-joint HUD items when clinical result.joints comparison is provided', async () => {
    const clinicalResult = counted({
      joints: [
        { name: 'Épaule' },
        { name: 'Coude' },
      ],
      reference: [[120, 120], [90, 90]],
      matched: [[115, 115], [92, 92]],
      seen: [[true, true], [true, true]],
    });
    const html = await renderReplay('fr', clinicalResult);
    expect(html).toContain('data-testid="rc-stage-hud"');
    expect(html).toContain('data-testid="rc-hud-Épaule"');
    expect(html).toContain('data-testid="rc-hud-Coude"');
  });
});
