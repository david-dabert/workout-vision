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

describe('Industrial Ergonomics UI Component', () => {
  for (const lang of ['en', 'fr']) {
    it(`renders correctly with NIOSH sliders and spinal compression metrics in ${lang}`, async () => {
      const rawHtml = await render(lang);
      const html = decode(rawHtml);

      expect(html).toContain('data-testid="ergonomics-screen"');
      expect(html).toContain('data-testid="ergo-li-value"');
      expect(html).toContain('data-testid="ergo-rwl-value"');
      expect(html).toContain('data-testid="slider-load"');
      expect(html).toContain('data-testid="slider-h"');
      expect(html).toContain('NIOSH');
      expect(html).toContain('L5/S1');
    });
  }
});
