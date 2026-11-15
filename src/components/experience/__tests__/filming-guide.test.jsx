import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

function stubEnv(store = { wv_lang: 'fr' }) {
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        createRadialGradient: () => ({ addColorStop() {} }),
        fillRect() {},
      }),
    }),
  });
}

describe('filmingGuideFor (card 041, test/real-phone/synth/synth.txt)', () => {
  it('returns front (0°) and verified synthetic notes for lateral_raise and overhead_press', async () => {
    stubEnv();
    const { filmingGuideFor } = await import('../filming-guide');
    const lr = filmingGuideFor('lateral_raise', true);
    expect(lr.view).toBe('front');
    expect(lr.angleLabel).toBe('De face (0°)');
    expect(lr.framingLabel).toContain('tête aux hanches');
    expect(lr.synthMeasured).toBe(true);
    expect(lr.evidenceNote).toContain('6/6 exactes');
    expect(lr.evidenceNote).toContain('symétrie');

    const ohp = filmingGuideFor('overhead_press', true);
    expect(ohp.view).toBe('front');
    expect(ohp.angleLabel).toBe('De face (0°)');
    expect(ohp.synthMeasured).toBe(true);
    expect(ohp.evidenceNote).toContain('6/6 exactes');
  });

  it('returns side (90°) and verified synthetic notes for bicep_curl and squat', async () => {
    stubEnv();
    const { filmingGuideFor } = await import('../filming-guide');
    const curl = filmingGuideFor('bicep_curl', true);
    expect(curl.view).toBe('side');
    expect(curl.angleLabel).toBe('De profil (90°)');
    expect(curl.framingLabel).toContain('bras qui travaille');
    expect(curl.synthMeasured).toBe(true);
    expect(curl.evidenceNote).toContain('4/6 exactes');

    const squat = filmingGuideFor('squat', true);
    expect(squat.view).toBe('side');
    expect(squat.angleLabel).toBe('De profil (90°)');
    expect(squat.framingLabel).toContain('corps entier');
    expect(squat.synthMeasured).toBe(true);
    expect(squat.evidenceNote).toContain('4/6 exactes');
    expect(squat.evidenceNote).toContain('-15°');
  });

  it('discloses honestly when an exercise has no multi-angle synthetic measurement', async () => {
    stubEnv();
    const { filmingGuideFor } = await import('../filming-guide');
    const bench = filmingGuideFor('bench_press', true);
    expect(bench.synthMeasured).toBe(false);
    expect(bench.evidenceNote).toContain('aucune mesure multi-angle synthétique');

    const benchEn = filmingGuideFor('bench_press', false);
    expect(benchEn.synthMeasured).toBe(false);
    expect(benchEn.evidenceNote).toContain('no multi-angle synthetic measurement');
  });
});

describe('Guide & Film camera placement rendering (card 041)', () => {
  it('renders placement guidance in Guide focus view and on Film', async () => {
    stubEnv({ wv_lang: 'fr' });
    const [{ LanguageProvider }, { default: Guide }, { default: Film }] = await Promise.all([
      import('../../../lib/LanguageContext'),
      import('../Guide.jsx'),
      import('../Film.jsx'),
    ]);

    const guideHtml = renderToStaticMarkup(
      <LanguageProvider>
        <Guide lift="bicep_curl" onClose={() => {}} onChoose={() => {}} />
      </LanguageProvider>,
    );
    expect(guideHtml).toContain('data-testid="guide-filming-note"');
    expect(guideHtml).toContain('De profil (90°)');
    expect(guideHtml).toContain('4/6 exactes');

    const filmHtml = renderToStaticMarkup(
      <LanguageProvider>
        <Film lift="lateral_raise" onBack={() => {}} onFile={() => {}} onLive={() => {}} onChangeLift={() => {}} />
      </LanguageProvider>,
    );
    expect(filmHtml).toContain('data-testid="film-filming-note"');
    expect(filmHtml).toContain('De face (0°)');
    expect(filmHtml).toContain('6/6 exactes');
  });
});
