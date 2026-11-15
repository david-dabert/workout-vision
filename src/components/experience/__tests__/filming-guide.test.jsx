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

// Card 042 (15 November 2026): the screens give the angle and the framing only. The figures card 041 printed came
// from six rendered bodies per lift (test/real-phone/synth/synth.txt), which validate nothing (measures.js), R8.
const CLAIM = /exactes|Synth[eè]se|synth[eé]tique|Synthetic|synthetic|\b\d\/6\b/;

describe('filmingGuideFor (card 041, card 042)', () => {
  it('front (0°) for lateral_raise and overhead_press, with no figure', async () => {
    stubEnv();
    const { filmingGuideFor } = await import('../filming-guide');
    const lr = filmingGuideFor('lateral_raise', true);
    expect(lr.view).toBe('front');
    expect(lr.angleLabel).toBe('De face (0°)');
    expect(lr.framingLabel).toContain('tête aux hanches');
    expect(lr).not.toHaveProperty('evidenceNote');

    const ohp = filmingGuideFor('overhead_press', true);
    expect(ohp.view).toBe('front');
    expect(ohp.angleLabel).toBe('De face (0°)');
    expect(ohp).not.toHaveProperty('evidenceNote');
  });

  it('side (90°) for bicep_curl and squat, with no figure', async () => {
    stubEnv();
    const { filmingGuideFor } = await import('../filming-guide');
    const curl = filmingGuideFor('bicep_curl', true);
    expect(curl.view).toBe('side');
    expect(curl.angleLabel).toBe('De profil (90°)');
    expect(curl.framingLabel).toContain('bras qui travaille');

    const squat = filmingGuideFor('squat', true);
    expect(squat.view).toBe('side');
    expect(squat.angleLabel).toBe('De profil (90°)');
    expect(squat.framingLabel).toContain('corps entier');
    expect(squat).not.toHaveProperty('evidenceNote');
  });

  it('an exercise with no rendered-body check gets its angle and framing the same way, in both languages', async () => {
    stubEnv();
    const { filmingGuideFor } = await import('../filming-guide');
    const bench = filmingGuideFor('bench_press', true);
    expect(bench.angleLabel).toMatch(/^De (face|profil)/);
    const benchEn = filmingGuideFor('bench_press', false);
    expect(benchEn.angleLabel).toMatch(/^(Front|Side)/);
    expect(JSON.stringify([bench, benchEn])).not.toMatch(CLAIM);
  });
});

describe('Guide & Film camera placement rendering (card 041, card 042)', () => {
  it('renders the angle and framing in the Guide focus view and on Film, and no figure', async () => {
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
    expect(guideHtml).not.toMatch(CLAIM);

    const filmHtml = renderToStaticMarkup(
      <LanguageProvider>
        <Film lift="lateral_raise" onBack={() => {}} onFile={() => {}} onLive={() => {}} onChangeLift={() => {}} />
      </LanguageProvider>,
    );
    expect(filmHtml).toContain('data-testid="film-filming-note"');
    expect(filmHtml).toContain('De face (0°)');
    expect(filmHtml).not.toMatch(CLAIM);
  });
});
