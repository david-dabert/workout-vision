import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.hoisted(() => {
  const any = new Proxy(function stub() {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : any), apply: () => any, set: () => true });
  globalThis.window ??= { devicePixelRatio: 1 };
  globalThis.document ??= { createElement: () => any };
  globalThis.navigator ??= { hardwareConcurrency: 8, vibrate: () => true };
});

import BiomechanicalRetentionQuiz from '../BiomechanicalRetentionQuiz';
import { LanguageProvider } from '../../../lib/LanguageContext';

vi.mock('../../../lib/storage', () => ({
  saveProfile: vi.fn().mockResolvedValue(true),
  getProfile: vi.fn().mockResolvedValue(null),
}));

function renderQuiz(props = {}, lang = 'fr') {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } });
  return renderToStaticMarkup(
    <LanguageProvider>
      <BiomechanicalRetentionQuiz onComplete={() => {}} onClose={() => {}} {...props} />
    </LanguageProvider>
  );
}

describe('BiomechanicalRetentionQuiz', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders intro screen with value proposition in French', () => {
    const html = renderQuiz({}, 'fr');
    expect(html).toContain('data-testid="bio-retention-quiz"');
    expect(html).toContain('Tirez le maximum de votre vidéo');
    expect(html).toContain('Analyse sur mesure');
    expect(html).toContain('data-testid="quiz-start-btn"');
    expect(html).toContain('Calibrer mon profil');
    expect(html).toContain('Leviers articulaires calculés');
  });

  it('renders intro screen in English', () => {
    const html = renderQuiz({}, 'en');
    expect(html).toContain('Get more out of your video');
    expect(html).toContain('Custom Analysis');
    expect(html).toContain('Calibrate my profile');
    expect(html).toContain('Joint levers computed');
  });

  it('has zero em-dashes in static output', () => {
    const htmlFr = renderQuiz({}, 'fr');
    const htmlEn = renderQuiz({}, 'en');
    expect(htmlFr).not.toContain('\u2014');
    expect(htmlEn).not.toContain('\u2014');
  });
});
