import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./CoachFinder.css', () => ({}));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function render(lang) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  const { LanguageProvider } = await import('../../lib/LanguageContext');
  const { default: CoachFinder } = await import('./CoachFinder');
  return renderToStaticMarkup(
    <LanguageProvider>
      <CoachFinder onClose={() => {}} />
    </LanguageProvider>
  );
}

const decode = s => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

describe('Coach & Physio Matcher UI Component', () => {
  for (const lang of ['en', 'fr']) {
    it(`renders correctly with city filters and verified coach profiles in ${lang}`, async () => {
      const rawHtml = await render(lang);
      const html = decode(rawHtml);

      expect(html).toContain('data-testid="coach-finder-screen"');
      expect(html).toContain('data-testid="city-paris"');
      expect(html).toContain('data-testid="city-london"');
      expect(html).toContain('data-testid="filter-rehab"');
      expect(html).toContain('Julien Mercier');
      expect(html).toContain('DPT');
    });
  }
});
