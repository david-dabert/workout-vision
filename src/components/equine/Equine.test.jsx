import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./Equine.css', () => ({}));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function render(lang) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  const { LanguageProvider } = await import('../../lib/LanguageContext');
  const { default: Equine } = await import('./Equine');
  return renderToStaticMarkup(
    <LanguageProvider>
      <Equine onClose={() => {}} />
    </LanguageProvider>
  );
}

const decode = s => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

describe('EquiVision Equine Gait UI Component', () => {
  for (const lang of ['en', 'fr']) {
    it(`renders correctly with gait analysis elements in ${lang}`, async () => {
      const rawHtml = await render(lang);
      const html = decode(rawHtml);

      expect(html).toContain('EquiVision');
      expect(html).toContain('Veterinary AI');
      expect(html).toContain('data-testid="equine-screen"');
      expect(html).toContain('data-testid="scenario-sound"');
      expect(html).toContain('data-testid="scenario-forelimb"');
      expect(html).toContain('data-testid="scenario-hindlimb"');
      expect(html).toContain('data-testid="toggle-circle"');
      expect(html).toContain('Savitzky-Golay quadratic');
      expect(html).toContain('Dyson & Greve, 2016');
    });
  }
});
