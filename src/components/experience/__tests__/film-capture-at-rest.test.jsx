import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../lift-scenes', () => ({
  createLiftScene: () => ({ destroy: () => {} }),
  hasFigure: () => false,
  liftView: () => null,
  topPose: () => null,
  restBox: () => ({ x: 0, y: 0, w: 100, h: 100 }),
}));

vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));
vi.mock('../Guide', () => ({ GuideFrames: () => null }));

vi.mock('../filming-guide', () => ({
  filmingGuideFor: () => ({
    view: 'side',
    framing: 'whole',
    angleLabel: 'Vue de profil',
    framingLabel: 'Corps entier',
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.doUnmock('../measures');
});

function stubBrowserEnv(lang = 'fr') {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  vi.stubGlobal('window', {
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  });
}

describe('Card 057: Film Screen Rest-Bounded Capture Flag', () => {
  it('does not display film-capture-at-rest pill when CAPTURE_AT_REST is false (default)', async () => {
    stubBrowserEnv('fr');
    const { LanguageProvider } = await import('../../../lib/LanguageContext');
    const { default: Film } = await import('../Film');

    const markup = renderToStaticMarkup(
      <LanguageProvider>
        <Film
          lift="squat"
          onBack={() => {}}
          onFile={() => {}}
          onLive={() => {}}
          onChangeLift={() => {}}
        />
      </LanguageProvider>
    );

    expect(markup).not.toContain('data-testid="film-capture-at-rest"');
  });

  it('displays film-capture-at-rest pill when CAPTURE_AT_REST is dynamically enabled', async () => {
    stubBrowserEnv('fr');
    vi.doMock('../measures', () => ({
      CAPTURE_AT_REST: true,
      MEASURES_SHOWN: true,
      experimentalLabel: () => 'Exp',
    }));

    const { LanguageProvider } = await import('../../../lib/LanguageContext');
    const { default: DynamicFilm } = await import('../Film');

    const markup = renderToStaticMarkup(
      <LanguageProvider>
        <DynamicFilm
          lift="squat"
          onBack={() => {}}
          onFile={() => {}}
          onLive={() => {}}
          onChangeLift={() => {}}
        />
      </LanguageProvider>
    );

    expect(markup).toContain('data-testid="film-capture-at-rest"');
    expect(markup).toContain('Capture calée au repos');
  });
});
