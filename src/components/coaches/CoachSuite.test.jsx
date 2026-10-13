import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./CoachSuite.css', () => ({}));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function render(lang) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  const { LanguageProvider } = await import('../../lib/LanguageContext');
  const { default: CoachSuite } = await import('./CoachSuite');
  return renderToStaticMarkup(
    <LanguageProvider>
      <CoachSuite onAddToProgramme={() => {}} onSelectClient={() => {}} />
    </LanguageProvider>
  );
}

const decode = s => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

describe('Coach Business OS & Suite Component', () => {
  for (const lang of ['en', 'fr']) {
    it(`renders all 4 tabs and workspace panels in ${lang}`, async () => {
      const rawHtml = await render(lang);
      const html = decode(rawHtml);

      expect(html).toContain('data-testid="coach-suite"');
      expect(html).toContain('data-testid="tab-clients"');
      expect(html).toContain('data-testid="tab-accounting"');
      expect(html).toContain('data-testid="tab-nutrition"');
      expect(html).toContain('data-testid="tab-physio"');
      expect(html).toContain('data-testid="section-clients"');
      expect(html).toContain('data-testid="btn-add-client"');
    });
  }
});
