import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./Ergonomics.css', () => ({}));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function render(lang) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  const { LanguageProvider } = await import('../../lib/LanguageContext');
  const { default: Ergonomics } = await import('./Ergonomics');
  return renderToStaticMarkup(
    <LanguageProvider>
      <Ergonomics onClose={() => {}} />
    </LanguageProvider>
  );
}

const decode = s => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

// Honesty pass of 14 October 2026 (ERG-1 to ERG-4): the published equation on typed values, no invented L5/S1.
describe('the NIOSH calculator', () => {
  for (const lang of ['en', 'fr']) {
    it(`shows the RWL, the LI with NIOSH's wording and the worked product, and no L5/S1 or compliance claim (${lang})`, async () => {
      const html = decode(await render(lang));
      expect(html).toContain('data-testid="ergonomics-screen"');
      expect(html).toContain('data-testid="ergo-li-value"');
      expect(html).toContain('data-testid="ergo-rwl-value"');
      expect(html).toContain('data-testid="ergo-product"');
      expect(html).toContain('data-testid="slider-load"');
      expect(html).toContain('data-testid="select-frequency"');
      expect(html).toContain('NIOSH');
      expect(html).not.toMatch(/L5\/S1|3[\s\u00A0\u202F,.]?400|Conforme|Compliant|RGPD|GDPR|Enterprise|HUD|Squelett|Skeletal|REBA/);
      // The screen opens on the example it highlights: palletising with a twist, LI 1.79.
      expect(html).toContain(lang === 'fr' ? '1,79' : '1.79');
    });
  }
});
